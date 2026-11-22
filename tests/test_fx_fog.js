// fx-fog.js v2 (design.home.fog + fog_style): light-coloured, dense banks at three depths + ground fog + a static veil; how many animated
// layers each amount makes (<= 30, ONE element and ONE animation each), transform + opacity only, the area budget, every colour value a
// valid rgba / hex, light and dense enough to read on a sharp photo, nothing when off / calm / Lighter / Loop, pause + resume, app.js
// wiring and design.js keeping the keys. Run: node tests/test_fx_fog.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
const COLOUR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(0|1|0?\.\d+)\))$/;
function validColour(c) {
  const m = COLOUR.exec(String(c));
  if (!m) return false;
  if (m[2] === undefined) return true;
  return +m[2] <= 255 && +m[3] <= 255 && +m[4] <= 255 && +m[5] >= 0 && +m[5] <= 1;
}
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas");
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  const stops = [], canvases = [];
  const ctx = () => ({ save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {}, fillStyle: "",
    createRadialGradient: () => ({ addColorStop(o, c) { stops.push(c); } }), createLinearGradient: () => ({ addColorStop(o, c) { stops.push(c); } }) });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { canvases.push(e); e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,AA"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, innerHeight: 1080, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-fog.js"), "utf8"), win);
  return { F: win.AmbientFog, body, head, stops, canvases };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-fog") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const layers = (h) => h.childNodes.filter((n) => n.tagName === "I");
const SCREEN = 1920 * 1080;

