// fx-waves.js (design.home.waves + waves_colour): how many strips each amount makes, their heights + the layer area budget, a strip one
// period wider than the screen that drifts exactly one period per cycle (a seamless loop), alternate drift directions, keyframes of
// transform only (no CSS variables, no filter, no blend), a crest only on the front strip, the colour (waves_colour, else sea teal),
// the 8 s loop, nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping + checking the keys.
// Run: node tests/test_fx_waves.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas"), stops = [], strokes = [];
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  const grad = () => ({ addColorStop(o, c) { stops.push(c); } });
  const ctx = () => { const g = { createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() { strokes.push(g.strokeStyle); } }; return g; };
  let pic = 0;
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { const id = pic++; e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,W" + id; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-waves.js"), "utf8"), win);
  return { W: win.AmbientWaves, body, head, stops, strokes };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-waves") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");

for (const [amount, n, top, budget] of [["low", 2, 10, 0.25], ["some", 3, 14, 0.45], ["high", 3, 18, 0.56]]) {
  const { W, body, head } = load(false);
  W.set(amount, "", false);
  const h = host(body), s = kids(h), css = allCss(head);
  check(s.length === n, amount + ": " + n + " strips");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const hs = s.map((t) => num(t.style.cssText, "height"));
  check(hs[0] === top && hs.every((v, i) => i === 0 || v < hs[i - 1]), amount + ": back strip " + top + " vh, each strip in front lower (" + hs.join(", ") + ")");
  const width = +/\.fx-waves i\{[^}]*width:([\d.]+)vw/.exec(css)[1];
  const area = hs.reduce((a, v) => a + (width / 100) * (v / 100), 0);
  check(area < budget, amount + ": all strips under " + budget * 100 + " % of the screen (" + (100 * area).toFixed(1) + " %)");
  check(s.every((t, k) => new RegExp("animation-name:fx-wave" + k + ";").test(t.style.cssText)), amount + ": each strip its own keyframes");
  check((css.match(/@keyframes fx-wave\d/g) || []).length === n, amount + ": " + n + " keyframe sets");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
  check(/\.fx-waves\{[^}]*bottom:0;height:20vh;[^}]*overflow:hidden/.test(css), amount + ": the water stays in the bottom 20 vh");
}
{ // a seamless drift: the strip is one period wider than the screen, the picture repeats every period, and each cycle moves exactly one period
  const { W, head } = load(false); W.set("some", "", false);
  const css = allCss(head), P = W.P;
  check(new RegExp("width:" + (100 + P) + "vw").test(css) && new RegExp("background-size:" + P + "vw 100%").test(css) && /repeat-x/.test(css), "one period (" + P + " vw) wider than the screen, the wave repeating every period");
  const kfs = [0, 1, 2].map((k) => new RegExp("@keyframes fx-wave" + k + "\\{([^@]*)\\}").exec(css)[1]);
  kfs.forEach((b, k) => {
    const xs = [...b.matchAll(/translate3d\((-?[\d.]+)vw,(-?[\d.]+)vh,0\)/g)].map((m) => [+m[1], +m[2]]);
    check(xs.length === 5 && Math.abs(xs[4][0] - xs[0][0]) === P && xs[0][1] === 0 && xs[4][1] === 0, "strip " + k + ": drifts exactly one period and ends where the bob started");
    check(xs.every(([x]) => x <= 0 && x >= -P), "strip " + k + ": never shows its right edge (x within -P..0)");
  });
  const dirs = kfs.map((b) => /^0%\{transform:translate3d\(0vw/.test(b) ? "left" : "right");
  check(dirs[0] !== dirs[1] && dirs[1] !== dirs[2], "neighbouring strips drift opposite ways (" + dirs.join(", ") + ")");
  const kfAll = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background|opacity)\s*:/.test(kfAll.replace(/transform:[^;}]*/g, "")), "the keyframes move transform only");
  check(/linear/.test(css) && /fx-waves\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-waves,\.old-engine \.fx-waves/.test(css), "linear drift, pausable, off in the Lighter home / old engine"); }
{ const { W, strokes } = load(false); W.set("high", "", false);
  check(strokes.length === 1, "only the front strip has a crest line"); }
for (const [col, rgb] of [["#3366ff", "51,102,255"], ["", "34,120,150"], ["sea", "34,120,150"]]) {
  const { W, stops } = load(false); W.set("some", col, false);
  check(stops.some((c) => c.indexOf("rgba(" + rgb + ",") === 0), (col || "no colour") + ": the middle strip is " + rgb);
}
{ const { W, body } = load(false, "?fxloop=1"); W.set("high", "", false);
  check(kids(host(body)).every((t) => num(t.style.cssText, "-webkit-animation-duration") === 8), "?fxloop=1: every strip on an 8 s cycle"); }
{ const { W, body } = load(false); W.set("some", "", false);
  const d = kids(host(body)).map((t) => num(t.style.cssText, "-webkit-animation-duration"));
  check(d[0] > d[1] && d[1] > d[2], "live: the back strip slowest, the front fastest (" + d.join(", ") + " s)"); }
{ const { W, body } = load(false); W.set("off", "", false); check(!host(body), "off: nothing on the page"); }
{ const { W, body } = load(false); W.set("huge", "", false); check(!host(body), "an unknown amount: nothing"); }
{ const { W, body } = load(true); W.set("high", "", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { W, body } = load(false); W.set("high", "", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { W, body } = load(false); W.set("some", "#ffffff", false);
  W.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  W.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); W.set("some", "#ffffff", false); check(host(body) === first, "the same setting again: not rebuilt");
  W.set("some", "#000000", false); check(host(body) !== first && host(body), "a new colour: rebuilt");
  W.set("off", "#000000", false); check(!host(body), "back to off: the layer goes"); }
{ const { W, body } = load(false); W.pause(); W.set("low", "", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"waves", "waves_colour"\]/.test(src), "design.js: waves, waves_colour are design home keys");
  check(/waves: \["off", "low", "some", "high"\]/.test(src), "design.js: only off / low / some / high");
  check(/out\.push\(\["Sea waves"/.test(src) && /The sea waves were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientWaves\.set\(HOME\.waves \|\| "off", HOME\.waves_colour \|\| "", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*wavesSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientWaves\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientWaves\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-waves\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-waves.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { waves: "high", waves_colour: "#1e6e8c" } }));
  check(out.home && out.home.waves === "high" && out.home.waves_colour === "#1e6e8c", "sanitize keeps waves + a #rrggbb colour");
  const bad = plain(D.sanitize({ home: { waves: "tsunami", waves_colour: "url(x)" } }));
  check(!(bad.home && (bad.home.waves || bad.home.waves_colour)), "sanitize drops a bad amount and a non-colour");
}
console.log("All " + ok + " waves tests passed.");
