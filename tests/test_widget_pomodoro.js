// The Pomodoro widget (widgets.js R.pomodoro): a focus / break rhythm cut from midnight on the TV's own clock,
// whole minutes left in a ring, nothing animated. Run: node tests/test_widget_pomodoro.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Pomodoro");

console.log("Running Pomodoro tests...");

// local time on the fake TV clock
const at = (h, m) => new Date(2026, 10, 21, h, m, 0).getTime();
const drawAt = (h, m, w, hh, opts) => { const T = K.home(at(h, m)); return T.W.render({ kind: "pomodoro", w, h: hh, opts: opts || {} }, {}); };
const words = (el) => el.textContent.replace(/\u00a0/g, " ");

// ---------------- 1. the block maths (25 focus + 5 break, from midnight) ----------------
const cases = [
  [14, 0, "Focus", "25", "Break in 25 min"],
  [14, 12, "Focus", "13", "Break in 13 min"],
  [14, 24, "Focus", "1", "Break in 1 min"],
  [14, 25, "Break", "5", "Focus in 5 min"],
  [14, 29, "Break", "1", "Focus in 1 min"],
  [14, 30, "Focus", "25", "Break in 25 min"],
  [0, 0, "Focus", "25", "Break in 25 min"],
  [23, 59, "Break", "1", "Focus in 1 min"],
];
cases.forEach(([h, m, word, left, next]) => {
  const t = words(drawAt(h, m, 400, 160));
  ok(t.indexOf(left) === 0 && t.indexOf(word) > 0, h + ":" + m + " -> " + word + ", " + left + " min left (" + t + ")");
  ok(t.indexOf(next) >= 0, h + ":" + m + " -> " + next);
});

// ---------------- 2. options, sizes, no empty state ----------------
const mid = (opts) => words(drawAt(10, 50, 400, 160, opts));
ok(/^10/.test(mid({ focus: 50, rest: 10 })) && /Break/.test(mid({ focus: 50, rest: 10 })) && /Focus in 10 min/.test(mid({ focus: 50, rest: 10 })), "50 + 10 at 10:50 (650 mod 60 = 50) is a break with 10 left");
ok(/Pomodoro/.test(mid()) && /Study/.test(mid({ label: "Study" })), "the word Pomodoro, or the design's own label");
ok(!/undefined|NaN/.test(mid({ focus: "x", rest: -4, label: "y".repeat(300) })), "hostile options are fine");
[[400, 160, "wtile"], [360, 360, "small"], [160, 160, "tile (too small to list, still safe)"]].forEach(([w, h, id]) => {
  const el = drawAt(9, 7, w, h);
  ok(el.getAttribute("data-empty") !== "1", "pomodoro " + id + ": never the empty state");
  ok(!/undefined|NaN/.test(el.textContent), "pomodoro " + id + ": no stray words");
  ok(el.all().filter((e) => e.tagName === "CIRCLE").length === 2, "pomodoro " + id + ": a track and an arc");
});
// the arc is how much of the block is left
const arc = (h, m) => drawAt(h, m, 400, 160).all().filter((e) => e.tagName === "CIRCLE")[1].getAttribute("stroke-dashoffset");
ok(Math.abs(arc(14, 0) - 0) < 1 && Math.abs(arc(14, 12) - 276 * (1 - 13 / 25)) < 0.5, "full ring at the start of a block, 13/25 left at :12");

// ---------------- 3. nothing animated, one shared tick ----------------
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.js"), "utf8");
const body = src.slice(src.indexOf("R.pomodoro = function"), src.indexOf("R.pomodoro = function") + 3200);
ok(!/setInterval|setTimeout|requestAnimationFrame|animation/.test(body.slice(0, body.indexOf("live(root, 30000"))) && /live\(root, 30000, draw\)/.test(body), "no timer or animation of its own: the shared live() tick, every 30 s");

// ---------------- 4. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "pomodoro", { label: "Study", focus: 50, rest: 10, url: "x", sound: "bell" });
ok(k.label === "Study" && k.focus === 50 && k.rest === 10 && k.url === undefined && k.sound === undefined, "a design keeps label, focus, rest; nothing else");
const bad = K.kept(CD, "pomodoro", { focus: 500, rest: 0 });
ok(bad.focus === undefined || (bad.focus >= 10 && bad.focus <= 60), "focus outside 10 to 60 is dropped or clamped (" + JSON.stringify(bad) + ")");
const T0 = K.home(at(9, 0));
const cap = T0.C.get("pomodoro");
ok(cap.status === "works" && T0.C.need("pomodoro", "Google TV") === "works" && T0.C.need("pomodoro", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T0.C.steps("pomodoro", g).length >= 1), "widget-caps: steps for each kind of TV");
ok(cap.sizes.s.join() === "wtile,small" && cap.sizes.min.join() === "4,2", "sizes: 4x2 and 4x4");
done();
