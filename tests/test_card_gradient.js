// Card gradient / iridescent glass (feat/card-gradient): a panel: colour card with style.colour2 (+ colour3), angle,
// radial, opacity, rim and sheen, and the same set once for the whole design in look.card_*. design.js sanitises it
// the way it sanitises the background's colour/colour2/angle/radial; widgets.js draws it as ONE static CSS background
// (opacity baked into the stops) + one box-shadow on the panel layer that is already there.
// Run: node tests/test_card_gradient.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const cp = require("child_process");
const K = require("./web-widgets-kit");

const web = path.join(__dirname, "../tv-home/web");
const { ok, done } = K.counter("Card gradient");
const plain = (v) => JSON.parse(JSON.stringify(v));
const CD = K.design();
const san = (style, look) => plain(CD.sanitize({ look, objects: [{ id: "w1", type: "widget", kind: "clock", size: "small", x: 80, y: 60, w: 360, h: 360, style }] }));
const st = (style) => (san(style).objects[0] || {}).style || {};

console.log("Running card gradient tests...");

// ---------------- 1. sanitise: style ----------------
const s1 = st({ panel: "colour", colour: "#7F25DA", colour2: "#ff4fd8", colour3: "rgba(255, 160, 80, 0.9)", angle: 135, radial: true, opacity: 0.62, rim: true, sheen: true, gradient: "soft" });
ok(s1.colour === "#7F25DA" && s1.colour2 === "#ff4fd8" && s1.colour3 === "rgba(255, 160, 80, 0.9)", "three plain colours are kept");
ok(s1.angle === 135 && s1.radial === true && s1.opacity === 0.62 && s1.rim === true && s1.sheen === true, "angle, radial, opacity, rim, sheen kept");
ok(st({ colour2: "#fff", angle: -50 }).angle === 0 && st({ colour2: "#fff", angle: 999 }).angle === 360, "angle is clamped to 0..360");
ok(st({ colour2: "#fff", angle: 45.6 }).angle === 46, "angle is a whole number");
ok(st({ colour2: "#fff", angle: "abc" }).angle === undefined && st({ colour2: "#fff", angle: NaN }).angle === undefined && st({ colour2: "#fff", angle: Infinity }).angle === undefined, "an angle that is not a number (or not finite) is dropped");
ok(st({ opacity: 0.01 }).opacity === 0.2 && st({ opacity: 7 }).opacity === 1, "opacity stays 0.2..1");
ok(st({ colour2: "#fff", radial: "yes" }).radial === undefined && st({ rim: 1 }).rim === undefined && st({ sheen: "true" }).sheen === undefined, "radial, rim and sheen are booleans only");
// bad colours, in every stop
const BAD = ["red", "#12", "#gggggg", "url(http://evil.example/x.png)", "red;background:url(x)", "rgba(1,2,3,'0.5')", "rgba(1,2,3,)", "rgba(1,2,3,0.5);x", "linear-gradient(red,blue)", "javascript:alert(1)", "", 42, null, {}, ["#fff"], "var(--x)", "#fff;"];
BAD.forEach((b, i) => {
  const o = st({ colour: b, colour2: b, colour3: b });
  ok(o.colour2 === undefined && o.colour3 === undefined && (i === 6 || i === 14 || o.colour === undefined), "bad colour " + i + " rejected in colour2 and colour3 (colour is stock: it still lets rgba(1,2,3,) by)");
});
ok(st({ colour2: "#ff4fd8" }).colour2 === "#ff4fd8" && st({ colour2: "rgb(1, 2, 3)" }).colour2 === "rgb(1, 2, 3)" && st({ colour2: "#ff4fd8cc" }).colour2 === "#ff4fd8cc", "hex, rgb(), 8 digit hex pass");
ok(st({ colour3: "#fff" }).colour3 === undefined, "a third stop with no second stop is dropped");
ok(st({ colour2: "nonsense", colour3: "#fff" }).colour3 === undefined, "a third stop behind a bad second stop is dropped");
ok(JSON.stringify(st({ colour2: "#fff", evil: 1, backdrop: "blur(9px)", filter: "blur(4px)", blur: 12, shadowcolour: "#000" })) === JSON.stringify({ colour2: "#fff" }), "no key outside the list (no blur, filter, backdrop) survives");

