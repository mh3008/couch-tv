// Card gradient / iridescent glass in a REAL browser (feat/card-gradient): the page draws, throws nothing, the card is
// ONE static CSS background (+ the rim's inset box-shadow), no backdrop-filter, no filter, no animation on it, the
// words stay >= 4.5:1 on the drawn pixels (measured on a screenshot, the words' own pixels left out), and a card
// with none of the new keys still draws as it did.
// Needs Playwright (Chromium). Without it the test says so and passes:
//   COUCHTV_PLAYWRIGHT=<a folder whose node_modules has playwright> node tests/test_card_gradient_browser.mjs
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium;
try { chromium = createRequire(path.join(process.env.COUCHTV_PLAYWRIGHT || process.cwd(), "package.json"))("playwright").chromium; }
catch (e) { console.log("SKIP: Playwright is not installed (set COUCHTV_PLAYWRIGHT to a folder that has it)"); process.exit(0); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port, BASE = ORIGIN + "/tv-home/web/index.html";
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });

console.log("Running card gradient browser tests...");
// a background that is dark on the left and bright on the right, so a translucent card has a dark or a bright photo to
// show through. The words are only promised against the card's own colours: a translucent deep card on a dark photo,
// an opaque card anywhere, a pale card on a bright photo
const design = {
  v: 1, background: { colour: "#14102a", colour2: "#f0c080", angle: 90 },
  look: { ink: "#ffffff", solid: "#16161b", card_colour2: "#b02f90", card_colour3: "#8a3a6a", card_angle: 135, card_opacity: 0.72, card_rim: true, card_sheen: true },
  objects: [
    { id: "g3", type: "widget", kind: "quote", style: { panel: "colour", colour: "#5a2fb0", colour2: "#b02f90", colour3: "#8a3a1a", angle: 120, opacity: 0.7, rim: true, sheen: true }, opts: { text: "Three stops and a rim" }, x: 80, y: 60, w: 520, h: 260 },
    { id: "lk", type: "widget", kind: "quote", style: { panel: "colour", colour: "#5a2fb0" }, opts: { text: "From the look" }, x: 80, y: 360, w: 520, h: 260 },
    { id: "rd", type: "widget", kind: "quote", style: { panel: "colour", colour: "#5a2fb0", colour2: "#b02f90", radial: true, opacity: 0.7 }, opts: { text: "Radial" }, x: 80, y: 660, w: 520, h: 260 },
    { id: "pl", type: "widget", kind: "quote", style: { panel: "colour", colour: "#336699", gradient: "off" }, opts: { text: "Plain, no gradient" }, x: 700, y: 60, w: 520, h: 260 },
    { id: "gl", type: "widget", kind: "quote", style: { panel: "glass" }, opts: { text: "Glass is untouched" }, x: 700, y: 360, w: 520, h: 260 },
    { id: "o3", type: "widget", kind: "quote", style: { panel: "colour", colour: "#f0804f", colour2: "#35d6d0", colour3: "#b05cff", angle: 120, opacity: 1, rim: true, sheen: true }, opts: { text: "Peach teal violet, opaque" }, x: 1320, y: 60, w: 520, h: 260 },
    { id: "op", type: "widget", kind: "quote", style: { panel: "colour", colour: "#7a3ce0", colour2: "#ff4fd8", radial: true, opacity: 1 }, opts: { text: "Opaque radial" }, x: 1320, y: 360, w: 520, h: 260 },
    { id: "pa", type: "widget", kind: "quote", style: { panel: "colour", colour: "#ffe3c8", colour2: "#c8f2ff", colour3: "#e9d0ff", opacity: 0.8, sheen: true }, opts: { text: "Pale glass dark ink" }, x: 1320, y: 660, w: 520, h: 260 }
  ]
};
await page.goto(BASE + "?mock=1&reset=1");
await page.evaluate((d) => { localStorage.clear(); localStorage.setItem("tvdesigner.design", JSON.stringify(d)); }, design);
await page.goto(BASE + "?mock=1&design=local&designstore=" + encodeURIComponent(ORIGIN));
await page.waitForFunction(() => document.querySelector(".cw-o .cw"), null, { timeout: 8000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll(".cw-o").forEach((o) => {
    const id = o.getAttribute("data-obj"), card = o.querySelector(".cw"), bg = card.querySelector(":scope > .cw-bg");
    const cs = bg ? getComputedStyle(bg) : null, r = card.getBoundingClientRect();
    out[id] = { img: cs && cs.backgroundImage, color: cs && cs.backgroundColor, shadow: cs && cs.boxShadow, bf: cs && (cs.backdropFilter || cs.webkitBackdropFilter || "none"), filter: cs && cs.filter, opacity: cs && cs.opacity,
      anim: card.getAnimations ? card.getAnimations({ subtree: true }).length : -1, kids: card.children.length, ink: getComputedStyle(card).color, rect: [r.left, r.top, r.width, r.height] };
  });
  return out;
});
const { g3, lk, pa, rd, pl, gl, o3, op } = info;
ok(g3 && /linear-gradient\(120deg/.test(g3.img) && (g3.img.match(/rgba\(/g) || []).length >= 5, "g3: a 120 degree gradient with three stops and a sheen in the page (" + (g3.img || "").slice(0, 90) + ")");
ok(/inset/.test(g3.shadow), "g3: the rim is an inset box-shadow (" + g3.shadow + ")");
ok(g3.opacity === "1", "g3: the panel layer is not faded as a whole (the opacity is in the stops)");
ok(/linear-gradient\(135deg/.test(lk.img) && /inset/.test(lk.shadow) && /0\.72/.test(lk.img), "lk: the look's angle, rim, sheen and opacity reach a card that sets only its colour");
ok(/radial-gradient\(120% 100% at 25% 15%/.test(rd.img), "rd: radial");
ok(/linear-gradient\(/.test(pa.img), "pa: pale glass drawn");
ok(pl.img === "none" && pl.color === "rgb(51, 102, 153)" && pl.shadow === "none", "pl: gradient off = the plain colour, no rim");
ok(gl && gl.img !== undefined, "gl: the glass card is drawn");
Object.keys(info).forEach((k) => ok(info[k].anim === 0, k + ": no animation or transition running on the card (" + info[k].anim + ")"));
["g3", "lk", "pa", "rd", "pl", "o3", "op"].forEach((k) => ok(info[k].bf === "none" && info[k].filter === "none", k + ": no backdrop-filter, no filter"));
ok(g3.kids === pl.kids, "g3: the same number of layers as a plain card (" + g3.kids + " vs " + pl.kids + ")");

// the words >= 4.5:1 on the pixels actually drawn (the words' own pixels left out)
async function worst(id) {
  const c = info[id], [x, y, w, h] = c.rect;
  const png = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) } });
  return page.evaluate(async ({ b64, ink }) => {
    const img = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "image/png" }));
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data, m = /(\d+)[, ]+(\d+)[, ]+(\d+)/.exec(ink), I = [+m[1], +m[2], +m[3]];
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b), li = L(I[0], I[1], I[2]);
    const W = cv.width, H = cv.height, px = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) px[i] = L(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    // the words: pixels on the ink's side of the middle between the ink and the card's median, plus 3 px around them
    // (the glyphs' soft edges); what is left is the card behind them
    const med = Array.from(px).sort((a, b) => a - b)[Math.floor(px.length / 2)], mid = (li + med) / 2;
    const word = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) word[i] = (li > med ? px[i] > mid : px[i] < mid) ? 1 : 0;
    const far = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let near = 0;
      for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && word[yy * W + xx]) { near = 1; break; } }
      if (!near) far.push(px[y * W + x]);
    }
    far.sort((a, b) => a - b);
    const worstL = li > 0.4 ? far[Math.floor(far.length * 0.9)] : far[Math.floor(far.length * 0.1)];
    return { n: far.length, ratio: (Math.max(li, worstL) + 0.05) / (Math.min(li, worstL) + 0.05) };
  }, { b64: png.toString("base64"), ink: c.ink });
}
for (const id of ["g3", "lk", "rd", "o3", "op", "pa"]) {
  const r = await worst(id);
  ok(r.n > 1000 && r.ratio >= 4.5, id + ": words " + info[id].ink + " read " + r.ratio.toFixed(2) + ":1 on the drawn card (" + r.n + " px)");
}
ok(!errors.length, "no page errors: " + errors.join(" | "));
console.log("All " + n + " card gradient browser tests passed.");
await browser.close();
server.closeAllConnections(); server.close();
