// The Campfire widget (widgets.js R.campfire, widgets.css .cw-fire): flames, drifting embers and glowing logs moved
// by CSS animations that use transforms and opacity only (so the GPU does the moving), standing still on the
// Lighter home and when the TV asks for less motion; OK plays the fire's sound. Run: node tests/test_widget_campfire.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Campfire");
const T = K.home(Date.UTC(2026, 10, 21, 12));

console.log("Running Campfire tests...");

const draw = (w, h, opts, env) => T.W.render({ kind: "campfire", w, h, opts: opts || {} }, env || {});
const text = (el) => el.textContent;
const cls = (el) => el.all().filter((e) => e.attrs && e.attrs.class !== undefined).map((e) => e.attrs.class + (e._cls && e._cls.length ? " " + e._cls.join(" ") : ""));
const hasCls = (el, c) => el.all().filter((e) => (e.getAttribute("class") || "").split(" ").indexOf(c) >= 0 || (e._cls || []).indexOf(c) >= 0);

// ---------------- 1. the drawing ----------------
[[160, 160, "tile"], [360, 160, "wide tile"]].forEach(([w, h, id]) => {
  const el = draw(w, h);
  ok(el.getAttribute("data-empty") !== "1", "campfire " + id + ": a fire, never the empty state");
  ok(hasCls(el, "cw-fire-flame").length === 5, "campfire " + id + ": five flames (" + hasCls(el, "cw-fire-flame").length + ")");
  ok(hasCls(el, "cw-fire-em").length === 6, "campfire " + id + ": six embers");
  ok(hasCls(el, "cw-fire-glow").length === 1 && hasCls(el, "cw-fire-coal").length === 1, "campfire " + id + ": the glow and the glowing coals");
  ok(el.all().filter((e) => e.tagName === "RECT").length >= 3, "campfire " + id + ": the logs");
  ok(el.getAttribute("data-act") === "sound" && el.getAttribute("data-arg") === "fire", "campfire " + id + ": OK plays the fire's sound");
  ok(!/undefined|NaN/.test(text(el)), "campfire " + id + ": no stray words");
});
const gradIds = hasCls(draw(160, 160), "cw-fire-flame").map((f) => f.all().filter((e) => e.tagName === "LINEARGRADIENT")[0].getAttribute("id"));
ok(new Set(gradIds).size === gradIds.length && gradIds.every((g) => /^cwfl\d+$/.test(g)), "every flame has its own gradient id, so two campfires on one home never share one");
ok(/Camp/.test(text(draw(360, 160, { label: "Camp" }))) && text(draw(360, 160)) === "", "a label if the design gives one; no words otherwise");
ok(!/undefined|NaN/.test(text(draw(360, 160, { label: "x".repeat(400) }))), "a hostile label is fine");
ok(draw(160, 160, {}, { demo: true, designer: true }).getAttribute("data-empty") !== "1", "the designer and the gallery show the fire");

// ---------------- 2. the stylesheet moves nothing but transforms and opacity ----------------
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const frames = {}, re = /@(?:-webkit-)?keyframes\s+(cw-fire-[a-z0-9]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
let m;
while ((m = re.exec(css))) {
  const props = new Set();
  m[2].replace(/\{([^}]*)\}/g, (_, body) => { body.split(";").forEach((d) => { const p = d.split(":")[0].trim(); if (p) props.add(p); }); return ""; });
  frames[m[1]] = (frames[m[1]] || new Set()); props.forEach((p) => frames[m[1]].add(p));
}
const names = Object.keys(frames);
ok(names.length === 7, "seven keyframe sets: the glow, the coals, two flame flickers, three ember drifts (" + names.join(",") + ")");
const moved = new Set(); names.forEach((n) => frames[n].forEach((p) => moved.add(p)));
ok([...moved].every((p) => /^(-webkit-)?transform$|^opacity$/.test(p)), "the fire animates only transform and opacity (" + [...moved].join(", ") + "): no layout, no repaint");
ok(/@-webkit-keyframes cw-fire-a/.test(css) && /@keyframes cw-fire-a/.test(css), "prefixed for older WebViews too");
ok(!/filter\s*:|backdrop-filter\s*:[^;]*cw-fire/.test(css.slice(css.indexOf(".cw-fire {"))), "no filter anywhere in the fire's styles");
ok(/html\.lighter \.cw-fire \*/.test(css) && /prefers-reduced-motion: reduce\) \{ \.cw-fire \*/.test(css), "still on the Lighter home and when motion is reduced");
ok(css.indexOf(".cw-fire {") > 0 && (css.match(/animation: cw-fire-[a-z0-9]+ [^;]*infinite/g) || []).length >= 16, "every moving part loops on its own");

// ---------------- 3. the design and the setup record ----------------
const CD = K.design();
const k = K.kept(CD, "campfire", { label: "Camp", url: "x", sound: "fire" });
ok(k.label === "Camp" && k.url === undefined && k.sound === undefined, "a design keeps a label, nothing else");
const cap = T.C.get("campfire");
ok(cap.status === "works" && T.C.need("campfire", "Google TV") === "works" && T.C.need("campfire", "VIDAA") === "works", "widget-caps: works on every TV");
ok(["android", "web", "vidaa"].every((g) => T.C.steps("campfire", g).length >= 1), "widget-caps: steps for each kind of TV");
ok(cap.sizes.s.join() === "tile,wtile" && cap.sizes.min.join() === "2,2", "sizes: 2x2 and 4x2");
done();
