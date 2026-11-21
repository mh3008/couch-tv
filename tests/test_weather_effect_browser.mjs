// A design's rain and snow (design.home.weather_effect, weather_amount) in a real browser at 1920x1080,
// the home as a TV draws it, mock.js standing in for the bridge (its weather is a clear sky):
//  1. "snow" snows on a clear day, "rain" rains; "off" and no setting draw nothing;
//  2. heavy draws more than light;
//  3. an app opening (tv.pause) stops the drawing, the home coming back starts it again;
//  4. the TV asking for less motion (reduced motion) and Lighter home draw nothing;
//  5. the cost at 4x slower CPU: frames a second and main thread time, off vs light, medium, heavy.
// Shots go to $SHOTS (default: the system temp folder, couchtv-weather-effect).
// Needs Playwright. Without it it says so and passes:
//   COUCHTV_PLAYWRIGHT=<a folder whose node_modules has playwright> node tests/test_weather_effect_browser.mjs
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium;
try { chromium = createRequire(path.join(process.env.COUCHTV_PLAYWRIGHT || process.cwd(), "package.json"))("playwright").chromium; }
catch (e) { console.log("SKIP: Playwright is not installed (set COUCHTV_PLAYWRIGHT to a folder that has it)"); process.exit(0); }

const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), "couchtv-weather-effect");
fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;
const BASE = ORIGIN + "/tv-home/web/index.html";
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log("  ok", m); };
const browser = await chromium.launch();

const design = (home) => ({ v: 1, background: { image: "backgrounds/loop-ocean.jpg", darken: 0 }, home });
async function load(d, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: opts.calm ? "reduce" : "no-preference" });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  if (opts.cdp) await opts.cdp(page);
  await page.goto(BASE + "?mock=1&reset=1");
  await page.evaluate((x) => { localStorage.clear(); localStorage.setItem("tvdesigner.design", JSON.stringify(x)); }, d);
  await page.goto(BASE + "?mock=1&design=local");
  await page.waitForFunction(() => document.documentElement.classList.contains("cd"));
  await page.waitForTimeout(1500);
  return page;
}
// the weather canvas: how many pixels are drawn on it right now, and what the engine says it is doing
const state = (page) => page.evaluate(() => {
  const c = document.getElementById("weather-canvas"), A = window.AmbientWeather;
  let lit = 0;
  if (c && c.width) { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i]) lit++; }
  return { lit, type: A ? A.getType() : null, amount: A && A.getAmount ? A.getAmount() : null };
});
// the most pixels lit over a second (one frame can be caught just after a clear)
const most = async (page) => { let m = 0; for (let i = 0; i < 6; i++) { m = Math.max(m, (await state(page)).lit); await page.waitForTimeout(170); } return m; };

console.log("Running weather effect browser tests...");

{ // 1. fixed snow and rain on a clear day; off and nothing set draw nothing
  const snow = await load(design({ weather_effect: "snow" }));
  const s = await state(snow);
  ok(s.type === "snow", "weather_effect snow: the engine snows on mock.js's clear day (" + s.type + ")");
  ok(await most(snow) > 0, "and snowflakes are drawn on the canvas");
  await snow.screenshot({ path: path.join(SHOTS, "snow-medium.png") });
  ok(!snow.errors.length, "no page errors: " + snow.errors.join(" | "));
  await snow.close();
  const rain = await load(design({ weather_effect: "rain", weather_amount: "heavy" }));
  ok((await state(rain)).type === "rain" && await most(rain) > 0, "weather_effect rain: rain is drawn");
  await rain.screenshot({ path: path.join(SHOTS, "rain-heavy.png") });
  await rain.close();
  for (const h of [{ weather_effect: "off" }, {}, { weather_effect: "off", ambient_weather: true }]) {
    const p = await load(design(h));
    ok(await most(p) === 0, "nothing drawn with " + JSON.stringify(h));
    await p.close();
  }
}

{ // 2. heavy draws more than light
  const light = await load(design({ weather_effect: "snow", weather_amount: "light" }));
  const heavy = await load(design({ weather_effect: "snow", weather_amount: "heavy" }));
  ok((await state(light)).amount === "light" && (await state(heavy)).amount === "heavy", "the amount reaches the engine");
  const l = await most(light), h = await most(heavy);
  ok(h > l * 2, "heavy snow lights more of the canvas than light (" + l + " to " + h + " sampled pixels)");
  await light.close(); await heavy.close();
}

{ // 3. an app in front stops it; back on the home it draws again
  const page = await load(design({ weather_effect: "rain" }));
  ok(await most(page) > 0, "raining on the home");
  await page.evaluate(() => window.tv.pause());
  await page.waitForTimeout(400);
  const a = (await state(page)).lit; await page.waitForTimeout(600); const b = (await state(page)).lit;
  ok(a === b, "an app opened (tv.pause): the canvas stops changing (" + a + ", " + b + ")");
  await page.evaluate(() => window.tv.resume());
  ok(await most(page) > 0, "back on the home: rain again");
  await page.close();
}

{ // 4. less motion and Lighter home draw nothing, even a fixed rain
  const calm = await load(design({ weather_effect: "rain", weather_amount: "heavy" }), { calm: true });
  ok(await most(calm) === 0, "the TV asks for reduced motion: no rain");
  await calm.close();
  const lighter = await load(design({ weather_effect: "rain", lighter: true }));
  ok(await most(lighter) === 0, "Lighter home: no rain");
  await lighter.close();
}

{ // 5. the cost at 4x slower CPU (the throttle Chrome's own tools use for a slow phone)
  const throttle = async (page) => { const c = await page.context().newCDPSession(page); await c.send("Emulation.setCPUThrottlingRate", { rate: 4 }); page.cdp = c; };
  const measure = async (h) => {
    const page = await load(design(h), { cdp: throttle });
    await page.waitForTimeout(2500);
    await page.cdp.send("Performance.enable");
    const m0 = Object.fromEntries((await page.cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    const fps = await page.evaluate(() => new Promise((r) => { let f = 0; const t0 = performance.now(); const tick = () => { f++; if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else r(f / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }));
    const m1 = Object.fromEntries((await page.cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    await page.close();
    return { fps: Math.round(fps * 10) / 10, busy: Math.round((m1.TaskDuration - m0.TaskDuration) / (m1.Timestamp - m0.Timestamp) * 1000) / 10 };
  };
  const off = await measure({ weather_effect: "off" });
  const res = { off };
  for (const fx of ["rain", "snow"]) for (const amt of ["light", "medium", "heavy"]) res[fx + "-" + amt] = await measure({ weather_effect: fx, weather_amount: amt });
  console.log("  cost at 4x slower CPU (frames a second, main thread busy %):", JSON.stringify(res));
  ok(res["rain-heavy"].fps >= 50 && res["snow-heavy"].fps >= 50, "heavy rain and snow: the page still draws " + res["rain-heavy"].fps + " / " + res["snow-heavy"].fps + " frames a second (off: " + off.fps + ")");
  ok(res["rain-heavy"].busy - off.busy < 15, "heavy rain adds " + (res["rain-heavy"].busy - off.busy).toFixed(1) + " points of main thread time (" + off.busy + "% to " + res["rain-heavy"].busy + "%)");
}

await browser.close();
server.close();
console.log("weather effect browser tests passed (" + n + " checks). Shots: " + SHOTS);
