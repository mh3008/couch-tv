// The Fibonacci clock (widgets.js R.fibclock, widgets.css .cw-fb-*): five squares of 1, 1, 2, 3 and 5 on an 8 x 5 board, red = hours,
// green = minutes, blue = both, white = neither; a square that changes colour cross-fades with a pop, a glint runs from square to
// square, nothing but transform and opacity moves, a lighter home / reduced motion stands still, and every colour the widget writes
// is a valid rgb / rgba / hex (a bad one threw in a real browser once, in the waves effect, and the page never drew).
// Run: node tests/test_widget_fibclock.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const K = require("./web-widgets-kit");
const { fakeDocument, fixedDate } = require("./fake-dom");
const { ok, done } = K.counter("Fibonacci clock");
const web = path.join(__dirname, "../tv-home/web");

console.log("Running Fibonacci clock tests...");

function page(at) {
  const D = fixedDate(Date); D.set(at);
  let tick = null;
  const sb = { document: fakeDocument(), Date: D, setInterval: (f) => { tick = f; return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, console, Promise, JSON, Math };
  sb.window = sb; vm.createContext(sb);
  ["widget-web.js", "widget-caps.js", "widgets.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sb, { filename: f }));
  return { W: sb.window.CouchWidgets, D, sb, tick: () => tick() };
}
const draw = (P, w, h, env, style, opts) => {
  const el = P.W.render({ kind: "fibclock", w, h, opts: opts || {}, style: style || {} }, env || {});
  P.sb.document.documentElement.appendChild(el);
  return el;
};
const has = (el, c) => el.all().filter((e) => (e._cls || []).indexOf(c) >= 0);
const squares = (el) => has(el, "cw-fb-s");
const layers = (sq) => sq.all().filter((e) => (e._cls || []).indexOf("cw-fb-c") >= 0);
// the colour of a square: the index of its layer that is on (0 neither, 1 hours, 2 minutes, 3 both)
const state = (sq) => layers(sq).findIndex((l) => l._cls.indexOf("cw-fb-on") >= 0);
const states = (el) => squares(el).map(state);
const at = (h, m, s) => new Date(2026, 10, 21, h, m, s || 0).getTime();
const SIZE = [5, 3, 2, 1, 1];   // the squares in the order they are drawn

// every colour in a piece of css text or an attribute: rgb(), rgba(), hex. Returns the bad ones.
function badColours(text) {
  const bad = [];
  (text.match(/rgba?\([^)]*\)/gi) || []).forEach((c) => {
    const n = c.replace(/^rgba?\(|\)$/gi, "").split(/[\s,\/]+/).filter(Boolean);
    const isA = /^rgba/i.test(c);
    const nums = n.every((v) => /^-?\d+(\.\d+)?%?$/.test(v) && isFinite(parseFloat(v)));
    const chan = n.slice(0, 3).every((v) => parseFloat(v) >= 0 && parseFloat(v) <= 255);
    const alpha = n.length < 4 || (parseFloat(n[3]) >= 0 && parseFloat(n[3]) <= 1);
    if (!(nums && chan && alpha && n.length === (isA ? 4 : 3))) bad.push(c);
  });
  (text.match(/#[0-9a-z]+\b/gi) || []).forEach((h) => { if (!/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) bad.push(h); });
  return bad;
}
const allCss = (el) => [el].concat(el.all()).map((e) => ((e.style && e.style.cssText) || "") + " " + Object.keys(e.attrs || {}).map((k) => e.attrs[k]).join(" ")).join("\n");

ok(badColours("rgba(1, 2, 3, NaN)").length === 1 && badColours("rgba(1, 2, 3, 'a')").length === 1 && badColours("rgba(1, 2, 3, 2)").length === 1 && badColours("rgba(1, 2)").length === 1 && badColours("#12").length === 1 && badColours("rgba(1, 2, 3, 0.5) #fff #a1b2c3").length === 0, "the colour checker rejects NaN / string / out-of-range alpha, a short hex, and accepts good ones");

// ---------------- 1. draws at every size ----------------
K.sizes(K.home().C, "fibclock").forEach(([id, w, h]) => {
  const P = page(at(14, 30, 30)), el = draw(P, w, h);
  const sq = squares(el);
  ok(sq.length === 5 && sq.every((s) => layers(s).length === 4), "fibclock " + id + " (" + w + "x" + h + "): five squares with four colour layers each");
  ok(sq.every((s) => layers(s).filter((l) => l._cls.indexOf("cw-fb-on") >= 0).length === 1), id + ": one colour on in each square (" + states(el) + ")");
  ok(has(el, "cw-fb-go").length === 0 && has(el, "cw-fb-fi").length === 0 && has(el, "cw-fb-fo").length === 0, id + ": at rest no fade or pop is running");
  ok(has(el, "cw-fb-g").length === 5, id + ": one glint layer a square");
  ok(!/undefined|NaN|null/.test(el.textContent + allCss(el)), id + ": no stray words or NaN in the markup");
  const bad = badColours(allCss(el));
  ok(bad.length === 0, id + ": every colour is a valid rgb / rgba / hex" + (bad.length ? " (bad: " + bad.slice(0, 3).join(" | ") + ")" : ""));
  const px = (s, k) => +new RegExp(k + ":(-?\\d+)px").exec(s.style.cssText)[1];
  const right = Math.max.apply(null, sq.map((s) => px(s, "left") + px(s, "width"))), bottom = Math.max.apply(null, sq.map((s) => px(s, "top") + px(s, "height")));
  ok(right <= w && bottom <= h, id + ": the board fits the box (" + right + " x " + bottom + " in " + w + " x " + h + ")");
});

// ---------------- 2. the rules: all 144 times read back ----------------
{
  let bad = 0, same = 0;
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 5) {
    const el = draw(page(at(h, m, 7)), 760, 460), st = states(el);
    const hh = h % 12 || 12, hours = st.reduce((a, s, i) => a + (s === 1 || s === 3 ? SIZE[i] : 0), 0), mins = st.reduce((a, s, i) => a + (s === 2 || s === 3 ? SIZE[i] : 0), 0);
    if (hours !== hh || mins !== m / 5) bad++;
    const again = states(draw(page(at(h, m, 55)), 760, 460));
    if (again.join() === st.join()) same++;
  }
  ok(bad === 0, "all 288 times (24 h x 12 five-minute steps): red + blue squares add up to the hour, green + blue to the minutes in fives (" + bad + " wrong)");
  ok(same === 288, "the same time always looks the same, whatever the second (" + same + " of 288)");
  const cols = new Set(); for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) states(draw(page(at(h, m)), 760, 460)).forEach((s) => cols.add(s));
  ok(cols.size === 4, "all four colours turn up over a day");
}

// ---------------- 3. the squares tile the board ----------------
{
  const el = draw(page(at(14, 30, 30)), 760, 760), sq = squares(el);
  const px = (s, k) => +new RegExp(k + ":(-?\\d+)px").exec(s.style.cssText)[1];
  const r = sq.map((s) => [px(s, "left"), px(s, "top"), px(s, "left") + px(s, "width"), px(s, "top") + px(s, "height")]);
  let overlap = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i][0] < r[j][2] && r[j][0] < r[i][2] && r[i][1] < r[j][3] && r[j][1] < r[i][3]) overlap++;
  ok(overlap === 0, "no two squares overlap");
  const sides = sq.map((s) => px(s, "width"));
  ok(sides[0] > sides[1] && sides[1] > sides[2] && sides[2] > sides[3] && sides[3] === sides[4], "the sides are in 5 : 3 : 2 : 1 : 1 order (" + sides + ")");
  ok(Math.abs(sides[0] / sides[3] - 5) < 1 && Math.abs(sides[1] / sides[3] - 3) < 0.7, "the 5 square is about five times the 1 square, the 3 about three (" + sides + ")");
}

