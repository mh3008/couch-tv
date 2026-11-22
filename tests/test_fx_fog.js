// fx-fog.js (design.home.fog + fog_style): how many banks each amount makes, the layer area budget, each bank drifting (outer,
// transform) and breathing (inner, opacity), the three styles, nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring
// and design.js keeping the keys. Run: node tests/test_fx_fog.js
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
  const stops = [];
  const ctx = () => ({ save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, arc() {}, fill() {}, fillStyle: "",
    createRadialGradient: () => ({ addColorStop(o, c) { stops.push(c); } }) });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,AA"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, innerHeight: 1080, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-fog.js"), "utf8"), win);
  return { F: win.AmbientFog, body, head, stops };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-fog") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];

for (const [amount, n, maxArea] of [["light", 3, 0.5], ["medium", 5, 0.75], ["thick", 7, 1.0]]) {
  for (const st of ["mist", "warm", "cool"]) {
    const { F, body } = load(false);
    F.set(amount, st, false);
    const h = host(body);
    check(h && h.childNodes.length === n, amount + " " + st + ": " + n + " banks");
    if (st !== "mist") continue;
    check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
    const area = h.childNodes.reduce((a, p) => { const w = num(p.style.cssText, "width"), ht = num(p.style.cssText, "height"); check(w >= 600 && w <= 1250 && ht >= 150 && ht <= 400, "a bank is 600-1250 by 150-400 px (" + w + "x" + ht + ")"); return a + w * ht; }, 0);
    check(area / (1920 * 1080) < maxArea, amount + ": all banks under " + maxArea + " of one screen (" + (area / (1920 * 1080)).toFixed(2) + ")");
    check(h.childNodes.every((p) => /animation-name:fx-roll[0-2]/.test(p.style.cssText) && p.childNodes.length === 1 && /animation-delay:-/.test(p.childNodes[0].style.cssText)), amount + ": each bank drifts (outer) and breathes (inner), already mid-way (negative delays)");
  }
}
{ const { F, body, head } = load(false); F.set("medium", "mist", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background|filter)\s*:/.test(kfs.replace(/transform:[^;}]*/g, "").replace(/opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/translate3d\(-260px,0,0\)/.test(css) && /fx-breathe/.test(css) && !/filter:\s*blur/.test(css), "a drift is a translate3d, the breath an opacity, no blur filter");
  check(/fx-fog\.fx-paused i,\.fx-fog\.fx-paused b\{[^}]*paused/.test(css) && /\.lighter \.fx-fog,\.old-engine \.fx-fog/.test(css), "pausable, and off in the Lighter home / old engine"); }
{ const { F, body, stops } = load(false); F.set("thick", "warm", false); check(stops.some((s) => /rgba\(255,228,190/.test(s)), "warm fog is a warm white"); }
{ const { F, body } = load(false, "?fxloop=1"); F.set("thick", "mist", false);
  const durs = host(body).childNodes.flatMap((p) => [num(p.style.cssText, "-webkit-animation-duration"), num(p.childNodes[0].style.cssText, "-webkit-animation-duration")]);
  check(durs.every((d) => 8 % d === 0 || 8 % (2 * d) === 0), "?fxloop=1: every leg and breath (they alternate: a full cycle is twice the time) divides 8 s (" + [...new Set(durs)].join(", ") + ")");
  check(durs.every((d) => (2 * d) % 8 === 0 || 8 % (2 * d) === 0), "?fxloop=1: a full cycle is 4 s or 8 s"); }
{ const { F, body } = load(false); F.set("off", "mist", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("heavy", "mist", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(false); F.set("medium", "smoke", false); check(host(body).childNodes.length === 5, "an unknown style: mist"); }
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
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientFog\.set\(HOME\.fog \|\| "off", HOME\.fog_style \|\| "mist", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientFog\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientFog\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered (hidden, paused, settings), resumed after");
  const html = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8");
  check(/<script src="fx-fog\.js"><\/script>/.test(html), "index.html loads fx-fog.js");
}
console.log("All " + ok + " fog tests passed.");
