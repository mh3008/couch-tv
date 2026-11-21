// The Holidays widget (tv-home/web/widget-web.js reads Nager.Date's public holidays, widgets.js draws them,
// widget-detail.js opens the list): saved answers read into the next weekday holidays with the days off in
// a row; the country and state come from the options or the TV's own town; the loader asks twice a day, one
// request per country and state; every size draws real holidays or an honest state; a design keeps a
// country and a region as short codes and nothing else. No live calls.
// Run: node tests/test_widget_holidays.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Holidays");
const NOW = Date.UTC(2026, 10, 21, 12, 0);
const T = K.home(NOW);
const WW = T.WW;

console.log("Running Holidays tests...");

// ---------------- 1. reading the answer ----------------
const au = K.json("nager-au.json"), gb = K.json("nager-gb.json");
const read = (j, cc, r) => WW.parseHolidays(j, cc, r);
const nsw = read(au, "AU", "NSW"), vic = read(au, "AU", "VIC"), anyAu = read(au, "AU", "");
ok(nsw.days.length >= 8 && nsw.days.length <= 12 && nsw.days.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d) && x.n && x.run >= 1), "AU: up to twelve, each with a date, a name and the days off in a row");
ok(nsw.days[0].d === "2026-12-25" && nsw.days[0].n === "Christmas Day" && nsw.days[0].run === 4, "Christmas Day on a Friday: Fri to Mon, four days off");
ok(nsw.days.every((x, i, a) => !i || a[i - 1].d < x.d), "in date order");
ok(nsw.days.every((x) => [0, 6].indexOf(((WW.dayNum(x.d) + 4) % 7 + 7) % 7) < 0), "only holidays on a weekday are listed (a Saturday one is not a day off)");
ok(anyAu.days.every((x) => x.n !== "Labour Day") && vic.days.some((x) => x.d === "2027-03-08" && x.n === "Labour Day") && !nsw.days.some((x) => x.d === "2027-03-08"), "a state's own holiday only for that state; with no state, only the national ones");
ok(WW.parseHolidays(gb, "GB", "ENG").days.some((x) => /Bank Holiday/.test(x.n)) && WW.parseHolidays(gb, "GB", "").days.length >= 3, "another country reads the same way");
const long = nsw.days.find((x) => x.d === "2027-01-01");
ok(long.run === 3 && WW.runWords(long.run) === "3 day weekend" && WW.runWords(1) === "" && WW.runWords(2) === "", "a Friday holiday makes a 3 day weekend; a midweek one says nothing");
const mid = nsw.days.find((x) => x.d === "2027-01-26");
ok(mid.run === 1, "Australia Day on a Tuesday: one day off");
ok(WW.parseHolidays(null, "AU", "").days.length === 0 && WW.parseHolidays({ x: 1 }, "AU", "").days.length === 0 && WW.parseHolidays("x", "AU", "NSW").days.length === 0 && WW.parseHolidays([null, 3, {}, { date: "2026-13-40", types: ["Public"], global: true, name: "x" }], "AU", "").days.length === 0, "nothing from nothing, or from rubbish");
const hostile = WW.parseHolidays([{ date: "2026-12-24", name: "<script>x</script>Eve <b>day</b> " + "x".repeat(200), global: true, types: ["Public"] }, { date: "2026-12-23", name: "School day", global: true, types: ["School"] }, { date: "2026-12-22", name: "Regional", global: false, counties: ["AU-WA"], types: ["Public"] }], "AU", "NSW");
ok(hostile.days.length === 1 && !/[<>]/.test(hostile.days[0].n) && hostile.days[0].n.length <= 44, "markup and long names from the source are cleaned; school days and other states' holidays are left out");
// the arithmetic
ok(WW.dayNum("1970-01-01") === 0 && WW.isoOf(0) === "1970-01-01" && WW.isoOf(WW.dayNum("2028-02-29") + 1) === "2028-03-01" && WW.isoOf(WW.dayNum("2026-12-31") + 1) === "2027-01-01", "whole days since 1970 and back, across a leap year and a new year");
ok(WW.holidayDate("2026-12-25") === "Fri 25 Dec" && WW.holidayDate("2027-01-01") === "Fri 1 Jan" && WW.holidayDate("x") === "", "dates read like Fri 25 Dec");
ok(WW.daysAway("2026-12-25", "2026-11-21") === 34 && WW.awayWords(0) === "Today" && WW.awayWords(1) === "Tomorrow" && WW.awayWords(34) === "In 34 days", "how far away, in words");
const demo = WW.demoHolidays("2026-11-21");
ok(demo.days.length >= 5 && demo.days[0].n === "Christmas Day" && demo.days[0].run === 3 && demo.days.every((x) => x.d >= "2026-11-21"), "the preview's sample holidays come next from today, drawn the same way");
ok(demo.days.some((x) => x.d === "2027-03-26" && x.n === "Good Friday" && x.run === 4) && demo.days.some((x) => x.d === "2027-03-29" && x.n === "Easter Monday"), "Easter in the samples lands on the real dates (Nager: Fri 26 and Mon 29 Mar 2027)");

