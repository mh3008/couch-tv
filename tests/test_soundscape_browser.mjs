// Soundscape+ in a real browser (Chromium): the real Web Audio and the real home.
//  1. The engine on a real AudioContext: every mix plays, then stops, with no page error.
//  2. Every mix rendered on an OfflineAudioContext: it makes sound, never clips at full volume, the fire really crackles, the storm
//     has its thunder, and what it costs (nodes made a second, how many times faster than real time it renders) stays under a budget.
//  3. The cards in the real home: idle = nothing moving; OK plays THAT card's mix; the card moves (computed animation, a column
//     really changes place), glows, shows the volume; another card taking over turns it off; still on the Lighter home and with
//     reduced motion; "Match the weather" follows the home's own weather and stays under its low ceiling.
// Needs Playwright (Chromium). Without it the test says so and passes:
//   COUCHTV_PLAYWRIGHT=<a folder whose node_modules has playwright> node tests/test_soundscape_browser.mjs
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

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port + "/tv-home/web/index.html";
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log("  ok  " + m); };
const rect = (c, r, w, h) => ({ x: 80 + c * 100, y: 60 + r * 100, w: w * 100 - 40, h: h * 100 - 40 });
const soundJs = fs.readFileSync(path.join(ROOT, "tv-home/web/soundscape.js"), "utf8");

console.log("Running Soundscape+ browser tests...");
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

// ---------------- 1. the real AudioContext ----------------
{
  const page = await browser.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.setContent("<html><body></body></html>");
  await page.evaluate(soundJs);
  const res = await page.evaluate(async () => {
    const S = window.Soundscape, out = {};
    S.setWeatherSource(() => 95);
    for (const t of S.TYPES.filter((x) => x !== "off")) {
      S.play(t, 0.2);
      await new Promise((r) => setTimeout(r, 700));
      out[t] = { cur: S.current(), mix: S.state().mix };
      S.stop();
    }
    return out;
  });
  const bad = Object.entries(res).filter(([t, v]) => v.cur !== t);
  ok(bad.length === 0 && Object.keys(res).length === 8, "real AudioContext: all 8 mixes play and stop (" + Object.keys(res).join(",") + ")");
  ok(res.match.mix === "storm", "real AudioContext: match with a thunderstorm outside plays the storm");
  ok(errs.length === 0, "real AudioContext: no page errors (" + errs.join("; ") + ")");
  await page.close();
}