// how many animated layers, one element and one animation each, the area budget, the static veil
for (const [amount, n, maxArea] of [["light", 5, 1.0], ["medium", 9, 2.0], ["thick", 14, 3.1]]) {
  for (const st of ["mist", "warm", "cool"]) {
    const { F, body } = load(false);
    F.set(amount, st, false);
    const h = host(body), ls = h && layers(h);
    check(ls && ls.length === n, amount + " " + st + ": " + n + " animated layers");
    check(ls.length <= 30, amount + ": at most 30 animated layers (" + ls.length + ")");
    check(F.COUNT[amount] === n, amount + ": COUNT says " + n);
    if (st !== "mist") continue;
    check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
    check(ls.every((p) => p.childNodes.length === 0 && (p.style.cssText.match(/(^|;)animation-name:/g) || []).length === 1), amount + ": every layer is ONE element with ONE animation (no inner breathing element)");
    check(ls.every((p) => /animation-delay:-/.test(p.style.cssText)), amount + ": already mid-way (negative delays)");
    const veil = h.childNodes.filter((x) => x.tagName === "U");
    check(veil.length === 1 && !/animation/.test(veil[0].style.cssText) && /linear-gradient/.test(veil[0].style.cssText), amount + ": ONE static veil (a CSS gradient, no animation)");
    const area = ls.reduce((a, p) => a + num(p.style.cssText, "width") * num(p.style.cssText, "height"), 0);
    check(area / SCREEN < maxArea, amount + ": layer boxes under " + maxArea + " screens (" + (area / SCREEN).toFixed(2) + ")");
  }
}
// three depths, drifting at different speeds: far slowest, near quickest
{
  const { F, body } = load(false); F.set("thick", "mist", false);
  const ls = layers(host(body)), by = (k) => ls.filter((p) => new RegExp("animation-name:fx-" + k + "-[fb];").test(p.style.cssText));
  const secs = (p) => num(p.style.cssText, "animation-duration");
  const far = by("far"), mid = by("mid"), near = by("near"), gnd = ls.filter((p) => /fx-gnd/.test(p.style.cssText));
  check(far.length === 4 && mid.length === 5 && near.length === 3 && gnd.length === 2, "thick: 4 far + 5 middle + 3 near banks + 2 ground-fog bands");
  check(Math.min(...far.map(secs)) >= 62 && Math.max(...mid.map(secs)) <= 60 && Math.min(...mid.map(secs)) >= 40 && Math.max(...near.map(secs)) <= 40, "depths drift at different speeds (far 62-90 s, middle 40-60 s, near 26-40 s per back-and-forth)");
  const w = (p) => num(p.style.cssText, "width");
  check(Math.max(...far.map(w)) < Math.min(...mid.map(w)) && Math.max(...mid.map(w)) < Math.min(...near.map(w)), "far banks are the smallest, near banks the biggest");
  const top = (p) => num(p.style.cssText, "top") + num(p.style.cssText, "height") / 2;
  check(top(far[0]) < top(near[0]), "far banks sit higher (nearer the horizon) than near banks");
  check(gnd.every((p) => num(p.style.cssText, "top") + num(p.style.cssText, "height") >= 1070 && /(^|\s)fx-g(\s|$)/.test(p.className)), "ground fog hugs the bottom of the screen");
  check(gnd.every((p) => num(p.style.cssText, "width") >= 1920 + num(p.style.cssText, "background-size")), "a ground band is wider than the screen plus one tile (it slides one tile for ever)");
  check(far.concat(mid, near).every((p) => num(p.style.cssText, "left") > -1400 && num(p.style.cssText, "left") < 1920), "banks start on or near the screen");
}
// the keyframes: transform + opacity only, no filter / blur / shadow / variables
for (const lp of [false, true]) {
  const { F, head } = load(false, lp ? "?fxloop=1" : ""); F.set("thick", "mist", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(kfs.length > 0 && !/(left|top|width|height|margin|background|filter)\s*:/.test(kfs.replace(/transform:[^;}]*/g, "").replace(/opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(!/var\(/.test(kfs) && !/filter|blur|shadow/.test(css), "no CSS variables in keyframes, no filter / blur / shadow anywhere");
  check(/translate3d\(-?\d+px,0,0\)/.test(css) && /@-webkit-keyframes fx-near-f/.test(css) && /fx-gnd1/.test(css), "a drift is a translate3d (webkit + standard keyframes), one per depth and direction, plus the ground tiles");
  check(/fx-fog\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-fog,\.old-engine \.fx-fog/.test(css), "pausable, and off in the Lighter home / old engine");
  const gnd = kfs.match(/@keyframes fx-gnd0\{[^@]*/)[0];
  check(/translate3d\(0px,0,0\)/.test(gnd) && /translate3d\(-960px,0,0\)/.test(gnd), "a ground band slides exactly one tile (960 px): the loop never jumps");
}
// COLOUR TEST: every colour value the pictures and the veil use is a valid rgba / hex (the waves bug: a bad value makes the canvas throw)
for (const [amount, st] of [["light", "mist"], ["medium", "warm"], ["thick", "cool"], ["thick", "mist"], ["thick", "warm"]]) {
  const { F, body, stops } = load(false); F.set(amount, st, false);
  const veil = host(body).childNodes.find((x) => x.tagName === "U").style.cssText;
  const all = stops.concat(veil.match(/rgba\([^)]*\)/g) || []);
  check(all.length > 100 && all.every(validColour), amount + " " + st + ": all " + all.length + " colour values are valid rgba/hex" + (all.filter((c) => !validColour(c))[0] ? " (bad: " + all.filter((c) => !validColour(c))[0] + ")" : ""));
}
// light + dense: the fog has to be brighter than the dark parts of a photo and thick enough to show on a sharp one
for (const st of ["mist", "warm", "cool"]) {
  const { F, stops } = load(false); F.set("thick", st, false);
  const rgba = stops.map((c) => /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(c)).filter(Boolean).map((m) => ({ r: +m[1], g: +m[2], b: +m[3], a: +m[4] }));
  const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const body = rgba.filter((c) => c.a > 0);
  check(body.every((c) => lum(c) >= 0.78), st + ": every fog colour is light (luma >= 0.78: on a dark photo it lifts, never darkens)");
  check(Math.max(...rgba.map((c) => c.a)) >= 0.7, st + ": the middle of a bank is dense (alpha >= 0.7)");
  check(rgba.some((c) => c.a > 0 && lum(c) >= 0.93), st + ": bright wisps (near white) are drawn into the pictures");
}
// the pictures are drawn once: 4 bank pictures + one per ground band, and pause / resume draw nothing
{ const { F, canvases } = load(false); F.set("thick", "mist", false); check(canvases.length === 6, "thick: 6 canvases drawn once (4 banks + 2 ground bands)"); F.pause(); F.resume(); check(canvases.length === 6, "pause / resume draw nothing");
  const m = load(false); m.F.set("light", "mist", false); check(m.canvases.length === 5, "light: 5 canvases (4 banks + 1 ground band)"); }
// ?fxloop=1: every cycle is exactly 8 s, the same fog every time
{ const a = load(false, "?fxloop=1"); a.F.set("thick", "mist", false);
  const b = load(false, "?fxloop=1"); b.F.set("thick", "mist", false);
  const ca = layers(host(a.body)).map((p) => p.style.cssText), cb = layers(host(b.body)).map((p) => p.style.cssText);
  check(ca.every((c) => num(c, "animation-duration") === 8), "?fxloop=1: every cycle (bank and ground band) takes exactly 8 s");
  check(JSON.stringify(ca) === JSON.stringify(cb), "?fxloop=1: positions and phases come from a seeded generator: the same every time"); }
{ const { F, body } = load(false); F.set("off", "mist", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("heavy", "mist", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(false); F.set("medium", "smoke", false); check(layers(host(body)).length === 9, "an unknown style: mist"); }
{ const { F, body } = load(true); F.set("thick", "mist", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("thick", "mist", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("medium", "cool", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); F.set("medium", "cool", false); check(host(body) === first, "the same setting again: not rebuilt");
  F.set("medium", "warm", false); check(host(body) !== first, "a new style: rebuilt");
  F.set("off", "warm", false); check(!host(body), "back to off: the layer goes"); }
{ const { F, body } = load(false); F.pause(); F.set("light", "mist", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"fog", "fog_style"/.test(src), "design.js: fog + fog_style are design home keys");
  check(/fog: \["off", "light", "medium", "thick"\], fog_style: \["mist", "warm", "cool"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Drifting fog"/.test(src) && /The drifting fog was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  check(/home\.fog === "thick" \? 14 : home\.fog === "light" \? 5 : 9, "fog"/.test(src), "design.js: the speed budget counts the animated layers (14 / 9 / 5)");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientFog\.set\(HOME\.fog \|\| "off", HOME\.fog_style \|\| "mist", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientFog\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientFog\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered (hidden, paused, settings), resumed after");
  const html = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8");
  check(/<script src="fx-fog\.js"><\/script>/.test(html), "index.html loads fx-fog.js");
}
console.log("All " + ok + " fog tests passed.");