// ---------------- 2. which country and state ----------------
const pl = (o, h) => WW.holidayPlace(o, h);
const same = (a, cc, r) => a.cc === cc && a.region === r;
ok(same(pl({}, null), "AU", "") && same(pl({}, { timezone: "auto" }), "AU", ""), "no town: Australia, like the news, scores and markets");
ok(same(pl({}, { timezone: "Australia/Melbourne", place: "Melbourne" }), "AU", "VIC") && same(pl({}, { timezone: "Australia/Sydney", place: "Canberra, Australian Capital Territory, Australia" }), "AU", "ACT"), "an Australian town: its state from the zone, or from its own words (Canberra)");
ok(same(pl({}, { timezone: "America/New_York" }), "US", "") && same(pl({}, { timezone: "Europe/London" }), "GB", "") && same(pl({}, { timezone: "Pacific/Auckland" }), "NZ", ""), "other TVs: the country from the time zone");
ok(same(pl({ country: "nz" }, { timezone: "Australia/Perth", place: "Perth" }), "NZ", "") && same(pl({ country: "US", region: "ca" }, { timezone: "Australia/Perth" }), "US", "CA"), "the design's country wins, and the TV's state is not carried to another country");
ok(same(pl({ country: "x1", region: "toolong" }, { timezone: "Europe/Paris" }), "FR", ""), "a bad country or region is ignored");

