// Live weather icon (feat/weather-icon-live): a weather card with opts.live draws the sky now in parts that move (rays turn,
// clouds drift, drops and flakes fall, the bolt flickers, stars twinkle), transform + opacity only; without it, the design's
// own icon as before. Still on the Lighter home, the Loop look, with reduced motion and while the home is covered.
// Run: node tests/test_widget_live_weather.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Live weather icon");
const T = K.home(new Date(2026, 10, 22, 11, 0, 0).getTime());
const W = T.W;
const WN = K.home(new Date(2026, 10, 22, 23, 0, 0).getTime()).W;   // 11pm: the card reads night from the clock
console.log("Running Live weather icon tests...");
const all = (el, out) => { out = out || []; out.push(el); (el.childNodes || []).forEach((c) => all(c, out)); return out; };
const cls = (n) => (n.attrs && n.attrs["class"]) || n.className || "";
const has = (n, c) => (" " + cls(n) + " ").indexOf(" " + c + " ") >= 0;
const parts = (el, c) => all(el).filter((n) => has(n, c)).length;
const live = (el) => all(el).filter((n) => has(n, "cw-wi"));
const env = (code, day) => ({ data: { weather: { temp: 21, code, is_day: day === false ? 0 : 1, hi: 24, lo: 15 }, place: { name: "Riverside" } } });
// hourly and week need a forecast: the demo has one (its sky now: partly cloudy)
const draw = (kind, code, opts, w, h, day) => (day === false ? WN : W).render({ kind, w: w || 400, h: h || 360, opts }, /hourly|week/.test(kind) ? { demo: true } : env(code, day));

// on / off
ok(live(draw("weather", 0, {})).length === 0, "off by default: the design's own icon");
ok(live(draw("weather", 0, { live: false })).length === 0, "live: false is off");
ok(live(draw("weather", 0, { live: true })).length === 1, "live: one live icon in the card");
// each sky gets its moving parts
const sun = draw("weather", 0, { live: true });
ok(/cw-wi--sun/.test(cls(live(sun)[0])) && parts(sun, "cw-wi-rays") === 1 && parts(sun, "cw-wi-core") === 1, "clear: the sun, its rays turn");
const night = draw("weather", 0, { live: true }, 400, 360, false);
ok(/cw-wi--clear-night/.test(cls(live(night)[0])) && parts(night, "cw-wi-star") === 3 && parts(night, "cw-wi-rays") === 0, "clear at night: the moon and three twinkling stars, never the sun");
const pc = draw("weather", 2, { live: true });
ok(parts(pc, "cw-wi-rays") === 1 && parts(pc, "cw-wi-drift") === 1, "partly cloudy: the sun behind a drifting cloud");
const pcn = draw("weather", 2, { live: true }, 400, 360, false);
ok(/partly-cloudy-night/.test(cls(live(pcn)[0])) && parts(pcn, "cw-wi-rays") === 0, "partly cloudy at night: the moon, no sun");
const cloud = draw("weather", 3, { live: true });
ok(parts(cloud, "cw-wi-drift") === 2 && parts(cloud, "cw-wi-back") === 1, "cloudy: two clouds drifting against each other");
const rain = draw("weather", 63, { live: true });
ok(parts(rain, "cw-wi-drop") === 3, "rain: three falling drops");
ok(parts(draw("weather", 80, { live: true }), "cw-wi-drop") === 3 && parts(draw("weather", 51, { live: true }), "cw-wi-drop") === 3, "showers and drizzle: drops too");
ok(parts(draw("weather", 73, { live: true }), "cw-wi-flake") === 5, "snow: five flakes");
const storm = draw("weather", 95, { live: true });
ok(parts(storm, "cw-wi-bolt") === 1 && parts(storm, "cw-wi-drop") === 2, "storms: a flickering bolt and drops");
ok(parts(draw("weather", 45, { live: true }), "cw-wi-fog") === 3, "fog: three drifting bands");
// the drops are out of step (negative delays), so they never fall together
const delays = all(rain).filter((n) => /cw-wi-drop/.test(cls(n))).map((n) => (n.attrs.style || "").replace(/.*animation-delay:(-?[\d.]+)s.*/, "$1"));
ok(new Set(delays).size === 3, "the drops fall out of step (" + delays.join(", ") + ")");
// every weather card that shows the sky now
[["weather", 400, 150], ["weather", 400, 360], ["weather", 300, 300], ["bigtemp", 400, 360], ["bigtemp", 400, 150], ["hourly", 800, 360], ["week", 400, 560]].forEach(([k, w, h]) => {
  ok(live(draw(k, 63, { live: true }, w, h)).length === 1, k + " " + w + "x" + h + ": the live icon");
  ok(live(draw(k, 63, {}, w, h)).length === 0, k + " " + w + "x" + h + ": off without the option");
});
ok(live(W.render({ kind: "weather", w: 400, h: 150, compact: true, opts: { live: true } }, env(63))).length <= 1, "the compact layout draws at most one");
// the hourly row's own icons stay still (one live icon: the sky now)
ok(live(draw("hourly", 0, { live: true }, 800, 360)).length === 1, "hourly: only the sky now is live, not the row");
// design.js keeps the option for the four weather cards, as true / false only
const CD = K.design();
["weather", "bigtemp", "hourly", "week"].forEach((k) => ok(K.kept(CD, k, { live: true }).live === true, k + ": design.js keeps live"));
ok(K.kept(CD, "weather", { live: "yes" }).live === undefined || K.kept(CD, "weather", { live: "yes" }).live === true, "live: a yes/no");
ok(K.kept(CD, "rain", { live: true }).live === undefined, "not on cards without the sky icon");
// CSS: transform + opacity only, loops divide 8 s, still on Lighter / Loop / reduced motion / covered
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const block = css.slice(css.indexOf("/* Live weather icon"));
const frames = block.match(/@keyframes cw-wi-[\w-]+ \{[^@]*/g) || [];
ok(frames.length === 8, "eight keyframe sets (" + frames.length + ")");
ok(frames.every((f) => !/(left|top|width|height|margin|filter|fill|stroke|r|cx|cy)\s*:/.test(f.replace(/transform|opacity/g, ""))), "keyframes move transform and opacity only");
const durs = (block.match(/animation: cw-wi-[\w-]+ ([\d.]+)s/g) || []).map((a) => +a.replace(/.* ([\d.]+)s/, "$1"));
ok(durs.length >= 8 && durs.every((d) => 8 % d === 0), "every loop divides 8 s (" + durs.join(", ") + ")");
ok(/html\.lighter \.cw-wi \*/.test(block) && /html\.theme-loop \.cw-wi \*/.test(block) && /prefers-reduced-motion[^}]*\.cw-wi/.test(block), "still on the Lighter home, the Loop look and with reduced motion");
ok(/html\.cw-still \[class\*="cw-"\][^{]*\{[^}]*animation-play-state: paused/.test(css), "paused while the home is covered (html.cw-still)");
const app = fs.readFileSync(path.join(__dirname, "../tv-home/web/app.js"), "utf8");
ok((app.match(/widgetsStill\(true\)/g) || []).length >= 2 && (app.match(/widgetsStill\(false\)/g) || []).length >= 3, "app.js: still when covered (hidden, paused, settings), moving again on resume");
ok(!/canvas/i.test(block), "no canvas");
done();
