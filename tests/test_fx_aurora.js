// fx-aurora.js (design.home.aurora + aurora_style): curtains / flares per amount, the layer area budget, one picture per layer type drawn
// once, sway + run keyframes (transform / opacity only, no CSS variables, a closed periodic path so the loop wraps), the loop timing,
// every style, nothing when off / calm / Lighter / Loop, pause + resume, design.js keeping the keys and app.js wiring.
// Run: node tests/test_fx_aurora.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
let drawn = 0;
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas");
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  const grad = () => ({ addColorStop() {} });
  const ctx = new Proxy({}, { get: (t, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? grad : (k in t ? t[k] : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
  let n = 0;
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = () => ctx; e.toDataURL = () => { drawn++; return "data:image/png;base64,AA" + (n++); }; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-aurora.js"), "utf8"), win);
  return { A: win.AmbientAurora, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-aurora") >= 0);
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const cssOf = (head) => head.childNodes.map((s) => s.textContent).join("");
const sec = (v) => parseFloat(v);
const flares = (c) => kids(kids(c, "i")[0], "u");

for (const [amount, nc, nf, pct] of [["light", 2, 1, 55], ["medium", 3, 1, 83], ["heavy", 3, 2, 95]]) {
  const { A, body, head } = load(false);
  A.set(amount, "green", false);
  const h = host(body), cs = kids(h, "b");
  check(cs.length === nc, amount + ": " + nc + " curtains");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  cs.forEach((c) => check(kids(c, "i").length === 1 && flares(c).length === nf, amount + ": one curtain layer + " + nf + " flare(s) per curtain"));
  const area = nc * (1280 * 380 + nf * 220 * 380);
  check(Math.abs(100 * area / (1920 * 1080) - pct) < 2 && area / (1920 * 1080) <= 1, amount + ": layer area about " + pct + " % of a screen (" + (100 * area / (1920 * 1080)).toFixed(1) + " %), never over one screen");
  const css = cssOf(head);
  check(!/var\(/.test(css), amount + ": no CSS variables");
  check(!/blur|filter|box-shadow|text-shadow|mix-blend|backdrop/.test(css), amount + ": no blur, filter, shadow or blend mode");
  check(/background-image:url\(data:image\/png/.test(css), amount + ": pictures are drawn once as data URLs");
  check(new Set(cs.map((c) => c.className.split(" ")[0])).size === nc, amount + ": every curtain its own picture");
}
// 3 curtain pictures + 1 flare drawn once, whatever the number of layers
{ drawn = 0; const { A } = load(false); A.set("heavy", "green", false); check(drawn === 4, "heavy: 4 canvases drawn in all (3 curtains + flare), got " + drawn);
  drawn = 0; const l = load(false); l.A.set("light", "green", false); check(drawn === 4, "light: the same 4 canvases"); }
{ // keyframes: transform + opacity only, a closed path (0 % = 100 %), sampled finely enough to read as smooth, flare dark at both ends
  const { A, head } = load(false); A.set("heavy", "green", false);
  const css = cssOf(head);
  const sets = css.match(/@keyframes [\w-]+\{[^@]*\}\}?/g) || [];
  check(sets.length === 2, "two keyframe sets (sway, run)");
  sets.forEach((s) => check(!/(left|top|width|height|margin|background)\s*:/.test(s.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "keyframes move transform and opacity only"));
  const rows = (name) => { const s = sets.find((x) => x.indexOf("@keyframes " + name + "{") === 0); return s.match(/\d+(?:\.\d+)?%\{[^}]*\}/g); };
  const sw = rows("fx-aur-sway");
  check(sw.length === 25, "sway: 24 steps + the closing key, got " + sw.length);
  check(sw[0].replace(/^0%/, "") === sw[sw.length - 1].replace(/^100%/, ""), "sway: 0 % and 100 % are the same frame (the cycle wraps with no jump)");
  const xs = sw.map((r) => parseFloat(/translateX\(([-\d.]+)px/.exec(r)[1]));
  check(Math.max.apply(null, xs) > 60 && Math.min.apply(null, xs) < -60, "sway: slides well over 60 px each way");
  check(xs.every((x, i) => i === 0 || Math.abs(x - xs[i - 1]) < 40), "sway: no step over 40 px (smooth)");
  const sks = sw.map((r) => parseFloat(/skewX\(([-\d.]+)deg/.exec(r)[1]));
  check(Math.max.apply(null, sks) > 3 && Math.min.apply(null, sks) < -3, "sway: leans a few degrees each way");
  const sy = sw.map((r) => parseFloat(/scaleY\(([\d.]+)\)/.exec(r)[1]));
  check(Math.max.apply(null, sy) > 1.08 && Math.min.apply(null, sy) < 0.92, "sway: stretches and shrinks 8 % or more from its foot");
  const ops = sw.map((r) => parseFloat(/opacity:([\d.]+)/.exec(r)[1]));
  check(Math.min.apply(null, ops) > 0.45 && Math.max.apply(null, ops) <= 1, "sway: breathes between 0.45 and 1 (never goes out)");
  check(Math.max.apply(null, ops) - Math.min.apply(null, ops) > 0.25, "sway: the breathing is easy to see (0.25 or more)");
  const rn = rows("fx-aur-run");
  check(/^0%\{opacity:0;/.test(rn[0]) && /^100%\{opacity:0;/.test(rn[rn.length - 1]), "run: dark at 0 % and 100 % (no pop)");
  const rx = rn.map((r) => parseFloat(/translateX\(([-\d.]+)px/.exec(r)[1]));
  check(rx.every((x, i) => i === 0 || x > rx[i - 1]) && rx[rx.length - 1] === 1280, "run: crosses the whole curtain, left to right, one way");
  check(/-webkit-transform:/.test(css) && /@-webkit-keyframes/.test(css), "webkit copies of the keyframes for the older WebView");
}
{ // timing: live = 16-26 s curtains, 9-15 s flares at random; ?fxloop=1 = 8 s everything, fixed
  const { A, body } = load(false); A.set("heavy", "green", false);
  kids(host(body), "b").forEach((c) => { const i = kids(c, "i")[0], d = sec(i.style.animationDuration); check(d >= 16 && d <= 26, "live: curtain cycle 16-26 s (" + d + ")");
    flares(c).forEach((u) => { const f = sec(u.style.animationDuration); check(f >= 9 && f <= 15, "live: flare cycle 9-15 s (" + f + ")"); }); });
  const run = () => { const l = load(false, "?fxloop=1"); l.A.set("heavy", "green", false);
    return kids(host(l.body), "b").map((c) => [kids(c, "i")[0].style.animationDelay].concat(flares(c).map((u) => u.style.animationDelay + "/" + u.style.animationDuration)).join(" ")).join("|"); };
  const a = run(), b = run();
  check(a === b, "?fxloop=1: identical every load (fixed places and phases)");
  const l = load(false, "?fxloop=1"); l.A.set("heavy", "green", false);
  kids(host(l.body), "b").forEach((c) => { const i = kids(c, "i")[0]; check(sec(i.style.animationDuration) === 8 && sec(i.style.animationDelay) <= 0, "?fxloop=1: curtain cycle 8 s, phase set by a negative delay");
    flares(c).forEach((u) => check(sec(u.style.animationDuration) === 8 && 8 % sec(u.style.animationDuration) === 0, "?fxloop=1: flare cycle 8 s")); });
}
// every style draws its own three colours; an unknown style falls back to green
for (const s of ["green", "violet", "ice"]) { const { A, body } = load(false); A.set("medium", s, false); check(!!host(body), s + ": draws"); }
{ const { A, body } = load(false); A.set("medium", "nope", false); check(!!host(body), "unknown style: green"); }
// off / unknown amount / calm / Lighter / old engine / Loop: nothing in the page
{ const { A, body } = load(false); A.set("off", "green", false); check(!host(body), "off: nothing");
  A.set("bogus", "green", false); check(!host(body), "unknown amount: nothing");
  A.set("medium", "green", true); check(!host(body), "Lighter / old engine / Loop: nothing");
  A.set("medium", "green", false); check(!!host(body), "back to normal: drawn again");
  A.set("off", "green", false); check(!host(body), "off again: removed"); }
{ const { A, body } = load(true); A.set("heavy", "green", false); check(!host(body), "reduced motion: nothing"); }
// pause + resume
{ const { A, body, head } = load(false); A.set("light", "green", false);
  A.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause: class set");
  check(/\.fx-aurora\.fx-paused i,\.fx-aurora\.fx-paused u\{[^}]*animation-play-state:paused/.test(cssOf(head)), "pause: the css pauses curtains and flares");
  A.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume: class cleared");
  A.pause(); A.set("medium", "green", false); check(host(body).className.indexOf("fx-paused") >= 0, "rebuilt while paused: stays paused"); }
// design.js keeps the keys, picks, cost and the drop step; app.js and index.html wire it
{ const dj = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8"), ap = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8"),
    ix = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"aurora", "aurora_style"\]/.test(dj), "design.js: both keys are kept");
  check(/aurora: \["off", "light", "medium", "heavy"\], aurora_style: \["green", "violet", "ice"\]/.test(dj), "design.js: picks");
  check(/out\.push\(\["Aurora"/.test(dj) && /The aurora was switched off: too slow/.test(dj), "design.js: cost line + drop step");
  check(/AmbientAurora\.set\(HOME\.aurora \|\| "off", HOME\.aurora_style \|\| "green", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(ap), "app.js: set from the design, off in Lighter / old engine / Loop");
  check((ap.match(/AmbientAurora\.pause\(\)/g) || []).length === 2 && (ap.match(/AmbientAurora\.resume\(\)/g) || []).length === 3, "app.js: paused / resumed with the weather layer everywhere it is");
  check(/<script src="fx-aurora\.js"><\/script>/.test(ix), "index.html: script tag"); }
console.log("test_fx_aurora: " + ok + " checks passed");
