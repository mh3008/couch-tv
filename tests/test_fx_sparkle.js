// fx-sparkle.js (design.home.sparkle + sparkle_where): how many glints each amount makes, sizes + the area budget, glints in the ground band
// or all over, hidden for most of the cycle so only a few glint at once, keyframes of transform / opacity only (no CSS variables, no filter,
// no blend), the 8 s loop, nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping + checking the keys.
// Run: node tests/test_fx_sparkle.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas");
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  const grad = () => ({ addColorStop() {} });
  const ctx = () => ({ createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {} });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,S"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-sparkle.js"), "utf8"), win);
  return { S: win.AmbientSparkle, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-sparkle") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");

for (const [amount, n] of [["few", 30], ["some", 60], ["many", 100]]) {
  const { S, body, head } = load(false);
  S.set(amount, "ground", false);
  const h = host(body), g = kids(h), css = allCss(head);
  check(g.length === n, amount + ": " + n + " glints");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = g.reduce((a, t) => { const s = num(t.style.cssText, "width"); check(s >= 0.7 && s <= 1.5, "a glint is 0.7-1.5 vw"); return a + Math.pow(s / 100 * 1920, 2); }, 0);
  check(area / (1920 * 1080) < 0.02, amount + ": all glints under 2 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(2) + " %)");
  check(g.every((t) => { const y = num(t.style.cssText, "top"); return y >= 62 && y <= 96; }), amount + ": ground: every glint in the lower part (62-96 %)");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
}
{ const { S, body } = load(false); S.set("many", "all", false);
  const ys = kids(host(body)).map((t) => num(t.style.cssText, "top"));
  check(ys.every((y) => y >= 5 && y <= 96) && Math.min(...ys) < 40, "all: glints over the whole picture (top " + Math.min(...ys).toFixed(0) + " %)"); }
{ const { S, body } = load(false); S.set("some", "sky", false);
  check(kids(host(body)).every((t) => num(t.style.cssText, "top") >= 62), "an unknown place: the ground"); }
{ const { S, head } = load(false); S.set("some", "ground", false);
  const css = allCss(head), kf = /@keyframes fx-glint\{([^@]*)\}/.exec(css)[1];
  check(/^0%,80%\{opacity:0;/.test(kf) && /94%,100%\{opacity:0;/.test(kf), "hidden for 80 % of the cycle and again from 94 %: a short glint");
  check(/87%\{opacity:1;transform:scale\(1\) rotate\(12deg\)\}/.test(kf), "the glint grows and turns a little at its peak");
  check(!/(left|top|width|height|margin|background)\s*:/.test(kf.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/\.fx-sparkle i\{[^}]*opacity:0;/.test(css), "a glint starts hidden");
  check(/fx-sparkle\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-sparkle,\.old-engine \.fx-sparkle/.test(css), "pausable, and off in the Lighter home / old engine"); }
{ const { S, body } = load(false); S.set("many", "ground", false);
  const d = kids(host(body)).map((t) => num(t.style.cssText, "-webkit-animation-duration"));
  check(d.every((x) => x >= 3 && x <= 7), "live: 3-7 s cycles");
  // the share of glints visible at any moment: the visible part of a cycle is 80-94 % = 14 %
  check(0.14 * d.length < 20, "only a handful glint at once (~" + Math.round(0.14 * d.length) + " of " + d.length + ")"); }
{ const { S, body } = load(false, "?fxloop=1"); S.set("many", "ground", false);
  const g = kids(host(body));
  check(g.every((t) => [4, 8].includes(num(t.style.cssText, "-webkit-animation-duration"))), "?fxloop=1: 4 or 8 s cycles (they divide the clip)");
  check(g.every((t) => { const at = num(t.style.cssText, "-webkit-animation-delay"), d = num(t.style.cssText, "-webkit-animation-duration"); return at <= 0 && at > -d; }), "?fxloop=1: delays inside one cycle"); }
{ const { S, body } = load(false); S.set("off", "ground", false); check(!host(body), "off: nothing on the page"); }
{ const { S, body } = load(false); S.set("blizzard", "ground", false); check(!host(body), "an unknown amount: nothing"); }
{ const { S, body } = load(true); S.set("many", "ground", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { S, body } = load(false); S.set("many", "ground", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { S, body } = load(false); S.set("some", "ground", false);
  S.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  S.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); S.set("some", "ground", false); check(host(body) === first, "the same setting again: not rebuilt");
  S.set("some", "all", false); check(host(body) !== first && host(body), "another place: rebuilt");
  S.set("off", "all", false); check(!host(body), "back to off: the layer goes"); }
{ const { S, body } = load(false); S.pause(); S.set("few", "ground", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"sparkle", "sparkle_where"\]/.test(src), "design.js: sparkle, sparkle_where are design home keys");
  check(/sparkle: \["off", "few", "some", "many"\], sparkle_where: \["ground", "all"\]/.test(src), "design.js: only the listed values");
  check(/out\.push\(\["Snow sparkle"/.test(src) && /The snow sparkle was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientSparkle\.set\(HOME\.sparkle \|\| "off", HOME\.sparkle_where \|\| "ground", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*sparkleSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientSparkle\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientSparkle\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-sparkle\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-sparkle.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { sparkle: "many", sparkle_where: "all" } }));
  check(out.home && out.home.sparkle === "many" && out.home.sparkle_where === "all", "sanitize keeps sparkle + sparkle_where");
  const bad = plain(D.sanitize({ home: { sparkle: "lots", sparkle_where: "sky" } }));
  check(!(bad.home && (bad.home.sparkle || bad.home.sparkle_where)), "sanitize drops a bad amount and a bad place");
}
console.log("All " + ok + " sparkle tests passed.");
