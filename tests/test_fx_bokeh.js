// fx-bokeh.js (design.home.bokeh + bokeh_colour): how many discs each amount makes, sizes + the layer area budget, near discs
// bigger and fainter, keyframes of transform / opacity only (no CSS variables, no filter, no blend), the colour (bokeh_colour,
// else the accent, else warm) and its tints, the 8 s loop, nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring
// and design.js keeping + checking the keys. Run: node tests/test_fx_bokeh.js
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
  let pic = 0;
  const grad = () => ({ addColorStop(o, c) { stops.push(c); } });
  const ctx = () => ({ createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, arc() {}, fill() {} });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { const id = pic++; e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,P" + id; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-bokeh.js"), "utf8"), win);
  return { B: win.AmbientBokeh, body, head, stops };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-bokeh") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const VW = 1920, VH = 1080;

for (const [amount, n, budget] of [["few", 10, 0.12], ["some", 16, 0.18], ["many", 24, 0.26]]) {
  const { B, body, head } = load(false);
  B.set(amount, "#ffaa33", false);
  const h = host(body), d = kids(h);
  check(d.length === n, amount + ": " + n + " discs");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = d.reduce((a, t) => {
    const w = num(t.style.cssText, "width"), ht = num(t.style.cssText, "height");
    check(w === ht && w >= 2.5 && w <= 11, "a disc is round, 2.5-11 vw");
    return a + Math.pow(w / 100 * VW, 2);
  }, 0);
  check(area / (VW * VH) < budget, amount + ": all discs under " + budget * 100 + " % of the screen (" + (100 * area / (VW * VH)).toFixed(1) + " %)");
  check(d.every((t) => /animation-name:fx-bokeh[0-3];/.test(t.style.cssText)), amount + ": each disc on one of the four drift paths");
  const css = head.childNodes.map((s) => s.textContent).join("");
  check((css.match(/@keyframes fx-bokeh\d/g) || []).length === 4, amount + ": four drift keyframe sets");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
}
{ // near discs (7-11 vw) use the faint picture, far discs (2.5-6 vw) the bright one
  const { B, body } = load(false); B.set("many", "#ffaa33", false);
  const d = kids(host(body)), pic = (t) => /url\(([^)]*)\)/.exec(t.style.cssText)[1];
  const near = d.filter((t) => num(t.style.cssText, "width") >= 7), far = d.filter((t) => num(t.style.cssText, "width") < 7);
  const nearPics = new Set(near.map(pic)), farPics = new Set(far.map(pic));
  check([...nearPics].every((p) => !farPics.has(p)), "near and far discs never share a picture");
  check(far.every((t) => num(t.style.cssText, "width") <= 6), "far discs are 2.5-6 vw");
}
{ const { B, head } = load(false); B.set("some", "", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background)\s*:/.test(kfs.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/fx-bokeh0\{0%,100%\{opacity:\.35;transform:translate3d\(0,0,0\)\}50%\{opacity:1;transform:translate3d\(4vw,-6vh,0\)\}/.test(css), "a disc drifts out and back and breathes");
  check(/fx-bokeh\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-bokeh,\.old-engine \.fx-bokeh/.test(css), "pausable, and off in the Lighter home / old engine"); }
for (const [col, first] of [["#3366ff", "51,102,255"], ["", "255,196,120"], ["red", "255,196,120"]]) {
  const { B, stops } = load(false); B.set("few", col, false);
  const rgbs = new Set(stops.map((c) => /rgba\((\d+,\d+,\d+),/.exec(c)[1]));
  check(rgbs.has(first) && rgbs.size === 3, (col || "no colour") + ": " + first + " and two lighter tints");
}
{ const { B, body } = load(false, "?fxloop=1"); B.set("many", "", false);
  const d = kids(host(body)), at = d.map((t) => num(t.style.cssText, "-webkit-animation-delay"));
  check(d.every((t) => num(t.style.cssText, "-webkit-animation-duration") === 8), "?fxloop=1: every disc on an 8 s cycle");
  check(at.every((x) => x <= 0 && x > -8) && new Set(at).size === d.length, "?fxloop=1: spread through the cycle"); }
{ const { B, body } = load(false); B.set("some", "", false);
  check(kids(host(body)).every((t) => { const d = num(t.style.cssText, "-webkit-animation-duration"); return d >= 16 && d <= 30; }), "live: slow 16-30 s cycles"); }
{ const { B, body } = load(false); B.set("off", "", false); check(!host(body), "off: nothing on the page"); }
{ const { B, body } = load(false); B.set("lots", "", false); check(!host(body), "an unknown amount: nothing"); }
{ const { B, body } = load(true); B.set("many", "", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { B, body } = load(false); B.set("many", "", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { B, body } = load(false); B.set("some", "#ffffff", false);
  B.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  B.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); B.set("some", "#ffffff", false); check(host(body) === first, "the same setting again: not rebuilt");
  B.set("some", "#000000", false); check(host(body) !== first && host(body), "a new colour: rebuilt");
  B.set("off", "#000000", false); check(!host(body), "back to off: the layer goes"); }
{ const { B, body } = load(false); B.pause(); B.set("few", "", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"bokeh", "bokeh_colour"\]/.test(src), "design.js: bokeh, bokeh_colour are design home keys");
  check(/bokeh: \["off", "few", "some", "many"\]/.test(src), "design.js: only off / few / some / many");
  check(/h\.bokeh_colour = String\(hm\.bokeh_colour\)/.test(src), "design.js: bokeh_colour kept only as #rrggbb");
  check(/out\.push\(\["Bokeh lights"/.test(src) && /The bokeh lights were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientBokeh\.set\(HOME\.bokeh \|\| "off", HOME\.bokeh_colour \|\| look\.accent \|\| "", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: the colour or the accent; off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*bokehSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientBokeh\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientBokeh\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-bokeh\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-bokeh.js");
}
// design.js really keeps the keys (a design sanitized through the module, the sandbox of test_design_depth_card.js)
{
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { bokeh: "many", bokeh_colour: "#12ab34" } }));
  check(out.home && out.home.bokeh === "many" && out.home.bokeh_colour === "#12ab34", "sanitize keeps bokeh + a #rrggbb colour");
  const bad = plain(D.sanitize({ home: { bokeh: "loads", bokeh_colour: "url(x)" } }));
  check(!(bad.home && (bad.home.bokeh || bad.home.bokeh_colour)), "sanitize drops a bad amount and a non-colour");
}
console.log("All " + ok + " bokeh tests passed.");
