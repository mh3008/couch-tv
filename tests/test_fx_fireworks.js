// fx-fireworks.js (design.home.fireworks + fireworks_style): bursts and sparks per amount, the layer area budget, bursts in the upper sky
// only, rocket + flash + spark keyframes (transform / opacity only, angles written in, no CSS variables), one cycle per burst with the
// rocket first and the sparks gone before the cycle ends, a new spot + colour when a cycle ends, the loop timing, every style's colours,
// nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping the keys.
// Run: node tests/test_fx_fireworks.js
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
  const ctx = () => ({ createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {} });
  let n = 0;
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,AA" + (n++); } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-fireworks.js"), "utf8"), win);
  return { F: win.AmbientFireworks, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-fireworks") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const cssOf = (head) => head.childNodes.map((s) => s.textContent).join("");
const sec = (v) => parseFloat(v);

for (const [amount, bursts, sparks] of [["few", 2, 24], ["some", 3, 32], ["lots", 4, 32]]) {
  const { F, body, head } = load(false);
  F.set(amount, "mixed", false);
  const h = host(body), bs = kids(h, "b");
  check(bs.length === bursts, amount + ": " + bursts + " bursts");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  bs.forEach((b) => {
    check(kids(b, "i").length === sparks && kids(b, "s").length === 1 && kids(b, "u").length === 1, amount + ": " + sparks + " sparks, one rocket, one flash per burst");
    check(parseFloat(b.style.top) >= 14 && parseFloat(b.style.top) <= 44, amount + ": a burst goes off in the upper sky (top " + b.style.top + ")");
    check(parseFloat(b.style.left) >= 10 && parseFloat(b.style.left) <= 90, amount + ": inside the width");
    const d = sec(b.style.animationDuration), at = sec(b.style.animationDelay);
    check(d >= 6 && d <= 9 && at <= 0 && at >= -d, amount + ": its own cycle of 6-9 s, started part-way (negative delay)");
    check(/^c\d$/.test(b.className), amount + ": a colour class");
  });
  // composited area: sparks 130x20, rocket 200x12, flash 400x400, per burst (the flash is the biggest layer)
  const area = bursts * (sparks * 130 * 20 + 200 * 12 + 400 * 400);
  check(area / (1920 * 1080) < 0.5, amount + ": all layers under half a screen (" + (100 * area / (1920 * 1080)).toFixed(1) + " %)");
  const css = cssOf(head);
  check((css.match(/@keyframes fx-fwk\d+\{/g) || []).length === sparks, amount + ": " + sparks + " spark keyframe sets (shared by every burst)");
  check(/@keyframes fx-fwk-up\{/.test(css) && /@keyframes fx-fwk-glow\{/.test(css), amount + ": rocket + flash keyframes");
  check(!/var\(/.test(css), amount + ": no CSS variables");
  check(!/blur|filter|box-shadow|text-shadow/.test(css), amount + ": no blur, filter or shadow");
}
{ const { F, head } = load(false); F.set("some", "mixed", false);
  const css = cssOf(head);
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background)\s*:/.test(kfs.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/@keyframes fx-fwk-up\{0%\{opacity:0;transform:translate\(0px,360px\) rotate\(-90deg\)/.test(css), "the rocket starts 360 px below the burst, head up, hidden");
  check(/9%\{opacity:1;transform:translate\(0px,0px\) rotate\(-90deg\)/.test(css) && /10%,100%\{opacity:0/.test(css), "the rocket is at the burst by 9 % and gone at 10 %");
  check(/@keyframes fx-fwk-glow\{0%,9%\{opacity:0/.test(css), "the flash waits for the burst");
  // every spark: hidden until 9 %, bright at 10 %, gone (opacity 0) from 38 % to the end of the cycle
  const sparkSets = css.match(/@keyframes fx-fwk\d+\{[^@]*\}\}?/g) || [];
  check(sparkSets.length >= 24, "spark keyframes found");
  check(sparkSets.every((s) => /0%,9%\{opacity:0/.test(s) && /10%\{opacity:1/.test(s) && /52%,100%\{opacity:0/.test(s)), "every spark: hidden to 9 %, bright at 10 %, gone by 52 %");
  // the sparks fan out over the full circle, the farthest by about 230 px, and droop (positive y offset at the end)
  const ends = sparkSets.map((s) => /52%,100%\{opacity:0;transform:translate\((-?[\d.]+)px,(-?[\d.]+)px\)/.exec(s)).map((m) => [+m[1], +m[2] - 100]);
  const dist = ends.map((p) => Math.hypot(p[0], p[1]));
  check(Math.max.apply(null, dist) <= 361 && Math.min.apply(null, dist) >= 289, "sparks end 290-360 px from the burst (" + Math.min.apply(null, dist).toFixed(0) + "-" + Math.max.apply(null, dist).toFixed(0) + ")");
  check(ends.some((p) => p[0] > 250) && ends.some((p) => p[0] < -250) && ends.some((p) => p[1] > 250) && ends.some((p) => p[1] < -250), "sparks go left, right, up and down");
  check(/fx-fireworks\.fx-paused i,\.fx-fireworks\.fx-paused s,\.fx-fireworks\.fx-paused u\{[^}]*paused/.test(css) && /\.lighter \.fx-fireworks,\.old-engine \.fx-fireworks/.test(css), "pausable, and off in the Lighter home / old engine");
  check(/background-image:url\(data:image\/png/.test(css), "pictures are drawn once as data URLs"); }
// styles: every palette gives its own colour classes
for (const [style, n] of [["mixed", 6], ["gold", 4], ["cool", 4], ["warm", 4]]) {
  const { F, head, body } = load(false); F.set("some", style, false);
  const css = cssOf(head);
  check((css.match(/b\.c\d i\{background-image/g) || []).length === n, style + ": " + n + " colours (spark pictures)");
  check((css.match(/b\.c\d u\{background-image/g) || []).length === n && (css.match(/b\.c\d s\{background-image/g) || []).length === n, style + ": a flash and a rocket picture per colour");
  kids(host(body), "b").forEach((b) => check(+b.className.slice(1) < n, style + ": a burst's colour is one of the " + n));
}
{ const { F, body } = load(false); F.set("some", "nonsense", false); check(kids(host(body), "b").length === 3, "an unknown style falls back to mixed"); }
// a cycle ends: the burst moves and changes colour (live, not the loop); the dark moment is when the rocket's animation restarts
{ FakeEl.prototype.addEventListener = function (t, f) { (this.handlers = this.handlers || {})[t] = f; };
  const { F, body } = load(false); F.set("lots", "mixed", false);
  const h = host(body), fire = h.handlers && h.handlers.animationiteration;
  check(typeof fire === "function", "live: a listener for animationiteration on the host");
  const b = kids(h, "b")[0], before = [b.style.left, b.style.top, b.className, b.style.transform].join("|");
  fire({ target: kids(b, "i")[0] }); check([b.style.left, b.style.top, b.className, b.style.transform].join("|") === before, "a spark's own iteration does nothing");
  let moved = false;
  for (let t = 0; t < 20 && !moved; t++) { fire({ target: kids(b, "s")[0] }); moved = [b.style.left, b.style.top, b.className, b.style.transform].join("|") !== before; }
  check(moved, "the rocket's iteration moves the burst");
  check(parseFloat(b.style.top) >= 14 && parseFloat(b.style.top) <= 44 && parseFloat(b.style.left) >= 10 && parseFloat(b.style.left) <= 90 && /^c[0-5]$/.test(b.className), "the new place is still the upper sky, the colour one of the six");
  check(b.style.cssText === "" || b.style.cssText.length < 20, "a move sets properties, it does not grow the style string");
  const loopLoad = load(false, "?fxloop=1"); loopLoad.F.set("some", "mixed", false);
  check(!(host(loopLoad.body).handlers), "?fxloop=1: no re-randomising listener (the clip must repeat exactly)");
  delete FakeEl.prototype.addEventListener; }
{ // ?fxloop=1: 8 s cycles, fixed places, one burst after another, nothing re-randomised
  const { F, body } = load(false, "?fxloop=1"); F.set("some", "mixed", false);
  const bs = kids(host(body), "b");
  const shows = bs.map((b) => { const d = sec(b.style.animationDelay); check(sec(b.style.animationDuration) === 8 && d <= 0 && d > -8, "?fxloop=1: an 8 s cycle, a negative delay"); return +((8 + d) % 8).toFixed(2); });
  check(new Set(shows).size === bs.length, "?fxloop=1: the bursts go off one after another (" + shows.join(", ") + " s offsets)");
  check(new Set(bs.map((b) => b.style.left)).size === bs.length, "?fxloop=1: each burst in its own place");
  const second = load(false, "?fxloop=1"); second.F.set("some", "mixed", false);
  check(kids(host(second.body), "b").every((b, k) => b.style.left === bs[k].style.left && b.style.top === bs[k].style.top && b.className === bs[k].className), "?fxloop=1: the same places and colours every load (the clip repeats exactly)"); }
{ const { F, body } = load(false); F.set("off", "mixed", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("many", "mixed", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(true); F.set("lots", "mixed", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("lots", "mixed", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("some", "gold", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); F.set("some", "gold", false); check(host(body) === first, "the same setting again: not rebuilt");
  F.set("some", "cool", false); check(host(body) !== first && !!host(body), "another style: rebuilt");
  F.set("off", "cool", false); check(!host(body), "back to off: the layer goes"); }
{ const { F, body } = load(false); F.pause(); F.set("few", "mixed", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"fireworks", "fireworks_style"\]/.test(src), "design.js: fireworks + fireworks_style are design home keys");
  check(/fireworks: \["off", "few", "some", "lots"\]/.test(src) && /fireworks_style: \["mixed", "gold", "cool", "warm"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Fireworks"/.test(src) && /The fireworks were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientFireworks\.set\(HOME\.fireworks \|\| "off", HOME\.fireworks_style \|\| "mixed", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientFireworks\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientFireworks\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-fireworks\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-fireworks.js");
}
console.log("All " + ok + " fireworks tests passed.");
