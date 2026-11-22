// fx-petals.js (design.home.petals + petals_style): how many petals each amount makes, the layer area budget, each petal
// falling (outer, transform) and fluttering (inner, transform), the fall spanning the screen, the three styles, nothing when
// off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping the keys. Run: node tests/test_fx_petals.js
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
  const ctx = () => ({ translate() {}, scale() {}, createLinearGradient: () => ({ addColorStop() {} }), beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, closePath() {}, fill() {}, stroke() {} });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,AA"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, innerHeight: 1080, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-petals.js"), "utf8"), win);
  return { P: win.AmbientPetals, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-petals") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];

for (const [amount, n] of [["few", 16], ["some", 28], ["many", 44]]) {
  for (const st of ["sakura", "autumn", "gold"]) {
    const { P, body } = load(false);
    P.set(amount, st, false);
    const h = host(body);
    check(h && h.childNodes.length === n, amount + " " + st + ": " + n + " petals");
    if (st !== "sakura") continue;
    check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
    const area = h.childNodes.reduce((a, p) => { const s = num(p.style.cssText, "width"); check(s >= 22 && s <= 50, "a petal is 22-50 px (" + s + ")"); return a + s * s; }, 0);
    check(area / (1920 * 1080) < 0.06, amount + ": all petals under 6 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(2) + " %)");
    check(h.childNodes.every((p) => /animation-name:fx-fall[0-3]/.test(p.style.cssText) && p.childNodes.length === 1 && /animation-name:fx-flut[01]/.test(p.childNodes[0].style.cssText)), amount + ": each petal falls (outer) and flutters (inner)");
    check(h.childNodes.every((p) => num(p.style.cssText, "-webkit-animation-delay") < 0), amount + ": already mid-fall when the home opens (negative delays)");
  }
}
{ const { P, body, head } = load(false); P.set("some", "autumn", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|opacity|background)\s*:/.test(kfs.replace(/transform:[^;}]*/g, "")), "the keyframes move transform only");
  check(/translate3d\(0,-60px,0\)/.test(css) && /,1140px,0\)/.test(css), "a fall runs from above the screen to below it (this screen's height)");
  check(/scaleX\(-1\)/.test(css), "the flutter turns the petal over");
  check(/fx-petals\.fx-paused i,\.fx-petals\.fx-paused b\{[^}]*paused/.test(css) && /\.lighter \.fx-petals,\.old-engine \.fx-petals/.test(css), "pausable, and off in the Lighter home / old engine"); }
{ const { P, body } = load(false, "?fxloop=1"); P.set("many", "sakura", false);
  const durs = host(body).childNodes.flatMap((p) => [num(p.style.cssText, "-webkit-animation-duration"), num(p.childNodes[0].style.cssText, "-webkit-animation-duration")]);
  check(durs.every((d) => 8 % d === 0), "?fxloop=1: every loop divides 8 s (" + [...new Set(durs)].join(", ") + ")"); }
{ const { P, body } = load(false); P.set("off", "sakura", false); check(!host(body), "off: nothing on the page"); }
{ const { P, body } = load(false); P.set("lots", "sakura", false); check(!host(body), "an unknown amount: nothing"); }
{ const { P, body } = load(false); P.set("some", "confetti", false); check(host(body).childNodes.length === 28, "an unknown style: sakura"); }
{ const { P, body } = load(true); P.set("many", "sakura", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { P, body } = load(false); P.set("many", "sakura", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { P, body } = load(false); P.set("some", "gold", false);
  P.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  P.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); P.set("some", "gold", false); check(host(body) === first, "the same setting again: not rebuilt");
  P.set("some", "autumn", false); check(host(body) !== first, "a new style: rebuilt");
  P.set("off", "autumn", false); check(!host(body), "back to off: the layer goes"); }
{ const { P, body } = load(false); P.pause(); P.set("few", "sakura", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"petals", "petals_style"/.test(src), "design.js: petals + petals_style are design home keys");
  check(/petals: \["off", "few", "some", "many"\], petals_style: \["sakura", "autumn", "gold"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Falling "/.test(src) && /The falling petals were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientPetals\.set\(HOME\.petals \|\| "off", HOME\.petals_style \|\| "sakura", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientPetals\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientPetals\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered (hidden, paused, settings), resumed after");
  const html = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8");
  check(/<script src="fx-petals\.js"><\/script>/.test(html), "index.html loads fx-petals.js");
}
console.log("All " + ok + " petals tests passed.");
