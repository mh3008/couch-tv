// The Day/night globe (widgets.js R.globe, widgets.css .cw-gl-*): the sun's place from the date, the night's edge, a glowing
// dot at the TV's town, one style change a minute, one small pulse animation, still on a lighter home / reduced motion.
// Run: node tests/test_widget_globe.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const K = require("./web-widgets-kit");
const { fakeDocument, fixedDate } = require("./fake-dom");
const { ok, done } = K.counter("Day/night globe");
const web = path.join(__dirname, "../tv-home/web");
const js = fs.readFileSync(path.join(web, "widgets.js"), "utf8");

console.log("Running Day/night globe tests...");

// ---------------- 1. the sun's place (the pure functions, cut out of widgets.js) ----------------
const a = js.indexOf("function sunPoint(ms)"), z = js.indexOf("R.globe = function");
const M = vm.runInNewContext(js.slice(a, z) + "; ({ sunPoint, globeNight })", { Math });
const near = (x, y, e) => Math.abs(x - y) <= e;
{
  const s = M.sunPoint(Date.UTC(2026, 10, 21, 12));   // 21 Nov 2026 12:00 UTC: declination -19.8, equation of time +13.7 min => sun over longitude -3.4
  ok(near(s.lat, -19.8, 0.3) && near(s.lon, -3.4, 0.5), "21 Nov 2026 12:00 UTC: sun over " + s.lat.toFixed(2) + ", " + s.lon.toFixed(2) + " (expect -19.8, -3.4)");
  const sol = M.sunPoint(Date.UTC(2026, 5, 21, 3, 24));   // June solstice 2026 ~08:24 UTC; check declination only
  ok(near(M.sunPoint(Date.UTC(2026, 5, 21, 12)).lat, 23.44, 0.1), "June solstice: declination 23.4 (" + M.sunPoint(Date.UTC(2026, 5, 21, 12)).lat.toFixed(2) + ")");
  ok(near(M.sunPoint(Date.UTC(2026, 11, 21, 12)).lat, -23.44, 0.1), "December solstice: declination -23.4");
  ok(Math.abs(M.sunPoint(Date.UTC(2026, 2, 20, 15)).lat) < 0.6, "March equinox: declination near 0");
  const l0 = M.sunPoint(Date.UTC(2026, 10, 21, 0)).lon, l6 = M.sunPoint(Date.UTC(2026, 10, 21, 6)).lon;
  ok(near((((l0 - l6) % 360) + 360) % 360, 90, 0.5), "the sun moves 15 degrees west an hour (6 h = 90 degrees)");
  void sol;
}

// ---------------- 2. the night's edge: points on it are really 'depth' degrees under the horizon ----------------
{
  const rad = Math.PI / 180, dec = -19.8;
  [0, 6, 12, 18].forEach((depth) => {
    const d = M.globeNight(dec, depth);
    ok(/^M/.test(d) && !/NaN|undefined/.test(d), "depth " + depth + ": a path with no NaN");
    // every vertex of the middle copy (x = (lon + 360) * 2 in the sun's frame, sun at lon 0) must have the sun 'depth' degrees under the horizon
    const nums = d.match(/-?\d+ -?\d+/g).map((p) => p.split(" ").map(Number));
    let worst = 0, n = 0;
    nums.forEach(([x, y]) => {
      if (y <= 0 || y >= 360 || x < 360 || x > 1080) return;
      const lon = x / 2 - 360, lat = 90 - y / 2;
      const alt = Math.asin(Math.sin(lat * rad) * Math.sin(dec * rad) + Math.cos(lat * rad) * Math.cos(dec * rad) * Math.cos(lon * rad)) / rad;
      worst = Math.max(worst, Math.abs(alt + depth)); n++;
    });
    ok(worst < 1.2, "depth " + depth + ": every edge point has the sun " + depth + " degrees below the horizon (worst error " + worst.toFixed(2) + ")");
    ok(n > 20, "depth " + depth + ": " + n + " vertices");
  });
}

