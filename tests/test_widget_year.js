// The Year progress widget (widgets.js R.year): how far through the year it is, from the TV's own date: a ring and a
// percentage, the day number, the days left and (with a town, to know north from south) when the next season starts.
// Run: node tests/test_widget_year.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Year progress");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Year progress tests...");

const at = (y, m, d) => T.D.set(new Date(y, m - 1, d, 12, 0).getTime());
const south = { data: { place: { name: "Sydney", lat: -33.9, lon: 151.2 } } }, north = { data: { place: { name: "Leeds", lat: 53.8, lon: -1.5 } } };
const draw = (w, h, env, opts) => T.W.render({ kind: "year", w, h, opts: opts || {} }, env || {});
const text = (el) => el.textContent.replace(/\u00a0/g, " ");

// ---------------- 1. the numbers ----------------
at(2026, 11, 21);
let s = text(draw(360, 360, south));
ok(/Day 325 of 365/.test(s) && /40 days left/.test(s) && /89%/.test(s) && /2026/.test(s), "21 Nov 2026: day 325 of 365, 40 left, 89% (" + s + ")");
at(2026, 1, 1); s = text(draw(360, 360, south));
ok(/Day 1 of 365/.test(s) && /364 days left/.test(s) && /0%/.test(s), "1 Jan: day 1, 364 left, 0%");
at(2026, 12, 31); s = text(draw(360, 360, south));
ok(/Day 365 of 365/.test(s) && /Last day of the year/.test(s) && /100%/.test(s), "31 Dec: the last day, 100%");
at(2026, 12, 30); ok(/1 day left/.test(text(draw(360, 360, south))), "30 Dec: 1 day left (singular)");
at(2028, 2, 29); s = text(draw(360, 360, south));
ok(/Day 60 of 366/.test(s) && /306 days left/.test(s), "29 Feb 2028 (leap year): day 60 of 366");
at(2028, 12, 31); ok(/Day 366 of 366/.test(text(draw(360, 360, south))), "31 Dec 2028: day 366 of 366");
at(2100, 3, 1); ok(/Day 60 of 365/.test(text(draw(360, 360, south))), "2100 is not a leap year: 1 Mar is day 60 of 365");
at(2027, 1, 1); ok(/2027/.test(text(draw(360, 360, south))) && /Day 1 of 365/.test(text(draw(360, 360, south))), "a new year starts again at day 1");

// ---------------- 2. the season line ----------------
const season = (y, m, d, env) => { at(y, m, d); const s = text(draw(360, 360, env)); const r = /(Winter|Spring|Summer|Autumn) starts[a-z0-9 ]*/.exec(s); return r ? r[0] : null; };
ok(season(2026, 11, 21, south) === "Summer starts in 10 days", "south, 21 Nov: summer starts in 10 days (" + season(2026, 11, 21, south) + ")");
ok(season(2026, 11, 21, north) === "Winter starts in 10 days", "north, 21 Nov: winter starts in 10 days");
ok(season(2026, 11, 30, south) === "Summer starts tomorrow", "30 Nov: tomorrow");
ok(season(2026, 12, 1, south) === "Autumn starts in 90 days", "south, 1 Dec: summer began today, autumn in 90 days (" + season(2026, 12, 1, south) + ")");
ok(season(2026, 12, 1, north) === "Spring starts in 90 days", "north, 1 Dec: spring in 90 days");
ok(season(2027, 2, 28, north) === "Spring starts tomorrow", "28 Feb 2027 north: spring tomorrow");
ok(season(2028, 2, 28, north) === "Spring starts in 2 days", "28 Feb 2028 (leap): spring in 2 days");
ok(season(2026, 3, 1, south) === "Winter starts in 92 days" && season(2026, 3, 1, north) === "Summer starts in 92 days", "1 Mar: the next season is 92 days away, either side of the equator");
ok(season(2026, 6, 15, south) === "Spring starts in 78 days", "south, 15 Jun: spring in 78 days");
ok(season(2026, 9, 1, north) === "Winter starts in 91 days", "north, 1 Sep: autumn began today, winter in 91 days");
ok(season(2026, 11, 21, { data: { place: {} } }) === null && season(2026, 11, 21, {}) === null, "no town: no season line (no guess at the hemisphere)");
ok(season(2026, 11, 21, { demo: true, designer: true }) === "Summer starts in 10 days", "the designer's demo shows a southern town");
ok(season(2026, 11, 21, { data: { place: { lat: 0, lon: 10 } } }) !== null, "a town on the equator still gets a line");
at(2026, 11, 21);

// ---------------- 3. sizes, never empty ----------------
[[160, 160, "tile"], [360, 160, "wide tile"], [360, 360, "small"], [760, 360, "medium"]].forEach(([w, h, id]) => {
  const el = draw(w, h, south);
  ok(el.getAttribute("data-empty") !== "1" && /89%/.test(text(el)) && !/undefined|NaN/.test(text(el)), "year " + id + ": the ring and its percentage, no stray words");
  ok(el.all().filter((e) => e.tagName === "CIRCLE").length === 2, "year " + id + ": a track and a progress ring");
});
ok(draw(160, 160, { data: {} }).getAttribute("data-empty") !== "1" && draw(360, 360, {}).getAttribute("data-empty") !== "1", "a TV with nothing set up still shows the year");
ok(/Rest/.test(text(draw(360, 360, south, { label: "Rest" }))) && !/undefined|NaN/.test(text(draw(360, 360, south, { label: "x".repeat(300) }))), "a label from the design, hostile ones are fine");

// ---------------- 4. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "year", { label: "Rest", url: "x", month: 3 });
ok(k.label === "Rest" && k.url === undefined && k.month === undefined, "a design keeps a label, nothing else");
const cap = T.C.get("year");
ok(cap.status === "works" && T.C.need("year", "Google TV") === "works" && T.C.need("year", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("year", g).length >= 1), "widget-caps: steps for each kind of TV");
ok(cap.sizes.s.join() === "tile,wtile,small,medium" && cap.sizes.min.join() === "2,2", "sizes: 2x2, 4x2, 4x4, 8x4");
done();
