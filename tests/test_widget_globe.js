// The Day/night globe (widgets.js R.globe, widgets.css .cw-gl-*): the sun's place from the date, the night's edge, a glowing
// dot at the TV's town, one canvas redrawn a minute, one ping ring, still on a lighter home / reduced motion.
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
const M = vm.runInNewContext(js.slice(a, z) + "; ({ sunPoint, globeNight, gbParse })", { Math });
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

// ---------------- 3. drawing: ONE canvas (map, night, sun, dot), one ping ring ----------------
// a recording 2D context: every call is logged per canvas; a clearRect starts a new frame. Colours are checked as they go in.
const COLOURS = [];
function recCanvas(el) {
  const log = [], frames = [];
  let cur = null;
  const rec = (n) => (...a) => { const e = [n, ...a]; log.push(e); if (n === "clearRect") { cur = [e]; frames.push(cur); } else if (cur) cur.push(e); };
  const grad = () => ({ addColorStop(o, c) { COLOURS.push(c); log.push(["stop", o, c]); } });
  const ctx = { _fill: null, _stroke: null };
  ["clearRect", "drawImage", "save", "restore", "translate", "beginPath", "closePath", "moveTo", "lineTo", "arcTo", "arc", "clip", "fill", "stroke"].forEach((n) => { ctx[n] = rec(n); });
  ctx.createLinearGradient = (...a) => { log.push(["lin", ...a]); return grad(); };
  ctx.createRadialGradient = (...a) => { log.push(["rad", ...a]); return grad(); };
  Object.defineProperty(ctx, "fillStyle", { set(v) { if (typeof v === "string") COLOURS.push(v); log.push(["fillStyle", typeof v === "string" ? v : "[gradient]"]); cur && cur.push(["fillStyle", typeof v === "string" ? v : "[gradient]"]); } });
  Object.defineProperty(ctx, "strokeStyle", { set(v) { if (typeof v === "string") COLOURS.push(v); log.push(["strokeStyle", v]); } });
  Object.defineProperty(ctx, "lineWidth", { set(v) { log.push(["lineWidth", v]); } });
  el.getContext = (t) => (t === "2d" ? ctx : null);
  el._log = log; el._frames = frames;
}
function page(at) {
  const D = fixedDate(Date); D.set(at);
  let tick = null;
  const doc = fakeDocument(), mk = doc.createElement, canvases = [];
  doc.createElement = (t) => { const e = mk(t); if (String(t).toLowerCase() === "canvas") { recCanvas(e); canvases.push(e); } return e; };
  const sb = { document: doc, Date: D, setInterval: (f) => { tick = f; return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, console, Promise, JSON, Math };
  sb.window = sb; vm.createContext(sb);
  ["widget-web.js", "widget-caps.js", "widgets.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sb, { filename: f }));
  return { W: sb.window.CouchWidgets, C: sb.window.CouchWidgetCaps, D, sb, canvases, tick: () => tick() };
}
const has = (el, c) => el.all().filter((e) => (e._cls || []).indexOf(c) >= 0);
const LOOK = { panel: "rgba(14, 22, 48, 0.7)", ink: "#EAF0FF", accent: "#FFBE5A", rim: "rgba(120, 160, 255, 0.3)" };
const draw = (P, w, h, env, style) => {
  const el = P.W.render({ kind: "globe", w, h, opts: {}, style: Object.assign({ panel: "glass" }, style || {}) }, env || { look: LOOK, data: { place: { lat: 51.48, lon: -3.18 } } });
  P.sb.document.documentElement.appendChild(el); return el;
};
const t0 = Date.UTC(2026, 10, 21, 12);
const count = (log, n) => log.filter((e) => e[0] === n).length;
K.sizes(page(t0).C, "globe").forEach(([id, w, h]) => {
  const P = page(t0), el = draw(P, w, h), map = has(el, "cw-gl-map")[0];
  const mw = parseFloat(/width:(\d+)px/.exec(map.style.cssText)[1]), mh = parseFloat(/height:(\d+)px/.exec(map.style.cssText)[1]);
  ok(mw <= w && mh <= h && mw === mh * 2, "globe " + id + " (" + w + "x" + h + "): a 2:1 map " + mw + "x" + mh + " inside the box");
  const vis = has(el, "cw-gl-cv");
  ok(vis.length === 1 && vis[0].tagName === "CANVAS" && vis[0].width === mw && vis[0].height === mh, id + ": ONE visible canvas, the size of the map");
  ok(el.all().filter((e) => e.tagName === "SVG" || e.tagName === "PATH").length === 0, id + ": no SVG, no paths (everything is the one canvas)");
  const layers = map.all().length, ring = has(el, "cw-gl-ring").length;
  ok(layers <= 2 && ring === 1, id + ": " + layers + " layers in the map (canvas + ping ring), 1 animated (cap ~10 per widget)");
  ok(!/undefined|NaN|null/.test(el.all().map((e) => e.style.cssText || "").join(" ")), id + ": no NaN in any style");
  const vlog = vis[0]._log, bot = P.canvases.filter((c) => c !== vis[0])[0]._log;
  ok(count(bot, "lineTo") > 600 && count(bot, "fill") === 2 && !bot.some((e) => e.some((x) => typeof x === "number" && !isFinite(x))), id + ": the land is drawn (" + count(bot, "lineTo") + " segments), into the cached map picture");
  const fr = vis[0]._frames[0], fills = fr.filter((e) => e[0] === "fill").length;
  ok(fr.filter((e) => e[0] === "drawImage").length === 2 && fills === 5, id + ": a frame = map picture, 4 night caps + the sun, top picture (" + fills + " fills)");
  ok(vlog.every((e) => !e.some((x) => typeof x === "number" && !isFinite(x))), id + ": no NaN in any canvas call");
});
{
  // Cardiff (51.48, -3.18) is under the sun at 12:00 UTC in November: the dot sits at x = (lon + 180) / 360 of the map
  const P = page(t0), el = draw(P, 760, 360), ring = has(el, "cw-gl-ring")[0];
  const mw = parseFloat(/width:(\d+)px/.exec(has(el, "cw-gl-map")[0].style.cssText)[1]), left = parseFloat(/left:(-?[\d.]+)px/.exec(ring.style.cssText)[1]);
  ok(near(left, (-3.18 + 180) / 360 * mw, 1), "the ping ring is at the town's longitude (" + left + " of " + mw + ")");
  const top = P.canvases[2], arcs = top._log.filter((e) => e[0] === "arc");
  ok(arcs.length === 2 && arcs.every((a) => near(a[1], (-3.18 + 180) / 360 * mw, 1)), "the halo and dot are drawn at the same place, once, in the top picture");
  const none = P.W.render({ kind: "globe", w: 760, h: 360, opts: {}, style: { panel: "glass" } }, { look: LOOK });
  ok(has(none, "cw-gl-ring").length === 0 && /Set your town/.test(none.textContent), "no town: no ring, the words 'Set your town'");
  const demo = P.W.render({ kind: "globe", w: 760, h: 360, opts: {}, style: { panel: "glass" } }, { look: LOOK, demo: true });
  ok(has(demo, "cw-gl-ring").length === 1, "the demo has a dot (a sample town)");
  // no canvas at all (a very old browser): still a plain ocean box, no throw
  const P2 = page(t0); P2.sb.document.createElement = (t) => new (require("./fake-dom").FakeEl)(t);
  const bare = draw(P2, 760, 360);
  ok(has(bare, "cw-gl-map").length === 1 && /background:rgba/.test(has(bare, "cw-gl-map")[0].style.cssText), "no canvas support: a plain ocean box, no error");
}
{
  // the land path itself: relative steps must land inside the 720x360 map
  const steps = M.gbParse(js.match(/var GLOBE_LAND = "([^"]*)"/)[1]);
  const pts = steps.filter((s) => s[0] !== 2);
  ok(steps.length > 700 && pts.every((s) => isFinite(s[1]) && isFinite(s[2]) && s[1] >= -2 && s[1] <= 722 && s[2] >= -2 && s[2] <= 362), "the land parses to " + steps.length + " steps, every point inside the 720x360 map");
}

// ---------------- 4. a minute later: a redraw of the one canvas, nothing rebuilt ----------------
{
  const P = page(t0), el = draw(P, 760, 360), cv = has(el, "cw-gl-cv")[0], others = P.canvases.filter((c) => c !== cv), n0 = others.map((c) => c._log.length);
  const sig = (f) => f.filter((e) => e[0] === "moveTo" || e[0] === "lineTo").map((e) => e.join(",")).join(";"), tr = (f) => f.filter((e) => e[0] === "translate")[0][1];
  P.D.set(t0 + 60000); P.tick();
  ok(cv._frames.length === 2 && tr(cv._frames[1]) !== tr(cv._frames[0]), "a minute on: one more frame on the canvas, the night slid sideways");
  ok(sig(cv._frames[1]) === sig(cv._frames[0]), "the night polygons were NOT rebuilt (the sun's declination moved < 0.2 degrees)");
  ok(others.every((c, i) => c._log.length === n0[i]), "the two cached pictures (map, top) were not touched again: drawn once");
  P.D.set(t0 + 6 * 86400000); P.tick();
  ok(sig(cv._frames[2]) !== sig(cv._frames[0]), "six days on the polygons are rebuilt for the new declination");
  P.D.set(t0 + 6 * 86400000 + 60000); P.tick(); const x0 = tr(cv._frames[3]);
  P.D.set(t0 + 6 * 86400000 + 3660000); P.tick(); const x1 = tr(cv._frames[4]), mw = 720;
  ok(near(((x0 - x1) + mw * 3) % mw, mw / 24, 1.5), "an hour moves the night " + (x0 - x1).toFixed(1) + " px west (1/24 of " + mw + ")");
  ok(cv._frames.every((f) => f.filter((e) => e[0] === "clearRect").length === 1), "one clear per frame, no per-frame repaint between ticks");
}
// every colour handed to the canvas, and every colour in a style, is a valid rgba / hex (a bad one threw in a real browser once)
{
  const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+|1\.0+)\s*)?\)$/, HEX = /^#[0-9a-f]{3,8}$/i;
  const good = (c) => (RGBA.test(c) && (c.match(/\d{1,3}/g) || []).slice(0, 3).every((n) => +n <= 255)) || HEX.test(c);
  const bad = COLOURS.filter((c) => !good(c));
  ok(COLOURS.length > 15 && bad.length === 0, COLOURS.length + " canvas colours, all valid rgba / hex" + (bad.length ? " BAD: " + bad.slice(0, 5).join(" | ") : ""));
  const P = page(t0), el = draw(P, 760, 360), css = el.all().map((e) => e.style.cssText || "").join(" ");
  const inl = css.match(/rgba?\([^)]*\)/g) || [];
  ok(inl.length > 0 && inl.every(good), inl.length + " colours in the styles, all valid");
}

// ---------------- 5. the stylesheet and the code: light ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8"), from = css.indexOf("Day/night globe (widgets.js R.globe)"), block = css.slice(from, css.indexOf("@keyframes cw-gl-ping") + 200);
  const fr = block.match(/@keyframes cw-gl-ping \{.*?\} \}/g) || [];
  ok(fr.length === 1 && !/(left|top|width|height|margin|filter|box-shadow|background)\s*:/.test(fr[0].replace(/@keyframes[^{]*\{/, "")), "the only animation is the dot's ping ring: transform and opacity");
  ok(!/(filter|backdrop-filter|box-shadow|blur)\s*[:(]/.test(block), "no filter, blur or shadow in the globe's css");
  ok(!/cw-gl-(sun|halo|dot)\b/.test(block) && (block.match(/animation:\s*cw-gl/g) || []).length === 2, "one animated class only (the ping ring): the sun, halo and dot are not elements any more");
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
