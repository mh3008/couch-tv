// The Birthdays widget (widgets.js R.birthdays): the next birthdays of the people a design names (a first name,
// a month and a day, a year if they want "turns 21"), worked out from the TV's own date; "Happy birthday" on the
// day; with nobody named it asks for names. Run: node tests/test_widget_birthdays.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Birthdays");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Birthdays tests...");

const at = (y, m, d) => T.D.set(new Date(y, m - 1, d, 12, 0).getTime());
const draw = (w, h, opts, env) => T.W.render({ kind: "birthdays", w, h, opts: opts || {} }, env || {});
const text = (el) => el.textContent.replace(/\u00a0/g, " ");
const tag = (el, t) => el.all().filter((e) => e.tagName === t);
const PEOPLE = [{ name: "Anna", month: 11, day: 24 }, { name: "Ben", month: 12, day: 2, year: 2005 }, { name: "Cleo", month: 11, day: 21, year: 2000 }, { name: "Dan", month: 1, day: 9 }];

// ---------------- 1. who is next ----------------
at(2026, 11, 21);
let s = text(draw(360, 360, { birthdays: PEOPLE }));
ok(s.indexOf("Cleo") < s.indexOf("Anna") && /Happy birthday/.test(s) && /Turns 26/.test(s), "on the day: Cleo first, Happy birthday, Turns 26 (" + s + ")");
at(2026, 11, 22); s = text(draw(560, 560, { birthdays: PEOPLE }));
ok(s.indexOf("Anna") < s.indexOf("Ben") && s.indexOf("Ben") < s.indexOf("Dan") && s.indexOf("Dan") < s.indexOf("Cleo"), "the day after: Anna, Ben, Dan, then Cleo's next one a year away (order by how soon)");
ok(/Tue 24 Nov/.test(s) && /Wed 2 Dec. Turns 21/.test(s) && (s.match(/In 2 days/g) || []).length === 1, "the date, 'Turns 21' where a year is given (Ben, 2 Dec 2026), and how soon said once per person");
at(2026, 11, 23); s = text(draw(560, 560, { birthdays: PEOPLE }));
ok(/Tomorrow/.test(s), "the day before: Tomorrow");
at(2026, 12, 31); s = text(draw(560, 560, { birthdays: PEOPLE }));
ok(s.indexOf("Dan") < s.indexOf("Cleo") && /In 9 days/.test(s), "over a new year: 9 Jan is 9 days away");
// 29 February
const leap = [{ name: "Lea", month: 2, day: 29, year: 2000 }];
at(2027, 2, 27); s = text(draw(360, 360, { birthdays: leap }));
ok(/Tomorrow/.test(s) && /Turns 27/.test(s), "a 29 Feb birthday is kept on 28 Feb in a common year (Turns 27 in 2027)");
at(2028, 2, 28); s = text(draw(360, 360, { birthdays: leap }));
ok(/Tomorrow/.test(s) && /Turns 28/.test(s), "and on the 29th in a leap year");
at(2026, 11, 21);
// a year in the future or nonsense gives no age
s = text(draw(360, 360, { birthdays: [{ name: "Baby", month: 12, day: 25, year: 2027 }] }));
ok(!/Turns/.test(s) && /Baby/.test(s), "a year that has not come gives no age");

// ---------------- 2. never empty, honest with nobody ----------------
const bare = draw(360, 360, {});
ok(bare.getAttribute("data-empty") === "1" && /Add birthdays in couch-tv Studio/.test(text(bare)), "nobody named: it says to add some in Studio");
ok(draw(360, 360, { birthdays: [] }).getAttribute("data-empty") === "1", "an empty list: the same");
const demo = draw(360, 360, {}, { demo: true, designer: true });
ok(demo.getAttribute("data-empty") !== "1" && /Mum/.test(text(demo)) && /In 3 days/.test(text(demo)), "the designer and the gallery show sample people, the next in 3 days");
ok(/Family/.test(text(draw(360, 360, { birthdays: PEOPLE, label: "Family" }))) && /Birthdays/.test(text(draw(360, 360, { birthdays: PEOPLE }))), "the label, Birthdays by default");
ok(!/undefined|NaN/.test(text(draw(360, 360, { birthdays: [{ name: "x".repeat(300), month: 11, day: 25 }] }))), "a hostile name is fine");

// ---------------- 3. every size ----------------
K.sizes(T.C, "birthdays").forEach(([id, w, h]) => {
  [[2026, 11, 21], [2026, 11, 22]].forEach(([y, m, d]) => {
    at(y, m, d);
    const e = draw(w, h, { birthdays: PEOPLE });
    ok(e.getAttribute("data-empty") !== "1" && /Cleo|Anna/.test(text(e)) && !/undefined|NaN|\.\.\./.test(text(e)), "birthdays " + id + " on " + d + "/" + m + ": the next birthday");
  });
  ok(draw(w, h, {}).getAttribute("data-empty") === "1", "birthdays " + id + ": with nobody it asks for names");
});

// ---------------- 4. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "birthdays", { label: "Family", birthdays: [{ name: "Anna", month: 11, day: 24, year: 1990, phone: "x" }, { name: "Ben", month: 13, day: 2 }, { name: "Cy3", month: 1, day: 1 }, { month: 1, day: 1 }, { name: "Dee", month: "x", day: 1 }, "Eve", null, { name: "Flo", month: 2, day: 31 }], url: "x" });
ok(k.label === "Family" && k.url === undefined, "a design keeps a label and the people, nothing else");
const names = (k.birthdays || []).map((p) => p.name);
ok(names.join() === "Anna,Ben,Flo", "a person needs a name in words, a month and a day (a name with a digit, no name, text as a date, a string, null are dropped: " + names.join() + ")");
ok(k.birthdays[0].year === 1990 && k.birthdays[0].phone === undefined && k.birthdays[1].month === 12 && k.birthdays[2].day === 31, "a year is kept, other fields dropped, a month past 12 is brought back to 12");
ok(K.kept(CD, "birthdays", { birthdays: Array.from({ length: 20 }, (_, i) => ({ name: "Person", month: 1, day: 1 + i })) }).birthdays.length === 8, "at most eight people");
ok(K.kept(CD, "birthdays", { birthdays: "Anna" }).birthdays === undefined || K.kept(CD, "birthdays", { birthdays: "Anna" }).birthdays.length === 0, "a string where the list should be is dropped");
const multi = K.kept(CD, "birthdays", { birthdays: [{ name: "Ann\nMarie", month: 5, day: 5 }, { name: "Call 0412 345 678", month: 5, day: 5 }] }).birthdays || [];
ok(multi.length === 1 && multi[0].name === "Ann Marie", "a name on two lines is joined; a phone number as a name is dropped");
const cap = T.C.get("birthdays");
ok(cap.status === "works" && T.C.need("birthdays", "Google TV") === "works" && T.C.need("birthdays", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("birthdays", g).length >= 1), "widget-caps: steps for each kind of TV");
done();
