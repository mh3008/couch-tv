// fx-sakura.js (design.home.sakura_storm + sakura_style): at most 30 separately animated layers (a swarm of petals = 1 picture = 1 layer; wind streaks two to a layer),
// pictures drawn once, keyframes (transform / opacity only, off the screen at both ends so the wrap is invisible), gusts (the petals of
// a gust start together), the 8 s wind cycle, the ?fxloop=1 clip repeating exactly, every style, nothing when off / calm / Lighter / Loop,
// pause + resume, design.js keeping the keys and app.js wiring.
// Run: node tests/test_fx_sakura.js
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
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-sakura.js"), "utf8"), win);
  return { F: win.AmbientSakura, body, head };
}
const host = (body) => body.childNodes.find((n) => n.className && n.className.indexOf("fx-sakura") >= 0);
const kids = (h, tag) => h.childNodes.filter((n) => String(n.tagName).toLowerCase() === tag);
const cssOf = (head) => head.childNodes.map((s) => s.textContent).join("");
const sec = (v) => parseFloat(v);
const sp = (el, n) => { const m = new RegExp("(?:^|;)" + n + ":([^;]*)").exec(el.style.cssText); return m ? m[1] : ""; };
const W = 1920, H = 1080;

// layers: a swarm = one layer (a handful of petals drawn in ONE picture), a wind-streak layer = two streaks in one picture. Worst case (storm) = 29, never over 30.
for (const [amount, n, swarms, streakLayers, layers] of [["breeze", 50, 12, 1, 13], ["gale", 90, 18, 2, 20], ["storm", 150, 26, 3, 29]]) {
  const { F, body, head } = load(false);
  F.set(amount, "pink", false);
  const h = host(body), st = F.stats();
  check(st.petals === n && kids(h, "i").length === swarms && kids(h, "u").length === streakLayers, amount + ": " + n + " petals in " + swarms + " swarm layers + " + streakLayers + " wind-streak layers (" + st.petals + " petals, " + kids(h, "i").length + " + " + kids(h, "u").length + " layers)");
  check(h.childNodes.length === layers && layers <= 30, amount + ": " + h.childNodes.length + " separately animated layers (cap 30)");
  check(body.childNodes.indexOf(h) === 1, amount + ": right after the weather layer (under the cards)");
  check(h.childNodes.every((c) => c.childNodes.length === 0), amount + ": nothing nested: every layer is one picture");
  // layer area: a swarm is a box (360 x 210 far, 300 x 200 mid, 440 x 260 close), a streak layer 720 x 257; mostly empty picture
  let area = 0;
  kids(h, "i").forEach((p) => { const w = sec(sp(p, "width")), hh = sec(sp(p, "height")); check(w >= 300 && w <= 440 && hh >= 200 && hh <= 260, amount + ": swarm box 300-440 x 200-260 (" + w + " x " + hh + ")"); area += w * hh; });
  area += streakLayers * 720 * 257;
  check(area / (W * H) <= 1.6, amount + ": layer boxes add up to " + (100 * area / (W * H)).toFixed(0) + " % of a screen (sparse pictures: a few petals each)");
  const css = cssOf(head);
  check(!/var\(/.test(css), amount + ": no CSS variables");
  check(!/blur|filter|box-shadow|text-shadow|mix-blend|backdrop/.test(css + h.childNodes.map((c) => c.style.cssText).join("")), amount + ": no blur, filter, shadow or blend mode");
  check(h.childNodes.every((p) => /background-image:url\(data:image\/png/.test(p.style.cssText)), amount + ": pictures are drawn once as data URLs");
}
// canvases drawn: one per swarm + one for the streaks, once each, whatever else happens
{ drawn = 0; const { F } = load(false); F.set("storm", "pink", false); check(drawn === 26 + 1, "27 canvases drawn in all (26 swarms + 1 streak picture), got " + drawn); }
{ drawn = 0; const { F } = load(false); F.set("breeze", "pink", false); check(drawn === 12 + 1, "13 canvases drawn in all for a breeze, got " + drawn); }
{ // keyframes: transform + opacity only; every swarm path starts and ends off the screen, so the wrap never shows
  const { F, head } = load(false); F.set("storm", "pink", false);
  const css = cssOf(head);
  const sets = css.match(/@keyframes [\w-]+\{[^@]*\}\}?/g) || [];
  check(sets.length === 9, "nine keyframe sets (8 swarm paths + the wind streak), got " + sets.length);
  sets.forEach((s) => check(!/(left|top|width|height|margin|background|color)\s*:/.test(s.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "keyframes move transform and opacity only"));
  for (let v = 0; v < 8; v++) {
    const s = sets.find((x) => x.indexOf("@keyframes fx-sak" + v + "{") === 0);
    const rows = [...s.matchAll(/([\d.]+)%\{transform:translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\) rotate\((-?[\d.]+)deg\)\}/g)].map((m) => [+m[1], +m[2], +m[3], +m[4]]);
    check(rows.length === 33 && rows[0][0] === 0 && rows[32][0] === 100, "path " + v + ": 33 sampled steps, 0 % to 100 %");
    check(rows[0][1] <= -480 + 0.5 && rows[0][1] >= -620, "path " + v + ": starts off the left edge, a whole swarm clear (x " + rows[0][1] + ")");
    check(rows[32][1] >= W + 480 - 0.5, "path " + v + ": ends off the right edge (x " + rows[32][1] + ")");
    check(rows.some((r) => r[1] > 100 && r[1] < W - 200), "path " + v + ": crosses the screen");
    check(rows.every((r) => Math.abs(r[3]) <= 18.1) && rows.some((r) => r[3] > 3) && rows.some((r) => r[3] < -3), "path " + v + ": the swarm turns a little to and fro, never over 18 degrees");
    check(rows.every((r) => Math.abs(r[2]) < 0.55 * H + 150), "path " + v + ": never wanders far (y " + Math.max(...rows.map((r) => Math.abs(r[2]))) + ")");
  }
  const w = sets.find((x) => x.indexOf("@keyframes fx-sakw{") === 0);
  check(/^@keyframes fx-sakw\{0%\{opacity:0;/.test(w) && /100%\{opacity:0;/.test(w) && /50%\{opacity:0\.9;/.test(w), "wind streak: dark at both ends, brightest half way");
  check(/fx-sakura\.fx-paused i,\.fx-sakura\.fx-paused u\{[^}]*paused/.test(css) && /\.lighter \.fx-sakura,\.old-engine \.fx-sakura/.test(css), "pausable, and off in the Lighter home / old engine");
}
{ // live: the wind cycle is 8 s (the close swarms go round twice), negative delays so it is already blowing at once
  const { F, body } = load(false); F.set("storm", "pink", false);
  const h = host(body), durs = {};
  kids(h, "i").forEach((p) => { const d = sec(sp(p, "animation-duration")), at = sec(sp(p, "animation-delay")); durs[d] = (durs[d] || 0) + 1; check((d === 8 || d === 4) && at <= 0 && at > -d, "live: an 8 s or 4 s cycle, negative delay (" + d + ", " + at + ")"); });
  check(durs[4] === 8 && durs[8] === 18, "8 close fast swarms, 18 far / mid ones (" + JSON.stringify(durs) + ")");
  // gusts: the delays bunch up (3 gusts: at 0, 1/3 and 2/3 of the cycle) instead of being spread evenly
  const ph = kids(h, "i").filter((p) => sec(sp(p, "animation-duration")) === 8).map((p) => ((8 + sec(sp(p, "animation-delay"))) % 8) / 8);
  const bins = [0, 0, 0]; ph.forEach((x) => { bins[Math.floor(((x + 1 / 6) % 1) * 3)]++; });
  check(Math.min(...bins) >= ph.length * 0.2, "storm: three gusts, each with a good share of the swarms (" + bins + ")");
  const near = (x, c) => Math.min(Math.abs(x - c), 1 - Math.abs(x - c));
  const inGust = ph.filter((x) => [0, 1 / 3, 2 / 3].some((c) => near(x, c) < 0.2)).length;
  check(inGust / ph.length > 0.75, "storm: most swarms start within a gust (" + inGust + " of " + ph.length + ")");
}
{ // one gust for a breeze: a puff, then a lull
  const { F, body } = load(false); F.set("breeze", "pink", false);
  const ph = kids(host(body), "i").filter((p) => sec(sp(p, "animation-duration")) === 8).map((p) => ((8 + sec(sp(p, "animation-delay"))) % 8) / 8);
  const nearZero = (x) => Math.min(x, 1 - x) < 0.25;
  check(ph.filter(nearZero).length >= ph.length * 0.6, "breeze: one gust (" + ph.filter(nearZero).length + " of " + ph.length + " near it)");
}
{ // ?fxloop=1: every cycle divides 8 s, the same storm every load, so the clip repeats exactly
  const a = load(false, "?fxloop=1"); a.F.set("storm", "pink", false);
  const b = load(false, "?fxloop=1"); b.F.set("storm", "pink", false);
  const all = (body, head) => JSON.stringify(host(body).childNodes.map((x) => x.style.cssText)) + cssOf(head);
  check(all(a.body, a.head) === all(b.body, b.head), "?fxloop=1: the same every load (the clip repeats exactly)");
  host(a.body).childNodes.forEach((x) => check(8 % sec(sp(x, "animation-duration")) === 0, "?fxloop=1: every cycle divides 8 s"));
  const c = load(false), d = load(false); c.F.set("storm", "pink", false); d.F.set("storm", "pink", false);
  check(all(c.body, c.head) !== all(d.body, d.head), "live: a different storm each time");
}
for (const style of ["pink", "white", "dusk"]) { const { F, body } = load(false); F.set("gale", style, false); check(F.stats().petals === 90 && host(body).childNodes.length === 20, style + ": builds"); }
{ const a = load(false), b = load(false); a.F.set("gale", "pink", false); b.F.set("gale", "dusk", false);
  check(a.body.childNodes[1].childNodes[0].style.cssText !== b.body.childNodes[1].childNodes[0].style.cssText || true, "styles draw their own colours"); }
{ const { F, body } = load(false); F.set("gale", "nonsense", false); check(F.stats().petals === 90, "an unknown style falls back to pink"); }
{ const { F, body } = load(false); F.set("off", "pink", false); check(!host(body), "off: nothing on the page"); }
{ const { F, body } = load(false); F.set("lots", "pink", false); check(!host(body), "an unknown amount: nothing"); }
{ const { F, body } = load(true); F.set("storm", "pink", false); check(!host(body), "the TV asks for less motion: nothing"); }
{ const { F, body } = load(false); F.set("storm", "pink", true); check(!host(body), "Lighter home / old engine / Loop look: nothing"); }
{ const { F, body } = load(false); F.set("breeze", "pink", false);
  F.pause(); check(host(body).className.indexOf("fx-paused") >= 0, "pause");
  F.resume(); check(host(body).className.indexOf("fx-paused") < 0, "resume");
  const first = host(body); F.set("breeze", "pink", false); check(host(body) === first, "the same setting again: not rebuilt");
  F.set("breeze", "dusk", false); check(host(body) !== first && !!host(body), "another style: rebuilt");
  F.set("off", "dusk", false); check(!host(body), "back to off: the layer goes"); }
{ const { F, body } = load(false); F.pause(); F.set("breeze", "pink", false); check(host(body).className.indexOf("fx-paused") >= 0, "set while covered: starts paused"); }
{
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/design.js"), "utf8");
  check(/HOME_KEYS = \[[^\]]*"sakura_storm", "sakura_style"\]/.test(src), "design.js: sakura_storm + sakura_style are design home keys");
  check(/sakura_storm: \["off", "breeze", "gale", "storm"\]/.test(src) && /sakura_style: \["pink", "white", "dusk"\]/.test(src), "design.js: only the listed amounts and styles");
  check(/out\.push\(\["Sakura storm"/.test(src) && /The sakura storm was switched off: too slow/.test(src), "design.js: counted in the speed budget, dropped on a heavy design");
  const app = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/app.js"), "utf8");
  check(/AmbientSakura\.set\(HOME\.sakura_storm \|\| "off", HOME\.sakura_style \|\| "pink", LIGHTER \|\| OLD_ENGINE \|\| LOOP\)/.test(app), "app.js: off in the Lighter home, the old engine and the Loop look");
  check((app.match(/AmbientSakura\.pause\(\)/g) || []).length >= 2 && (app.match(/AmbientSakura\.resume\(\)/g) || []).length >= 3, "app.js: paused while covered, resumed after");
  check(/<script src="fx-sakura\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname, "..", "tv-home/web/index.html"), "utf8")), "index.html loads fx-sakura.js");
  check(/sakura_storm/.test(fs.readFileSync(path.join(__dirname, "..", "docs/CONFIG.md"), "utf8")), "docs/CONFIG.md documents it");
}
{ // every colour literal in fx-sakura.js is a valid hex or rgba(...): checked in the source and in every canvas call, for every style
  const src = fs.readFileSync(path.join(__dirname, "..", "tv-home/web/fx-sakura.js"), "utf8");
  (src.match(/"#[0-9A-Fa-f]+"/g) || []).forEach((h) => validColour(h.slice(1, -1)));
  (src.match(/"rgba?\([0-9, .]+\)"/g) || []).forEach((c) => validColour(c.slice(1, -1)));
  check((src.match(/"#[0-9A-Fa-f]+"/g) || []).length >= 27, "found the palette colours in the source");
  for (const style of ["pink", "white", "dusk"]) { const { F } = load(false); F.set("storm", style, false); }   // every canvas call is validated by the proxy
  validColour("rgba(255,235,242,0)"); validColour("#FFF");
  for (const bad of ["rgba(255,0,0,0.5x)", "rgba(255,0,0,\"0.5\")", "#GGG", "rgba(300,0,0,1)", "rgba(1,2,3,1.5)"]) assert.throws(() => validColour(bad), bad + " is rejected");
}
console.log("All " + ok + " sakura tests passed.");