// ---------------- 2. the audio itself, rendered offline ----------------
{
  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>");
  await page.evaluate(soundJs);
  const SECS = 90;
  const out = await page.evaluate(async (SECS) => {
    const res = {};
    window.Soundscape.setWeatherSource(() => 63);
    for (const type of window.Soundscape.TYPES.filter((t) => t !== "off")) {
      const rate = 22050, ac = new OfflineAudioContext(2, rate * SECS, rate);
      let nodes = 0;
      ["createGain", "createBiquadFilter", "createBufferSource", "createOscillator"].forEach((m) => { const o = ac[m].bind(ac); ac[m] = function () { nodes++; return o.apply(null, arguments); }; });
      const master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
      const t0 = performance.now();
      window.Soundscape._build(ac, master, type, SECS);
      const t1 = performance.now();
      const buf = await ac.startRendering();
      const t2 = performance.now();
      const d = buf.getChannelData(0);
      let peak = 0, sq = 0, big = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sq += d[i] * d[i]; }
      const rms = Math.sqrt(sq / d.length);
      for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > rms * 4) big++;
      // impulses: how many 20 ms windows peak at more than 2.5x the typical window (a crackle or a pop is a spike on the bed)
      const win = Math.round(rate * 0.02), peaks = [];
      for (let i = 0; i + win <= d.length; i += win) { let m = 0; for (let k = i; k < i + win; k++) { const a = Math.abs(d[k]); if (a > m) m = a; } peaks.push(m); }
      const med = peaks.slice().sort((x, y) => x - y)[Math.floor(peaks.length / 2)], impulses = peaks.filter((x) => x > med * 2.5).length, srt = peaks.slice().sort((x, y) => x - y), spiky = srt[Math.floor(srt.length * 0.99)] / med;
      const per = [];
      for (let s = 0; s < SECS; s++) { let q = 0; for (let i = s * rate; i < (s + 1) * rate; i++) q += d[i] * d[i]; per.push(Math.sqrt(q / rate)); }
      res[type] = { peak, rms, crest: peak / rms, impulses, spiky, nodesPerSec: (nodes - 1) / SECS, buildMs: t1 - t0, renderMs: t2 - t1, xRealtime: SECS * 1000 / (t2 - t0), per };
    }
    return res;
  }, SECS);
  const rows = Object.entries(out).map(([t, v]) => t.padEnd(9) + " peak " + v.peak.toFixed(2) + "  rms " + v.rms.toFixed(3) + "  nodes/s " + v.nodesPerSec.toFixed(1) + "  " + Math.round(v.xRealtime) + "x real time");
  console.log("      " + rows.join("\n      "));
  Object.entries(out).forEach(([t, v]) => {
    ok(v.rms > 0.01, t + ": it makes sound (rms " + v.rms.toFixed(3) + ")");
    ok(v.peak < 0.95, t + ": never clips at full volume (peak " + v.peak.toFixed(2) + ")");
    ok(v.xRealtime >= 25, t + ": renders at least 25x faster than real time on this PC (" + Math.round(v.xRealtime) + "x): a budget for the stick bench");
  });
  ok(out.fire.nodesPerSec <= 5 && out.rainfire.nodesPerSec <= 5 && out.window.nodesPerSec <= 4 && out.storm.nodesPerSec <= 1, "event budget: fire " + out.fire.nodesPerSec.toFixed(1) + ", rain + fire " + out.rainfire.nodesPerSec.toFixed(1) + ", window " + out.window.nodesPerSec.toFixed(1) + ", storm " + out.storm.nodesPerSec.toFixed(1) + " nodes a second (limits 5, 5, 4, 1)");
  ok(out.rain.nodesPerSec < 0.5 && out.brown.nodesPerSec < 0.5, "the old sounds stay as light as they were (no events)");
  console.log("      spikes (>2.5x median), loudest 1% window / median:", Object.entries(out).map(([t, v]) => t + " " + v.impulses + " / " + v.spiky.toFixed(1)).join(", "));
  ok(out.fire.impulses >= 10 && out.fire.spiky > 2 && out.rainfire.spiky > out.rain.spiky + 0.2 && out.rain.impulses <= 2 && out.brown.impulses <= 2, "fire really crackles: " + out.fire.impulses + " spikes on the bed in " + SECS + " s (rain " + out.rain.impulses + ", brown " + out.brown.impulses + ")");
  const per = out.storm.per, base = per.slice().sort((a, b) => a - b)[Math.floor(per.length * 0.3)];
  const loud = per.map((v, i) => (v > base * 1.4 ? i : -1)).filter((i) => i >= 0);
  ok(loud.length >= 3 && loud[0] <= 24, "storm: thunder is audible as a swell over the rain (first at " + loud[0] + " s; " + loud.length + " loud seconds in " + SECS + ")");
  ok(Math.max(...per) < base * 4, "storm: but it is distant, not a bang (loudest second " + (Math.max(...per) / base).toFixed(1) + "x the rain)");
  await page.close();
}

