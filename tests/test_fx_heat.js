// fx-heat.js (design.home.heat + heat_style): ribbons per amount, the layer area budget, one picture per layer type drawn once, keyframes
// (transform / opacity only, dark at both ends so the loop is seamless, the sway closes on itself), the loop timing, every style,
// nothing when off / calm / Lighter / Loop, pause + resume, design.js keeping the keys and app.js wiring.
// Run: node tests/test_fx_heat.js
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
  const ctx = new Proxy({}, { get: (t, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? grad : (k in t ? t[k] : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
  let n = 0;
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = () => ctx; e.toDataURL = () => { drawn++; return "data:image/png;base64,AA" + (n++); }; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-heat.js"), "utf8"), win);
  return { F: win.AmbientHeat, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-heat") >= 0);
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const cssOf = (head) => head.childNodes.map((s) => s.textContent).join("");
const sec = (v) => parseFloat(v);

for (const [amount, n, pct] of [["light", 5, 59], ["medium", 7, 71], ["heavy", 10, 90]]) {
  const { F, body, head } = load(false);
  F.set(amount, "warm", false);
  const h = host(body);
  check(kids(h, "b").length === n && kids(h, "u").length === 1, amount + ": " + n + " ribbons + 1 glow layer");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  kids(h, "b").forEach((b) => check(kids(b, "i").length === 1, amount + ": one animated layer per ribbon"));
  const area = n * 200 * 640 + 1920 * 300;
  check(Math.abs(100 * area / (1920 * 1080) - pct) < 2 && area / (1920 * 1080) <= 1, amount + ": layer area about " + pct + " % of a screen (" + (100 * area / (1920 * 1080)).toFixed(1) + " %), never over one screen");
  const xs = kids(h, "b").map((b) => sec(b.style.left));
  check(new Set(xs).size === n && Math.min(...xs) > -200 && Math.max(...xs) < 1920, amount + ": ribbons all in different places across the screen");
  const css = cssOf(head);
  check(!/var\(/.test(css), amount + ": no CSS variables");
  check(!/blur|filter|box-shadow|text-shadow/.test(css), amount + ": no blur, filter or shadow");
  check(/background-image:url\(data:image\/png/.test(css), amount + ": pictures are drawn once as data URLs");
}
// canvases: 2 ribbon shapes + the glow, whatever the number of layers
{ drawn = 0; const { F } = load(false); F.set("heavy", "warm", false); check(drawn === 3, "3 canvases drawn in all (2 ribbons + glow), got " + drawn); }
{ // keyframes: transform + opacity only, dark at both ends, the sway closes so 100 % meets 0 %
  const { F, head } = load(false); F.set("heavy", "warm", false);
  const css = cssOf(head);
  const sets = css.match(/@keyframes [\w-]+\{[^@]*\}\}?/g) || [];
  check(sets.length === 4, "four keyframe sets (3 ribbon shapes + glow)");
  sets.forEach((s) => check(!/(left|top|width|height|margin|background)\s*:/.test(s.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "keyframes move transform and opacity only"));
  for (const name of ["fx-hea-0", "fx-hea-1", "fx-hea-2"]) {
    const s = sets.find((x) => x.indexOf("@keyframes " + name + "{") === 0);
    const rows = [...s.matchAll(/([\d.]+)%\{opacity:([\d.]+);transform:translate\((-?[\d.]+)px,(-?[\d.]+)px\) scaleX\(([\d.]+)\)\}/g)].map((m) => [+m[1], +m[2], +m[3], +m[4], +m[5]]);
    check(rows.length === 17, name + ": 17 sampled steps");
    check(rows[0][1] === 0 && rows[16][1] === 0, name + ": dark at 0 % and 100 % (seamless loop)");
    check(Math.abs(rows[0][2] - rows[16][2]) < 0.05 && Math.abs(rows[0][4] - rows[16][4]) < 0.01, name + ": the sway closes on itself (x and scale at 100 % = 0 %)");
    check(rows.every((r, k) => k === 0 || r[3] < rows[k - 1][3]), name + ": always rising");
    check(rows.some((r) => r[1] === 1) && rows.every((r) => r[1] >= 0 && r[1] <= 1), name + ": fades up to full and back");
  }
  check(/@keyframes fx-hea-glow\{0%,100%\{opacity:0\.62;transform:scaleY\(0\.9\)\}50%\{opacity:1;transform:scaleY\(1\.12\)\}\}/.test(css), "glow: breathes, same value at both ends");
  check(/fx-heat\.fx-paused i,\.fx-heat\.fx-paused u\{[^}]*paused/.test(css) && /\.lighter \.fx-heat,\.old-engine \.fx-heat/.test(css), "pausable, and off in the Lighter home / old engine");
}
{ // live: its own 8-12 s cycle per ribbon, started part-way
  const { F, body } = load(false); F.set("heavy", "warm", false);
  kids(host(body), "b").forEach((b) => { const i = kids(b, "i")[0], d = sec(i.style.animationDuration), at = sec(i.style.animationDelay); check(d >= 8 && d <= 12 && at <= 0 && at >= -d, "live: an 8-12 s cycle, negative delay (" + d + ", " + at + ")"); });
}
{ // ?fxloop=1: every cycle divides 8 s, fixed, repeats exactly
  const a = load(false, "?fxloop=1"); a.F.set("heavy", "warm", false);
  const b = load(false, "?fxloop=1"); b.F.set("heavy", "warm", false);
  const all = (body) => JSON.stringify(kids(host(body), "b").map((x) => { const i = kids(x, "i")[0]; return [x.className, x.style.left, x.style.transform, i.style.animationDuration, i.style.animationDelay]; }));
  check(all(a.body) === all(b.body), "?fxloop=1: the same every load (the clip repeats exactly)");
  const offs = kids(host(a.body), "b").map((x) => { const i = kids(x, "i")[0]; check(sec(i.style.animationDuration) === 8 && sec(i.style.animationDelay) <= 0 && sec(i.style.animationDelay) > -8, "?fxloop=1: ribbons on an 8 s cycle"); return ((8 + sec(i.style.animationDelay)) % 8).toFixed(2); });
  check(new Set(offs).size === 10, "?fxloop=1: the ribbons start at different moments (evenly staggered)");
  check(8 % sec(kids(host(a.body), "u")[0].style.animationDuration) === 0, "?fxloop=1: the glow cycle divides 8 s");
}
for (const style of ["warm", "clear", "ember"]) { const { F, body } = load(false); F.set("medium", style, false); check(kids(host(body), "b").length === 7, style + ": builds"); }
{ const { F, body } = load(false); F.set("medium", "nonsense", false); check(kids(host(body), "b").length === 7, "an unknown style falls back to warm"); }
{ const { F, body } = load(false); F.set("off", "warm", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("lots", "warm", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(true); F.set("heavy", "warm", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("heavy", "warm", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("light", "warm", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); F.set("light", "warm", false); check(host(body) === first, "the same setting again: not rebuilt");
  F.set("light", "ember", false); check(host(body) !== first && !!host(body), "another style: rebuilt");
  F.set("off", "ember", false); check(!host(body), "back to off: the layer goes"); }
{ const { F, body } = load(false); F.pause(); F.set("light", "warm", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"heat", "heat_style"\]/.test(src), "design.js: heat + heat_style are design home keys");
  check(/heat: \["off", "light", "medium", "heavy"\]/.test(src) && /heat_style: \["warm", "clear", "ember"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Heat shimmer"/.test(src) && /The heat shimmer was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientHeat\.set\(HOME\.heat \|\| "off", HOME\.heat_style \|\| "warm", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientHeat\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientHeat\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-heat\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-heat.js");
}
console.log("All " + ok + " heat tests passed.");
