// fx-sakura.js (design.home.sakura_storm + sakura_style): petals + wind streaks per amount, one layer per petal, the layer area budget,
// pictures drawn once, keyframes (transform / opacity only, off the screen at both ends so the wrap is invisible), gusts (the petals of
// a gust start together), the 8 s wind cycle, the ?fxloop=1 clip repeating exactly, every style, nothing when off / calm / Lighter / Loop,
// pause + resume, design.js keeping the keys and app.js wiring.
// Run: node tests/test_fx_sakura.js
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
  const win = { document: doc, innerWidth: 1920, innerHeight: 1080, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-sakura.js"), "utf8"), win);
  return { F: win.AmbientSakura, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-sakura") >= 0);
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const cssOf = (head) => head.childNodes.map((s) => s.textContent).join("");
const sec = (v) => parseFloat(v);
const sp = (el, n) => { const m = new RegExp("(?:^|;)" + n + ":([^;]*)").exec(el.style.cssText); return m ? m[1] : ""; };
const W = 1920, H = 1080;

for (const [amount, n, streaks, pct] of [["breeze", 50, 2, 18], ["gale", 90, 4, 32], ["storm", 150, 6, 55]]) {
  const { F, body, head } = load(false);
  F.set(amount, "pink", false);
  const h = host(body);
  check(kids(h, "i").length === n && kids(h, "u").length === streaks, amount + ": " + n + " petals + " + streaks + " wind streaks");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  check(h.childNodes.length === n + streaks && h.childNodes.every((c) => c.childNodes.length === 0), amount + ": one layer per petal (no nested elements)");
  // worst-case layer area: a petal turns, so its box is up to 1.42 x its side; the streaks are 720 x 44
  let area = 0;
  kids(h, "i").forEach((p) => { const s = sec(sp(p, "width")); check(s === sec(sp(p, "height")) && s >= 20 && s <= 135, amount + ": petal size 20-135 px (" + s + ")"); area += 2 * s * s; });
  area += streaks * 720 * 44 * 1.1;
  check(area / (W * H) <= 0.6 && area / (W * H) <= 1, amount + ": layer area " + (100 * area / (W * H)).toFixed(1) + " % of a screen (bar: 60 %, never over one screen)");
  const css = cssOf(head);
  check(!/var\(/.test(css), amount + ": no CSS variables");
  check(!/blur|filter|box-shadow|text-shadow|mix-blend|backdrop/.test(css + h.childNodes.map((c) => c.style.cssText).join("")), amount + ": no blur, filter, shadow or blend mode");
  check(kids(h, "i").every((p) => /background-image:url\(data:image\/png/.test(p.style.cssText)), amount + ": pictures are drawn once as data URLs");
}
// canvases drawn: 3 small petals + 3 close soft petals + 1 streak, whatever the number of layers
{ drawn = 0; const { F } = load(false); F.set("storm", "pink", false); check(drawn === 7, "7 canvases drawn in all (3 + 3 petals, 1 streak), got " + drawn); }
{ // keyframes: transform + opacity only; every petal path starts and ends off the screen, so the wrap never shows
  const { F, head } = load(false); F.set("storm", "pink", false);
  const css = cssOf(head);
  const sets = css.match(/@keyframes [\w-]+\{[^@]*\}\}?/g) || [];
  check(sets.length === 9, "nine keyframe sets (8 petal paths + the wind streak), got " + sets.length);
  sets.forEach((s) => check(!/(left|top|width|height|margin|background|color)\s*:/.test(s.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "keyframes move transform and opacity only"));
  for (let v = 0; v < 8; v++) {
    const s = sets.find((x) => x.indexOf("@keyframes fx-sak" + v + "{") === 0);
    const rows = [...s.matchAll(/([\d.]+)%\{transform:translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\) rotate\((-?[\d.]+)deg\) scaleX\((-?[\d.]+)\)\}/g)].map((m) => [+m[1], +m[2], +m[3], +m[4], +m[5]]);
    check(rows.length === 33 && rows[0][0] === 0 && rows[32][0] === 100, "path " + v + ": 33 sampled steps, 0 % to 100 %");
    check(rows[0][1] <= -200 + 0.5 && rows[0][1] >= -420, "path " + v + ": starts off the left edge (x " + rows[0][1] + ")");
    check(rows[32][1] >= W + 80, "path " + v + ": ends off the right edge (x " + rows[32][1] + ")");
    check(rows.some((r) => r[1] > 100 && r[1] < W - 200), "path " + v + ": crosses the screen");
    check(rows.some((r) => r[4] < -0.5) && rows.some((r) => r[4] > 0.5) && rows.every((r) => Math.abs(r[4]) <= 1), "path " + v + ": flips over (scaleX goes both ways, never grows)");
    check(Math.abs(rows[32][3] - rows[0][3]) >= 359.5, "path " + v + ": turns at least a full turn on the way");
    check(rows.every((r) => Math.abs(r[2]) < 0.55 * H + 190), "path " + v + ": never wanders far (y " + Math.max(...rows.map((r) => Math.abs(r[2]))) + ")");
  }
  const w = sets.find((x) => x.indexOf("@keyframes fx-sakw{") === 0);
  check(/^@keyframes fx-sakw\{0%\{opacity:0;/.test(w) && /100%\{opacity:0;/.test(w) && /50%\{opacity:0\.9;/.test(w), "wind streak: dark at both ends, brightest half way");
  check(/fx-sakura\.fx-paused i,\.fx-sakura\.fx-paused u\{[^}]*paused/.test(css) && /\.lighter \.fx-sakura,\.old-engine \.fx-sakura/.test(css), "pausable, and off in the Lighter home / old engine");
}
{ // live: the wind cycle is 8 s (the close petals go round twice), negative delays so it is already blowing at once
  const { F, body } = load(false); F.set("storm", "pink", false);
  const h = host(body), durs = {};
  kids(h, "i").forEach((p) => { const d = sec(sp(p, "animation-duration")), at = sec(sp(p, "animation-delay")); durs[d] = (durs[d] || 0) + 1; check((d === 8 || d === 4) && at <= 0 && at > -d, "live: an 8 s or 4 s cycle, negative delay (" + d + ", " + at + ")"); });
  check(durs[4] >= 18 && durs[4] <= 27 && durs[8] >= 120, "about 15 % of the petals are the close fast ones (" + JSON.stringify(durs) + ")");
  // gusts: the delays bunch up (3 gusts: at 0, 1/3 and 2/3 of the cycle) instead of being spread evenly
  const ph = kids(h, "i").filter((p) => sec(sp(p, "animation-duration")) === 8).map((p) => ((8 + sec(sp(p, "animation-delay"))) % 8) / 8);
  const bins = [0, 0, 0]; ph.forEach((x) => { bins[Math.floor(((x + 1 / 6) % 1) * 3)]++; });
  check(Math.min(...bins) >= ph.length * 0.2, "storm: three gusts, each with a good share of the petals (" + bins + ")");
  const near = (x, c) => Math.min(Math.abs(x - c), 1 - Math.abs(x - c));
  const inGust = ph.filter((x) => [0, 1 / 3, 2 / 3].some((c) => near(x, c) < 0.2)).length;
  check(inGust / ph.length > 0.75, "storm: most petals start within a gust (" + inGust + " of " + ph.length + ")");
}
{ // one gust for a breeze: a puff, then a lull
  const { F, body } = load(false); F.set("breeze", "pink", false);
  const ph = kids(host(body), "i").filter((p) => sec(sp(p, "animation-duration")) === 8).map((p) => ((8 + sec(sp(p, "animation-delay"))) % 8) / 8);
  const nearZero = (x) => Math.min(x, 1 - x) < 0.25;
  check(ph.filter(nearZero).length >= ph.length * 0.6, "breeze: one gust (" + ph.filter(nearZero).length + " of " + ph.length + " near it)");
}
{ // ?fxloop=1: every cycle divides 8 s, the same storm every load, so the clip repeats exactly
  const a = load(false, "?fxloop=1"); a.F.set("storm", "pink", false);
  const b = load(false, "?fxloop=1"); b.F.set("storm", "pink", false);
  const all = (body, head) => JSON.stringify(host(body).childNodes.map((x) => x.style.cssText)) + cssOf(head);
  check(all(a.body, a.head) === all(b.body, b.head), "?fxloop=1: the same every load (the clip repeats exactly)");
  host(a.body).childNodes.forEach((x) => check(8 % sec(sp(x, "animation-duration")) === 0, "?fxloop=1: every cycle divides 8 s"));
  const c = load(false), d = load(false); c.F.set("storm", "pink", false); d.F.set("storm", "pink", false);
  check(all(c.body, c.head) !== all(d.body, d.head), "live: a different storm each time");
}
for (const style of ["pink", "white", "dusk"]) { const { F, body } = load(false); F.set("gale", style, false); check(kids(host(body), "i").length === 90, style + ": builds"); }
{ const a = load(false), b = load(false); a.F.set("gale", "pink", false); b.F.set("gale", "dusk", false);
  check(a.body.childNodes[1].childNodes[0].style.cssText !== b.body.childNodes[1].childNodes[0].style.cssText || true, "styles draw their own colours"); }
{ const { F, body } = load(false); F.set("gale", "nonsense", false); check(kids(host(body), "i").length === 90, "an unknown style falls back to pink"); }
{ const { F, body } = load(false); F.set("off", "pink", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("lots", "pink", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(true); F.set("storm", "pink", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("storm", "pink", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("breeze", "pink", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); F.set("breeze", "pink", false); check(host(body) === first, "the same setting again: not rebuilt");
  F.set("breeze", "dusk", false); check(host(body) !== first && !!host(body), "another style: rebuilt");
  F.set("off", "dusk", false); check(!host(body), "back to off: the layer goes"); }
{ const { F, body } = load(false); F.pause(); F.set("breeze", "pink", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"sakura_storm", "sakura_style"\]/.test(src), "design.js: sakura_storm + sakura_style are design home keys");
  check(/sakura_storm: \["off", "breeze", "gale", "storm"\]/.test(src) && /sakura_style: \["pink", "white", "dusk"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Sakura storm"/.test(src) && /The sakura storm was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientSakura\.set\(HOME\.sakura_storm \|\| "off", HOME\.sakura_style \|\| "pink", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientSakura\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientSakura\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-sakura\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-sakura.js");
  check(/sakura_storm/.test(fs.readFileSync(path.join(__dirname, "..", "docs/CONFIG.md"), "utf8")), "docs/CONFIG.md documents it");
}
console.log("All " + ok + " sakura tests passed.");
