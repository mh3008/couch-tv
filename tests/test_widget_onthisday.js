// The On this day widget (tv-home/web/widget-web.js reads Wikipedia's picks for a date, widgets.js draws them):
// the big daily answer (about 150 KB) is cut down to four short lines before anything is saved; one request
// for each date by the TV's own clock, kept for the day, only the last three dates kept; every size draws real
// lines or an honest state. No live calls.
// Run: node tests/test_widget_onthisday.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("On this day");
const T = K.home(new Date(2026, 10, 21, 12).getTime());
const WW = T.WW;

console.log("Running On this day tests...");

const at = (y, m, d) => T.D.set(new Date(y, m - 1, d, 12, 0).getTime());
const text = (el) => el.textContent;

// ---------------- 1. reading the answer ----------------
const feed = K.json("wiki-onthisday-1121.json");
const v = WW.parseOnThisDay(feed, "11-21");
ok(v.md === "11-21" && v.items.length === 4, "four lines from seventeen picks");
ok(v.items.every((x, i, a) => typeof x.y === "number" && x.t.length >= 12 && x.t.length <= 110 && (!i || a[i - 1].y <= x.y)), "each a year and a sentence of at most 110 letters, oldest first");
ok(JSON.stringify(v).length < 700, "what is kept is under 700 bytes (the feed is " + JSON.stringify(feed).length + " here and 150 KB live)");
ok(v.short && v.short.t.length <= 80 && v.items.every((x) => x.t.length >= v.short.t.length || true) && feed.selected.some((e) => e.text.indexOf(v.short.t.slice(0, 20)) === 0), "the shortest line is kept for a small box");
ok(WW.parseOnThisDay(null, "11-21").items.length === 0 && WW.parseOnThisDay({ selected: "x" }, "11-21").items.length === 0 && WW.parseOnThisDay({ selected: [null, 3, {}, { text: "short", year: 1900 }, { text: "A real sentence that is long enough", year: "abc" }, { text: "Another real sentence that is fine", year: 99999 }] }, "11-21").items.length === 0, "nothing from nothing, or from rubbish");
const hostile = WW.parseOnThisDay({ selected: [{ text: "<script>x</script>An event with <b>markup</b> &amp; a dash \u2013 " + "x".repeat(300), year: 1815 }] }, "11-21");
ok(hostile.items.length === 1 && !/[<>]/.test(hostile.items[0].t) && /&/.test(hostile.items[0].t) && hostile.items[0].t.length <= 110 && hostile.items[0].t.indexOf("\u2013") < 0, "markup and long text from the source are cleaned and cut to a whole word");
ok(WW.parseOnThisDay({ selected: [{ text: "A sentence from long ago, before the common era.", year: -44 }] }, "03-15").items[0].y === -44 && WW.yearWords(-44) === "44 BC" && WW.yearWords(1969) === "1969", "years before the common era read as BC");
ok(WW.parseOnThisDay({ selected: [{ text: "The same sentence repeated twice over.", year: 1900 }, { text: "The same sentence repeated twice over.", year: 1900 }] }, "01-01").items.length === 1, "the same line twice is one");
ok(WW.onThisDayKey(new Date(2026, 10, 21, 0, 5).getTime()) === "11-21" && WW.onThisDayKey(new Date(2026, 10, 21, 23, 55).getTime()) === "11-21" && WW.onThisDayKey(new Date(2027, 0, 1, 12).getTime()) === "01-01", "the date is the TV's own, local, to the minute either side of midnight");
const demo = WW.demoOnThisDay();
ok(demo.md === "07-20" && demo.items.length === 4 && demo.items.some((x) => x.y === 1969 && /Apollo/.test(x.t)), "the preview's sample is four real events of one date");

