// fx-koi.js (design.home.koi + koi_where): how many koi each amount makes, sizes + the area budget, the three varieties, every colour a
// valid rgba (a browser throws on a bad one), koi in the pond band or all over, swimming both ways from just off the screen, a crossing with
// an S-curve whose heading turns with it, keyframes of transform (and opacity only in the showcase loop) with no filter / blend, the 8 s
// loop, nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping + checking the keys.
// Run: node tests/test_fx_koi.js
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
  const ctx = () => {
    const g = { createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, closePath() {},
      ellipse() {}, save() {}, restore() {}, clip() {},
      fill() { if (typeof g.fillStyle === "string") colours.push(g.fillStyle); }, fillRect() { if (typeof g.fillStyle === "string") colours.push(g.fillStyle); } };
    return g;
  };
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { const id = pic++; e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,K" + id; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-koi.js"), "utf8"), win);
  return { K: win.AmbientKoi, body, head, colours };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-koi") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");
const okc = (c) => { const m = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),([\d.]+)\)$/.exec(c); return !!m && [1, 2, 3].every((i) => +m[i] <= 255) && +m[4] >= 0 && +m[4] <= 1; };

for (const [amount, n] of [["few", 2], ["some", 4], ["many", 7]]) {
  const { K, body, head, colours } = load(false);
  K.set(amount, "pond", false);
  const h = host(body), f = kids(h), css = allCss(head);
  check(f.length === n, amount + ": " + n + " koi");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = f.reduce((a, t) => { const w = num(t.style.cssText, "width"), ht = num(t.style.cssText, "height"); check(w >= 7 && w <= 11 && Math.abs(ht / w - 0.4) < 0.01, "a koi is 7-11 vw long, the picture's shape"); return a + (w / 100 * 1920) * (ht / 100 * 1920); }, 0);
  check(area / (1920 * 1080) < 0.05, amount + ": all koi under 5 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(2) + " %)");
  check(f.every((t) => { const y = num(t.style.cssText, "top"); return y >= 50 && y <= 82; }), amount + ": pond: every koi in the lower half");
  check(f.every((t, k) => { const x = num(t.style.cssText, "left"), w = num(t.style.cssText, "width"); return k % 2 ? x === 108 : Math.abs(x - (-w - 8)) < 0.11; }), amount + ": live, each starts just off one side (left or right in turn)");
  check(colours.length && colours.every(okc), amount + ": every colour a valid rgba (" + colours.filter((c) => !okc(c)).slice(0, 3).join(" ") + ")");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
}
{ const { K, body } = load(false); K.set("many", "all", "medium", false);
  const ys = kids(host(body)).map((t) => num(t.style.cssText, "top"));
  check(ys.every((y) => y >= 12 && y <= 82), "all: anywhere from 12 % down"); }
{ const { K, body } = load(false); K.set("some", "sky", "medium", false); check(kids(host(body)).every((t) => num(t.style.cssText, "top") >= 50), "an unknown place: the pond"); }
{ const { K, body } = load(false); K.set("many", "pond", "medium", false);
  const pics = new Set(kids(host(body)).map((t) => /url\(([^)]*)\)/.exec(t.style.cssText)[1]));
  check(pics.size === 3 && K.KINDS.join() === "kohaku,ogon,showa", "three varieties: kohaku, ogon, showa"); }
{ const { K, head } = load(false); K.set("some", "pond", "medium", false);
  const css = allCss(head), r = /@keyframes fx-koi0r\{([^@]*)\}/.exec(css)[1], l = /@keyframes fx-koi0l\{([^@]*)\}/.exec(css)[1];
  const pts = (kf) => [...kf.matchAll(/translate3d\((-?[\d.]+)vw,(-?[\d.]+)vh,0\) rotate\((-?[\d.]+)deg\)/g)].map((m) => [+m[1], +m[2], +m[3]]);
  const R = pts(r), L = pts(l);
  check(R.length === 5 && R[4][0] === 140 && L[4][0] === -140, "live: a 140 vw crossing, rightwards or leftwards");
  check(R.every((p) => Math.abs(p[2]) <= 6) && L.every((p) => Math.abs(p[2] - 180) <= 6), "the head points the way it swims (0 / 180 deg), turning at most 6 deg");
  check(R[1][1] > 0 && R[1][2] > 0 && R[2][2] < 0, "the heading turns with the S of the path (down: nose down, then back up)");
  check(R[0][1] === 0 && R[4][1] === 0 && R[0][2] === 0 && R[4][2] === 0, "each crossing starts and ends level");
  const all = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background|opacity)\s*:/.test(all.replace(/transform:[^;}]*/g, "")), "live: the keyframes move transform only");
  check(/\.fx-koi i\{[^}]*opacity:\.85;/.test(css), "a koi is 85 % opaque: seen through the water");
  check(/linear/.test(css) && /fx-koi\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-koi,\.old-engine \.fx-koi/.test(css), "an even glide, pausable, off in the Lighter home / old engine"); }
{ const { K, body } = load(false); K.set("many", "pond", "medium", false);
  check(kids(host(body)).every((t) => { const d = num(t.style.cssText, "-webkit-animation-duration"); return d >= 45 && d <= 75; }), "live: 45-75 s a crossing (a slow glide)"); }
{ const { K, body, head } = load(false, "?fxloop=1"); K.set("many", "pond", "medium", false);
  const f = kids(host(body)), css = allCss(head);
  check(f.every((t) => num(t.style.cssText, "-webkit-animation-duration") === 8), "?fxloop=1: every koi on an 8 s cycle");
  check(/100%\{opacity:0;transform:translate3d\(30vw,0vh,0\)/.test(css) && /12%\{opacity:\.85\}/.test(css), "?fxloop=1: a 30 vw stretch, fading in and out");
  check(f.every((t) => { const x = num(t.style.cssText, "left"); return x >= 10 && x <= 90; }), "?fxloop=1: they start inside the screen"); }
for (const [z, lo, hi] of [["small", 4, 6], ["large", 10, 14], ["huge", 7, 11]]) {   // koi_size: small for a distant lake, large for a close pond
  const { K, body } = load(false); K.set("many", "pond", z, false);
  check(kids(host(body)).every((t) => { const w = num(t.style.cssText, "width"); return w >= lo && w <= hi; }), "koi_size " + z + ": " + lo + "-" + hi + " vw" + (z === "huge" ? " (unknown: medium)" : ""));
}
{ const { K, body } = load(false); K.set("some", "pond", "medium", false); const first = host(body); K.set("some", "pond", "large", false); check(host(body) !== first, "a new size: rebuilt"); }
{ const { K, body } = load(false); K.set("off", "pond", "medium", false); check(!host(body), "off: nothing on the page"); }
{ const { K, body } = load(false); K.set("school", "pond", "medium", false); check(!host(body), "an unknown amount: nothing"); }
{ const { K, body } = load(true); K.set("many", "pond", "medium", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { K, body } = load(false); K.set("many", "pond", "medium", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { K, body } = load(false); K.set("some", "pond", "medium", false);
  K.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  K.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); K.set("some", "pond", "medium", false); check(host(body) === first, "the same setting again: not rebuilt");
  K.set("some", "all", "medium", false); check(host(body) !== first && host(body), "another place: rebuilt");
  K.set("off", "all", "medium", false); check(!host(body), "back to off: the layer goes"); }
{ const { K, body } = load(false); K.pause(); K.set("few", "pond", "medium", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"koi", "koi_where", "koi_size"\]/.test(src), "design.js: koi, koi_where are design home keys");
  check(/koi: \["off", "few", "some", "many"\], koi_where: \["pond", "all"\], koi_size: \["small", "medium", "large"\]/.test(src), "design.js: only the listed values");
  check(/out\.push\(\["Koi"/.test(src) && /The koi were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientKoi\.set\(HOME\.koi \|\| "off", HOME\.koi_where \|\| "pond", HOME\.koi_size \|\| "medium", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*koiSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientKoi\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientKoi\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-koi\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-koi.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { koi: "many", koi_where: "all", koi_size: "small" } }));
  check(out.home && out.home.koi === "many" && out.home.koi_where === "all" && out.home.koi_size === "small", "sanitize keeps koi + koi_where + koi_size");
  const bad = plain(D.sanitize({ home: { koi: "shoal", koi_where: "sky", koi_size: "huge" } }));
  check(!(bad.home && (bad.home.koi || bad.home.koi_where || bad.home.koi_size)), "sanitize drops a bad amount, place and size");
}
console.log("All " + ok + " koi tests passed.");
