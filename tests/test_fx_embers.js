// fx-embers.js (design.home.embers + embers_from): how many embers each amount makes, sizes + the area budget, every colour a valid rgba,
// embers starting along the bottom (all) or over one spot (left / centre / right), a rise with a zigzag that flickers, shrinks and goes out,
// keyframes of transform / opacity only (no CSS variables, no filter, no blend), the 8 s loop, nothing when off / calm / Lighter / Loop,
// pause + resume, app.js wiring and design.js keeping + checking the keys. Run: node tests/test_fx_embers.js
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
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { const id = pic++; e.getContext = ctx; e.toDataURL = () => "data:image/png;base64,E" + id; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-embers.js"), "utf8"), win);
  return { E: win.AmbientEmbers, body, head, colours };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-embers") >= 0);
const num = (css, k) => +(new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)").exec(css) || [0, NaN])[1];
const kids = (h) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === "i");
const allCss = (head) => head.childNodes.map((s) => s.textContent).join("");
const okc = (c) => { const m = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),([\d.]+)\)$/.exec(c); return !!m && [1, 2, 3].every((i) => +m[i] <= 255) && +m[4] >= 0 && +m[4] <= 1; };

for (const [amount, n] of [["few", 24], ["some", 45], ["many", 75]]) {
  const { E, body, head, colours } = load(false);
  E.set(amount, "all", false);
  const h = host(body), g = kids(h), css = allCss(head);
  check(g.length === n, amount + ": " + n + " embers");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = g.reduce((a, t) => { const s = num(t.style.cssText, "width"); check(s >= 0.35 && s <= 0.9, "an ember is 0.35-0.9 vw"); return a + Math.pow(s / 100 * 1920, 2); }, 0);
  check(area / (1920 * 1080) < 0.01, amount + ": all embers under 1 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(3) + " %)");
  check(g.every((t) => { const y = num(t.style.cssText, "top"), x = num(t.style.cssText, "left"); return y >= 96 && y <= 101 && x >= 2 && x <= 98; }), amount + ": all: they start along the bottom edge");
  check(colours.length && colours.every(okc), amount + ": every colour a valid rgba (" + colours.filter((c) => !okc(c)).slice(0, 3).join(" ") + ")");
  check(!/var\(/.test(css) && !/filter|blend/.test(css), amount + ": no CSS variables, no filter, no blend mode");
  check(g.every((t, k) => new RegExp("animation-name:fx-ember" + (k % 5) + ";").test(t.style.cssText)), amount + ": each ember on one of five paths");
}
for (const [side, lo, hi] of [["left", 10, 30], ["centre", 40, 60], ["right", 70, 90], ["sky", 2, 98]]) {
  const { E, body } = load(false); E.set("many", side, false);
  check(kids(host(body)).every((t) => { const x = num(t.style.cssText, "left"); return x >= lo && x <= hi; }), side + ": they start between " + lo + " and " + hi + " %" + (side === "sky" ? " (unknown: all)" : ""));
}
{ const { E, head } = load(false); E.set("some", "all", false);
  const css = allCss(head), kf = /@keyframes fx-ember1\{([^@]*)\}/.exec(css)[1];
  const pts = [...kf.matchAll(/translate3d\((-?[\d.]+)vw,(-?[\d.]+)vh,0\) scale\(([\d.]+)\)/g)].map((m) => [+m[1], +m[2], +m[3]]);
  check(pts.length === 5 && pts[4][1] === -72 && pts.every((p, i) => !i || p[1] < pts[i - 1][1]), "a path rises steadily (72 vh on path 1)");
  check(pts[1][0] * pts[2][0] < 0 && pts[2][0] * pts[3][0] < 0, "it zigzags left and right on the way up");
  check(pts.every((p, i) => !i || p[2] <= pts[i - 1][2]) && pts[4][2] === 0.4, "it shrinks as it cools");
  check(/^0%\{opacity:0;/.test(kf) && /6%\{opacity:1\}/.test(kf) && /35%\{opacity:\.6\}/.test(kf) && /100%\{opacity:0;/.test(kf), "it flares, flickers and goes out");
  const all = (css.match(/@keyframes[^@]*/g) || []).join("");
  check(!/(left|top|width|height|margin|background)\s*:/.test(all.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/\.fx-embers i\{[^}]*opacity:0;/.test(css) && /fx-embers\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-embers,\.old-engine \.fx-embers/.test(css), "starts hidden, pausable, off in the Lighter home / old engine"); }
{ const { E, body } = load(false); E.set("many", "all", false);
  check(kids(host(body)).every((t) => { const d = num(t.style.cssText, "-webkit-animation-duration"); return d >= 4 && d <= 9; }), "live: 4-9 s from the fire to going out"); }
{ const { E, body } = load(false, "?fxloop=1"); E.set("many", "all", false);
  const g = kids(host(body));
  check(g.every((t) => [4, 8].includes(num(t.style.cssText, "-webkit-animation-duration"))), "?fxloop=1: 4 or 8 s cycles");
  check(g.every((t) => { const at = num(t.style.cssText, "-webkit-animation-delay"), d = num(t.style.cssText, "-webkit-animation-duration"); return at <= 0 && at > -d; }), "?fxloop=1: delays inside one cycle"); }
{ const { E, body } = load(false); E.set("off", "all", false); check(!host(body), "off: nothing on the page"); }
{ const { E, body } = load(false); E.set("bonfire", "all", false); check(!host(body), "an unknown amount: nothing"); }
{ const { E, body } = load(true); E.set("many", "all", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { E, body } = load(false); E.set("many", "all", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { E, body } = load(false); E.set("some", "all", false);
  E.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  E.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); E.set("some", "all", false); check(host(body) === first, "the same setting again: not rebuilt");
  E.set("some", "left", false); check(host(body) !== first && host(body), "another spot: rebuilt");
  E.set("off", "left", false); check(!host(body), "back to off: the layer goes"); }
{ const { E, body } = load(false); E.pause(); E.set("few", "all", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"embers", "embers_from"\]/.test(src), "design.js: embers, embers_from are design home keys");
  check(/embers: \["off", "few", "some", "many"\], embers_from: \["all", "left", "centre", "right"\]/.test(src), "design.js: only the listed values");
  check(/out\.push\(\["Rising embers"/.test(src) && /The rising embers were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientEmbers\.set\(HOME\.embers \|\| "off", HOME\.embers_from \|\| "all", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check(/updateAmbientWeather\(\);\s*embersSync\(\);/.test(app), "app.js: synced with the weather effects' settings");
  check((app.match(/AmbientEmbers\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientEmbers\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-embers\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-embers.js");
}
{ // design.js really keeps the keys (the sandbox of test_design_depth_card.js)
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, innerWidth: 1920, innerHeight: 1080,
    document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop } };
  sb.window = sb; sb.addEventListener = noop;
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), sb);
  const plain = (v) => JSON.parse(JSON.stringify(v)), D = sb.CouchDesign;
  const out = plain(D.sanitize({ home: { embers: "many", embers_from: "centre" } }));
  check(out.home && out.home.embers === "many" && out.home.embers_from === "centre", "sanitize keeps embers + embers_from");
  const bad = plain(D.sanitize({ home: { embers: "inferno", embers_from: "up" } }));
  check(!(bad.home && (bad.home.embers || bad.home.embers_from)), "sanitize drops a bad amount and a bad spot");
}
console.log("All " + ok + " embers tests passed.");
