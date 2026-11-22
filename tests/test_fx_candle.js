// fx-candle.js (design.home.candle + candle_colour): how many glows each amount makes and where, the layer area budget, the glow's
// centre on the bottom edge, a GENTLE flicker (never below 72 %, scale within 3 %, no step shorter than 0.2 s: no flashes, see the
// candle simulator with an epilepsy warning in the scan), keyframes of transform / opacity only, different cycles so the glows never
// pulse together, the colour (candle_colour, else warm), the 8 s loop, nothing when off / calm / Lighter / Loop, pause + resume,
// app.js wiring and design.js keeping + checking the keys. Run: node tests/test_fx_candle.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas"), stops = [];
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  const grad = () => ({ addColorStop(o, c) { stops.push(c); } });
  const ctx = () => ({ createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, arc() {}, fill() {} });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,C"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-candle.js"), "utf8"), win);
  return { C: win.AmbientCandle, body, head, stops };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-candle") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");

for (const [amount, n, budget] of [["one", 1, 0.18], ["two", 2, 0.34], ["three", 3, 0.5]]) {
  const { C, body, head } = load(false);
  C.set(amount, "", false);
  const h = host(body), g = kids(h), css = allCss(head);
  check(g.length === n, amount + ": " + n + " glows");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const size = +/\.fx-candle i\{[^}]*width:([\d.]+)vw/.exec(css)[1];
  const area = n * Math.pow(size / 100 * 1920, 2) / (1920 * 1080);
  check(area < budget, amount + ": all glows under " + budget * 100 + " % of the screen (" + (100 * area).toFixed(1) + " %)");
  check(new RegExp("bottom:-" + size / 2 + "vw").test(css), amount + ": the glow's centre sits on the bottom edge (half below the screen)");
  const xs = g.map((t) => num(t.style.cssText, "left"));
  check(xs[0] === 16 && (n < 2 || xs[1] === 84) && (n < 3 || xs[2] === 50), amount + ": bottom left first, then right, then the middle (" + xs.join(", ") + ")");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
}
{ // gentle: the flicker never dips below 72 %, the size stays within 3 %, and no step is shorter than 0.2 s even on the fastest cycle
  const { C, head } = load(false); C.set("three", "", false);
  const css = allCss(head), kf = /@keyframes fx-candle\{([^@]*)\}/.exec(css)[1];
  const steps = [...kf.matchAll(/([\d.]+)%\{opacity:([\d.]+);transform:scale\(([\d.]+)\)\}/g)].map((m) => [+m[1], +m[2], +m[3]]);
  check(steps.length >= 10 && steps[0][0] === 0 && steps[steps.length - 1][0] === 100, "a flicker of " + steps.length + " uneven steps over the whole cycle");
  check(steps.every(([, o]) => o >= 0.72 && o <= 1), "never below 72 % brightness, never off");
  check(steps.every(([, , s]) => s >= 0.97 && s <= 1.03), "the size stays within 3 %");
  check(steps[0][1] === steps[steps.length - 1][1] && steps[0][2] === steps[steps.length - 1][2], "ends where it starts (no jump at the loop)");
  const fastest = Math.min(...C.CYCLES), gaps = steps.slice(1).map((s, i) => (s[0] - steps[i][0]) / 100 * fastest);
  check(Math.min(...gaps) >= 0.2, "no step shorter than 0.2 s (shortest " + Math.min(...gaps).toFixed(2) + " s)");
  const sizes = new Set(steps.slice(1).map((s, i) => s[0] - steps[i][0]));
  check(sizes.size >= 4, "the steps are uneven (" + [...sizes].join(", ") + " %)");
  check(!/(left|top|width|height|margin|background)\s*:/.test(kf.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/fx-candle\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-candle,\.old-engine \.fx-candle/.test(css), "pausable, and off in the Lighter home / old engine"); }
{ const { C, body } = load(false); C.set("three", "", false);
  const d = kids(host(body)).map((t) => num(t.style.cssText, "-webkit-animation-duration"));
  check(new Set(d).size === 3, "live: three different cycles, so the glows never pulse together (" + d.join(", ") + " s)"); }
{ const { C, body } = load(false, "?fxloop=1"); C.set("three", "", false);
  const d = kids(host(body)).map((t) => num(t.style.cssText, "-webkit-animation-duration"));
  check(d.join() === "8,4,2", "?fxloop=1: 8 / 4 / 2 s cycles (they divide the 8 s clip)"); }
for (const [col, rgb] of [["#3366ff", "51,102,255"], ["", "255,170,90"], ["warm", "255,170,90"]]) {
  const { C, stops } = load(false); C.set("one", col, false);
  check(stops.some((c) => c.indexOf("rgba(" + rgb + ",") === 0) && stops[stops.length - 1].endsWith(",0)"), (col || "no colour") + ": the glow is " + rgb + ", fading to nothing");
}
{ const { C, body } = load(false); C.set("off", "", false); check(!host(body), "off: nothing on the page"); }
{ const { C, body } = load(false); C.set("seven", "", false); check(!host(body), "an unknown amount: nothing"); }
{ const { C, body } = load(true); C.set("three", "", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { C, body } = load(false); C.set("three", "", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { C, body } = load(false); C.set("two", "#ffffff", false);
  C.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  C.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); C.set("two", "#ffffff", false); check(host(body) === first, "the same setting again: not rebuilt");
  C.set("two", "#000000", false); check(host(body) !== first && host(body), "a new colour: rebuilt");
  C.set("off", "#000000", false); check(!host(body), "back to off: the layer goes"); }
{ const { C, body } = load(false); C.pause(); C.set("one", "", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"candle", "candle_colour"\]/.test(src), "design.js: candle, candle_colour are design home keys");
  check(/candle: \["off", "one", "two", "three"\]/.test(src), "design.js: only off / one / two / three");
  check(/out\.push\(\["Candle glow"/.test(src) && /The candle glow was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientCandle\.set\(HOME\.candle \|\| "off", HOME\.candle_colour \|\| "", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*candleSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientCandle\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientCandle\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-candle\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-candle.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { candle: "three", candle_colour: "#ffaa5a" } }));
  check(out.home && out.home.candle === "three" && out.home.candle_colour === "#ffaa5a", "sanitize keeps candle + a #rrggbb colour");
  const bad = plain(D.sanitize({ home: { candle: "bonfire", candle_colour: "url(x)" } }));
  check(!(bad.home && (bad.home.candle || bad.home.candle_colour)), "sanitize drops a bad amount and a non-colour");
}
console.log("All " + ok + " candle tests passed.");
