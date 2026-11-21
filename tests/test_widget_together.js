// The Days together widget (widgets.js R.together): the days, and the years, months and days, since a date the
// design names, with a heart. Worked out from the TV's own date; a date in the future counts down to it; with no
// date it asks for one. Run: node tests/test_widget_together.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Days together");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Days together tests...");

const at = (y, m, d) => T.D.set(new Date(y, m - 1, d, 12, 0).getTime());
const draw = (w, h, opts, env) => T.W.render({ kind: "together", w, h, opts: opts || {} }, env || {});
const text = (el) => el.textContent.replace(/ /g, " ");
const tag = (el, t) => el.all().filter((e) => e.tagName === t);

// ---------------- 1. the count ----------------
at(2026, 11, 21);
let s = text(draw(360, 360, { year: 2024, month: 8, day: 10 }));
ok(/833/.test(s) && /days together/.test(s) && /2 years, 3 months, 11 days/.test(s), "10 Aug 2024 to 21 Nov 2026: 833 days, 2 years, 3 months, 11 days (" + s + ")");
s = text(draw(360, 360, { year: 2025, month: 11, day: 21 }));
ok(/Happy anniversary/.test(s) && /365/.test(s) && /1 year\b/.test(s), "exactly a year: Happy anniversary, 365 days, 1 year");
s = text(draw(360, 360, { year: 2026, month: 11, day: 20 }));
ok(/1day together/.test(s) && !/days together/.test(s) && !/1 day/.test(s), "yesterday: 1 day together (singular), no second line saying the same");
s = text(draw(360, 360, { year: 2026, month: 11, day: 21 }));
ok(/Day one/.test(s) && !/NaN|undefined/.test(s), "today: Day one");
s = text(draw(360, 360, { year: 2020, month: 1, day: 5 }));
ok(/2,512/.test(s) && /6 years, 10 months, 16 days/.test(s), "thousands get a comma: 2,512 days");
// month ends and leap days
at(2027, 3, 1); s = text(draw(360, 360, { year: 2027, month: 1, day: 31 }));
ok(/1 month, 1 day/.test(s) && /29days/.test(s), "31 Jan to 1 Mar: 1 month and 1 day (the month is cut at the end of February), 29 days");
at(2028, 2, 29); s = text(draw(360, 360, { year: 2024, month: 2, day: 29 }));
ok(/Happy anniversary/.test(s) && /1,461days/.test(s) && /4 years/.test(s), "a leap day start: 4 years on 29 Feb 2028 (1,461 days)");
at(2027, 2, 28); s = text(draw(360, 360, { year: 2024, month: 2, day: 29 }));
ok(/Happy anniversary/.test(s) && /3 years/.test(s) && /1,095days/.test(s), "in a common year the leap day counts on 28 Feb: 3 years, 1,095 days");
at(2026, 11, 21); s = text(draw(360, 360, { year: 2025, month: 2, day: 31 }));
ok(/631days/.test(s) && /1 year, 8 months, 24 days/.test(s), "31 Feb is read as 28 Feb 2025: 631 days");
ok(!/NaN|undefined/.test(s) && /days together/.test(s), "31 Feb is read as the last day of February, not an error");
// a date in the future counts down
s = text(draw(360, 360, { year: 2026, month: 12, day: 25 }));
ok(/34/.test(s) && /days to go/.test(s) && !/together/.test(s.replace("Together", "")), "a future date counts down: 34 days to go");
// midnight: the count moves with the TV's date
at(2026, 11, 22); ok(/834/.test(text(draw(360, 360, { year: 2024, month: 8, day: 10 }))), "the next day it says 834, with no new request");

// ---------------- 2. never empty, honest when it has no date ----------------
at(2026, 11, 21);
const bare = draw(360, 360, {});
ok(bare.getAttribute("data-empty") === "1" && /Set your day in couch-tv Studio/.test(text(bare)), "no date: it says to set one in Studio");
const demo = draw(360, 360, {}, { demo: true, designer: true });
ok(demo.getAttribute("data-empty") !== "1" && /2 years, 3 months, 11 days/.test(text(demo)) && tag(demo, "PATH").length >= 1, "the designer and the gallery show a sample, with the heart");
ok(/Our story/.test(text(draw(360, 360, { year: 2024, month: 8, day: 10, label: "Our story" }))) && /Together/.test(text(draw(360, 360, { year: 2024, month: 8, day: 10 }))), "the label, Together by default");
ok(!/undefined|NaN/.test(text(draw(360, 360, { year: 2024, month: 8, day: 10, label: "x".repeat(400) }))), "a hostile label is fine");

// ---------------- 3. every size ----------------
K.sizes(T.C, "together").forEach(([id, w, h]) => {
  const e = draw(w, h, { year: 2024, month: 8, day: 10 });
  ok(e.getAttribute("data-empty") !== "1" && tag(e, "SVG").length === 1 && /833/.test(text(e)) && !/undefined|NaN|\.\.\./.test(text(e)), "together " + id + ": the heart and the days");
  ok(draw(w, h, {}).getAttribute("data-empty") === "1", "together " + id + ": with no date it asks for one");
});

// ---------------- 4. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "together", { year: 2024, month: 8, day: 10, label: "Our story", unit: "weeks", url: "x" });
ok(k.year === 2024 && k.month === 8 && k.day === 10 && k.label === "Our story" && k.unit === undefined && k.url === undefined, "a design keeps a date and a label, nothing else");
const bad = K.kept(CD, "together", { year: 99999, month: 44, day: -3 });
ok(bad.year === 2100 && bad.month === 12 && bad.day === 1, "a date out of range is brought back into range");
const junk = K.kept(CD, "together", { year: "soon", month: "x", day: "x" });
ok(junk.year === undefined && junk.month === undefined && junk.day === undefined, "words as a date are dropped");
const cap = T.C.get("together");
ok(cap.status === "works" && T.C.need("together", "Google TV") === "works" && T.C.need("together", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("together", g).length >= 1), "widget-caps: steps for each kind of TV");
done();
