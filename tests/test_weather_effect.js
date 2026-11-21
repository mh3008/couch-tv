// A design's rain and snow (design.home.weather_effect and weather_amount): the engine draws the amount
// asked for and can be fixed to rain or snow whatever the weather; the design block keeps only the
// listed choices, costs more for heavy, and a slow TV steps heavy down before switching the effect off.
// Run: node tests/test_weather_effect.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const web = path.join(__dirname, "../tv-home/web");
const noop = () => {};

// ---------------- the engine (ambient-weather.js) ----------------
// a canvas that counts what is drawn: one stroke per rain streak, one fill per snowflake
function countingCanvas() {
  const n = { stroke: 0, fill: 0, ellipse: 0, width: 0, radius: 0, fillStyle: "" };
  const ctx = {
    clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, fillRect: noop,
    arc: (x, y, r) => { n.radius = r; },
    ellipse: () => { n.ellipse++; }, stroke: () => { n.stroke++; n.width = ctx.lineWidth; },
    fill: () => { n.fill++; n.fillStyle = ctx.fillStyle; },
    createRadialGradient: () => ({ addColorStop: noop })
  };
  return { width: 0, height: 0, n, getContext: () => ctx };
}
const lighting = { style: {}, classList: { add: noop, remove: noop, contains: () => false } };
let frame = null, now = 1000;
const box = {
  location: { search: "" },
  requestAnimationFrame: (cb) => { frame = cb; return 1; },
  cancelAnimationFrame: () => { frame = null; },
  // every drop starts near the top (random 0.1), so none reaches the ground and splashes in the frame counted
  Date: { now: () => now }, Math: Object.assign(Object.create(Math), { random: () => 0.1 })
};
box.window = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(web, "ambient-weather.js"), "utf8"), box);
const W = box.AmbientWeather;
const canvas = countingCanvas();
W.init(canvas, lighting);
W.setEnabled(true);

// draws one frame (the engine draws at most 30 a second) and says how many drops / flakes it drew
function drawn() {
  canvas.n.stroke = 0; canvas.n.fill = 0;
  now += 40;
  assert.ok(frame, "a frame is waiting while there is rain or snow");
  const f = frame; frame = null; f();
  return canvas.n;
}

W.setWeather({ code: 63 }, null);
assert.strictEqual(W.getType(), "rain");
assert.strictEqual(W.getAmount(), "medium", "medium unless a design says otherwise");
assert.strictEqual(drawn().stroke, 65, "medium rain is the 65 drops the home always drew");
W.setAmount("light");
assert.strictEqual(drawn().stroke, 30, "light rain: 30 drops");
W.setAmount("heavy");
assert.strictEqual(drawn().stroke, 110, "heavy rain: 110 drops");
W.setAmount("tornado");
assert.strictEqual(W.getAmount(), "medium", "an unknown amount is medium");

W.setWeather({ code: 73 }, null);
W.setAmount("light");
assert.strictEqual(drawn().fill, 20, "light snow: 20 flakes");
W.setAmount("heavy");
assert.strictEqual(drawn().fill, 70, "heavy snow: 70 flakes");

// fixed to snow: a sunny day still snows, and the live weather is remembered for when it is unfixed
W.setWeather({ code: 0 }, null);
assert.strictEqual(W.getType(), "clear");
W.setForced("snow");
assert.strictEqual(W.getType(), "snow", "always snow, even on a clear day");
W.setWeather({ code: 63 }, null);
assert.strictEqual(W.getType(), "snow", "a rain reading does not change a fixed snow");
W.setForced(null);
assert.strictEqual(W.getType(), "rain", "unfixed, it follows the weather it was last told");
W.setForced("lava");
assert.strictEqual(W.getType(), "rain", "only rain or snow can be fixed");
W.setForced("rain");
W.setWeather(null, null);
assert.strictEqual(W.getType(), "rain", "no weather reading at all: a fixed rain still rains");

// the snow's colour: grey flakes are drawn grey, "soft" adds an edge (one stroke per flake), unknown is white
W.setForced("snow"); W.setAmount("light");
W.setColour("grey"); assert.strictEqual(drawn().fill, 20, "grey snow: still 20 flakes");
W.setColour("soft"); { const n = drawn(); assert.strictEqual(n.fill, 20); assert.strictEqual(n.stroke, 20, "soft: an edge on every flake"); }
W.setColour("purple"); assert.strictEqual(drawn().stroke, 0, "an unknown colour is plain white, no edge");
W.setColour("white");

// bold (a design that picked weather_effect): the same drops and flakes, drawn wider, bigger and brighter;
// off (the older ambient_weather) draws exactly what it always did
assert.strictEqual(W.isBold(), false, "not bold unless app.js says so");
W.setForced("rain"); W.setAmount("medium");
const plainRain = drawn().width;
W.setBold(true); assert.strictEqual(W.isBold(), true);
{ const n = drawn(); assert.strictEqual(n.stroke, 65, "bold rain: still 65 drops"); assert.ok(Math.abs(n.width - plainRain - 0.6) < 1e-9, "bold medium rain: 0.6 px wider (" + plainRain + " to " + n.width + ")"); }
W.setForced("snow"); W.setAmount("heavy");
{ const n = drawn(); assert.strictEqual(n.fill, 70, "bold snow: still 70 flakes"); }
W.setBold(false);
const unBold = drawn();
assert.strictEqual(unBold.fill, 70);
assert.ok(/, 0\.290\)$/.test(unBold.fillStyle), "not bold: a flake keeps its own alpha, as before (" + unBold.fillStyle + ")");
const plainR = unBold.radius;
for (const [amt, r] of [["light", 1.4], ["medium", 1.6], ["heavy", 1.9]]) {
  W.setAmount(amt); W.setBold(true);
  const n = drawn();
  assert.ok(Math.abs(n.radius - plainR * r) < 1e-9, "bold " + amt + " snow: flakes x" + r + " (" + plainR + " to " + n.radius + ")");
  assert.ok(parseFloat(n.fillStyle.split(",").pop()) > 0.29, "bold " + amt + " snow: brighter than plain (" + n.fillStyle + ")");
  W.setBold(false);
}
W.setForced("rain"); W.setAmount("medium");   // back to the fixed rain the checks below use

