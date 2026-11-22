// fx-fireflies.js (design.home.fireflies + fireflies_colour): how many motes each amount makes, the layer area budget,
// each mote on a wander + a pulse (transform / opacity), nothing when off / calm / Lighter, pause + resume, and
// design.js keeping the keys (the colour only as #rrggbb). Run: node tests/test_fx_fireflies.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
function load(reduce) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas");
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = () => ({ createRadialGradient: () => ({ addColorStop() {} }), beginPath() {}, arc() {}, fill() {} }); e.toDataURL = () => "data:image/png;base64,AA"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-fireflies.js"), "utf8"), win);
  return { F: win.AmbientFireflies, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-flies") >= 0);

for (const [amount, n] of [["few", 24], ["some", 40], ["many", 60]]) {
  const { F, body } = load(false);
  F.set(amount, "#FFB347", false);
  const h = host(body);
  check(h && h.childNodes.length === n, amount + ": " + n + " fireflies");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const area = h.childNodes.reduce((a, f) => { const s = +/width:(\d+)px/.exec(f.style.cssText)[1]; check(s >= 24 && s <= 64, "a mote is 24-64 px"); return a + s * s; }, 0);
  check(area / (1920 * 1080) < 0.12, amount + ": all motes under 12 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(2) + " %)");
  check(h.childNodes.every((f) => /animation-name:fx-fly[0-3],fx-glow/.test(f.style.cssText)), amount + ": each mote wanders and pulses");
}
{ const { F, body, head } = load(false); F.set("some", "#fff", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  check(!/(left|top|width|height|margin|background-position)\s*:[^;}]*[;}][^@]*@?/.test((css.match(/@keyframes[^@]*/g) || []).join("").replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "the keyframes move transform and opacity only");
  check(/fx-flies\.fx-paused i\{[^}]*paused/.test(css) && /\.lighter \.fx-flies/.test(css), "pausable, and off in the Lighter home"); }
{ const { F, body } = load(false); F.set("off", "#fff", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("lots", "#fff", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(true); F.set("many", "#fff", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("many", "#fff", true); check(!host(body), "Lighter home / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("some", "#123456", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  F.set("off", "#123456", false); check(!host(body), "back to off: the layer goes"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"fireflies", "fireflies_colour"/.test(src), "design.js: fireflies + fireflies_colour are design home keys");
  check(/fireflies: \["off", "few", "some", "many"\]/.test(src), "design.js: only off / few / some / many");
  check(/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(hm\.fireflies_colour/.test(src), "design.js: the colour only as #rrggbb");
  check(/out\.push\(\["Fireflies"/.test(src) && /The fireflies were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
}
console.log("All " + ok + " fireflies tests passed.");