// ---------------- 3. the cards in the real home ----------------
async function home(widgets, q) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  const design = { v: 1, background: { colour: "#26303f" }, objects: widgets.map((x, i) => { const R = rect(x[1], x[2], x[3], x[4]); return Object.assign({ id: "w" + i, type: "widget", kind: x[0], x: R.x, y: R.y, w: R.w, h: R.h }, x[5] ? { opts: x[5] } : {}); }) };
  await page.goto(BASE + "?mock=1&reset=1");
  await page.evaluate((d) => { localStorage.clear(); localStorage.setItem("tvdesigner.design", JSON.stringify(d)); }, design);
  await page.goto(BASE + "?mock=1&design=local" + (q || ""));
  await page.waitForFunction(() => document.querySelector(".cw-o .cw") && window.Soundscape);
  await page.waitForTimeout(500);
  return page;
}
const press = async (page, k, wait) => { await page.keyboard.press(k); await page.waitForTimeout(wait || 300); };
const card = (id) => '.cw-o[data-obj="' + id + '"] .cw';
const anim = (page, id, sel) => page.evaluate(([c, s]) => { const e = document.querySelector(c + " " + s); return e ? getComputedStyle(e).animationName : "missing"; }, [card(id), sel]);
const tx = (page, id, sel) => page.evaluate(([c, s]) => { const e = document.querySelector(c + " " + s); return e ? getComputedStyle(e).transform : "missing"; }, [card(id), sel]);
const isOn = (page, id) => page.evaluate((c) => document.querySelector(c).classList.contains("cw-snd-on"), card(id));
const toCard = async (page, id) => {
  for (let i = 0; i < 24; i++) {
    const d = await page.evaluate((id) => {
      const cur = window.CouchDesign.nav.current(); if (cur && cur.id === id) return null;
      const c = document.querySelector('.cw-o[data-obj="' + id + '"] .cw').getBoundingClientRect(), a = cur ? document.querySelector('.cw-o[data-obj="' + cur.id + '"] > *, .cw-o[data-obj="' + cur.id + '"]').getBoundingClientRect() : { left: 9999, top: 0, width: 0, height: 0 };
      const dx = (c.left + c.width / 2) - (a.left + a.width / 2), dy = (c.top + c.height / 2) - (a.top + a.height / 2);
      return Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
    }, id);
    if (d === null) return true;
    await page.evaluate((d) => window.CouchDesign.nav.move(d[0], d[1]), d);
    await page.waitForTimeout(80);
  }
  return false;
};

