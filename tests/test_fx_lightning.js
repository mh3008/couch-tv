// fx-lightning.js (design.home.lightning: off | rare | storm): one sky layer + two bolt pictures, off the page between
// flashes; a flash shows them for about a second and the timer schedules the next; nothing when off / calm / Lighter;
// pause stops the timer; design.js keeps the key. Run: node tests/test_fx_lightning.js
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
  const timers = [];
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = () => ({ save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }); e.toDataURL = () => "data:image/png;base64,AA"; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, matchMedia: () => ({ matches: !!reduce, addListener() {} }),
    setTimeout: (f, ms) => { timers.push({ f, ms, live: true }); return timers.length; }, clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].live = false; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-lightning.js"), "utf8"), win);
  return { L: win.AmbientLightning, body, head, timers };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-light") >= 0);
const live = (timers) => timers.filter((t) => t.live);

for (const [amount, lo, hi] of [["rare", 8000, 22000], ["storm", 4000, 11000]]) {
  const { L, body, timers } = load(false);
  L.set(amount, false);
  const h = host(body);
  check(h && h.childNodes.length === 3, amount + ": one sky layer + two bolts");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  const next = live(timers);
  check(next.length === 1 && next[0].ms >= lo && next[0].ms <= hi, amount + ": the next flash in " + lo / 1000 + "-" + hi / 1000 + " s (" + Math.round(next[0].ms) + " ms)");
  check(h.childNodes.every((c) => c.className.indexOf("fx-on") < 0), amount + ": nothing shown (off the page) between flashes");
}
{
  const { L, body, timers } = load(false); L.set("rare", false);
  L.flash(); const h = host(body);
  check(h.childNodes[0].className.indexOf("fx-on") >= 0, "a flash shows the sky layer");
  const off = timers.filter((t) => t.live && t.ms === 1000);
  check(off.length === 1, "and takes it off the page after a second"); off[0].f();
  check(h.childNodes.every((c) => c.className.indexOf("fx-on") < 0), "off again");
  L.pause(); check(live(timers).filter((t) => t.ms !== 1000).length === 0 && h.className.indexOf("fx-paused") >= 0, "pause: no next flash");
  L.resume(); check(live(timers).some((t) => t.ms >= 8000), "resume: the next flash is scheduled");
  L.set("off", false); check(!host(body), "back to off: the layer goes");
}
{ const { L, head } = load(false); L.set("storm", false);
  const css = head.childNodes.map((s) => s.textContent).join("");
  check(/\.fx-light b\{[^}]*height:55%/.test(css), "the flash covers the sky only (55 % of the screen)");
  check(/\.fx-light b\{[^}]*display:none/.test(css) && /\.fx-light i\{[^}]*display:none/.test(css), "flash + bolts are off the page unless flashing");
  const frames = (css.match(/@keyframes [^{]*\{[^@]*/g) || []).join("");
  check(frames && !/(left|top|width|height|transform)\s*:/.test(frames), "the flashes move opacity only");
  check(/\.lighter \.fx-light/.test(css), "off in the Lighter home"); }
{ const { L, body } = load(false); L.set("off", false); check(!host(body), "off: nothing"); }
{ const { L, body } = load(false); L.set("always", false); check(!host(body), "an unknown amount: nothing"); }
{ const { L, body } = load(true); L.set("storm", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { L, body } = load(false); L.set("storm", true); check(!host(body), "Lighter home / Loop look: nothing"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"lightning"/.test(src) && /lightning: \["off", "rare", "storm"\]/.test(src), "design.js: lightning is a design home key, off / rare / storm");
  check(/out\.push\(\["Lightning"/.test(src) && /The lightning was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
}
console.log("All " + ok + " lightning tests passed.");