// ---------------- 3. drawing: a map, the night, the sun, the dot ----------------
function page(at) {
  const D = fixedDate(Date); D.set(at);
  let tick = null;
  const sb = { document: fakeDocument(), Date: D, setInterval: (f) => { tick = f; return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, console, Promise, JSON, Math };
  sb.window = sb; vm.createContext(sb);
  ["widget-web.js", "widget-caps.js", "widgets.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sb, { filename: f }));
  return { W: sb.window.CouchWidgets, C: sb.window.CouchWidgetCaps, D, sb, tick: () => tick() };
}
const has = (el, c) => el.all().filter((e) => (e._cls || []).indexOf(c) >= 0);
const paths = (el) => el.all().filter((e) => e.tagName === "PATH");
const LOOK = { panel: "rgba(14, 22, 48, 0.7)", ink: "#EAF0FF", accent: "#FFBE5A", rim: "rgba(120, 160, 255, 0.3)" };
const draw = (P, w, h, env, style) => {
  const el = P.W.render({ kind: "globe", w, h, opts: {}, style: Object.assign({ panel: "glass" }, style || {}) }, env || { look: LOOK, data: { place: { lat: 51.48, lon: -3.18 } } });
  P.sb.document.documentElement.appendChild(el); return el;
};
const t0 = Date.UTC(2026, 10, 21, 12);
K.sizes(page(t0).C, "globe").forEach(([id, w, h]) => {
  const P = page(t0), el = draw(P, w, h), map = has(el, "cw-gl-map")[0];
  const mw = parseFloat(/width:(\d+)px/.exec(map.style.cssText)[1]), mh = parseFloat(/height:(\d+)px/.exec(map.style.cssText)[1]);
  ok(mw <= w && mh <= h && mw === mh * 2, "globe " + id + " (" + w + "x" + h + "): a 2:1 map " + mw + "x" + mh + " inside the box");
  ok(paths(el).length === 5 && paths(el).every((p) => p.getAttribute("d") && !/NaN/.test(p.getAttribute("d"))), id + ": land + 4 night caps, every path has data");
  ok(has(el, "cw-gl-dot").length === 1 && has(el, "cw-gl-ring").length === 1 && has(el, "cw-gl-halo").length === 1 && has(el, "cw-gl-sun").length === 1, id + ": the town's dot (halo, ring, dot) and the sun");
  ok(!/undefined|NaN|null/.test(el.all().map((e) => e.style.cssText || "").join(" ")), id + ": no NaN in any style");
});
{
  // Cardiff (51.48, -3.18) is under the sun at 12:00 UTC in November: the dot sits at x = (lon + 180) / 360 of the map
  const P = page(t0), el = draw(P, 760, 360), dot = has(el, "cw-gl-dot")[0];
  const mw = parseFloat(/width:(\d+)px/.exec(has(el, "cw-gl-map")[0].style.cssText)[1]), left = parseFloat(/left:(-?[\d.]+)px/.exec(dot.style.cssText)[1]);
  ok(near(left, (-3.18 + 180) / 360 * mw, 1), "the dot is at the town's longitude (" + left + " of " + mw + ")");
  const none = P.W.render({ kind: "globe", w: 760, h: 360, opts: {}, style: { panel: "glass" } }, { look: LOOK });
  ok(has(none, "cw-gl-dot").length === 0 && /Set your town/.test(none.textContent), "no town: no dot, the words 'Set your town'");
  const demo = P.W.render({ kind: "globe", w: 760, h: 360, opts: {}, style: { panel: "glass" } }, { look: LOOK, demo: true });
  ok(has(demo, "cw-gl-dot").length === 1, "the demo has a dot (a sample town)");
}

// ---------------- 4. a minute later: one style change, no rebuild ----------------
{
  const P = page(t0), el = draw(P, 760, 360), g = el.all().filter((e) => e.tagName === "G")[0], before = g.getAttribute("transform"), d0 = paths(el)[1].getAttribute("d");
  P.D.set(t0 + 60000); P.tick();
  ok(g.getAttribute("transform") !== before && /translate\(/.test(g.getAttribute("transform")), "a minute on: the night strip slid sideways");
  ok(paths(el)[1].getAttribute("d") === d0, "the night polygons were NOT rebuilt (the sun's declination moved < 0.2 degrees)");
  P.D.set(t0 + 6 * 86400000); P.tick();
  ok(paths(el)[1].getAttribute("d") !== d0, "six days on the polygons are rebuilt for the new declination");
  const t = (s) => parseFloat(/translate\((-?[\d.]+) /.exec(s)[1]);
  P.D.set(t0 + 6 * 86400000 + 60000); P.tick(); const x0 = t(g.getAttribute("transform"));
  P.D.set(t0 + 6 * 86400000 + 3660000); P.tick(); const x1 = t(g.getAttribute("transform")), mw = 720;
  ok(near(((x0 - x1) + mw * 3) % mw, mw / 24, 1.5), "an hour moves the night " + ((x0 - x1)).toFixed(1) + " map units west (1/24 of " + mw + ")");
}

// ---------------- 5. the stylesheet and the code: light ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8"), from = css.indexOf("Day/night globe (widgets.js R.globe)"), block = css.slice(from, css.indexOf("@keyframes cw-gl-ping") + 200);
  const fr = block.match(/@keyframes cw-gl-ping \{.*?\} \}/g) || [];
  ok(fr.length === 1 && !/(left|top|width|height|margin|filter|box-shadow|background)\s*:/.test(fr[0].replace(/@keyframes[^{]*\{/, "")), "the only animation is the dot's ping: transform and opacity");
  ok(!/(filter|backdrop-filter|box-shadow|blur)\s*[:(]/.test(block), "no filter, blur or shadow in the globe's css");
  ok(/html\.lighter \.cw-gl-ring/.test(block) && /prefers-reduced-motion: reduce\) \{ \.cw-gl-ring/.test(block), "lighter home + reduced motion: the ping stands still");
  const body = js.slice(js.indexOf("R.globe = function"), js.indexOf("R.worldclock = function"));
  ok(!/setInterval|setTimeout|requestAnimationFrame/.test(body) && /live\(root, 60000/.test(body), "no timer of its own: the loader's tick every 60 s only");
  ok(js.indexOf("var GLOBE_LAND") > 0 && /var GLOBE_LAND = "[Mm][^"']*"/.test(js) && js.match(/var GLOBE_LAND = "([^"]*)"/)[1].length < 12000, "the land is one path under 12 KB");
}

// ---------------- 6. design.js, caps ----------------
{
  const CD = K.design();
  const kept = JSON.parse(JSON.stringify(CD.sanitize({ objects: [{ id: "g", type: "widget", kind: "globe", opts: { x: 1 } }] })));
  ok(kept.objects.length === 1 && kept.objects[0].kind === "globe" && JSON.stringify(kept.objects[0].opts || {}) === "{}", "design.js accepts globe, no options");
  const c = page(t0).C.get("globe");
  ok(c && c.status === "works" && c.sizes.min[0] === 4 && c.sizes.min[1] === 2, "widget-caps: a record, works, minimum 4x2");
}

done();