// ---------------- 4. the time changes: only the squares that change colour fade ----------------
{
  const P = page(at(14, 30, 30)), el = draw(P, 760, 460);
  const before = states(el);
  P.D.set(at(14, 32, 0)); P.tick();
  ok(has(el, "cw-fb-go").length === 0 && states(el).join() === before.join(), "14:30 to 14:32: still the same five-minute step, nothing fades");
  P.D.set(at(14, 40, 0)); P.tick();
  const after = [];
  for (let i = 0; i < 5; i++) after.push(layers(squares(el)[i]).findIndex((l) => l._cls.indexOf("cw-fb-on") >= 0));
  const exp = states(draw(page(at(14, 40, 0)), 760, 460));
  ok(after.join() === exp.join(), "14:40 shows the 14:40 colours (" + after + ")");
  const moved = squares(el).map((s, i) => s._cls.indexOf("cw-fb-go") >= 0);
  const should = before.map((s, i) => s !== exp[i]);
  ok(moved.join() === should.join() && moved.some(Boolean), "the squares whose colour changed pop, the others stay (" + moved + ")");
  squares(el).forEach((s, i) => { if (!should[i]) return; const L = layers(s); ok(L[before[i]]._cls.indexOf("cw-fb-fo") >= 0 && L[exp[i]]._cls.indexOf("cw-fb-fi") >= 0, "square " + i + ": the old colour fades out, the new one in"); });
  P.D.set(at(14, 40, 3)); P.tick();
  ok(has(el, "cw-fb-go").length === 0 && has(el, "cw-fb-fi").length === 0 && has(el, "cw-fb-fo").length === 0, "the next 1 s tick: all fades are over, back to resting colours");
  ok(states(el).join() === exp.join(), "and the colours are the new ones");
  P.D.set(at(14, 45, 0)); P.tick(); P.D.set(at(14, 50, 0)); P.tick();
  ok(states(el).join() === states(draw(page(at(14, 50, 0)), 760, 460)).join(), "two changes in a row end on the right colours (" + states(el) + ")");
  const txt = el.all().filter((e) => (e._cls || []).indexOf("cw-dim") >= 0)[0];
  ok(txt && /^2:50$/.test(txt.textContent), "the caption under the board follows the time (" + (txt && txt.textContent) + ")");
}

