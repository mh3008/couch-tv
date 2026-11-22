// fx-clouds.js (design.home.clouds + clouds_style): how many clouds each amount makes, sizes + the area budget, clouds in the sky band,
// depth (far small / faint / slow / behind, near big / bright / quick / in front), a crossing from just off the left to just off the right,
// keyframes of transform only (no CSS variables, no filter, no blend), every colour a valid rgba, the styles, the 8 s time-lapse loop,
// nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping + checking the keys.
// Run: node tests/test_fx_clouds.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas"), colours = [];
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  let pic = 0;
  const grad = () => ({ addColorStop(o, c) { colours.push(c); } });
  const ctx = () => ({ createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, arc() {}, fill() {} });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { const id = pic++; e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,C" + id; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-clouds.js"), "utf8"), win);
  return { C: win.AmbientClouds, body, head, colours };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-clouds") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");
const okc = (c) => { const m = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),([\d.]+)\)$/.exec(c); return !!m && [1, 2, 3].every((i) => +m[i] <= 255) && +m[4] >= 0 && +m[4] <= 1; };

for (const [amount, n, budget] of [["few", 4, 0.18], ["some", 7, 0.3], ["many", 11, 0.45]]) {
  const { C, body, head, colours } = load(false);
  C.set(amount, "white", false);
  const h = host(body), c = kids(h), css = allCss(head);
  check(c.length === n, amount + ": " + n + " clouds");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = c.reduce((a, t) => { const w = num(t.style.cssText, "width"), ht = num(t.style.cssText, "height"); check(w >= 10.5 && w <= 31.5 && Math.abs(ht / w - 112 / 256) < 0.01, "a cloud is 10.5-31.5 vw, the picture's shape"); return a + (w / 100 * 1920) * (ht / 100 * 1920); }, 0);
  check(area / (1920 * 1080) < budget, amount + ": all clouds under " + budget * 100 + " % of the screen (" + (100 * area / (1920 * 1080)).toFixed(1) + " %)");
  check(c.every((t) => { const y = num(t.style.cssText, "top"); return y >= 3 && y <= 30; }), amount + ": in the sky (3-30 % down, above most horizons)");
  check(c.every((t) => num(t.style.cssText, "left") === -30), amount + ": each starts just off the left edge");
  check(colours.length && colours.every(okc), amount + ": every colour a valid rgba (" + colours.filter((x) => !okc(x)).slice(0, 3).join(" ") + ")");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
}
{ // depth: far clouds small, faint, slow and behind; near ones big, bright, quick and in front
  const { C, body } = load(false); C.set("many", "white", false);
  const c = kids(host(body)), pic = (t) => /url\(([^)]*)\)/.exec(t.style.cssText)[1], z = (t) => num(t.style.cssText, "z-index");
  const far = c.filter((t) => z(t) < 4), near = c.filter((t) => z(t) >= 4);
  const w = (t) => num(t.style.cssText, "width"), d = (t) => num(t.style.cssText, "-webkit-animation-duration");
  check(far.length && near.length && Math.max(...far.map(w)) < Math.max(...near.map(w)), "far clouds smaller");
  check(new Set(far.map(pic)).size <= 2 && near.every((t) => !far.map(pic).includes(pic(t))), "far clouds use the faint pictures, near ones the bright ones");
  check(Math.min(...far.map(d)) > Math.max(...near.map(d)) - 40, "far clouds drift more slowly (" + Math.round(Math.min(...far.map(d))) + " s vs " + Math.round(Math.max(...near.map(d))) + " s)");
  check(c.every((t) => { const x = d(t); return x >= 70 && x <= 200; }), "live: a crossing takes 70-200 s (a slow drift)"); }
{ const { C, head } = load(false); C.set("some", "white", false);
  const css = allCss(head), kf = /@keyframes fx-cloud\{([^@]*)\}/.exec(css)[1];
  check(/from\{transform:translate3d\(0,0,0\)\}to\{transform:translate3d\(130vw,0,0\)\}/.test(kf), "from just off the left (-30 vw) to just off the right: 130 vw");
  check(!/(left|top|width|height|margin|background|opacity)\s*:/.test(kf.replace(/transform:[^;}]*/g, "")), "the keyframes move transform only");
  check(/linear/.test(css) && /fx-clouds\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-clouds,\.old-engine \.fx-clouds/.test(css), "an even drift, pausable, off in the Lighter home / old engine"); }
for (const [st, rgb] of [["white", "255,255,255"], ["grey", "226,230,236"], ["dusk", "255,226,214"], ["green", "255,255,255"]]) {
  const { C, colours } = load(false); C.set("few", st, false);
  check(colours.some((c) => c.indexOf("rgba(" + rgb + ",") === 0), st + ": clouds in " + rgb);
}
{ const { C, body } = load(false, "?fxloop=1"); C.set("many", "white", false);
  const c = kids(host(body)), at = c.map((t) => num(t.style.cssText, "-webkit-animation-delay"));
  check(c.every((t) => num(t.style.cssText, "-webkit-animation-duration") === 8), "?fxloop=1: a time-lapse, every crossing 8 s");
  check(at.every((x) => x <= 0 && x > -8) && new Set(at.map((x) => x.toFixed(2))).size === c.length, "?fxloop=1: spread through the cycle"); }
{ const { C, body } = load(false); C.set("off", "white", false); check(!host(body), "off: nothing on the page"); }
{ const { C, body } = load(false); C.set("overcast", "white", false); check(!host(body), "an unknown amount: nothing"); }
{ const { C, body } = load(true); C.set("many", "white", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { C, body } = load(false); C.set("many", "white", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { C, body } = load(false); C.set("some", "white", false);
  C.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  C.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); C.set("some", "white", false); check(host(body) === first, "the same setting again: not rebuilt");
  C.set("some", "dusk", false); check(host(body) !== first && host(body), "another style: rebuilt");
  C.set("off", "dusk", false); check(!host(body), "back to off: the layer goes"); }
{ const { C, body } = load(false); C.pause(); C.set("few", "white", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"clouds", "clouds_style"\]/.test(src), "design.js: clouds, clouds_style are design home keys");
  check(/clouds: \["off", "few", "some", "many"\], clouds_style: \["white", "grey", "dusk"\]/.test(src), "design.js: only the listed values");
  check(/out\.push\(\["Drifting clouds"/.test(src) && /The drifting clouds were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientClouds\.set\(HOME\.clouds \|\| "off", HOME\.clouds_style \|\| "white", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*cloudsSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientClouds\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientClouds\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-clouds\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-clouds.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { clouds: "many", clouds_style: "dusk" } }));
  check(out.home && out.home.clouds === "many" && out.home.clouds_style === "dusk", "sanitize keeps clouds + clouds_style");
  const bad = plain(D.sanitize({ home: { clouds: "storm", clouds_style: "green" } }));
  check(!(bad.home && (bad.home.clouds || bad.home.clouds_style)), "sanitize drops a bad amount and a bad style");
}
console.log("All " + ok + " clouds tests passed.");
