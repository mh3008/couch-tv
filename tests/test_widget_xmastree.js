// The Christmas tree widget (widgets.js R.xmastree): an advent tree. From 1 December one more light each day
// (24 of them), on the 24th two presents, on the 25th every light, five presents and the star with its rays,
// the rest of the year a bare tree with the days to the next Christmas. Two looks: "classic" (branches) and
// "lights" (a spiral of light dots). Drawn from the TV's own date, so no data, no timer, never empty; the
// twinkle is opacity alone on a few layers. Run: node tests/test_widget_xmastree.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Christmas tree");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Christmas tree tests...");

const at = (y, m, d) => T.D.set(new Date(y, m - 1, d, 12, 0).getTime());
const draw = (w, h, opts, env) => T.W.render({ kind: "xmastree", w, h, opts: opts || {} }, env || {});
const text = (el) => el.textContent;
const tag = (el, t) => el.all().filter((e) => e.tagName === t);
const klass = (el, c) => el.all().filter((e) => (e.getAttribute("class") || "").split(" ").indexOf(c) >= 0);
const lights = (el) => klass(el, "cw-tree-on").length;
const starOn = (el) => klass(el, "cw-tree-star-on").length === 1;
const gifts = (el) => klass(el, "cw-tree-gift").length;
const rays = (el) => klass(el, "cw-tree-rays").length;
const layers = (el) => tag(el, "SVG").length;