// ---------------- 2. sanitise: look.card_* ----------------
const lk = (look) => (san({}, look).look || {});
const L1 = lk({ card_colour: "#112233", card_colour2: "#ff4fd8", card_colour3: "#ffaa44", card_angle: 120, card_radial: false, card_opacity: 0.6, card_rim: true, card_sheen: true, ink: "#fff" });
ok(L1.card_colour === "#112233" && L1.card_colour2 === "#ff4fd8" && L1.card_colour3 === "#ffaa44" && L1.card_angle === 120 && L1.card_radial === false && L1.card_opacity === 0.6 && L1.card_rim === true && L1.card_sheen === true, "look.card_* kept");
ok(lk({ card_angle: 400 }).card_angle === 360 && lk({ card_angle: -3 }).card_angle === 0 && lk({ card_opacity: 0 }).card_opacity === 0.2 && lk({ card_opacity: 9 }).card_opacity === 1, "look ranges: angle 0..360, opacity 0.2..1");
BAD.forEach((b, i) => ok(lk({ card_colour: b, card_colour2: b, card_colour3: b }).card_colour2 === undefined && lk({ card_colour: b }).card_colour === undefined && lk({ card_colour3: b }).card_colour3 === undefined, "look: bad colour " + i + " rejected"));
ok(lk({ card_rim: "y", card_sheen: 1, card_radial: "no" }).card_rim === undefined, "look: flags are booleans only");
ok(lk({ card_colour2: "#fff", mystery: 1 }).mystery === undefined, "look: unknown keys still go");

