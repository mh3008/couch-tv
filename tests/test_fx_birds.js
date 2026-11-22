// fx-birds.js (design.home.birds + birds_style): flocks per amount, at most 30 separately animated layers (a flock = 1 layer with every body in one picture, + 1 per bird for the wings),
// pictures drawn once, keyframes (transform only, off the screen at both ends so the wrap is invisible), the wing beat (scale only),
// formations holding (one path + one delay per flock), the ?fxloop=1 clip repeating exactly in 8 s, every style, nothing when off /
// calm / Lighter / Loop, pause + resume, design.js keeping the keys and app.js wiring, and every colour a valid hex / rgba.
// Run: node tests/test_fx_birds.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { FakeEl } = require("./fake-dom.js");

let ok = 0;
function check(c, msg) { assert.ok(c, msg); ok++; }
let drawn = 0;
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/;
function validColour(c) {
  assert.ok(typeof c === "string", "a colour is a string: " + c);
  if (HEX.test(c)) { ok++; return; }
  const m = RGBA.exec(c);
  assert.ok(m && +m[1] <= 255 && +m[2] <= 255 && +m[3] <= 255 && (m[4] === undefined || (+m[4] >= 0 && +m[4] <= 1)), "not a valid hex / rgba colour: " + c); ok++;
}
const SRC = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-birds.js"), "utf8");
function load(reduce, search) {
  const head = new FakeEl("head"), body = new FakeEl("body"), wc = new FakeEl("canvas");
  wc.attrs.id = "weather-canvas"; body.appendChild(wc);
  // a colour the canvas would throw on (an alpha string in an rgba colour, a bad hex) must fail here: the real-browser bug the VM tests missed (waves, 22 Nov)
  const grad = () => ({ addColorStop(off, col) { check(typeof off === "number" && off >= 0 && off <= 1, "colour stop offset 0..1"); validColour(col); } });
  const ctx = new Proxy({}, { get: (t, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? grad : (k in t ? t[k] : () => {})),
    set: (t, k, v) => { if (k === "fillStyle" || k === "strokeStyle") { if (typeof v !== "object") validColour(v); } if (k === "globalAlpha") check(typeof v === "number" && v >= 0 && v <= 1, "globalAlpha is a number 0..1 (" + v + ")"); t[k] = v; return true; } });
  let n = 0;
  const doc = { head, body,
    createElement: (t) => { const e = new FakeEl(t); if (t === "canvas") { e.getContext = () => ctx; e.toDataURL = () => { drawn++; return "data:image/png;base64,AA" + (n++); }; } return e; },
    getElementById: (id) => (id === "weather-canvas" ? wc : null) };
  const win = { document: doc, innerWidth: 1920, innerHeight: 1080, location: { search: search || "" }, matchMedia: () => ({ matches: !!reduce, addListener() {} }) };
  vm.runInNewContext(SRC, win);
  return { F: win.AmbientBirds, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-birds") >= 0);
const cssOf = (head) => head.childNodes.map((s) => s.textContent).join("");
const sec = (v) => parseFloat(v);
const sp = (el, n) => { const m = new RegExp("(?:^|;)" + n + ":([^;]*)").exec(el.style.cssText); return m ? m[1] : ""; };
const W = 1920, H = 1080;

// layers: a flock = one layer (path + every body as one picture), each beating pair of wings = one more. Worst case (many) = 30, never more.
const wingsOf = (h) => h.childNodes.reduce((a, f) => a.concat(f.childNodes), []);
const layersOf = (h) => h.childNodes.length + wingsOf(h).length;
for (const [amount, flocks, layers] of [["few", 2, 11], ["flock", 3, 19], ["many", 4, 30]]) {
  const { F, body, head } = load(false);
  F.set(amount, "dark", false);
  const h = host(body);
  check(h.childNodes.length === flocks, amount + ": " + flocks + " flocks (one layer each), got " + h.childNodes.length);
  check(layersOf(h) === layers && layersOf(h) <= 30, amount + ": " + layersOf(h) + " separately animated layers (cap 30)");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  check(h.childNodes.every((f) => String(f.tagName).toLowerCase() === "i" && /background-image:url\(data:image\/png/.test(f.style.cssText) && f.childNodes.every((u) => String(u.tagName).toLowerCase() === "u" && u.childNodes.length === 0)), amount + ": a flock is one picture with its wings as children (no deeper)");
  // the wings: worst-case layer area (wing boxes), and the flock pictures (sparse: only the bodies are drawn in them)
  let area = 0, pic = 0;
  wingsOf(h).forEach((u) => { const s = sec(sp(u, "width")); check(s >= 35 && s <= 226, amount + ": wing span 35-226 px (" + s + ")"); check(Math.abs(sec(sp(u, "height")) - s / 2) <= 0.5, amount + ": wings 2:1"); area += s * (s / 2); });
  h.childNodes.forEach((f) => { pic += sec(sp(f, "width")) * sec(sp(f, "height")); });
  check(area / (W * H) <= 0.06, amount + ": wing layer area " + (100 * area / (W * H)).toFixed(1) + " % of a screen (bar 6 %; the flock pictures are sparse: " + (100 * pic / (W * H)).toFixed(0) + " % of a screen as boxes)");
  const css = cssOf(head);
  check(!/var\(/.test(css), amount + ": no CSS variables");
  check(!/blur|filter|box-shadow|text-shadow|mix-blend|backdrop/.test(css + h.childNodes.map((f) => f.style.cssText + f.childNodes.map((u) => u.style.cssText).join("")).join("")), amount + ": no blur, filter, shadow or blend");
  check(wingsOf(h).every((u) => /background-image:url\(data:image\/png/.test(u.style.cssText)), amount + ": the wings are a picture drawn once");
}
// wings: 3 pictures (small far, small mid, big close); each flock's bodies: 1 picture per flock; nothing drawn per bird or per frame
{ drawn = 0; const { F } = load(false); F.set("many", "dark", false); check(drawn === 3 + 4, "7 canvases drawn in all (3 wing pictures + 1 per flock), got " + drawn); }
{ drawn = 0; const { F } = load(false); F.set("few", "dark", false); check(drawn === 3 + 2, "few: 5 canvases drawn in all, got " + drawn); }
{ // keyframes: transform only; every path starts and ends off the screen, so the wrap never shows; the wings beat by scaleY alone
  const { F, head } = load(false); F.set("many", "dark", false);
  const css = cssOf(head);
  const sets = css.match(/@keyframes [\w-]+\{[^@]*\}\}?/g) || [];
  check(sets.length === 2 + 4, "6 keyframe sets (2 wing beats + 4 flock paths), got " + sets.length);
  sets.forEach((s) => check(!/(left|top|width|height|margin|background|color|opacity)\s*:/.test(s.replace(/transform:[^;}]*/g, "")), "keyframes move transform only"));
  const flapc = sets.find((x) => x.indexOf("@keyframes fx-bflapc{") === 0), flapb = sets.find((x) => x.indexOf("@keyframes fx-bflapb{") === 0);
  for (const s of [flapc, flapb]) {
    const rows = [...s.matchAll(/([\d.]+)%\{transform:scaleY\((-?[\d.]+)\)\}/g)].map((m) => [+m[1], +m[2]]);
    check(rows[0][0] === 0 && rows[rows.length - 1][0] === 100 && rows[0][1] === 1 && rows[rows.length - 1][1] === 1, "a wing beat starts and ends tips up (scaleY 1)");
    check(rows.some((r) => r[1] < -0.5) && rows.every((r) => r[1] <= 1 && r[1] >= -1), "the wings go down past flat and never grow");
    check(rows.every((r, i) => i === 0 || r[0] >= rows[i - 1][0]), "keyframe offsets only go forward");
  }
  check(/\{transform:scaleY\(0\.4\)\}/.test(flapb), "a burst glides with the wings held up");
  for (let fi = 0; fi < 4; fi++) {
    const s = sets.find((x) => x.indexOf("@keyframes fx-bpath" + fi + "{") === 0);
    const rows = [...s.matchAll(/([\d.]+)%\{transform:translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\) scaleX\((-?1)\)\}/g)].map((m) => [+m[1], +m[2], +m[3], +m[4]]);
    check(rows.length >= 49 && rows[0][0] === 0 && rows[rows.length - 1][0] === 100, "path " + fi + ": 49+ sampled steps, 0 % to 100 %");
    const dir = rows[0][3], first = rows[0][1], last = rows[rows.length - 1][1];
    if (dir > 0) check(first <= -100 && last >= W + 100, "path " + fi + ": off the left edge to off the right (" + first + " -> " + last + ")");
    else check(first >= W + 100 && last <= -100, "path " + fi + ": off the right edge to off the left (" + first + " -> " + last + ")");
    check(rows.every((r) => r[2] > -20 && r[2] < 0.6 * H), "path " + fi + ": stays in the sky (y " + Math.min(...rows.map((r) => r[2])) + ".." + Math.max(...rows.map((r) => r[2])) + ")");
    check(rows.every((r) => r[3] === dir), "path " + fi + ": faces one way");
  }
  check(/fx-birds\.fx-paused i,\.fx-birds\.fx-paused u\{[^}]*paused/.test(css) && /\.lighter \.fx-birds,\.old-engine \.fx-birds/.test(css), "pausable, and off in the Lighter home / old engine");
}
{ // live: a flock is one layer on its own path and its own delay (the formation holds); a crossing + the empty sky; already flying at once (negative delays)
  const { F, body, head } = load(false); F.set("many", "dark", false);
  const h = host(body);
  check(h.childNodes.every((f, k) => sp(f, "animation-name") === "fx-bpath" + k), "4 flocks, each on its own path");
  const sizes = h.childNodes.map((f) => f.childNodes.length);
  check(JSON.stringify(sizes) === JSON.stringify([10, 7, 3, 6]), "wing layers per flock 10 / 7 / 3 / 6 (the last far bird glides: the budget), got " + sizes);
  h.childNodes.forEach((f, k) => {
    const d = sec(sp(f, "animation-duration")), at = sec(sp(f, "animation-delay"));
    check(d >= 20 && d <= 60 && at <= 0 && at > -d, "flock " + k + ": a crossing + the empty sky, already flying (duration " + d + ", delay " + at + ")");
    const s = cssOf(head).match(new RegExp("@keyframes fx-bpath" + k + "\\{[^@]*\\}\\}?"))[0];
    check(/100%\{transform:translate3d\(/.test(s) && /9\d\.\d%\{|100%/.test(s), "flock " + k + ": holds off the screen after the crossing");
    check(/transform-origin:-?[\d.]+px 0/.test(f.style.cssText), "flock " + k + ": turns round about the leader's centre line");
  });
  // wings beat out of step, at a believable rate: 1 to 3 beats a second
  const ws = wingsOf(h), wdel = new Set(ws.map((u) => sp(u, "animation-delay")));
  check(ws.every((u) => { const d = sec(sp(u, "animation-duration")); return d === 4 || (d >= 0.3 && d <= 0.9); }) && wdel.size > ws.length * 0.6, "wings beat at their own rate and phase (" + wdel.size + " different delays)");
  check(ws.every((u) => sec(sp(u, "animation-delay")) <= 0), "every wing starts already beating");
  check(ws.every((u) => sec(sp(u, "left")) >= 0 && sec(sp(u, "top")) >= 0), "every wing sits inside its flock's box");
}
{ // ?fxloop=1: every cycle divides 8 s, the same sky every load, so the clip repeats exactly; the crossing fills the whole cycle (no empty sky)
  const a = load(false, "?fxloop=1"); a.F.set("many", "dark", false);
  const b = load(false, "?fxloop=1"); b.F.set("many", "dark", false);
  const all = (body, head) => JSON.stringify(host(body).childNodes.map((x) => x.style.cssText + x.childNodes.map((u) => u.style.cssText).join(""))) + cssOf(head);
  check(all(a.body, a.head) === all(b.body, b.head), "?fxloop=1: the same every load (the clip repeats exactly)");
  host(a.body).childNodes.forEach((x) => { check(8 % sec(sp(x, "animation-duration")) === 0, "?fxloop=1: a path cycle divides 8 s"); x.childNodes.forEach((u) => { const n = 8 / sec(sp(u, "animation-duration")); check(Math.abs(n - Math.round(n)) < 1e-6, "?fxloop=1: a wing cycle divides 8 s (" + n.toFixed(2) + " beats)"); }); });
  { const ps = cssOf(a.head).match(/@keyframes fx-bpath0\{[^@]*\}\}?/)[0]; check((ps.match(/%\{transform:translate3d/g) || []).length === 49, "?fxloop=1: crossing fills the cycle (49 steps, no empty sky)"); }
  const c = load(false), d = load(false); c.F.set("many", "dark", false); d.F.set("many", "dark", false);
  check(all(c.body, c.head) !== all(d.body, d.head), "live: a different sky each time");
}
for (const style of ["dark", "light", "dusk"]) { const { F, body } = load(false); F.set("flock", style, false); check(layersOf(host(body)) === 19, style + ": builds (19 layers)"); }
{ const { F, body } = load(false); F.set("flock", "nonsense", false); check(layersOf(host(body)) === 19, "an unknown style falls back to dark"); }
{ const { F, body } = load(false); F.set("off", "dark", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("lots", "dark", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(true); F.set("many", "dark", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("many", "dark", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("few", "dark", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); F.set("few", "dark", false); check(host(body) === first, "the same setting again: not rebuilt");
  F.set("few", "dusk", false); check(host(body) !== first && !!host(body), "another style: rebuilt");
  F.set("off", "dusk", false); check(!host(body), "back to off: the layer goes"); }
{ const { F, body } = load(false); F.pause(); F.set("few", "dark", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const rd = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
  const src = rd("tv-home/web/design.js");
  check(/HOME_KEYS = \[[^\]]*"birds", "birds_style"\]/.test(src), "design.js: birds + birds_style are design home keys");
  check(/birds: \["off", "few", "flock", "many"\]/.test(src) && /birds_style: \["dark", "light", "dusk"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Birds"/.test(src) && /The birds were switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = rd("tv-home/web/app.js");
  check(/AmbientBirds\.set\(HOME\.birds \|\| "off", HOME\.birds_style \|\| "dark", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientBirds\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientBirds\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-birds\.js"><\/script>/.test(rd("tv-home/web/index.html")), "index.html loads fx-birds.js");
  check(/`birds` \(off, few, flock, many/.test(rd("docs/CONFIG.md")), "docs/CONFIG.md documents it");
}
{ // every colour literal in fx-birds.js is a valid hex or rgba(...): in the source and in every canvas call, for every style
  const hexes = SRC.match(/"#[0-9A-Fa-f]+"/g) || [];
  hexes.forEach((h) => validColour(h.slice(1, -1)));
  (SRC.match(/"rgba?\([0-9, .]+\)"/g) || []).forEach((c) => validColour(c.slice(1, -1)));
  check(hexes.length >= 12, "found the palette colours in the source");
  for (const style of ["dark", "light", "dusk"]) { const { F } = load(false); F.set("many", style, false); }   // every canvas call is validated by the proxy
  validColour("rgba(255,235,242,0)"); validColour("#FFF");
  for (const bad of ["rgba(255,0,0,0.5x)", "rgba(255,0,0,\"0.5\")", "#GGG", "rgba(300,0,0,1)", "rgba(1,2,3,1.5)"]) assert.throws(() => validColour(bad), bad + " is rejected");
}
console.log("All " + ok + " birds tests passed.");