// ---------------- 1. the lights follow the date (classic) ----------------
at(2026, 11, 21);
let el = draw(360, 360);
ok(lights(el) === 0 && /34/.test(text(el)) && /sleeps to go/.test(text(el)) && gifts(el) === 0 && !starOn(el), "21 Nov: a bare tree, 34 sleeps to go, no presents");
ok(klass(el, "cw-tree-off").length === 24 && layers(el) === 1, "a bare tree still has its 24 places and is one still layer: it is never empty, and nothing twinkles");
at(2026, 12, 1); el = draw(360, 360);
ok(lights(el) === 1 && /24/.test(text(el)) && layers(el) === 2, "1 Dec: one light (and its halo layer), 24 sleeps");
at(2026, 12, 10); el = draw(360, 360);
ok(lights(el) === 10 && /15/.test(text(el)) && layers(el) === 4, "10 Dec: ten lights, 15 sleeps, three twinkling halo layers");
at(2026, 12, 23); el = draw(360, 360);
ok(lights(el) === 23 && gifts(el) === 0 && rays(el) === 0, "23 Dec: 23 lights, no presents yet");
at(2026, 12, 24); el = draw(360, 360);
ok(lights(el) === 24 && /sleep to go/.test(text(el)) && !starOn(el) && gifts(el) === 2 && rays(el) === 0, "24 Dec: all 24 lights, one sleep to go, two presents, the star not yet");
at(2026, 12, 25); el = draw(360, 360);
ok(lights(el) === 24 && starOn(el) && gifts(el) === 5 && rays(el) === 1 && /It's today!/.test(text(el)), "25 Dec: every light, five presents, the star and its rays, 'It's today!'");
ok(layers(el) === 5, "25 Dec: the still drawing, three halo layers, the rays (5 layers)");
at(2026, 12, 26); el = draw(360, 360);
ok(lights(el) === 0 && gifts(el) === 0 && /364/.test(text(el)), "26 Dec: the tree is bare again, no presents, counting to next Christmas (364)");
at(2027, 1, 5); el = draw(360, 360);
ok(lights(el) === 0 && /354/.test(text(el)), "5 Jan: bare, 354 sleeps");
at(2027, 12, 25); el = draw(360, 360);
ok(starOn(el), "the next year's 25th lights the star too");
// each day keeps the lights already on and adds one
const pos = (day, opts) => { at(2026, 12, day); return klass(draw(360, 360, opts), "cw-tree-on").map((c) => c.getAttribute("cx") + "," + c.getAttribute("cy")); };
for (const opts of [{}, { style: "lights" }]) {
  const a = pos(5, opts), b2 = pos(6, opts);
  ok(a.length === 5 && b2.length === 6 && a.every((p) => b2.indexOf(p) >= 0), "each day keeps the lights already on and adds one (" + (opts.style || "classic") + ")");
}

// ---------------- 2. the lights look ----------------
at(2026, 11, 21);
let lk = draw(360, 360, { style: "lights" });
ok(tag(lk, "CIRCLE").length >= 72 && lights(lk) === 0 && layers(lk) === 1 && !tag(lk, "PATH").length, "lights, bare: a spiral of 72 dim dots, no branches, one still layer");
at(2026, 12, 12); lk = draw(360, 360, { style: "lights" });
ok(lights(lk) === 12 && layers(lk) === 4 && /13/.test(text(lk)), "lights, 12 Dec: twelve bright dots with halos, 13 sleeps");
at(2026, 12, 25); lk = draw(360, 360, { style: "lights" });
ok(lights(lk) === 24 && starOn(lk) && rays(lk) === 1 && gifts(lk) === 5, "lights, 25 Dec: all bright, the star and rays, presents");
const clas = draw(360, 360, { style: "classic" }), dflt = draw(360, 360);
ok(tag(clas, "PATH").length === tag(dflt, "PATH").length && tag(clas, "PATH").length > 6, "classic is the default and draws branches");
ok(tag(draw(360, 360, { style: "neon" }), "PATH").length === tag(dflt, "PATH").length, "an unknown style is the classic one");

// ---------------- 3. words and options ----------------
at(2026, 12, 10);
ok(/days to go/.test(text(draw(360, 360, { unit: "days" }))) && /sleeps to go/.test(text(draw(360, 360))) && /sleeps to go/.test(text(draw(360, 360, { unit: "weeks" }))), "sleeps or days (weeks is not a thing for a tree)");
ok(/Our Christmas/.test(text(draw(360, 360, { label: "Our Christmas" }))) && /Christmas/.test(text(draw(360, 360))), "the label, Christmas by default");
ok(!/undefined|NaN/.test(text(draw(360, 360, { label: "x".repeat(400) }))), "a hostile label is fine");
for (const st of ["classic", "lights"]) {
  const demo = draw(360, 360, { style: st }, { demo: true, designer: true });
  ok(lights(demo) === 18 && /7/.test(text(demo)) && demo.getAttribute("data-empty") !== "1", "the designer and the gallery show a tree part way through December (" + st + "), whatever the date");
}
const idsOf = (e) => tag(e, "RADIALGRADIENT").concat(tag(e, "LINEARGRADIENT")).map((g) => g.getAttribute("id"));
at(2026, 12, 20);
const both = idsOf(draw(360, 360)).concat(idsOf(draw(160, 160)));
ok(both.length > 6 && new Set(both).size === both.length, "two trees on one home never share a gradient id");

// ---------------- 4. every size ----------------
for (const st of ["classic", "lights"]) K.sizes(T.C, "xmastree").forEach(([id, w, h]) => {
  [[2026, 11, 21], [2026, 12, 12], [2026, 12, 24], [2026, 12, 25]].forEach(([y, m, d]) => {
    at(y, m, d);
    const e = draw(w, h, { style: st });
    ok(e.getAttribute("data-empty") !== "1" && layers(e) >= 1 && !/undefined|NaN|\.\.\./.test(text(e)), "xmastree " + st + " " + id + " on " + d + "/" + m + ": the tree and the count");
  });
});

// ---------------- 5. light for a Fire TV Stick: opacity alone moves ----------------
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const frames = {}, re = /@(?:-webkit-)?keyframes\s+(cw-tree-[a-z0-9]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
let m;
while ((m = re.exec(css))) { frames[m[1]] = frames[m[1]] || new Set(); m[2].replace(/\{([^}]*)\}/g, (_, body) => { body.split(";").forEach((d) => { const p = d.split(":")[0].trim(); if (p) frames[m[1]].add(p); }); return ""; }); }
ok(Object.keys(frames).sort().join() === "cw-tree-pulse,cw-tree-tw", "two keyframe sets: the twinkle and the star's pulse");
ok(Object.keys(frames).every((n) => [...frames[n]].join() === "opacity"), "the tree animates opacity and nothing else: no layout, no repaint, no transform");
ok(/@-webkit-keyframes cw-tree-tw/.test(css) && /@keyframes cw-tree-tw/.test(css), "prefixed for older WebViews too");
ok(!/filter\s*:/.test(css.slice(css.indexOf(".cw-tree >"))), "no filter anywhere in the tree's styles");
ok(/html\.lighter \.cw-tree svg/.test(css) && /prefers-reduced-motion: reduce\) \{ \.cw-tree svg/.test(css), "still on the Lighter home and when motion is reduced");
at(2026, 12, 25);
const full = draw(360, 360), count = (e) => e.all().length;
ok(count(full) < 330, "the busiest tree (25 Dec, classic) is " + count(full) + " nodes: small enough to draw once");
ok(klass(full, "cw-tree-t1").length === 1 && klass(full, "cw-tree-t2").length === 1 && klass(full, "cw-tree-t3").length === 1, "the halos twinkle in three groups, one element each");

// ---------------- 6. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "xmastree", { label: "Our first Christmas", unit: "days", style: "lights", month: 3, day: 4, url: "x" });
ok(k.label === "Our first Christmas" && k.unit === "days" && k.style === "lights" && k.month === undefined && k.day === undefined && k.url === undefined, "a design keeps a label, sleeps or days and the look, nothing else");
ok(K.kept(CD, "xmastree", { unit: "fortnights" }).unit === undefined && K.kept(CD, "xmastree", { style: "neon" }).style === undefined, "a bad unit or look is dropped");
const cap = T.C.get("xmastree");
ok(cap.status === "works" && T.C.need("xmastree", "Google TV") === "works" && T.C.need("xmastree", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("xmastree", g).length >= 1), "widget-caps: steps for each kind of TV");
done();
