// fx-lanterns.js (design.home.lanterns + lanterns_style): how many lanterns each amount makes, sizes + the area budget, near lanterns
// bigger with the bright picture and far ones smaller with the faint one, every colour a valid rgba (a browser throws on a bad one), a
// rise with a sway that fades in and out, keyframes of transform / opacity only (no CSS variables, no filter, no blend), the 8 s loop,
// nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping + checking the keys.
// Run: node tests/test_fx_lanterns.js
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
  const ctx = () => { const g = { createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, fill() {},
    fillRect() { if (typeof g.fillStyle === "string") colours.push(g.fillStyle); } }; return g; };
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { const id = pic++; e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,L" + id; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-lanterns.js"), "utf8"), win);
  return { L: win.AmbientLanterns, body, head, colours };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-lanterns") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");
const okc = (c) => { const m = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),([\d.]+)\)$/.exec(c); return !!m && [1, 2, 3].every((i) => +m[i] <= 255) && +m[4] >= 0 && +m[4] <= 1; };

for (const [amount, n] of [["few", 8], ["some", 14], ["many", 22]]) {
  const { L, body, head, colours } = load(false);
  L.set(amount, "warm", false);
  const h = host(body), g = kids(h), css = allCss(head);
  check(g.length === n, amount + ": " + n + " lanterns");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = g.reduce((a, t) => { const w = num(t.style.cssText, "width"), ht = num(t.style.cssText, "height"); check(w >= 1.2 && w <= 3.2 && Math.abs(ht / w - 88 / 64) < 0.01, "a lantern is 1.2-3.2 vw, the picture's shape"); return a + (w / 100 * 1920) * (ht / 100 * 1920); }, 0);
  check(area / (1920 * 1080) < 0.06, amount + ": all lanterns under 6 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(2) + " %)");
  check(g.every((t) => num(t.style.cssText, "top") === 104), amount + ": live, every lantern starts just below the screen");
  check(colours.length && colours.every(okc), amount + ": every colour a valid rgba (" + colours.filter((c) => !okc(c)).slice(0, 3).join(" ") + ")");
  check(!/var\(/.test(css) && !/filter|blend/.test(css) && !g.some((t) => /filter/.test(t.style.cssText)), amount + ": no CSS variables, no filter, no blend mode");
  check(g.every((t, k) => new RegExp("animation-name:fx-lantern" + (k % 4) + ";").test(t.style.cssText)), amount + ": each lantern on one of four paths");
}
{ // depth: the far (small) ones use the faint picture, the near (big) ones the bright one, and the near ones are drawn on top
  const { L, body } = load(false); L.set("many", "red", false);
  const g = kids(host(body)), pic = (t) => /url\(([^)]*)\)/.exec(t.style.cssText)[1];
  const small = g.filter((t) => num(t.style.cssText, "width") < 1.9), big = g.filter((t) => num(t.style.cssText, "width") > 2.1);
  check(small.every((t) => pic(t) === pic(small[0])) && big.every((t) => pic(t) !== pic(small[0])), "far lanterns faint, near ones bright");
  check(big.every((t) => num(t.style.cssText, "z-index") >= 4) && small.every((t) => num(t.style.cssText, "z-index") <= 4), "near lanterns in front of far ones");
  const d = (t) => num(t.style.cssText, "-webkit-animation-duration");
  check(small.length && big.length && Math.min(...small.map(d)) > Math.max(...big.map(d)) - 8, "far lanterns rise more slowly"); }
{ const { L, head } = load(false); L.set("some", "gold", false);
  const css = allCss(head), kf = /@keyframes fx-lantern0\{([^@]*)\}/.exec(css)[1];
  check(/^0%\{opacity:0;/.test(kf) && /8%\{opacity:1\}/.test(kf) && /100%\{opacity:0;transform:translate3d\(0vw,-125vh,0\)/.test(kf), "live: fades in, rises 125 vh (below the screen to above it), fades out");
  check(/33%\{transform:translate3d\(1\.5vw,/.test(kf) && /rotate\(3deg\)/.test(kf), "it sways and tilts a little on the way");
  const all = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background)\s*:/.test(all.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/\.fx-lanterns i\{[^}]*opacity:0;/.test(css) && /linear/.test(css), "a lantern starts hidden, rises at an even pace");
  check(/fx-lanterns\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-lanterns,\.old-engine \.fx-lanterns/.test(css), "pausable, and off in the Lighter home / old engine"); }
for (const [st, rgb] of [["warm", "255,150,60"], ["red", "235,70,50"], ["gold", "255,196,90"], ["blue", "255,150,60"]]) {
  const { L, colours } = load(false); L.set("few", st, false);
  check(colours.some((c) => c.indexOf("rgba(" + rgb + ",") === 0), st + ": lanterns in " + rgb);
}
{ const { L, body, head } = load(false, "?fxloop=1"); L.set("many", "warm", false);
  const g = kids(host(body));
  check(g.every((t) => num(t.style.cssText, "-webkit-animation-duration") === 8), "?fxloop=1: every lantern on an 8 s cycle");
  check(/100%\{opacity:0;transform:translate3d\(0vw,-55vh,0\)/.test(allCss(head)) && g.every((t) => { const y = num(t.style.cssText, "top"); return y >= 45 && y <= 100; }), "?fxloop=1: a 55 vh rise from inside the screen (seen whole in the clip)"); }
{ const { L, body } = load(false); L.set("off", "warm", false); check(!host(body), "off: nothing on the page"); }
{ const { L, body } = load(false); L.set("lots", "warm", false); check(!host(body), "an unknown amount: nothing"); }
{ const { L, body } = load(true); L.set("many", "warm", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { L, body } = load(false); L.set("many", "warm", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { L, body } = load(false); L.set("some", "warm", false);
  L.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  L.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); L.set("some", "warm", false); check(host(body) === first, "the same setting again: not rebuilt");
  L.set("some", "red", false); check(host(body) !== first && host(body), "another style: rebuilt");
  L.set("off", "red", false); check(!host(body), "back to off: the layer goes"); }
{ const { L, body } = load(false); L.pause(); L.set("few", "warm", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"lanterns", "lanterns_style"\]/.test(src), "design.js: lanterns, lanterns_style are design home keys");
  check(/lanterns: \["off", "few", "some", "many"\], lanterns_style: \["warm", "red", "gold"\]/.test(src), "design.js: only the listed values");
  check(/out\.push\(\["Sky lanterns"/.test(src) && /The sky lanterns were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientLanterns\.set\(HOME\.lanterns \|\| "off", HOME\.lanterns_style \|\| "warm", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*lanternsSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientLanterns\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientLanterns\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-lanterns\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-lanterns.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { lanterns: "many", lanterns_style: "red" } }));
  check(out.home && out.home.lanterns === "many" && out.home.lanterns_style === "red", "sanitize keeps lanterns + lanterns_style");
  const bad = plain(D.sanitize({ home: { lanterns: "hundreds", lanterns_style: "blue" } }));
  check(!(bad.home && (bad.home.lanterns || bad.home.lanterns_style)), "sanitize drops a bad amount and a bad style");
}
console.log("All " + ok + " lanterns tests passed.");
