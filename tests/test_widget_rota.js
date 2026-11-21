// The Whose turn widget (widgets.js R.rota): a chore rota for the names a design gives, passing on every day or every
// week (Monday to Sunday), worked out from the TV's own date. Run: node tests/test_widget_rota.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Whose turn");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Whose turn tests...");

const at = (y, m, d, h) => T.D.set(new Date(y, m - 1, d, h === undefined ? 12 : h, 0).getTime());
const draw = (w, h, opts, env) => T.W.render({ kind: "rota", w, h, opts: opts || {} }, env || {});
const text = (el) => el.textContent.replace(/\u00a0/g, " ");
const NAMES = ["Anna", "Ben", "Cleo"];
const who = (opts, w, h) => { const s = text(draw(w || 360, h || 360, opts)); const m = /(Anna|Ben|Cleo)/.exec(s.replace(/^(Dishes|Whose turn)/, "")); return m && m[1]; };

// ---------------- 1. every day ----------------
at(2026, 11, 21);
const first = who({ turns: NAMES });
const idx = NAMES.indexOf(first);
ok(idx >= 0, "one person has it today (" + first + ")");
at(2026, 11, 22); ok(who({ turns: NAMES }) === NAMES[(idx + 1) % 3], "tomorrow it is the next name");
at(2026, 11, 23); ok(who({ turns: NAMES }) === NAMES[(idx + 2) % 3], "and the one after");
at(2026, 11, 24); ok(who({ turns: NAMES }) === NAMES[idx], "then back to the first (every third day)");
at(2026, 11, 21, 0); const a0 = who({ turns: NAMES }); at(2026, 11, 21, 23); ok(who({ turns: NAMES }) === a0 && a0 === first, "the same person from 00:00 to 23:00: it changes at midnight, not before");
at(2026, 12, 31); const dec31 = who({ turns: NAMES }); at(2027, 1, 1); ok(NAMES.indexOf(who({ turns: NAMES })) === (NAMES.indexOf(dec31) + 1) % 3, "over a new year it carries on");
at(2028, 2, 28); const f28 = NAMES.indexOf(who({ turns: NAMES })); at(2028, 2, 29); const f29 = NAMES.indexOf(who({ turns: NAMES })); at(2028, 3, 1); const m1 = NAMES.indexOf(who({ turns: NAMES }));
ok(f29 === (f28 + 1) % 3 && m1 === (f29 + 1) % 3, "over 29 February: one step a day, none skipped or repeated");
// the month ends and daylight saving changes never skip a day (checked over a year)
let steps = 0, prev = null, bad = 0;
for (let d = 0; d < 400; d++) { at(2026, 1, 1 + d); const i = NAMES.indexOf(who({ turns: NAMES })); if (prev !== null && i !== (prev + 1) % 3) bad++; prev = i; steps++; }
ok(bad === 0 && steps === 400, "400 days in a row, each one step on from the last (including the clock changes)");
at(2026, 11, 21);
let s = text(draw(360, 360, { turns: NAMES }));
ok(/Today/.test(s) && /Tomorrow: /.test(s), "today's name leads, with tomorrow's below (" + s + ")");
ok(s.indexOf("Tomorrow: " + NAMES[(idx + 1) % 3]) >= 0, "tomorrow's name is the next one");

// ---------------- 2. shift and one person ----------------
ok(who({ turns: NAMES, shift: 1 }) === NAMES[(idx + 1) % 3] && who({ turns: NAMES, shift: 3 }) === first, "shift moves who starts (and 3 of 3 is no change)");
s = text(draw(360, 360, { turns: ["Solo"] }));
ok(/Solo/.test(s) && !/Tomorrow/.test(s), "one name: always theirs, no 'tomorrow' line");

// ---------------- 3. every week (Monday to Sunday) ----------------
const wk = (y, m, d) => { at(y, m, d); return NAMES.indexOf(who({ turns: NAMES, every: "week" })); };
const mon = wk(2026, 11, 16);   // a Monday
ok([17, 18, 19, 20, 21, 22].every((d) => wk(2026, 11, d) === mon), "a week runs Monday to Sunday: the same name Mon 16 to Sun 22 Nov");
ok(wk(2026, 11, 23) === (mon + 1) % 3, "Monday 23 Nov: the next name");
ok(wk(2026, 11, 29) === (mon + 1) % 3 && wk(2026, 11, 30) === (mon + 2) % 3, "Sunday 29 Nov still the same, Monday 30 Nov passes on");
ok(wk(2027, 1, 3) === wk(2026, 12, 28) && wk(2027, 1, 4) === (wk(2026, 12, 28) + 1) % 3, "over a new year (Mon 28 Dec to Sun 3 Jan one week)");
at(2026, 11, 21); s = text(draw(360, 360, { turns: NAMES, every: "week" }));
ok(/This week/.test(s) && /Next week: /.test(s) && !/Today/.test(s), "weekly says This week and Next week");

// ---------------- 4. honest, never empty ----------------
const bare = draw(360, 360, {});
ok(bare.getAttribute("data-empty") === "1" && /Add names in couch-tv Studio/.test(text(bare)), "no names: it says to add some in Studio");
const demo = draw(360, 360, {}, { demo: true, designer: true });
ok(demo.getAttribute("data-empty") !== "1" && /Dishes/.test(text(demo)) && /(Alex|Sam|Jo|Max)/.test(text(demo)), "the designer and the gallery show a sample rota");
ok(/Bins/.test(text(draw(360, 360, { turns: NAMES, label: "Bins" }))), "the chore's name comes from the design");
ok(!/undefined|NaN/.test(text(draw(360, 360, { turns: ["x".repeat(300), "y"], label: "z".repeat(300) }))), "hostile words are fine");
[[160, 160, "tile"], [360, 160, "wide tile"], [360, 360, "small"], [360, 560, "tall"], [760, 360, "medium"]].forEach(([w, h, id]) => {
  const el = draw(w, h, { turns: NAMES });
  ok(el.getAttribute("data-empty") !== "1" && NAMES.indexOf(who({ turns: NAMES }, w, h)) >= 0 && !/undefined|NaN/.test(text(el)), "rota " + id + ": today's name, no stray words");
});

// ---------------- 5. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "rota", { label: "Dishes", turns: ["Anna", "Ben2", "Cleo", "<b>x</b>", "", "Dan"], every: "week", shift: 9, url: "x" });
ok(k.label === "Dishes" && k.every === "week" && k.shift === 7 && k.url === undefined, "a design keeps the label, how often and the shift (clamped to 7)");
ok(JSON.stringify(k.turns) === JSON.stringify(["Anna", "Cleo", "Dan"]), "names with digits, markup or nothing are dropped: " + JSON.stringify(k.turns));
ok(K.kept(CD, "rota", { every: "month" }).every === undefined && K.kept(CD, "rota", { turns: Array(20).fill("Sam") }).turns.length === 8, "an unknown 'every' is dropped; at most eight names");
const cap = T.C.get("rota");
ok(cap.status === "works" && T.C.need("rota", "Google TV") === "works" && T.C.need("rota", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("rota", g).length >= 1), "widget-caps: steps for each kind of TV");
ok(cap.sizes.s.join() === "tile,wtile,small,tall,medium" && cap.sizes.min.join() === "2,2", "sizes: 2x2 to 8x4");
done();