{
  const widgets = [["soundscape", 0, 0, 4, 2, { sound: "rain" }], ["soundscape", 0, 2, 2, 2, { sound: "fire" }], ["soundscape", 2, 2, 2, 2, { sound: "storm" }], ["soundscape", 0, 4, 4, 2, { sound: "window", fade: 30 }],
    ["soundscape", 4, 0, 4, 2, { sound: "match" }], ["soundscape", 4, 2, 4, 2, { sound: "rainfire" }], ["app", 10, 0, 2, 2, { apps: ["com.netflix.ninja"] }]];
  const page = await home(widgets, "&wx=15,63");
  // idle: nothing moves
  const idle = [];
  for (const id of ["w0", "w1", "w2", "w3", "w4", "w5"]) idle.push(await anim(page, id, ".cw-snd-glow"), await page.evaluate((c) => getComputedStyle(document.querySelector(c + " .cw-snd-fx")).opacity, card(id)));
  ok(idle.filter((v) => v === "none").length === 6 && idle.filter((v) => v === "0").length === 6, "idle: no animation is running and the effects layer is invisible on all six cards");
  ok(await page.evaluate(() => window.Soundscape.current() === "off"), "idle: nothing plays by itself");

  // OK on the rain card
  ok(await toCard(page, "w0"), "the remote reaches the rain card");
  await press(page, "Enter", 900);
  ok(await page.evaluate(() => window.Soundscape.current()) === "rain", "OK plays the rain card's own mix");
  ok(await isOn(page, "w0"), "the card turns on");
  ok((await anim(page, "w0", ".cw-snd-glow")) === "cw-snd-glow" && (await anim(page, "w0", ".cw-snd-col")) === "cw-snd-fall", "playing: the glow breathes and the drops fall (computed animation names)");
  const t1 = await tx(page, "w0", ".cw-snd-col"); await page.waitForTimeout(260); const t2 = await tx(page, "w0", ".cw-snd-col");
  ok(t1 !== t2 && /matrix/.test(t1), "playing: a drop has really moved in 260 ms (" + t1.slice(0, 40) + " -> " + t2.slice(0, 40) + ")");
  ok(await page.evaluate((c) => getComputedStyle(document.querySelector(c + " .cw-snd-vol")).opacity === "1", card("w0")), "playing: the volume bar shows");
  ok(/Playing/.test(await page.evaluate((c) => document.querySelector(c).textContent, card("w0"))), "playing: the card says Playing");
  const w = await page.evaluate((c) => document.querySelector(c + " .cw-snd-volw").style.width, card("w0"));
  ok(w === "50%", "playing: the bar is at the volume (" + w + ")");
  // another card takes over
  ok(await toCard(page, "w1"), "the remote reaches the fire card");
  await press(page, "Enter", 900);
  ok(await page.evaluate(() => window.Soundscape.current()) === "fire" && !(await isOn(page, "w0")) && (await isOn(page, "w1")), "pressing the fire card plays Fire and turns the rain card off");
  ok((await anim(page, "w1", ".cw-snd-flick")) === "cw-snd-flick" && (await anim(page, "w1", ".cw-snd-em")) === "cw-snd-ember", "fire card: the flame flickers and the embers rise");
  ok(await page.evaluate((c) => { const p = document.querySelector(c + " .cw-snd-ic svg path"); return !!p && /^M12 2\.75/.test(p.getAttribute("d") || ""); }, card("w1")), "fire card: the icon is the flame (not the lightning bolt)");
  // OK again stops it
  await press(page, "Enter", 700);
  ok(await page.evaluate(() => window.Soundscape.current()) === "off" && !(await isOn(page, "w1")), "OK again stops it, and the card goes quiet");
  ok((await anim(page, "w1", ".cw-snd-flick")) === "none", "a stopped card runs no animation");
  // the card with its own fade out
  ok(await toCard(page, "w3"), "the remote reaches the window-rain card");
  await press(page, "Enter", 900);
  const st = await page.evaluate(() => window.Soundscape.state());
  ok(st.type === "window" && st.fadeSecs === 1800, "a card with fade 30 starts its sound fading out over 30 minutes (" + st.fadeSecs + " s)");
  ok((await anim(page, "w3", ".cw-snd-volf")) === "cw-snd-fadevol" && /Fading out/.test(await page.evaluate((c) => document.querySelector(c).textContent, card("w3"))), "and shows it: the bar empties by one slow CSS animation, the card says Fading out");
  await press(page, "Enter", 500);
  // storm
  ok(await toCard(page, "w2"), "the remote reaches the storm card");
  await press(page, "Enter", 900);
  ok((await anim(page, "w2", ".cw-snd-flash")) === "cw-snd-flash" && (await page.evaluate(() => window.Soundscape.current())) === "storm", "storm card: plays the storm and flashes");
  await press(page, "Enter", 500);
  // match the weather: the home's weather (mock: code 63, moderate rain)
  ok(await toCard(page, "w4"), "the remote reaches the match card");
  await press(page, "Enter", 900);
  const ms = await page.evaluate(() => window.Soundscape.state());
  ok(ms.type === "match" && ms.mix === "rain", "match: the home's weather is rain (code 63), so it plays rain (" + ms.mix + ")");
  ok(ms.effective <= 0.3 + 1e-9 && ms.vol === 0.5, "match: volume 50% is held to the low ceiling: " + Math.round(ms.effective * 100) + "%");
  ok(/Rain now/.test(await page.evaluate((c) => document.querySelector(c).textContent, card("w4"))), "match: the card says Rain now");
  await press(page, "Enter", 500);
  // reduced motion, Lighter home
  ok(await toCard(page, "w5"), "the remote reaches the rain + fire card");
  await press(page, "Enter", 900);
  ok((await anim(page, "w5", ".cw-snd-col")) === "cw-snd-fall", "rain + fire: drops fall");
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.waitForTimeout(200);
  ok((await anim(page, "w5", ".cw-snd-col")) === "none" && (await anim(page, "w5", ".cw-snd-flick")) === "none", "reduced motion: everything stands still");
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForTimeout(200);
  await page.evaluate(() => document.documentElement.classList.add("lighter")); await page.waitForTimeout(200);
  ok((await anim(page, "w5", ".cw-snd-col")) === "none" && (await anim(page, "w5", ".cw-snd-ember, .cw-snd-em")) === "none", "the Lighter home: still too");
  await page.evaluate(() => document.documentElement.classList.remove("lighter"));
  // leaving the home stops the sound (the home's own rule) and the card follows
  await press(page, "Enter", 500);
  ok(page.errors.length === 0, "no page errors (" + page.errors.join("; ") + ")");
  await page.close();
}

