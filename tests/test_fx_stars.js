// fx-stars.js (design.home.stars): how many stars and shooting stars each amount makes, the layer area budget, stars in the
// sky part only, twinkle + shoot keyframes (transform / opacity, angles written in, no CSS variables), the loop timing, nothing
// when off / calm / Lighter / Loop, pause + resume, app.js wiring and design.js keeping the key. Run: node tests/test_fx_stars.js
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
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,AA"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-stars.js"), "utf8"), win);
  return { S: win.AmbientStars, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-stars") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);

for (const [amount, n, m, tw] of [["few", 30, 2, 12], ["some", 50, 3, 16], ["many", 80, 4, 20]]) {
  const { S, body, head } = load(false);
  S.set(amount, false);
  const h = host(body), stars = kids(h, "i"), shoot = kids(h, "s");
  check(stars.length === tw && shoot.length === m, amount + ": " + tw + " twinkling stars (of " + n + "), " + m + " shooting stars");
  const skyEl = kids(h, "b");
  check(skyEl.length === 1 && skyEl[0].className === "fx-stars-sky" && !/animation/.test(skyEl[0].style.cssText), amount + ": the other " + (n - tw) + " stars in ONE still picture (never animated)");
  check(tw + m <= 30, amount + ": at most 30 animated layers (" + (tw + m) + "): the 22 Nov stick bench missed 24.8 % with 84");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = stars.reduce((a, t) => { const s = num(t.style.cssText, "width"); check(s >= 6 && s <= 16, "a star is 6-16 px"); return a + s * s; }, 0);
  check(area / (1920 * 1080) < 0.01, amount + ": all stars under 1 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(2) + " %)");
  check(stars.every((t) => num(t.style.cssText, "top") <= 62), amount + ": stars only in the sky (top 62 %)");
  check(shoot.every((t, k) => new RegExp("animation-name:fx-shoot" + k + ";").test(t.style.cssText) && num(t.style.cssText, "top") <= 30), amount + ": each shooting star its own keyframes, starting high");
  const css = head.childNodes.map((s) => s.textContent).join("");
  check((css.match(/@keyframes fx-shoot\d/g) || []).length === m, amount + ": " + m + " shoot keyframe sets");
  check(!/var\(/.test(css), amount + ": no CSS variables");
}
{ const { S, head } = load(false); S.set("some", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  const kfs = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background)\s*:/.test(kfs.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/0%,85%\{opacity:0/.test(css) && /97%,100%\{opacity:0/.test(css), "a shooting star is hidden for most of its cycle");
  check(/fx-stars\.fx-paused i,\.fx-stars\.fx-paused s\{[^}]*paused/.test(css) && /\.lighter \.fx-stars,\.old-engine \.fx-stars/.test(css), "pausable, and off in the Lighter home / old engine"); }
{ const { S, body } = load(false, "?fxloop=1"); S.set("many", false);
  const h = host(body), shoot = kids(h, "s");
  check(kids(h, "i").every((t) => [2, 4].includes(num(t.style.cssText, "-webkit-animation-duration"))), "?fxloop=1: twinkles of 2 or 4 s");
  shoot.forEach((t) => { const d = num(t.style.cssText, "-webkit-animation-delay"); check(num(t.style.cssText, "-webkit-animation-duration") === 8 && d <= 0 && d > -8, "?fxloop=1: an 8 s cycle, a negative delay"); });
  // each shooting star shows (85-97 % of its cycle) at a different moment of the 8 s clip
  const shows = shoot.map((t) => +(((6.8 + num(t.style.cssText, "-webkit-animation-delay")) % 8 + 8) % 8).toFixed(2));
  check(new Set(shows).size === shoot.length, "?fxloop=1: the shooting stars come one after another (" + shows.join(", ") + " s)"); }
{ const { S, body } = load(false); S.set("off", false); check(!host(body), "off: nothing on the page"); }
{ const { S, body } = load(false); S.set("lots", false); check(!host(body), "an unknown amount: nothing"); }
{ const { S, body } = load(true); S.set("many", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { S, body } = load(false); S.set("many", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { S, body } = load(false); S.set("some", false);
  S.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  S.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); S.set("some", false); check(host(body) === first, "the same setting again: not rebuilt");
  S.set("off", false); check(!host(body), "back to off: the layer goes"); }
{ const { S, body } = load(false); S.pause(); S.set("few", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"stars"\]/.test(src), "design.js: stars is a design home key");
  check(/stars: \["off", "few", "some", "many"\]/.test(src), "design.js: only off / few / some / many");
  check(/out\.push\(\["Shooting stars"/.test(src) && /The shooting stars were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientStars\.set\(HOME\.stars \|\| "off", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientStars\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientStars\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-stars\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-stars.js");
}
console.log("All " + ok + " stars tests passed.");
