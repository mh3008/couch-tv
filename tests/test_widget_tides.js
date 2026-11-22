// The Tides widget (feat/tides): app.js asks Open-Meteo's marine service for the hourly sea level only while a tides
// widget is on the home; widgets.js finds the turns of the tide on it (placed between the hours with a parabola) and
// draws the next high + low, a 24 hour curve with a dot for the time it is, and the swell. No live calls.
// Run: node tests/test_widget_tides.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Tides");
const NOW = new Date(2026, 10, 22, 9, 0).getTime();   // 9am on the TV's clock
const T = K.home(NOW);
const W = T.W;
console.log("Running Tides tests...");

// ---------------- 1. the turns of the tide ----------------
// a sea of 0.1 + 0.6 cos(...) with a 12 h 25 min period, high at 14:40 today: hourly values from midnight
const H = 3600000, t0 = new Date(2026, 10, 22, 0, 0).getTime(), hiAt = new Date(2026, 10, 22, 14, 40).getTime(), P = 12.42 * H;
const level = []; for (let k = 0; k < 48; k++) level.push(+(0.1 + 0.6 * Math.cos(2 * Math.PI * (t0 + k * H - hiAt) / P)).toFixed(2));
const turns = W.kit.tideTurns(t0, level);
const highs = turns.filter((x) => x.high), lows = turns.filter((x) => !x.high);
ok(highs.length >= 3 && lows.length >= 3, "a 48 h sea: 3+ highs and 3+ lows (" + highs.length + " / " + lows.length + ")");
const near = highs.reduce((b, x) => (Math.abs(x.t - hiAt) < Math.abs(b.t - hiAt) ? x : b));
ok(Math.abs(near.t - hiAt) < 12 * 60000, "the high is placed between the hours: within 12 minutes of 14:40 (" + new Date(near.t).toTimeString().slice(0, 5) + ")");
ok(Math.abs(near.v - 0.7) < 0.05, "and its height is about 0.7 m (" + near.v.toFixed(2) + ")");
ok(turns.every((x, i) => !i || x.high !== turns[i - 1].high), "highs and lows take turns");
ok(W.kit.tideTurns(t0, [0.1, NaN, 0.3, 0.2]).length === 0 && W.kit.tideTurns(t0, []).length === 0, "gaps and short readings: no made-up turn");

// ---------------- 2. drawing it ----------------
const env = (tides) => ({ data: { weather: tides === undefined ? { temp: 20, code: 1 } : Object.assign({ temp: 20, code: 1 }, { tides }), place: { name: "Bondi" } } });
const real = { t0, level, swell: { h: 1.4, period: 11, dir: 135 } };
K.sizes(T.C, "tides").forEach(([id, w, h]) => {
  const el = W.render({ kind: "tides", w, h }, env(real));
  ok(!el.getAttribute("data-empty") && /2:\d\dpm/.test(el.textContent), "tides " + id + ": the real next high (" + el.textContent.slice(0, 80) + ")");
  ok(!/The point/.test(el.textContent), "tides " + id + ": no sample place on a real TV");
});
const big = W.render({ kind: "tides", w: 360, h: 360 }, env(real));
ok(/High/.test(big.textContent) && /Low/.test(big.textContent) && /1\.4 m SE swell, 11 s/.test(big.textContent), "a 4x4: high, low and the swell");
ok(/rising/.test(big.textContent), "9am before a 2:40pm high: rising");
const wait = W.render({ kind: "tides", w: 360, h: 360 }, env(null));
ok(/Waiting for the tides/.test(wait.textContent), "no reading yet: an honest wait");
const inland = W.render({ kind: "tides", w: 360, h: 360 }, env({ t0, level: level.map(() => 0.2), swell: {} }));
ok(/No tide reading here/.test(inland.textContent), "a flat sea (inland): says so");
const demo = W.render({ kind: "tides", w: 360, h: 360 }, { demo: true, designer: true, data: {} });
ok(/High/.test(demo.textContent) && /The point/.test(demo.textContent), "the designer shows a sample sea");

// ---------------- 3. design.js keeps it, app.js asks only for it ----------------
const CD = K.design();
ok(K.kept(CD, "tides", { label: "Bondi" }).label === "Bondi", "design.js: tides keeps its label");
const app = fs.readFileSync(path.join(__dirname, "../tv-home/web/app.js"), "utf8");
ok(/wantsKinds\(\["air", "surf", "tides"\]\)/.test(app), "app.js: the marine sea level is asked only while a tides widget is on the home");
ok(/sea_level_height_msl/.test(app) && /past_days=1&forecast_days=2/.test(app), "app.js: yesterday to the day after tomorrow, hourly");
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const block = css.slice(css.indexOf("/* Tides"));
ok(!/(width|height|left|top|background-position)\s*:[^;]*;[^}]*}\s*$/m.test(block.split("@")[1] || "") && /cw-tide-pulse[^}]*\{[^}]*transform/.test(block), "widgets.css: the tide moves by transform + opacity only");
ok(/html\.lighter \.cw-tide-dot/.test(block) && /prefers-reduced-motion/.test(block), "still on the Lighter home and with reduced motion");
done();