// the real home's weather decides: a storm outside, then a dry day
for (const [q, want] of [["&wx=12,96", "storm"], ["&wx=22,0", "brown"], ["&wx=9,61", "window"]]) {
  const page = await home([["soundscape", 0, 0, 4, 2, { sound: "match" }], ["app", 10, 0, 2, 2, { apps: ["com.netflix.ninja"] }]], q);
  await toCard(page, "w0");
  await press(page, "Enter", 900);
  const s = await page.evaluate(() => window.Soundscape.state());
  ok(s.type === "match" && s.mix === want, "match with " + q.slice(1) + ": plays " + want + " (got " + s.mix + ")");
  await page.close();
}

// ---------------- 4. Home settings: the fade out and the weather ceiling ----------------
{
  const page = await home([["clock", 0, 0, 6, 2], ["soundscape", 0, 2, 4, 2, { sound: "rain" }]], "");
  await page.evaluate(() => window.CouchDesign.nav.focus("w0"));
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(250);
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.getElementById("settings").classList.contains("on")), "Home settings opens");
  for (let i = 0; i < 20; i++) { const t = await page.evaluate(() => document.getElementById("settings").innerText); if (/Soundscape volume/.test(t)) break; await page.keyboard.press("ArrowDown"); await page.waitForTimeout(120); }
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150);
  const rows = () => page.evaluate(() => Array.from(document.querySelectorAll("#settings .srow")));
  const focused = () => page.evaluate(() => Array.from(document.querySelectorAll("#settings .srow.focus")).map((r) => r.textContent).join("|"));
  let hit = false;
  for (let i = 0; i < 60 && !hit; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(110); hit = /Fade out after/.test(await focused()); }
  ok(hit, "Home settings has a Fade out after row in the Soundscape section");
  const val = () => page.evaluate(() => { const r = Array.from(document.querySelectorAll("#settings .srow")).filter((x) => /Fade out after/.test(x.textContent)).pop(); return r ? r.textContent.replace("Fade out after", "") : null; });
  ok((await val()) === "Off", "the fade out starts Off");
  await press(page, "Enter", 300); ok((await val()) === "30 min", "OK: 30 min");
  await press(page, "Enter", 300); ok((await val()) === "60 min", "OK again: 60 min");
  await press(page, "Enter", 300); ok((await val()) === "Off", "and back to Off");
  await press(page, "ArrowDown", 200);
  ok(/Match the weather: loudest/.test(await focused()), "the next row is the Match the weather ceiling");
  ok(await page.evaluate(() => window.Soundscape.state().ceiling) === 0.3, "the ceiling is 30% by default");
  await press(page, "Enter", 300);
  ok(await page.evaluate(() => window.Soundscape.state().ceiling) === 0.5, "OK raises it to 50% and the engine has it at once");
  ok(page.errors.length === 0, "no page errors (" + page.errors.join("; ") + ")");
  await page.close();
}

await browser.close();
server.close();
console.log("\nSoundscape+ browser: " + n + " checks passed");