(async () => {
  // ---------------- 3. the loader: straight from the TV, no relay ----------------
  const answer = (src, url) => (/\/GB$/.test(url) ? gb : au);
  const t = K.fakeTv(WW, { answer, relay: false, now: NOW, home: { timezone: "Australia/Sydney", place: "Sydney, New South Wales" },
    widgets: [{ kind: "holidays", opts: {} }, { kind: "holidays", opts: { label: "Days off" } }, { kind: "holidays", opts: { country: "GB", region: "ENG" } }, { kind: "holidays", opts: { country: "GB", region: "SCT" } }] });
  await t.L.tick();
  ok(t.asked.length === 3 && t.asked.every((u) => /^https:\/\/date\.nager\.at\/api\/v3\/NextPublicHolidays\/(AU|GB)$/.test(u)), "one request per country (and state), straight to Nager.Date, no key, no relay (" + t.asked.length + ")");
  ok(t.L.data().holidays["AU:NSW"].ok && t.L.data().holidays["GB:ENG"].v.days.length >= 3 && t.L.data().holidays["GB:SCT"].ok, "the holidays are kept per country and state");
  t.now += 11 * 3600000; await t.L.tick();
  ok(t.asked.length === 3, "good for 12 hours: not asked again");
  t.now += 2 * 3600000; await t.L.tick();
  ok(t.asked.length === 6, "twice a day: asked again after 12 hours");
  // a country Nager does not list: 404 is "nothing there", not "could not be read"
  const t2 = K.fakeTv(WW, { answer: () => null, now: NOW, widgets: [{ kind: "holidays", opts: { country: "ZZ" } }] });
  t2.h.json = () => Promise.reject(new Error("http 404"));
  t2.L = WW.loader(t2.h); await t2.L.tick();
  ok(t2.L.data().holidays["ZZ:"].err === "empty", "a country the service does not list: nothing there");
  t2.h.json = () => Promise.reject(new Error("http 500")); t2.now += 13 * 3600000;
  const t3 = K.fakeTv(WW, { answer: () => null, now: NOW, widgets: [{ kind: "holidays", opts: { country: "NZ" } }] });
  t3.h.json = () => Promise.reject(new Error("http 500")); t3.L = WW.loader(t3.h); await t3.L.tick();
  ok(t3.L.data().holidays["NZ:"].err === "failed", "a broken answer: could not be read");
  const t4 = K.fakeTv(WW, { answer, now: NOW, widgets: [{ kind: "sports" }] });
  await t4.L.tick();
  ok(!t4.asked.some((u) => /nager/.test(u)), "no holidays widget on the home: nager.date is never asked");
  t.fail = true; t.now += 13 * 3600000; await t.L.tick();
  ok(t.L.data().holidays["AU:NSW"].ok && t.L.data().holidays["AU:NSW"].stale, "a failed ask keeps the last holidays, marked not lately");

  // ---------------- 4. the widget at every size ----------------
  const home = { timezone: "Australia/Sydney", place: "Sydney, New South Wales" };
  const env = (r) => ({ data: { holidays: home, web: r === undefined ? {} : { holidays: { "AU:NSW": r } } } });
  const good = { ok: true, at: NOW, v: nsw };
  K.sizes(T.C, "holidays").forEach(([id, w, h]) => {
    const el = T.W.render({ kind: "holidays", w, h }, env(good)), txt = el.textContent;
    ok(!el.getAttribute("data-empty") && /Christmas Day/.test(txt) && !/undefined|NaN|\.\.\./.test(txt), "holidays " + id + ": the next holiday, real");
    ok(/Christmas Day|Boxing|New Year|Anzac|Australia Day/.test(T.W.render({ kind: "holidays", w, h }, { demo: true, designer: true }).textContent), "holidays " + id + ": the designer shows sample holidays");
  });
  const wt = T.W.render({ kind: "holidays", w: 360, h: 160 }, env(good)).textContent;
  ok(/34 days/.test(wt) && /Christmas Day/.test(wt) && /Fri 25 Dec. 4 day weekend/.test(wt), "a wide tile: 34 days, the holiday, its date and the long weekend");
  const sm = T.W.render({ kind: "holidays", w: 360, h: 360 }, env(good)).textContent, md = T.W.render({ kind: "holidays", w: 760, h: 360 }, env(good)).textContent;
  ok(/Christmas Day/.test(sm) && /Fri 25 Dec. In 34 days/.test(sm) && /4 day weekend/.test(sm), "small: the holiday, its date, how far away, and the long weekend in words");
  ok(/Christmas Day/.test(md) && /New Year/.test(md) && /4 day weekend/.test(md), "medium: more holidays, the long weekend as a chip");
  // the count follows the TV's own date, no new ask
  T.D.set(Date.UTC(2026, 11, 24, 12, 0));
  ok(/Tomorrow/.test(T.W.render({ kind: "holidays", w: 360, h: 360 }, env(good)).textContent) && /Tomorrow/.test(T.W.render({ kind: "holidays", w: 360, h: 160 }, env(good)).textContent), "on the 24th it says Tomorrow, with no new request");
  T.D.set(Date.UTC(2026, 11, 26, 12, 0));
  ok(!/Christmas Day/.test(T.W.render({ kind: "holidays", w: 360, h: 360 }, env(good)).textContent) && /Mon 28 Dec|New Year/.test(T.W.render({ kind: "holidays", w: 360, h: 360 }, env(good)).textContent), "a holiday that has gone is not shown");
  const spent = T.W.render({ kind: "holidays", w: 360, h: 360 }, env({ ok: true, at: NOW, v: { days: [{ d: "2026-01-01", n: "Old", run: 1 }] } }));
  ok(spent.getAttribute("data-empty") === "1" && /No more holidays listed yet/.test(spent.textContent), "a list that has run out says so, calmly");
  T.D.set(NOW);
  const stale = T.W.render({ kind: "holidays", w: 360, h: 360 }, env({ ok: true, at: NOW, stale: true, v: nsw })).textContent;
  ok(/Not updated lately/.test(stale), "an old answer says so");
  ok(/Time off/.test(T.W.render({ kind: "holidays", w: 360, h: 360, opts: { label: "Time off" } }, env(good)).textContent) && !/Time off/.test(T.W.render({ kind: "holidays", w: 360, h: 360 }, env(good)).textContent), "the design's label heads a box tall enough for one");
  [[undefined, "Getting the holidays", "Getting days off"], [{ ok: false, err: "failed", at: 1 }, "could not be read", "Holidays failed"], [{ ok: false, err: "empty", at: 1 }, "No public holidays are listed for this country", "No holidays"], [{ ok: false, err: "paused", at: 1 }, "This feed is paused", "Paused"]].forEach(([r, long, short]) => K.sizes(T.C, "holidays").forEach(([id, w, h]) => {
    const el = T.W.render({ kind: "holidays", w, h }, env(r)), says = w < 300 || h < 200 ? short : long;
    ok(el.getAttribute("data-empty") === "1" && el.textContent.indexOf(says) >= 0, "holidays " + id + ": " + says);
  }));
  // another country's answer is read by the options, not the TV's town
  const gbEnv = { data: { holidays: home, web: { holidays: { "GB:ENG": { ok: true, at: NOW, v: read(gb, "GB", "ENG") } } } } };
  ok(/Christmas Day/.test(T.W.render({ kind: "holidays", w: 360, h: 360, opts: { country: "gb", region: "eng" } }, gbEnv).textContent) && T.W.render({ kind: "holidays", w: 360, h: 360, opts: { country: "GB", region: "ENG" } }, env(good)).getAttribute("data-empty") === "1", "a design's country and region pick their own answer");

  // ---------------- 5. the design and the setup record ----------------
  const CD = K.design();
  const k = K.kept(CD, "holidays", { country: "nz", region: "akl", label: "Time off", align: "left" });
  ok(k.country === "NZ" && k.region === "AKL" && k.label === "Time off" && k.align === "left", "a design keeps a country and a region as capital letters, a label and a side");
  const b = K.kept(CD, "holidays", { country: "https://x.example", region: "<b>x</b>", url: "x", feed: "abc" });
  ok(b.country === undefined && b.region === undefined && b.url === undefined && b.feed === undefined, "a link as a country, markup as a region, and other options are dropped");
  ok(K.kept(CD, "holidays", { country: "A", region: "ABCD" }).country === undefined && K.kept(CD, "holidays", { country: "AUS" }).country === undefined, "a country is exactly two letters, a region one to three");
  const cap = T.C.get("holidays");
  ok(cap.status === "works" && T.C.need("holidays", "Google TV") === "works" && T.C.need("holidays", "VIDAA") === "works" && T.C.need("holidays", "webOS") === "computer" && T.C.need("holidays", "tvOS") === "no", "widget-caps: works, honest platforms");
  ok([ "android", "web", "vidaa"].every((g) => T.C.steps("holidays", g).length >= 3) && /^Unofficial source: /.test(T.C.beta("holidays")), "widget-caps: steps for each kind of TV, marked unofficial");
  ok(WW.PAUSABLE.indexOf("holidays") >= 0 && WW.pausedOf({ v: 1, paused: ["holidays"] }).join() === "holidays", "the design store can pause the source for every TV");
  done();
})().catch((e) => { console.error(e); process.exit(1); });
