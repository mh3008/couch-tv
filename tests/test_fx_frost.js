// fx-frost.js (design.home.frost + frost_style): corners / edge strips per amount, the layer area budget, one picture per layer drawn
// once, creep keyframes (transform / opacity only, no CSS variables, ease-out in small steps, dark at both ends so the loop is
// seamless), glints on the crystal tips, the loop timing, every style, nothing when off / calm / Lighter / Loop, pause + resume,
// design.js keeping the keys and app.js wiring.
// Run: node tests/test_fx_frost.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
let drawn = 0;
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas");
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  const grad = () => ({ addColorStop() {} });
  // any 2d call is a no-op; gradients have addColorStop
  const ctx = new Proxy({}, { get: (t, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? grad : (k in t ? t[k] : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
  let n = 0;
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = () => ctx; e.toDataURL = () => { drawn++; return "data:image/png;base64,AA" + (n++); }; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-frost.js"), "utf8"), win);
  return { F: win.AmbientFrost, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-frost") >= 0);
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const cssOf = (head) => head.childNodes.map((s) => s.textContent).join("");
const sec = (v) => parseFloat(v);
const corners = (h) => kids(h, "b").filter((b) => b.className.indexOf("e ") !== 0);
const edges = (h) => kids(h, "b").filter((b) => b.className.indexOf("e ") === 0);

for (const [amount, nc, ne, pct] of [["light", 2, 0, 38], ["medium", 4, 0, 76], ["heavy", 4, 2, 98]]) {
  const { F, body, head } = load(false);
  F.set(amount, "ice", false);
  const h = host(body);
  check(corners(h).length === nc && edges(h).length === ne, amount + ": " + nc + " corners, " + ne + " edge strips");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  check(new Set(corners(h).map((b) => b.className.split(" ")[0])).size === nc, amount + ": every corner different");
  corners(h).forEach((b) => check(kids(b, "i").length === 1 && kids(kids(b, "i")[0], "u").length === 6, amount + ": one frost layer + 6 glints per corner"));
  const area = nc * 760 * 520 + ne * 1920 * 120;
  check(Math.abs(100 * area / (1920 * 1080) - pct) < 2 && area / (1920 * 1080) <= 1, amount + ": layer area about " + pct + " % of a screen (" + (100 * area / (1920 * 1080)).toFixed(1) + " %), never over one screen");
  const css = cssOf(head);
  check(!/var\(/.test(css), amount + ": no CSS variables");
  check(!/blur|filter|box-shadow|text-shadow/.test(css), amount + ": no blur, filter or shadow");
  check(/background-image:url\(data:image\/png/.test(css), amount + ": pictures are drawn once as data URLs");
}
// one picture per layer type, drawn once: 2 corner variants + glint (+ strip when heavy), whatever the number of layers
{ drawn = 0; const { F } = load(false); F.set("medium", "ice", false); check(drawn === 3, "medium: 3 canvases drawn in all (2 corners + glint), got " + drawn);
  drawn = 0; const l2 = load(false); l2.F.set("heavy", "ice", false); check(drawn === 4, "heavy: 4 canvases (+ the rime strip), got " + drawn); }
{ // keyframes: transform + opacity only, dark at 0 % and 100 % (the loop seam), grows in small ease-out steps, thaws at the end
  const { F, head } = load(false); F.set("heavy", "ice", false);
  const css = cssOf(head);
  const sets = css.match(/@keyframes [\w-]+\{[^@]*\}\}?/g) || [];
  check(sets.length === 3, "three keyframe sets (grow, edge, twinkle)");
  sets.forEach((s) => check(!/(left|top|width|height|margin|background)\s*:/.test(s.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "keyframes move transform and opacity only"));
  for (const name of ["fx-frs-grow", "fx-frs-edge"]) {
    const s = sets.find((x) => x.indexOf("@keyframes " + name + "{") === 0);
    check(/^[^{]*\{0%\{opacity:0;/.test(s) && /98%\{opacity:0;/.test(s) && /100%\{opacity:0;/.test(s), name + ": dark at the start and again from 98 % (seamless loop)");
    const rows = [...s.matchAll(/(\d+)%\{opacity:([\d.]+);transform:(?:scale|scaleY)\(([\d.]+)\)/g)].map((m) => [+m[1], +m[2], +m[3]]);
    const grow = rows.filter((r) => r[0] >= 4 && r[0] <= 46);
    check(grow.length === 9, name + ": nine growth steps ");
    const steps = grow.slice(1).map((r, k) => r[2] - grow[k][2]);
    check(steps.every((d, k) => d > 0 && (k === 0 || d <= steps[k - 1] + 1e-9 || d < 0.2)), name + ": ease-out: every step grows, the steps shrink");
    check(grow[grow.length - 1][2] === 1 && grow[grow.length - 1][1] === 1, name + ": full size and full opacity at 46 %");
    check(rows.some((r) => r[0] === 86 && r[1] < 1) && rows.some((r) => r[0] === 72 && r[1] === 1), name + ": holds to 72 %, thaws after");
  }
  check(/@keyframes fx-frs-tw\{0%,100%\{opacity:0;transform:scale\(0\.3\) rotate\(-25deg\)\}50%\{opacity:1/.test(css), "glints: dark at both ends of their cycle");
  check(/fx-frost\.fx-paused i,\.fx-frost\.fx-paused u\{[^}]*paused/.test(css) && /\.lighter \.fx-frost,\.old-engine \.fx-frost/.test(css), "pausable, and off in the Lighter home / old engine");
}
{ // live: its own long cycle per corner (20-28 s), started part-way; glints 2.4-4.2 s on the crystal tips (inside the picture)
  const { F, body } = load(false); F.set("heavy", "ice", false);
  kids(host(body), "b").forEach((b) => { const d = sec(b.style.animationDuration), at = sec(b.style.animationDelay); check(d >= 20 && d <= 28 && at <= 0 && at >= -d, "live: a 20-28 s cycle, negative delay (" + d + ", " + at + ")"); });
  corners(host(body)).forEach((b) => kids(kids(b, "i")[0], "u").forEach((u) => {
    const d = sec(u.style.animationDuration); check(d >= 2.4 && d <= 4.2 && sec(u.style.animationDelay) <= 0, "live: a glint twinkles every 2.4-4.2 s");
    check(sec(u.style.left) >= 0 && sec(u.style.left) <= 760 && sec(u.style.top) >= 0 && sec(u.style.top) <= 520, "a glint sits inside its corner picture");
  }));
}
{ // ?fxloop=1: every cycle divides 8 s, fixed, repeats exactly
  const a = load(false, "?fxloop=1"); a.F.set("heavy", "ice", false);
  const b = load(false, "?fxloop=1"); b.F.set("heavy", "ice", false);
  const all = (body) => { const o = []; kids(host(body), "b").forEach((x) => { o.push([x.className, x.style.animationDuration, x.style.animationDelay]); const i = kids(x, "i")[0]; kids(i, "u").forEach((u) => o.push([u.style.left, u.style.top, u.style.animationDuration, u.style.animationDelay])); }); return JSON.stringify(o); };
  check(all(a.body) === all(b.body), "?fxloop=1: the same every load (the clip repeats exactly)");
  corners(host(a.body)).forEach((c) => {
    check(sec(c.style.animationDuration) === 8 && sec(c.style.animationDelay) <= 0 && sec(c.style.animationDelay) > -8, "?fxloop=1: corners on an 8 s cycle");
    kids(kids(c, "i")[0], "u").forEach((u) => check(8 % sec(u.style.animationDuration) === 0 && sec(u.style.animationDelay) <= 0, "?fxloop=1: a glint cycle that divides 8 s (" + u.style.animationDuration + ")"));
  });
  edges(host(a.body)).forEach((e) => check(sec(e.style.animationDuration) === 8, "?fxloop=1: edge strips on 8 s"));
  const offs = corners(host(a.body)).map((c) => ((8 + sec(c.style.animationDelay)) % 8).toFixed(2));
  check(new Set(offs).size === 4, "?fxloop=1: the corners start at different moments (" + offs.join(", ") + ")");
}
// styles
for (const style of ["ice", "aqua", "rose"]) { const { F, body } = load(false); F.set("medium", style, false); check(corners(host(body)).length === 4, style + ": builds"); }
{ const { F, body } = load(false); F.set("medium", "nonsense", false); check(corners(host(body)).length === 4, "an unknown style falls back to ice"); }
{ const { F, body } = load(false); F.set("off", "ice", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("lots", "ice", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(true); F.set("heavy", "ice", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("heavy", "ice", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("light", "ice", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); F.set("light", "ice", false); check(host(body) === first, "the same setting again: not rebuilt");
  F.set("light", "aqua", false); check(host(body) !== first && !!host(body), "another style: rebuilt");
  F.set("off", "aqua", false); check(!host(body), "back to off: the layer goes"); }
{ const { F, body } = load(false); F.pause(); F.set("light", "ice", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"frost", "frost_style"\]/.test(src), "design.js: frost + frost_style are design home keys");
  check(/frost: \["off", "light", "medium", "heavy"\]/.test(src) && /frost_style: \["ice", "aqua", "rose"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Frost"/.test(src) && /The frost was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientFrost\.set\(HOME\.frost \|\| "off", HOME\.frost_style \|\| "ice", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientFrost\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientFrost\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-frost\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-frost.js");
}
console.log("All " + ok + " frost tests passed.");
