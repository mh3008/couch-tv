// The Breathe widget (widgets.js R.breathe, widgets.css .cw-br): a disc that grows and shrinks to pace slow breaths,
// moved by CSS animations that use transform and opacity only, standing still on the Lighter home and when the TV
// asks for less motion. Run: node tests/test_widget_breathe.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Breathe");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Breathe tests...");

const draw = (w, h, opts, env) => T.W.render({ kind: "breathe", w, h, opts: opts || {} }, env || {});
const hasCls = (el, c) => el.all().filter((e) => (e.getAttribute("class") || "").split(" ").indexOf(c) >= 0 || (e._cls || []).indexOf(c) >= 0);

// ---------------- 1. the drawing ----------------
[[160, 160, "tile"], [360, 160, "wide tile"], [360, 360, "small"]].forEach(([w, h, id]) => {
  const el = draw(w, h);
  ok(el.getAttribute("data-empty") !== "1", "breathe " + id + ": a disc, never the empty state");
  ok(hasCls(el, "cw-br-disc").length === 1 && hasCls(el, "cw-br-ring").length === 1, "breathe " + id + ": the disc and its ring");
  ok(hasCls(el, "cw-br-in").length === 1 && hasCls(el, "cw-br-out").length === 1, "breathe " + id + ": In and Out");
  ok(!/undefined|NaN/.test(el.textContent), "breathe " + id + ": no stray words");
});
ok(/Breathe/.test(draw(360, 360).textContent) && /Rest/.test(draw(360, 360, { label: "Rest" }).textContent), "the word Breathe, or the design's own label");
ok(!/undefined|NaN/.test(draw(360, 360, { label: "x".repeat(400) }).textContent), "a hostile label is fine");
ok(draw(160, 160, {}, { demo: true, designer: true }).getAttribute("data-empty") !== "1", "the designer and the gallery show the disc");

// ---------------- 2. the stylesheet moves nothing but transform and opacity ----------------
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const frames = {}, re = /@(?:-webkit-)?keyframes\s+(cw-br-[a-z0-9]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
let m;
while ((m = re.exec(css))) {
  const props = new Set();
  m[2].replace(/\{([^}]*)\}/g, (_, body) => { body.split(";").forEach((d) => { const p = d.split(":")[0].trim(); if (p) props.add(p); }); return ""; });
  frames[m[1]] = frames[m[1]] || new Set(); props.forEach((p) => frames[m[1]].add(p));
}
const names = Object.keys(frames), moved = new Set(); names.forEach((n) => frames[n].forEach((p) => moved.add(p)));
ok(names.length === 3, "three keyframe sets: the disc, In, Out (" + names.join(",") + ")");
ok([...moved].every((p) => /^(-webkit-)?transform$|^opacity$/.test(p)), "only transform and opacity are animated (" + [...moved].join(", ") + ")");
ok(/@-webkit-keyframes cw-br-grow/.test(css) && /@keyframes cw-br-grow/.test(css), "prefixed for older WebViews too");
ok(!/filter\s*:/.test(css.slice(css.indexOf(".cw-br {"))), "no filter in the breathing styles");
ok(/html\.lighter \.cw-br-disc/.test(css) && /prefers-reduced-motion: reduce\) \{ \.cw-br-disc/.test(css), "still on the Lighter home and when motion is reduced");
ok(/animation: cw-br-grow 10s infinite/.test(css) && /cw-br-in 10s infinite/.test(css) && /cw-br-out 10s infinite/.test(css), "one 10 second breath, looping on its own");
ok(/40% \{ transform: scale\(1\)/.test(css), "in takes 40% of the breath (4 s), out the other 60% (6 s)");

// ---------------- 3. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "breathe", { label: "Rest", url: "x", pace: "fast" });
ok(k.label === "Rest" && k.url === undefined && k.pace === undefined, "a design keeps a label, nothing else");
const cap = T.C.get("breathe");
ok(cap.status === "works" && T.C.need("breathe", "Google TV") === "works" && T.C.need("breathe", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("breathe", g).length >= 1), "widget-caps: steps for each kind of TV");
ok(cap.sizes.s.join() === "tile,wtile,small" && cap.sizes.min.join() === "2,2", "sizes: 2x2, 4x2, 4x4");
done();