// ---------------- 3. stock couch-tv drops it and falls back to colour + soft ----------------
let stockSrc = null;
try { stockSrc = cp.execFileSync("git", ["show", "origin/main:tv-home/web/design.js"], { cwd: path.join(__dirname, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) { /* no git: skip */ }
if (stockSrc) {
  const noop = () => {};
  const sb = { location: { search: "", origin: "http://tv" }, document: { documentElement: { classList: { add: noop, remove: noop, toggle: noop, contains: () => false } }, addEventListener: noop }, innerWidth: 1920, innerHeight: 1080 };
  sb.window = sb; sb.window.addEventListener = noop; vm.createContext(sb); vm.runInContext(stockSrc, sb);
  const stock = sb.window.CouchDesign;
  const mine = { look: { ink: "#ffffff", solid: "#16161b", card_colour2: "#ff4fd8", card_angle: 135, card_sheen: true }, objects: [{ id: "w1", type: "widget", kind: "clock", size: "small", x: 80, y: 60, w: 360, h: 360, style: { panel: "colour", colour: "#7F25DA", gradient: "soft", opacity: 0.62, colour2: "#ff4fd8", colour3: "#ffaa44", angle: 135, radial: false, rim: true, sheen: true } }] };
  const a = plain(stock.sanitize(mine));
  const so = a.objects[0].style;
  ok(a.objects.length === 1 && so.panel === "colour" && so.colour === "#7F25DA" && so.gradient === "soft" && so.opacity === 0.62, "stock keeps panel colour + colour + gradient soft + opacity");
  ok(so.colour2 === undefined && so.colour3 === undefined && so.angle === undefined && so.radial === undefined && so.rim === undefined && so.sheen === undefined, "stock drops colour2, colour3, angle, radial, rim, sheen (no error, no throw)");
  ok(a.look && a.look.ink === "#ffffff" && a.look.card_colour2 === undefined && a.look.card_angle === undefined && a.look.card_sheen === undefined, "stock keeps the look's own keys and drops look.card_*");
  const b = plain(CD.sanitize(mine));
  ok(b.objects[0].style.colour2 === "#ff4fd8" && b.look.card_colour2 === "#ff4fd8", "this branch keeps them");
  // and a stock design is read the same by both
  const old = { look: { ink: "#fff", panel: "rgba(6, 6, 10, 0.62)" }, objects: [{ id: "w1", type: "widget", kind: "weather", size: "wtile", x: 80, y: 60, w: 360, h: 160, style: { panel: "colour", colour: "#336699", gradient: "soft" } }] };
  ok(JSON.stringify(plain(stock.sanitize(old))) === JSON.stringify(plain(CD.sanitize(old))), "a design with none of it sanitises exactly as on stock");
} else console.log("  (git not available: stock fallback check skipped)");

// ---------------- 4. the card is drawn ----------------
const T = K.home();
const W = T.W;
function card(style, look, kind) {
  const o = { id: "c", kind: kind || "clock", w: 360, h: 360, style: Object.assign({ panel: "colour" }, style) };
  const el = W.render(o, { demo: true, look: look || {} });
  const root = [el].concat(el.all()).find((e) => e.style && e.style["--tile"] !== undefined);
  return { el, root, bg: el.all().filter((e) => /\bcw-bg\b/.test(e.className)) };
}
const rgbaOf = (s) => (s.match(/rgba?\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+(?:[\s,]+[\d.]+)?\s*\)/g) || []);
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const nums = (s) => s.match(/[\d.]+/g).map(Number);
const inkOf = (root) => nums(root.style["--ink"]).slice(0, 3);

const g3 = card({ colour: "#7F25DA", colour2: "#ff4fd8", colour3: "#ffaa44", angle: 120, opacity: 0.62, rim: true, sheen: true });
ok(g3.root && /linear-gradient\(120deg,/.test(g3.root.style["--tile"]), "a 120 degree linear gradient is drawn");
ok(rgbaOf(g3.root.style["--tile"]).length === 5, "three stops + the sheen (two values) = 5 colour values: " + rgbaOf(g3.root.style["--tile"]).length);
ok((g3.root.style["--tile"].match(/0\.62\)/g) || []).length === 3, "the card opacity is baked into every stop");
ok(g3.bg.length === 1 && !/opacity/.test(g3.bg[0].attrs.style || g3.bg[0].style.cssText || ""), "the panel layer has no element opacity (it would fade the rim and the sheen)");
ok(g3.el.all().length === card({ colour: "#7F25DA" }).el.all().length, "no extra element for the gradient, the rim or the sheen: the same layers as a plain colour card");
ok(g3.root.style["--cwrim"] && /^inset 0 0 0 1px/.test(g3.root.style["--cwrim"]) && /inset 1\.5px 1\.5px/.test(g3.root.style["--cwrim"]), "a thin rim: inset box-shadows, light at the top left");
ok(/radial-gradient\(90% 70% at 6% 0%/.test(g3.root.style["--tile"]), "a soft sheen at the top left");
const rad = card({ colour: "#7F25DA", colour2: "#ff4fd8", radial: true });
ok(/^radial-gradient\(120% 100% at 25% 15%,/.test(rad.root.style["--tile"]), "radial = the background's radial");
ok(card({ colour: "#7F25DA", colour2: "#ff4fd8" }).root.style["--tile"].indexOf("linear-gradient(160deg,") === 0, "default angle 160, like the background");
ok(card({ colour: "#7F25DA", colour2: "#ff4fd8" }).root.style["--cwrim"] === undefined, "no rim unless asked");

// nothing older changes
const flat = card({ colour: "#336699", gradient: "soft", opacity: 0.7 });
ok(flat.root.style["--tile"] === "linear-gradient(160deg,#336699,rgb(43, 86, 129))" && /opacity:0\.7/.test(flat.bg[0].attrs.style || flat.bg[0].style.cssText || ""), "a card with none of the new keys draws exactly as before (soft = colour, 84 percent, element opacity)");

// the whole design once, in look.card_*; the card's own style wins; gradient: off opts out
const LOOK = { card_colour2: "#ff4fd8", card_colour3: "#ffaa44", card_angle: 200, card_opacity: 0.6, card_rim: true, card_sheen: true };
const fromLook = card({ colour: "#7F25DA" }, LOOK);
ok(/linear-gradient\(200deg,/.test(fromLook.root.style["--tile"]) && fromLook.root.style["--cwrim"] && (fromLook.root.style["--tile"].match(/0\.6\)/g) || []).length === 3, "look.card_* give the card its gradient, angle, opacity, rim, sheen");
ok(/linear-gradient\(10deg,/.test(card({ colour: "#7F25DA", angle: 10 }, LOOK).root.style["--tile"]), "the card's own angle wins over the look's");
const own2 = card({ colour: "#7F25DA", colour2: "#00ccaa" }, LOOK).root.style["--tile"];
ok(rgbaOf(own2).length === 4 && !/255, 170, 68/.test(own2), "a card with its own colour2 does not borrow the look's third stop");
ok(card({ colour: "#7F25DA", gradient: "off" }, LOOK).root.style["--tile"] === "#7F25DA", "gradient: off opts one card out of the look's gradient");
ok(card({ colour: "#7F25DA" }, LOOK, "weather").root.style["--tile"].indexOf("linear-gradient(200deg") > 0, "any kind on a colour panel takes it");
const gl = W.render({ id: "g", kind: "clock", w: 360, h: 360, style: { panel: "glass" } }, { demo: true, look: LOOK });
ok(!gl.all().concat([gl]).some((e) => e.style && e.style["--tile"] !== undefined), "a glass or solid card is not touched by look.card_*");

// ink: every stop >= 4.5:1, the ink is chosen for them all
const SETS = [
  ["#7F25DA", "#ff4fd8", "#ffaa44"], ["#ffb58a", "#35d6d0", "#b05cff"], ["#c93f78", "#f5a35c"], ["#5b3a1d", "#e8962e"], ["#f2a900", "#e0431f"], ["#ffffff", "#ffe6f0"], ["#000000", "#222222", "#111111"],
  ["#7fffd4", "#fff0f5", "#ffd1dc"], ["#ff8a00", "#00d4ff", "#c040ff"], ["#808080", "#8a8a8a"], ["#9966ff", "#ff66cc", "#66ffcc"]
];
SETS.forEach((s) => [true, false].forEach((sheen) => {
  const c = card({ colour: s[0], colour2: s[1], colour3: s[2], sheen });
  const ink = inkOf(c.root);
  const stops = rgbaOf(c.root.style["--tile"].replace(/^radial-gradient\(90% 70% at 6% 0%,rgba\([^)]*\),rgba\([^)]*\) 62%\),/, "")).map((x) => nums(x).slice(0, 3));
  ok(stops.length === s.filter(Boolean).length, "stops drawn for " + s.join());
  stops.forEach((r, i) => {
    const eff = i === 0 && sheen ? r.map((v) => v + (255 - v) * 0.22) : r;
    ok(ratio(eff, ink) >= 4.5 && ratio(r, ink) >= 4.5, "ink " + ink.join() + " on stop " + r.join() + " of " + s.join() + (sheen ? " (sheen)" : "") + " = " + ratio(eff, ink).toFixed(2));
  });
  // and on every blend between two stops (a lilac into a pink can dip below both)
  for (let i = 0; i + 1 < stops.length; i++) for (let t = 0; t <= 10; t++) {
    const m = stops[i].map((v, k) => v + (stops[i + 1][k] - v) * t / 10);
    ok(ratio(m, ink) >= 4.5, "ink on the blend " + i + "/" + t + " of " + s.join() + " = " + ratio(m, ink).toFixed(2));
  }
}));
ok(inkOf(card({ colour: "#ffe3c8", colour2: "#c8f2ff" }).root)[0] < 60 && inkOf(card({ colour: "#3b1a66", colour2: "#6a2a9a" }).root)[0] === 255, "pale glass gets dark ink, deep glass gets white ink");
ok(card({ colour: "#ffe3c8", colour2: "#c8f2ff", ink: "white" }).root.style["--ink"] === "rgba(255, 255, 255, 1)", "an explicit ink: white is kept");
const forced = card({ colour: "#ffe3c8", colour2: "#c8f2ff", ink: "white" });
ok(rgbaOf(forced.root.style["--tile"]).every((x) => ratio(nums(x).slice(0, 3), [255, 255, 255]) >= 4.5), "...and the stops are pulled down until that white ink reads");

// ---------------- 5. every colour value we write is a valid rgba / hex ----------------
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const RGBA = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/;
const valid = (c) => HEX.test(c) || ((m) => !!m && [1, 2, 3].every((i) => +m[i] <= 255) && (m[4] === undefined || (+m[4] >= 0 && +m[4] <= 1)))(RGBA.exec(c));
let cv = 0;
const all = [];
SETS.concat([["#7F25DA", "#ff4fd8", "#ffaa44"]]).forEach((s) => [0.2, 0.5, 0.62, 1].forEach((op) => [true, false].forEach((rim) => {
  const c = card({ colour: s[0], colour2: s[1], colour3: s[2], opacity: op, rim, sheen: rim });
  all.push(c.root.style["--tile"], c.root.style["--cwrim"] || "", c.root.style["--ink"], c.root.style["--sub"], c.root.style["--faint"]);
})));
all.forEach((str) => {
  ok(!/NaN|undefined|null|Infinity|\[object/.test(str), "no NaN/undefined in " + str.slice(0, 60));
  rgbaOf(str).forEach((c) => { cv++; ok(valid(c), "valid colour " + c); });
  // no alpha written as a string/quoted, and no rgba() with the wrong count
  ok(!/["']/.test(str), "no quotes in a colour string");
});
console.log("  colour values checked: " + cv);

// ---------------- 6. static, light for the stick ----------------
const src = fs.readFileSync(path.join(web, "widgets.js"), "utf8");
const fn = src.slice(src.indexOf("function cardGlass("), src.indexOf("function shell("));
ok(fn.length > 500 && !/filter|backdrop|animation|keyframes|transition|setInterval|setTimeout|requestAnimationFrame|shadow-blur|text-shadow/i.test(fn.replace(/box-shadow/g, "")), "cardGlass: no filter, no backdrop-filter, no animation, no timer");
const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
ok(/\.cw-tint > \.cw-bg \{[^}]*box-shadow: var\(--cwrim, none\)/.test(css) && !/\.cw-tint > \.cw-bg \{[^}]*(backdrop|filter)/.test(css), "the tint panel gains only the rim's box-shadow, never a blur");
const rimStr = g3.root.style["--cwrim"];
ok(!/blur|\d+px \d+px \d+px/.test(rimStr), "the rim shadows have no blur radius: " + rimStr);
ok(JSON.stringify(plain(g3.el.all().map((e) => e.style && e.style.cssText))).indexOf("animation") < 0, "no animation on the card");

done();