// ---------------- 5. a short box has no caption; 12 / 24 h ----------------
{
  const short = draw(page(at(14, 30)), 760, 260);
  ok(!short.all().some((e) => (e._cls || []).indexOf("cw-dim") >= 0), "a box under 300 px high drops the caption");
  const e24 = draw(page(at(14, 30)), 760, 460, {}, {}, { format: "24h" });
  ok(e24.all().some((e) => /^14:30$/.test(e.textContent)), "the caption follows the 12 / 24 hour option");
}

// ---------------- 6. lighter home / reduced motion ----------------
{
  const P = page(at(14, 30, 30)), el = draw(P, 760, 460);
  P.sb.document.documentElement.classList.add("lighter");
  P.D.set(at(14, 40, 0)); P.tick();
  ok(has(el, "cw-fb-go").length === 0 && has(el, "cw-fb-fi").length === 0 && states(el).join() === states(draw(page(at(14, 40, 0)), 760, 460)).join(), "html.lighter: the colours just change, no fade or pop started");
  const Q = page(at(14, 30, 30)), e2 = draw(Q, 760, 460);
  Q.sb.matchMedia = (q) => ({ matches: /reduce/.test(q) });
  Q.D.set(at(14, 40, 0)); Q.tick();
  ok(has(e2, "cw-fb-go").length === 0 && has(e2, "cw-fb-fi").length === 0, "prefers-reduced-motion: no fade or pop started");
}

// ---------------- 7. the stylesheet: only transform and opacity move; layers; no timers ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
  const sec = css.slice(css.indexOf("the Fibonacci clock"), css.indexOf("things typed at home"));
  const frames = sec.match(/@keyframes cw-fb-[a-z]+ \{[^@]*?\} \}/g) || [];
  ok(frames.length === 4, "four keyframe blocks (glint, in, out, pop): " + frames.length);
  ok(frames.every((f) => !/(left|top|width|height|margin|filter|box-shadow|background|color)\s*:/.test(f.replace(/@keyframes[^{]*\{/, ""))), "keyframes touch only transform / opacity");
  ok(/html\.lighter \.cw-fb-g/.test(sec) && /prefers-reduced-motion: reduce\) \{ \.cw-fb-g/.test(sec), "the stylesheet stops the glint, the fades and the pop on a lighter home and for reduced motion");
  ok(!/will-change/.test(sec) && !/transition/.test(sec), "no will-change, no transition");
  ok(badColours(sec).length === 0, "every colour in the stylesheet block is valid (" + badColours(sec).join(" | ") + ")");
  const js = fs.readFileSync(path.join(web, "widgets.js"), "utf8");
  const blk = js.slice(js.indexOf("R.fibclock = function"), js.indexOf("the widget's own settings: To the minute"));
  ok(!/setInterval|setTimeout|requestAnimationFrame/.test(blk), "no timer of its own (the loader's one 1 s tick does all)");
  // composited area while it runs: the five glint layers (the squares), as a share of the 1920 x 1080 screen
  const sq = squares(draw(page(at(14, 30, 30)), 760, 460)), px = (s, k) => +new RegExp(k + ":(-?\\d+)px").exec(s.style.cssText)[1];
  const area = sq.reduce((a, s) => a + px(s, "width") * px(s, "height"), 0), pct = area / (1920 * 1080) * 100;
  console.log("  glint layers at 760 x 460: " + area + " px = " + pct.toFixed(1) + " % of the screen");
  ok(pct <= 10, "the moving layers are at most 10 % of the screen (" + pct.toFixed(1) + " %)");
}

// ---------------- 8. design.js knows the kind and its one option ----------------
{
  const CD = K.design();
  const o = K.kept(CD, "fibclock", { format: "24h", junk: "x" });
  ok(o.format === "24h" && o.junk === undefined, "design.js keeps format, drops anything else (" + JSON.stringify(o) + ")");
  const d = JSON.parse(JSON.stringify(CD.sanitize({ objects: [{ id: "w", type: "widget", kind: "fibclock" }] })));
  ok(d.objects.length === 1 && d.objects[0].kind === "fibclock", "a fibclock widget survives the design check");
  const C = K.home().C;
  ok(C.get("fibclock") && C.get("fibclock").name === "Fibonacci clock" && C.settings("fibclock").some((s) => s.key === "format"), "widget-caps has the record and the 12 or 24 hour setting");
}

done();
