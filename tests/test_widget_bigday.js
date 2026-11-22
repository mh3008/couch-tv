// The Big day widget (feat/bigday): the days to a named day + the hours, minutes and seconds ticking; a yearly day comes
// back next year, a one-off day (with a year) says so plainly after; "Today!" with confetti on the day.
// Run: node tests/test_widget_bigday.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Big day");
const NOW = new Date(2026, 10, 22, 21, 30, 15).getTime();   // Sunday 22 Nov 2026, 9:30:15pm
const T = K.home(NOW);
const W = T.W;
console.log("Running Big day tests...");
const draw = (opts, w, h) => W.render({ kind: "bigday", w: w || 360, h: h || 360, opts }, {});

// ---------------- 1. the count ----------------
const trip = draw({ label: "Bali", month: 12, day: 5 });
ok(/Bali13days/.test(trip.textContent), "13 days to 5 Dec (" + trip.textContent.slice(0, 60) + ")");
ok(/02:29:45/.test(trip.textContent), "the ticker: 2:29:45 to the end of today (" + trip.textContent + ")");
ok(/Party1day(?!s)/.test(draw({ label: "Party", month: 11, day: 23 }).textContent), "tomorrow: 1 day");
const bday = draw({ label: "Mum", month: 3, day: 2 });
ok(/Mum100days/.test(bday.textContent), "a yearly day already gone this year: next year's (2 Mar 2027 is 100 days away) (" + bday.textContent.slice(0, 40) + ")");
const once = draw({ label: "Wedding", year: 2027, month: 2, day: 14 });
ok(/Wedding84days/.test(once.textContent), "a one-off day next year: 84 days (" + once.textContent.slice(0, 40) + ")");

// ---------------- 2. the day itself, and after ----------------
const today = draw({ label: "Holiday", month: 11, day: 22 });
const find = (el, cls) => { if (el.className && String(el.className).split(" ").indexOf(cls) >= 0) return el; for (const c of el.childNodes || []) { const f = find(c, cls); if (f) return f; } return null; };
const fx = find(today, "cw-bd-fx");
ok(/Today!/.test(today.textContent) && fx && fx.childNodes.length === 18, "on the day: Today! with 18 confetti pieces");
const gone = draw({ label: "Concert", year: 2026, month: 11, day: 1 });
ok(/That was/.test(gone.textContent) && /couch-tv Studio/.test(gone.textContent), "a one-off day that has passed: says so, never a negative count");
ok(!/-\d/.test(gone.textContent), "no negative numbers");
K.sizes(T.C, "bigday").forEach(([id, w, h]) => {
  const el = W.render({ kind: "bigday", w, h, opts: { label: "Bali", month: 12, day: 5 } }, {});
  ok(/13/.test(el.textContent), "bigday " + id + ": the count shows (" + w + "x" + h + ")");
});
const short = W.render({ kind: "bigday", w: 360, h: 160, opts: { label: "Bali", month: 12, day: 5 } }, {});
ok(/days to go/.test(short.textContent) && !/:\d\d:/.test(short.textContent), "a short box: the days, no ticker");

// ---------------- 3. design.js keeps it; the confetti moves by transform + opacity ----------------
const CD = K.design();
const k = K.kept(CD, "bigday", { label: "Bali", year: 2027, month: 2, day: 14, icon: "party" });
ok(k.label === "Bali" && k.year === 2027 && k.month === 2 && k.day === 14 && k.icon === "party", "design.js keeps label, year, month, day, icon (" + JSON.stringify(k) + ")");
ok(K.kept(CD, "bigday", { year: 1066 }).year === 2000 && !K.kept(CD, "bigday", { label: "Party 2027" }).label, "years are kept within 2000-2100; no digits in the name");
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const block = css.slice(css.indexOf("/* Big day"));
const frames = (block.match(/@keyframes cw-bd-fall \{[^@]*/) || [""])[0];
ok(frames && !/(left|top|width|height|margin)\s*:/.test(frames), "the confetti keyframes move transform + opacity only");
ok(/html\.lighter \.cw-bd-fx/.test(block) && /prefers-reduced-motion/.test(block), "no confetti on the Lighter home or with reduced motion");
done();
