// The Christmas tree widget (widgets.js R.xmastree): an advent tree. From 1 December one more light each day
// (24 of them), on the 25th every light and the star, the rest of the year a bare tree with the days to the
// next Christmas. Drawn from the TV's own date, so no data, no timer, never empty.
// Run: node tests/test_widget_xmastree.js
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Christmas tree");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Christmas tree tests...");

const at = (y, m, d) => T.D.set(new Date(y, m - 1, d, 12, 0).getTime());
const draw = (w, h, opts, env) => T.W.render({ kind: "xmastree", w, h, opts: opts || {} }, env || {});
// lit lights are drawn solid (r 5.5), dim places smaller (r 4); the star is the polygon after the last circle
const lights = (el) => tag(el, "CIRCLE").filter((c) => c.getAttribute("r") === "5.5").length;
const star = (el) => { const p = tag(el, "POLYGON"); return p[p.length - 1].getAttribute("fill"); };
const tag = (el, t) => el.all().filter((e) => e.tagName === t);
const texts = (el) => el.textContent;

// ---------------- 1. the lights follow the date ----------------
at(2026, 11, 21);
let el = draw(360, 360);
ok(lights(el) === 0 && /34/.test(texts(el)) && /sleeps to go/.test(texts(el)), "21 Nov: a bare tree, 34 sleeps to go");
ok(tag(el, "CIRCLE").length >= 24 && star(el) !== "#ffe45c", "a bare tree still has its 24 places and an unlit star: it is never empty");
at(2026, 12, 1); el = draw(360, 360);
ok(lights(el) === 1 && /24/.test(texts(el)), "1 Dec: one light, 24 sleeps");
at(2026, 12, 10); el = draw(360, 360);
ok(lights(el) === 10 && /15/.test(texts(el)), "10 Dec: ten lights, 15 sleeps");
at(2026, 12, 24); el = draw(360, 360);
ok(lights(el) === 24 && /1/.test(texts(el)) && /sleep to go/.test(texts(el)) && star(el) !== "#ffe45c", "24 Dec: all 24 lights, one sleep to go, the star not yet");
at(2026, 12, 25); el = draw(360, 360);
ok(lights(el) === 24 && star(el) === "#ffe45c" && /It's today!/.test(texts(el)), "25 Dec: every light, the star, the glow, 'It's today!'");
ok(tag(el, "CIRCLE").some((c) => c.getAttribute("r") === "98") && tag(el, "CIRCLE").some((c) => c.getAttribute("r") === "22"), "25 Dec: the glow behind the tree and the star's halo are drawn");
at(2026, 12, 24);
ok(!tag(draw(360, 360), "CIRCLE").some((c) => c.getAttribute("r") === "98"), "24 Dec: no glow yet");
at(2026, 12, 25);
at(2026, 12, 26); el = draw(360, 360);
ok(lights(el) === 0 && /364/.test(texts(el)), "26 Dec: the tree is bare again and counts to next Christmas (364)");
at(2027, 1, 5); el = draw(360, 360);
ok(lights(el) === 0 && /354/.test(texts(el)), "5 Jan: bare, 354 sleeps");
// a leap year and a year end do not break the count
at(2027, 12, 25); el = draw(360, 360);
ok(star(el) === "#ffe45c", "the next year's 25th lights the star too");
// the lights that come on are spread out: day 2 is not next to day 1
const pos = (day) => { at(2026, 12, day); return tag(draw(360, 360), "CIRCLE").filter((c) => c.getAttribute("r") === "5.5").map((c) => c.getAttribute("cx") + "," + c.getAttribute("cy")); };
const a = pos(5), b2 = pos(6);
ok(a.every((p) => b2.indexOf(p) >= 0) && b2.length === a.length + 1, "each day keeps the lights already on and adds one");

// ---------------- 2. words and options ----------------
at(2026, 12, 10);
ok(/days to go/.test(texts(draw(360, 360, { unit: "days" }))) && /sleeps to go/.test(texts(draw(360, 360))) && /sleeps to go/.test(texts(draw(360, 360, { unit: "weeks" }))), "sleeps or days (weeks is not a thing for a tree)");
ok(/Our Christmas/.test(texts(draw(360, 360, { label: "Our Christmas" }))) && /Christmas/.test(texts(draw(360, 360))), "the label, Christmas by default");
ok(!/undefined|NaN/.test(texts(draw(360, 360, { label: "x".repeat(400) }))), "a hostile label is fine");
const demo = draw(360, 360, {}, { demo: true, designer: true });
ok(lights(demo) === 14 && /11/.test(texts(demo)), "the designer and the gallery show a tree part way through December, whatever the date");

// ---------------- 3. every size ----------------
at(2026, 11, 21);
K.sizes(T.C, "xmastree").forEach(([id, w, h]) => {
  [[2026, 11, 21], [2026, 12, 12], [2026, 12, 25]].forEach(([y, m, d]) => {
    at(y, m, d);
    const e = draw(w, h);
    ok(e.getAttribute("data-empty") !== "1" && tag(e, "SVG").length && !/undefined|NaN|\.\.\./.test(texts(e)), "xmastree " + id + " on " + d + "/" + m + ": the tree and the count");
  });
});

// ---------------- 4. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "xmastree", { label: "Our first Christmas", unit: "days", month: 3, day: 4, url: "x" });
ok(k.label === "Our first Christmas" && k.unit === "days" && k.month === undefined && k.day === undefined && k.url === undefined, "a design keeps a label and sleeps or days, nothing else");
ok(K.kept(CD, "xmastree", { unit: "fortnights" }).unit === undefined, "a bad unit is dropped");
const cap = T.C.get("xmastree");
ok(cap.status === "works" && T.C.need("xmastree", "Google TV") === "works" && T.C.need("xmastree", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("xmastree", g).length >= 1), "widget-caps: steps for each kind of TV");
done();
