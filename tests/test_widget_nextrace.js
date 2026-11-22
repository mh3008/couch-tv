// The Next race widget (feat/nextmatch): app.js asks the free Jolpica-F1 API for the next Formula 1 race only while a nextrace widget
// is on the home (its own loop, not the weather's: a race needs no town), at most every 6 hours, never in a preview; widgets.js reads
// Jolpica's race (raceOf) and draws its name, where, a countdown, the start in the TV's own time, qualifying and "Data: Jolpica-F1".
// No live calls. Run: node tests/test_widget_nextrace.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Next race");
const NOW = Date.UTC(2026, 10, 22, 12, 0);   // Sunday 22 Nov 2026, 12:00 UTC
const T = K.home(NOW);
const W = T.W;
console.log("Running Next race tests...");

// Jolpica's current/next for the 2026 Qatar Grand Prix (trimmed from the real answer)
const QATAR = { season: "2026", round: "22", raceName: "Qatar Grand Prix", date: "2026-11-29", time: "16:00:00Z",
  Circuit: { circuitName: "Lusail International Circuit", Location: { locality: "Lusail", country: "Qatar" } },
  FirstPractice: { date: "2026-11-27", time: "13:30:00Z" }, Qualifying: { date: "2026-11-28", time: "18:00:00Z" } };

// ---------------- 1. reading Jolpica's race ----------------
const r = W.kit.raceOf(QATAR);
ok(r && r.name === "Qatar Grand Prix" && r.place === "Lusail, Qatar" && r.round === 22 && r.season === 2026, "raceOf: name, place, round, season");
ok(r.t === Date.UTC(2026, 10, 29, 16, 0) && r.quali === Date.UTC(2026, 10, 28, 18, 0) && isNaN(r.sprint), "raceOf: the start and qualifying in UTC, no sprint");
ok(W.kit.raceOf({ raceName: "X", date: "2026-03-08" }).t === Date.UTC(2026, 2, 8, 12, 0), "no time yet: midday UTC (the right day everywhere)");
ok(W.kit.raceOf(null) === null && W.kit.raceOf({}) === null && W.kit.raceOf({ raceName: "X", date: "soon" }) === null, "nothing or a bad date: no race, never a made-up one");
ok(W.kit.raceOf(Object.assign({}, QATAR, { Circuit: { circuitName: "Lusail International Circuit" } })).place === "Lusail International Circuit", "no town: the circuit's name");

// ---------------- 2. the countdown ----------------
const at = Date.UTC(2026, 10, 29, 16, 0), C = W.kit.raceCountdown;
ok(C(at, at - (6 * 24 + 23) * 3600000) === "6d 23h", "days away: 6d 23h");
ok(C(at, at - (5 * 60 + 12) * 60000) === "5h 12m", "hours away: 5h 12m");
ok(C(at, at - 12 * 60000) === "12 min" && C(at, at - 59 * 60000) === "59 min", "under an hour: minutes");
ok(C(at, at + 60000) === "Racing now" && C(at, at + 119 * 60000) === "Racing now", "the 2 hours of the race: Racing now");
ok(C(at, at + 3 * 3600000) === "Finished", "after: Finished");

// ---------------- 3. drawing it ----------------
const env = (raw) => ({ data: { nextrace: raw === undefined ? QATAR : raw, weather: null } });
K.sizes(T.C, "nextrace").forEach(([id, w, h]) => {
  const el = W.render({ kind: "nextrace", w, h }, env());
  ok(!el.getAttribute("data-empty") && /Qatar Grand Prix/.test(el.textContent) && /7d 4h/.test(el.textContent), "nextrace " + id + ": the race and its countdown (" + el.textContent.slice(0, 90) + ")");
});
const big = W.render({ kind: "nextrace", w: 460, h: 360 }, env());
ok(/Round 22/.test(big.textContent) && /Lusail, Qatar/.test(big.textContent), "a 4x4: the round and where");
ok(/Sun 29 Nov/.test(big.textContent) && /Qualifying Sat \d{1,2}:\d\d[ap]m/.test(big.textContent), "a 4x4: the start (day + date) and qualifying (the day name: same weekend), in the TV's own time");
ok(/Data: Jolpica-F1/.test(big.textContent), "the credit: Data: Jolpica-F1 (CC BY-NC-SA)");
const wait = W.render({ kind: "nextrace", w: 460, h: 360 }, env(null));
ok(/Waiting for the next race/.test(wait.textContent), "no reading yet: an honest wait, never a pretend race");
const demo = W.render({ kind: "nextrace", w: 460, h: 360 }, { demo: true, designer: true, data: {} });
ok(/Grand Prix/.test(demo.textContent) && /Riverside/.test(demo.textContent), "the designer shows a sample race");
ok(!/Riverside/.test(big.textContent), "no sample place on a real TV");

// ---------------- 4. design.js keeps it, app.js asks only for it ----------------
const CD = K.design();
ok(K.kept(CD, "nextrace", { label: "F1", series: "f1" }).series === "f1", "design.js: nextrace keeps series f1");
ok(K.kept(CD, "nextrace", { series: "afl" }).series === undefined, "design.js: no AFL (its free API needs a server-side fetch): dropped");
const app = fs.readFileSync(path.join(__dirname, "../tv-home/web/app.js"), "utf8");
ok(/wantsKinds\(\["nextrace"\]\)/.test(app) && /function refreshNextRace\(\)/.test(app), "app.js: Jolpica is asked only while a nextrace widget is on the home");
ok(/MOCK && !\/\[\?&\]wxlive=1\/\.test\(Q\)/.test(app.slice(app.indexOf("function refreshNextRace"))), "app.js: never from a preview");
ok(/6 \* 3600000/.test(app.slice(app.indexOf("function nextRace"))), "app.js: at most every 6 hours");
ok(/api\.jolpi\.ca\/ergast\/f1\//.test(app) && /current\/next\.json/.test(app) && /getFullYear\(\) \+ 1\) \+ "\/1\.json"/.test(app), "app.js: the next race, else next season's round 1");
ok(/nextrace: data\.nextrace \|\| null/.test(app), "app.js: the widgets get the race");
ok(/setInterval\(refreshNextRace, 30 \* 60000\)/.test(app), "app.js: its own 30 minute loop (the 6 hour cache inside)");
ok(!/squiggle/i.test(app), "app.js: no AFL fetch from the TV's page (Squiggle's terms)");
done();
