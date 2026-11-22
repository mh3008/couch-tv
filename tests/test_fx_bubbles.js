// fx-bubbles.js (design.home.bubbles): how many bubbles each amount makes, nothing when off / calm / Lighter,
// pause + resume, the layer area budget (all bubbles together well under a screen), and design.js keeping the key.
// Run: node tests/test_fx_bubbles.js
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
  const doc = {
    head, body,
    createElement: (t) => {
      const e = new FakeEl(t);
      if (t === "canvas") { e.getContext = () => ({ createRadialGradient: () => ({ addColorStop() {} }), beginPath() {}, arc() {}, fill() {}, stroke() {} }); e.toDataURL = () => "data:image/png;base64,AA"; }
      return e;
    },
    getElementById: (id) => (id === "weather-canvas" ? wc : null)
  };
  const win = { document: doc, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-bubbles.js"), "utf8"), win);
  return { B: win.AmbientBubbles, body, doc };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-bubbles") >= 0);

for (const [amount, n] of [["light", 12], ["medium", 18], ["many", 28]]) {
  const { B, body } = load(false);
  B.set(amount, "#E060B0", false);
  const h = host(body);
  check(h && h.childNodes.length === n, amount + ": " + n + " bubbles");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  // area: every bubble <= 140 px square; all of them together on a 1920x1080 screen
  const area = h.childNodes.reduce((a, b) => { const s = +/width:(\d+)px/.exec(b.style.cssText)[1]; check(s >= 36 && s <= 140, "a bubble is 36-140 px"); return a + s * s; }, 0);
  check(area / (1920 * 1080) < 0.12, amount + ": all bubbles under 12 % of the screen (" + (100 * area / (1920 * 1080)).toFixed(2) + " %)");
  check(h.childNodes.every((b) => /animation-name:fx-bub[012]/.test(b.style.cssText)), amount + ": each bubble rises on its own animation");
}
{ const { B, body } = load(false); B.set("off", "#fff", false); check(!host(body), "off: nothing on the page"); }
{ const { B, body } = load(false); B.set("bogus", "#fff", false); check(!host(body), "an unknown amount: nothing"); }
{ const { B, body } = load(true); B.set("many", "#fff", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { B, body } = load(false); B.set("many", "#fff", true); check(!host(body), "Lighter home / Loop look: nothing"); }
{
  const { B, body } = load(false); B.set("medium", "#123456", false);
  B.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause: the bubbles stop where they are");
  B.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume: they go on");
  B.set("off", "#123456", false); check(!host(body), "back to off: the layer goes");
}
// design.js keeps home.bubbles from the allowed list only, and counts it in the speed budget
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"bubbles"/.test(src), "design.js: bubbles is a design home key");
  check(/bubbles: \["off", "light", "medium", "many"\]/.test(src), "design.js: only off / light / medium / many");
  check(/out\.push\(\["Bubbles"/.test(src), "design.js: bubbles count in the speed budget");
  check(/The bubbles were switched off: too slow/.test(src), "design.js: a design that is too heavy loses the bubbles first-ish");
}
console.log("All " + ok + " bubbles tests passed.");
