// fx-rays.js (design.home.rays + rays_from + rays_style): how many rays each amount makes, the layer area budget, rays starting
// at a sun above the top edge and fanning the right way, keyframes of transform / opacity only (angles written in, no CSS
// variables), the 8 s loop, the colours, nothing when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js
// keeping the keys. Run: node tests/test_fx_rays.js
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
  const grad = () => ({ addColorStop(o, c) { stops.push(c); } });
  const ctx = () => ({ createRadialGradient: grad, createLinearGradient: grad, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {} });
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,AA"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-rays.js"), "utf8"), win);
  return { R: win.AmbientRays, body, head, stops };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-rays") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const angle = (t) => +/transform:rotate\((-?[\d.]+)deg\)/.exec(t.style.cssText)[1];
const VW = 1920, VH = 1080;

for (const [amount, n, budget] of [["few", 4, 0.36], ["some", 6, 0.54], ["many", 8, 0.72]]) {
  const { R, body, head } = load(false);
  R.set(amount, "left", "warm", false);
  const h = host(body), rays = kids(h, "i"), glow = kids(h, "b");
  check(rays.length === n && glow.length === 1, amount + ": " + n + " rays and one glow");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = rays.reduce((a, t) => {
    const w = num(t.style.cssText, "width"), ht = num(t.style.cssText, "height");
    check(w >= 6.5 && w <= 10.5 && ht >= 70 && ht <= 96, "a ray is 6.5-10.5 vw wide, 70-96 vh long");
    return a + (w / 100 * VW) * (ht / 100 * VH);
  }, 0);
  check(area / (VW * VH) < budget, amount + ": all rays under " + budget * 100 + " % of the screen (" + (100 * area / (VW * VH)).toFixed(1) + " %)");
  check(rays.every((t) => num(t.style.cssText, "top") < 0) && num(glow[0].style.cssText, "top") < 0, amount + ": the sun is above the top edge");
  check(rays.every((t, k) => new RegExp("animation-name:fx-ray" + k + ";").test(t.style.cssText)), amount + ": each ray its own keyframes");
  const css = head.childNodes.map((s) => s.textContent).join("");
  check((css.match(/@keyframes fx-ray\d/g) || []).length === n, amount + ": " + n + " ray keyframe sets");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
}
// the fan: from the left the rays fall to the right (negative angles), from the right to the left, from the centre both ways
for (const [side, test] of [["left", (a) => a.every((x) => x < 0)], ["right", (a) => a.every((x) => x > 0)], ["centre", (a) => a.some((x) => x < 0) && a.some((x) => x > 0)]]) {
  const { R, body } = load(false); R.set("many", side, "warm", false);
  const rays = kids(host(body), "i"), a = rays.map(angle), x = num(rays[0].style.cssText, "left");
  check(test(a) && a.every((v) => Math.abs(v) <= 63), side + ": the rays fan the right way (" + a.map((v) => v.toFixed(0)).join(", ") + ")");
  check(side === "left" ? x < 20 : side === "right" ? x > 80 : x === 50, side + ": the sun sits " + side + " (" + x + " %)");
}
{ const { R, head } = load(false); R.set("some", "left", "warm", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background)\s*:/.test(kfs.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/fx-ray0\{0%,100%\{opacity:[\d.]+;transform:rotate\(-?[\d.]+deg\)\}50%\{opacity:[\d.]+;transform:rotate/.test(css), "a ray sways about its angle and breathes");
  check(/transform-origin:50% 0/.test(css), "a ray turns about the sun (its top)");
  check(/fx-rays\.fx-paused i,\.fx-rays\.fx-paused b\{[^}]*paused/.test(css) && /\.lighter \.fx-rays,\.old-engine \.fx-rays/.test(css), "pausable, and off in the Lighter home / old engine"); }
for (const [look, rgb] of [["warm", "255,238,205"], ["white", "255,255,255"], ["gold", "255,212,140"], ["purple", "255,238,205"]]) {
  const { R, stops } = load(false); R.set("few", "left", look, false);
  check(stops.length && stops.every((c) => c.indexOf("rgba(" + rgb + ",") === 0), look + ": the beams and glow are " + rgb);
}
{ const { R, body } = load(false, "?fxloop=1"); R.set("many", "centre", "gold", false);
  const h = host(body), rays = kids(h, "i");
  check([...rays, ...kids(h, "b")].every((t) => num(t.style.cssText, "-webkit-animation-duration") === 8), "?fxloop=1: every ray and the glow on an 8 s cycle");
  const at = rays.map((t) => num(t.style.cssText, "-webkit-animation-delay"));
  check(at.every((d) => d <= 0 && d > -8) && new Set(at).size === rays.length, "?fxloop=1: spread through the cycle (" + at.join(", ") + ")"); }
{ const { R, body } = load(false); R.set("off", "left", "warm", false); check(!host(body), "off: nothing on the page"); }
{ const { R, body } = load(false); R.set("lots", "left", "warm", false); check(!host(body), "an unknown amount: nothing"); }
{ const { R, body } = load(false); R.set("few", "up", "warm", false); check(num(kids(host(body), "i")[0].style.cssText, "left") === 7, "an unknown side: from the left"); }
{ const { R, body } = load(true); R.set("many", "left", "warm", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { R, body } = load(false); R.set("many", "left", "warm", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { R, body } = load(false); R.set("some", "left", "warm", false);
  R.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  R.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); R.set("some", "left", "warm", false); check(host(body) === first, "the same setting again: not rebuilt");
  R.set("some", "right", "warm", false); check(host(body) !== first && host(body), "another side: rebuilt");
  R.set("off", "right", "warm", false); check(!host(body), "back to off: the layer goes"); }
{ const { R, body } = load(false); R.pause(); R.set("few", "left", "warm", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"rays", "rays_from", "rays_style"\]/.test(src), "design.js: rays, rays_from, rays_style are design home keys");
  check(/rays: \["off", "few", "some", "many"\], rays_from: \["left", "centre", "right"\], rays_style: \["warm", "white", "gold"\]/.test(src), "design.js: only the listed values");
  check(/out\.push\(\["Light rays"/.test(src) && /The light rays were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientRays\.set\(HOME\.rays \|\| "off", HOME\.rays_from \|\| "left", HOME\.rays_style \|\| "warm", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*raysSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientRays\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientRays\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-rays\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-rays.js");
}
console.log("All " + ok + " rays tests passed.");