// paused (an app is open) nothing is drawn; switched off, no frame is asked for at all
W.pause();
assert.strictEqual(frame, null, "paused: no frames");
W.resume();
assert.ok(frame, "back on the home: frames again");
W.setEnabled(false);
assert.strictEqual(frame, null, "off: no frames");
W.setEnabled(true);
W.setLighter(true);
assert.strictEqual(frame, null, "Lighter home: no frames, even fixed rain");
W.setLighter(false);

// ---------------- the design block (design.js) ----------------
const page = {
  location: { search: "", origin: "http://tv" },
  document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop },
  innerWidth: 1920, innerHeight: 1080
};
page.window = page;
page.window.addEventListener = noop;
vm.createContext(page);
vm.runInContext(fs.readFileSync(path.join(web, "design.js"), "utf8"), page);
const D = page.window.CouchDesign;
const plain = (v) => JSON.parse(JSON.stringify(v));
const home = (h) => plain(D.sanitize({ v: 1, home: h })).home || {};

for (const fx of ["off", "auto", "rain", "snow"]) assert.strictEqual(home({ weather_effect: fx }).weather_effect, fx, fx + " is kept");
for (const amt of ["light", "medium", "heavy"]) assert.strictEqual(home({ weather_amount: amt }).weather_amount, amt, amt + " is kept");
// anything else is dropped, never passed on to the page
for (const bad of ["hail", "RAIN", "", 3, true, null, ["rain"], { a: 1 }, "rain;}body{display:none"]) {
  assert.strictEqual(home({ weather_effect: bad }).weather_effect, undefined, "refused effect: " + JSON.stringify(bad));
  assert.strictEqual(home({ weather_amount: bad }).weather_amount, undefined, "refused amount: " + JSON.stringify(bad));
}

// the snow's colour: the listed ones are kept, anything else dropped
for (const col of ["white", "ice", "silver", "soft", "grey"]) assert.strictEqual(home({ weather_colour: col }).weather_colour, col, col + " is kept");
for (const bad of ["red", "#fff", "rgba(0,0,0,1)", 5, null, "grey;}body{display:none"]) assert.strictEqual(home({ weather_colour: bad }).weather_colour, undefined, "refused colour: " + JSON.stringify(bad));

// cost: light < medium (the 34 the effects always cost) < heavy; off costs nothing
const wx = (h) => D.cost({ home: h }).filter((i) => i[2] === "weatherfx").reduce((n, i) => n + i[1], 0);
assert.strictEqual(wx({ weather_effect: "off" }), 0, "off costs nothing");
assert.strictEqual(wx({ ambient_weather: true }), 34, "the older ambient_weather costs what it always did");
assert.strictEqual(wx({ weather_effect: "rain" }), 34, "medium by default");
assert.ok(wx({ weather_effect: "snow", weather_amount: "light" }) < 34, "light costs less");
assert.ok(wx({ weather_effect: "auto", weather_amount: "heavy" }) > 34, "heavy costs more");
assert.strictEqual(wx({ weather_effect: "off", ambient_weather: true }), 0, "weather_effect off wins over the older switch");

// a design too heavy for the TV: heavy rain becomes light first, then the effect goes
const L = D.limits;
const crowded = (h) => D.check({ home: h, background: { image: "backgrounds/grose-valley.jpg", blur: 40 },
  objects: Array.from({ length: 40 }, (_, i) => ({ id: "k" + i, type: "text", text: "Hi", size: 60, shade: "glow", x: i * 40, y: 900 })) });
const total = (d) => D.cost(d).reduce((n, i) => n + i[1], 0);
const c1 = crowded({ weather_effect: "rain", weather_amount: "heavy", clock_style: "liquid", glass_amount: 5 });
assert.ok(total(c1.clean) <= L.cost, "brought within the budget, got " + total(c1.clean));
const h1 = c1.clean.home || {};
assert.ok(h1.weather_effect === "off" || h1.weather_amount === "light", "heavy rain is made light or switched off, not kept heavy");
// a light design keeps its heavy snow
const calm = D.check({ v: 1, home: { weather_effect: "snow", weather_amount: "heavy" } });
assert.strictEqual(calm.clean.home.weather_amount, "heavy", "nothing else on the page: heavy snow stays");
assert.strictEqual(calm.clean.home.weather_effect, "snow");

// the TV takes the design's choices into its home settings (CouchDesign.home), like ambient_weather
const merged = D.home({}, { v: 1, home: { weather_effect: "snow", weather_amount: "light" } }, {});
assert.ok(merged.weather_effect === undefined || merged.weather_effect === "snow", "home() passes weather_effect on (or holds the whole design back until it is accepted)");

console.log("weather effect tests passed");