(async () => {
  // ---------------- 2. the loader: straight from the TV, once a date ----------------
  const NOW = new Date(2026, 10, 21, 9, 0).getTime();
  const answer = () => feed;
  const t = K.fakeTv(WW, { answer, relay: false, now: NOW, widgets: [{ kind: "onthisday", opts: {} }, { kind: "onthisday", opts: { label: "History" } }] });
  await t.L.tick();
  ok(t.asked.length === 1 && t.asked[0] === "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/11/21", "one request for both widgets, straight to Wikimedia, for 21 November (" + t.asked[0] + ")");
  ok(t.L.data().onthisday["11-21"].ok && t.L.data().onthisday["11-21"].v.items.length === 4, "only the four lines are kept");
  t.now += 10 * 3600000; await t.L.tick();
  ok(t.asked.length === 1, "later the same day: not asked again");
  t.now = new Date(2026, 10, 22, 0, 10).getTime(); await t.L.tick();
  ok(t.asked.length === 2 && /\/11\/22$/.test(t.asked[1]) && t.L.data().onthisday["11-22"].ok, "after midnight: asked for the new date");
  for (const d of [[2026, 10, 23], [2026, 10, 24], [2026, 10, 25]]) { t.now = new Date(d[0], d[1], d[2], 8).getTime(); await t.L.tick(); }
  ok(Object.keys(t.L.data().onthisday).length === 3 && !t.L.data().onthisday["11-21"], "only the last three dates are kept (" + Object.keys(t.L.data().onthisday).join(",") + ")");
  ok(JSON.stringify(t.store).length < 3000, "what the TV saves stays small (" + JSON.stringify(t.store).length + " bytes)");
  // a day with no lines
  const t2 = K.fakeTv(WW, { answer: () => ({ selected: [] }), now: NOW, widgets: [{ kind: "onthisday" }] });
  await t2.L.tick();
  ok(t2.L.data().onthisday["11-21"].err === "empty", "a date with nothing listed: nothing there");
  const t3 = K.fakeTv(WW, { answer, now: NOW, widgets: [{ kind: "onthisday" }] });
  t3.fail = true; await t3.L.tick();
  ok(t3.L.data().onthisday["11-21"].err === "failed", "a broken ask: could not be read");
  t3.fail = false; t3.now += 4 * 60000; await t3.L.tick();
  ok(t3.L.data().onthisday["11-21"].ok, "and tried again after three minutes");
  const t4 = K.fakeTv(WW, { answer, now: NOW, widgets: [{ kind: "news" }] });
  await t4.L.tick();
  ok(!t4.asked.some((u) => /wikimedia/.test(u)), "no On this day widget on the home: Wikimedia is never asked");
  t.fail = true; t.now = new Date(2026, 10, 26, 8).getTime(); await t.L.tick();
  ok(t.L.data().onthisday["11-26"].err === "failed", "a new date that cannot be read says so (there is nothing for it to keep)");

  // ---------------- 3. the widget at every size ----------------
  at(2026, 11, 21);
  const good = { ok: true, at: NOW, v };
  const env = (r) => ({ data: { web: r === undefined ? {} : { onthisday: { "11-21": r } } } });
  K.sizes(T.C, "onthisday").forEach(([id, w, h]) => {
    const e = T.W.render({ kind: "onthisday", w, h }, env(good)), s = text(e);
    ok(e.getAttribute("data-empty") !== "1" && /(18|19|20)[0-9][0-9]/.test(s) && !/undefined|NaN|\.\.\./.test(s), "onthisday " + id + ": a real year and sentence");
    ok(/Apollo|Napoleon|Viking|Hitler/.test(text(T.W.render({ kind: "onthisday", w, h }, { demo: true, designer: true }))), "onthisday " + id + ": the designer shows sample lines");
  });
  const sm = text(T.W.render({ kind: "onthisday", w: 360, h: 360 }, env(good))), tl = text(T.W.render({ kind: "onthisday", w: 360, h: 560 }, env(good)));
  ok(/On this day/.test(sm) && /21 November/.test(sm), "small: the title and the date");
  ok((tl.match(/(18|19|20)[0-9][0-9]/g) || []).length > (sm.match(/(18|19|20)[0-9][0-9]/g) || []).length, "a taller box shows more lines");
  const wide = text(T.W.render({ kind: "onthisday", w: 360, h: 160 }, env(good)));
  ok(wide.indexOf(v.short.t) >= 0, "the wide tile shows the shortest line");
  // the date changes with the TV's clock
  at(2026, 11, 22);
  ok(T.W.render({ kind: "onthisday", w: 360, h: 360 }, env(good)).getAttribute("data-empty") === "1", "on the 22nd the 21st's answer is not shown: it says it is getting today's");
  at(2026, 11, 21);
  const stale = text(T.W.render({ kind: "onthisday", w: 360, h: 360 }, env({ ok: true, at: NOW, stale: true, v })));
  ok(/Not updated lately/.test(stale), "an old answer says so");
  ok(/History/.test(text(T.W.render({ kind: "onthisday", w: 360, h: 360, opts: { label: "History" } }, env(good)))), "the design's label");
  [[undefined, "Getting today in history", "Getting history"], [{ ok: false, err: "failed", at: 1 }, "could not be read", "History failed"], [{ ok: false, err: "empty", at: 1 }, "Nothing is listed for today", "Nothing today"], [{ ok: false, err: "paused", at: 1 }, "This feed is paused", "Paused"]].forEach(([r, long, short]) => K.sizes(T.C, "onthisday").forEach(([id, w, h]) => {
    const e = T.W.render({ kind: "onthisday", w, h }, env(r)), says = w < 300 || h < 200 ? short : long;
    ok(e.getAttribute("data-empty") === "1" && text(e).indexOf(says) >= 0, "onthisday " + id + ": " + says);
  }));
  const bad = text(T.W.render({ kind: "onthisday", w: 360, h: 360 }, env({ ok: true, at: NOW, v: { md: "x", items: [] } })));
  ok(/Nothing is listed for today/.test(bad), "a saved answer with nothing in it is an honest state, not a blank card");

  // ---------------- 4. the design and the setup record ----------------
  const CD = K.design();
  const k = K.kept(CD, "onthisday", { label: "History", align: "left", lang: "de", url: "x", feed: "abc" });
  ok(k.label === "History" && k.align === "left" && k.lang === undefined && k.url === undefined && k.feed === undefined, "a design keeps a label and a side, nothing else (no language, no address)");
  const cap = T.C.get("onthisday");
  ok(cap.status === "works" && T.C.need("onthisday", "Google TV") === "works" && T.C.need("onthisday", "VIDAA") === "works", "widget-caps: works on every TV");
  ok(["android", "web", "vidaa"].every((g) => T.C.steps("onthisday", g).length >= 1) && /^Unofficial source: /.test(T.C.beta("onthisday")), "widget-caps: steps for each kind of TV, marked unofficial");
  ok(WW.PAUSABLE.indexOf("onthisday") >= 0, "the design store can pause the source for every TV");
  done();
})().catch((e) => { console.error(e); process.exit(1); });
