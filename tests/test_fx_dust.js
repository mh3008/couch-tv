// fx-dust.js (design.home.dust + dust_from): how many motes each amount makes, mote sizes + the area budget, the still shaft (rotated once,
// never animated), every mote inside the shaft for both sides, wander paths that stay small, keyframes of transform / opacity only (no CSS
// variables, no filter, no blend, no clip), the 8 s loop, nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and
// design.js keeping + checking the keys. Run: node tests/test_fx_dust.js
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
  const ctx = () => ({ createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, arc() {}, fill() {}, fillRect() {} });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,D"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-dust.js"), "utf8"), win);
  return { D: win.AmbientDust, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-dust") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");
const VH = 9 / 16;

// the shaft's own frame: a point (left vw, top vh) -> (s along 0..1, u across -0.5..0.5)
function shaftCoords(D, side, x, y) {
  const S = D.SHAFT, a = S.tilt * Math.PI / 180, dir = side === "right" ? -1 : 1, L = S.len * VH;
  const x0 = side === "right" ? 100 - S.x : S.x, y0 = S.y * VH, dx = x - x0, dy = y * VH - y0;
  const along = [dir * Math.sin(a), Math.cos(a)], across = [dir * Math.cos(a), -Math.sin(a)];
  return [(dx * along[0] + dy * along[1]) / L, (dx * across[0] + dy * across[1]) / S.w];
}

for (const [amount, n, a] of [["few", 40, 14], ["some", 70, 20], ["many", 110, 28]]) {
  const { D, body, head } = load(false);
  D.set(amount, "left", false);
  const h = host(body), motes = kids(h, "i"), shaft = kids(h, "b"), css = allCss(head);
  check(motes.length === a && shaft.length === 2, amount + ": " + a + " moving motes (of " + n + "), the shaft + one still picture of the other " + (n - a));
  check(shaft[1].style.cssText.replace(/url\([^)]*\)/, "") === shaft[0].style.cssText.replace(/url\([^)]*\)/, "") && !/animation/.test(shaft[1].style.cssText), amount + ": the still motes lie exactly over the shaft, never animated");
  check(a <= 30, amount + ": at most 30 animated layers (Design Lessons 15b)");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = motes.reduce((a, t) => { const s = num(t.style.cssText, "width"); check(s >= 0.15 && s <= 0.4, "a mote is 0.15-0.4 vw"); return a + Math.pow(s / 100 * 1920, 2); }, 0);
  check(area / (1920 * 1080) < 0.01, amount + ": all motes under 1 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(3) + " %)");
  check(!/var\(/.test(css) && !/filter|blend|clip|mask/.test(css), amount + ": no CSS variables, no filter, no blend, no clip / mask");
  check(motes.every((t, k) => new RegExp("animation-name:fx-dust" + (k % 6) + ";").test(t.style.cssText)), amount + ": each mote on one of six paths");
}
for (const side of ["left", "right"]) {
  const { D, body } = load(false); D.set("many", side, false);
  const h = host(body), sh = kids(h, "b")[0], motes = kids(h, "i");
  const rot = +/transform:rotate\((-?[\d.]+)deg\)/.exec(sh.style.cssText)[1];
  check(side === "left" ? rot < 0 : rot > 0, side + ": the shaft slants away from its corner (" + rot + " deg)");
  check(!/animation/.test(sh.style.cssText), side + ": the shaft never animates");
  const inside = motes.every((t) => { const [s, u] = shaftCoords(D, side, num(t.style.cssText, "left"), num(t.style.cssText, "top")); return s >= 0.05 && s <= 0.91 && Math.abs(u) <= 0.39; });
  check(inside, side + ": every mote starts inside the shaft");
  const xs = motes.map((t) => num(t.style.cssText, "left")), mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  check(side === "left" ? mean < 50 : mean > 50, side + ": the motes gather on the " + side + " (mean x " + mean.toFixed(1) + " vw)");
}
{ const { D, head } = load(false); D.set("some", "left", false);
  const css = allCss(head);
  const hops = [...css.matchAll(/translate3d\((-?[\d.]+)vw,(-?[\d.]+)vh,0\)/g)].map((m) => Math.hypot(+m[1], +m[2] * VH));
  check(Math.max(...hops) <= 2.5, "a mote wanders at most " + Math.max(...hops).toFixed(2) + " vw: it stays in the light");
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background)\s*:/.test(kfs.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check((css.match(/@keyframes fx-dust\d/g) || []).length === 6 && /0%,100%\{opacity:\.25;transform:translate3d\(0vw,0vh,0\)/.test(css), "six paths, each back home at the end");
  check(/fx-dust\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-dust,\.old-engine \.fx-dust/.test(css), "pausable, and off in the Lighter home / old engine"); }
{ const { D, body } = load(false, "?fxloop=1"); D.set("many", "left", false);
  const m = kids(host(body), "i");
  check(m.every((t) => num(t.style.cssText, "-webkit-animation-duration") === 8), "?fxloop=1: every mote on an 8 s cycle");
  const at = m.map((t) => num(t.style.cssText, "-webkit-animation-delay"));
  check(at.every((d) => d <= 0 && d > -8), "?fxloop=1: delays spread through the cycle"); }
{ const { D, body } = load(false); D.set("some", "up", false); const mean = kids(host(body), "i").map((t) => num(t.style.cssText, "left")).reduce((a, b) => a + b, 0) / 20; check(mean < 50, "an unknown side: from the left"); }
{ const { D, body } = load(false); D.set("off", "left", false); check(!host(body), "off: nothing on the page"); }
{ const { D, body } = load(false); D.set("storm", "left", false); check(!host(body), "an unknown amount: nothing"); }
{ const { D, body } = load(true); D.set("many", "left", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { D, body } = load(false); D.set("many", "left", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { D, body } = load(false); D.set("some", "left", false);
  D.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  D.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); D.set("some", "left", false); check(host(body) === first, "the same setting again: not rebuilt");
  D.set("some", "right", false); check(host(body) !== first && host(body), "another side: rebuilt");
  D.set("off", "right", false); check(!host(body), "back to off: the layer goes"); }
{ const { D, body } = load(false); D.pause(); D.set("few", "left", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"dust", "dust_from"\]/.test(src), "design.js: dust, dust_from are design home keys");
  check(/dust: \["off", "few", "some", "many"\], dust_from: \["left", "right"\]/.test(src), "design.js: only the listed values");
  check(/out\.push\(\["Dust in the sun"/.test(src) && /The dust in the sun was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientDust\.set\(HOME\.dust \|\| "off", HOME\.dust_from \|\| "left", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*dustSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientDust\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientDust\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-dust\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-dust.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), DS = sb.CouchDesign;
  const out = plain(DS.sanitize({ home: { dust: "many", dust_from: "right" } }));
  check(out.home && out.home.dust === "many" && out.home.dust_from === "right", "sanitize keeps dust + dust_from");
  const bad = plain(DS.sanitize({ home: { dust: "sandstorm", dust_from: "up" } }));
  check(!(bad.home && (bad.home.dust || bad.home.dust_from)), "sanitize drops a bad amount and a bad side");
}
console.log("All " + ok + " dust tests passed.");
