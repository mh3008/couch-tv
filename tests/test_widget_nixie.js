// The Nixie clock (widgets.js R.nixie, widgets.css .cw-nx-*): four glass tubes with a glowing digit, two neon dots,
// a digit that changes cross-fades, nothing but transform and opacity moves, a lighter home / reduced motion
// stands still, and every colour the widget writes is a valid rgb / rgba / hex (a bad one threw in a real browser
// once, in the waves effect, and the page never drew).
// Run: node tests/test_widget_nixie.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const K = require("./web-widgets-kit");
const { fakeDocument, fixedDate } = require("./fake-dom");
const { ok, done } = K.counter("Nixie clock");
const web = path.join(__dirname, "../tv-home/web");

console.log("Running Nixie clock tests...");

function page(at) {
  const D = fixedDate(Date); D.set(at);
  let tick = null;
  const sb = { document: fakeDocument(), Date: D, setInterval: (f) => { tick = f; return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, console, Promise, JSON, Math };
  sb.window = sb; vm.createContext(sb);
  ["widget-web.js", "widget-caps.js", "widgets.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sb, { filename: f }));
  return { W: sb.window.CouchWidgets, D, sb, tick: () => tick() };
}
const draw = (P, w, h, env, style, opts) => {
  const el = P.W.render({ kind: "nixie", w, h, opts: opts || { format: "24h" }, style: style || {} }, env || {});
  P.sb.document.documentElement.appendChild(el);
  return el;
};
const has = (el, c) => el.all().filter((e) => (e._cls || []).indexOf(c) >= 0);
const tubes = (el) => has(el, "cw-nx");
const cur = (t) => has(t, "cw-nx-cur")[0].textContent;
const prev = (t) => has(t, "cw-nx-prev")[0].textContent;
const digits = (el) => tubes(el).map(cur).join("");
const at = (h, m, s) => new Date(2026, 10, 21, h, m, s || 0).getTime();

// every colour in a piece of css text: rgb(), rgba(), hex. Returns the bad ones.
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
const allCss = (el) => [el].concat(el.all()).map((e) => (e.style && e.style.cssText) || "").join("\n");

// the checker itself catches what broke the waves effect (an alpha that is a string, NaN, a short hex)
ok(badColours("rgba(1, 2, 3, NaN)").length === 1 && badColours("rgba(1, 2, 3, 'a')").length === 1 && badColours("rgba(1, 2, 3, 2)").length === 1 && badColours("rgba(1, 2)").length === 1 && badColours("#12").length === 1 && badColours("rgba(1, 2, 3, 0.5) #fff #a1b2c3").length === 0, "the colour checker rejects NaN / string / out-of-range alpha, a short hex, and accepts good ones");

// ---------------- 1. draws at every size, four tubes, the right digits, nothing moving by itself except the glow ----------------
K.sizes(K.home().C, "nixie").forEach(([id, w, h]) => {
  const P = page(at(19, 7, 30)), el = draw(P, w, h);
  ok(tubes(el).length === 4 && digits(el) === "1907", "nixie " + id + " (" + w + "x" + h + "): four tubes showing 1907 (" + digits(el) + ")");
  ok(has(el, "cw-nx-go").length === 0, id + ": at rest no cross-fade is running");
  ok(has(el, "cw-nx-l").length === 4 && has(el, "cw-nx-c").length === 1, id + ": one glow layer per tube and one for the dots");
  ok(!/undefined|NaN|null/.test(el.textContent + allCss(el)), id + ": no stray words or NaN in the markup");
  const bad = badColours(allCss(el));
  ok(bad.length === 0, id + ": every colour is a valid rgb / rgba / hex" + (bad.length ? " (bad: " + bad.slice(0, 3).join(" | ") + ")" : ""));
  tubes(el).forEach((t) => { const m = /width:(\d+)px;height:(\d+)px/.exec(t.style.cssText); ok(m && +m[1] <= w / 4 && +m[2] <= h, id + ": a tube fits the box (" + (m && m[1] + "x" + m[2]) + ")"); });
});

// ---------------- 2. colours: the classic orange, or the design's glow colour (style.accent); a bad one is ignored ----------------
{
  const P = page(at(19, 7, 30));
  const plain = draw(P, 760, 300);
  ok(/rgba\(255, 122, 26,/.test(allCss(plain)), "no accent: the classic nixie orange (255, 122, 26)");
  const blue = draw(page(at(19, 7, 30)), 760, 300, {}, { accent: "#33AAFF" });
  ok(/rgba\(51, 170, 255,/.test(allCss(blue)) && badColours(allCss(blue)).length === 0, "style.accent #33AAFF: a blue-glow tube, colours valid");
  const dark = draw(page(at(19, 7, 30)), 760, 300, {}, { accent: "#101010" });
  ok(badColours(allCss(dark)).length === 0 && !/rgba\(16, 16, 16, 1\);text-shadow/.test(allCss(dark)), "a near-black accent is lifted so the digit still glows (no black digit)");
  const junk = draw(page(at(19, 7, 30)), 760, 300, {}, { accent: "not-a-colour" });
  ok(/rgba\(255, 122, 26,/.test(allCss(junk)) && badColours(allCss(junk)).length === 0, "a bad accent falls back to the orange");
}

// ---------------- 3. the minute changes: only the digits that change cross-fade ----------------
{
  const P = page(at(19, 7, 30)), el = draw(P, 760, 300);
  P.D.set(at(19, 7, 50)); P.tick();
  ok(has(el, "cw-nx-go").length === 0, "same minute: nothing fades");
  P.D.set(at(19, 8, 0)); P.tick();
  const go = tubes(el).map((c) => c._cls.indexOf("cw-nx-go") >= 0);
  ok(go.join() === "false,false,false,true", "19:07 to 19:08: only the last tube fades (" + go + ")");
  const t = tubes(el)[3];
  ok(prev(t) === "7" && cur(t) === "8", "the old digit (7) fades out under the new one (8)");
  P.D.set(at(19, 8, 2)); P.tick();
  ok(has(el, "cw-nx-go").length === 0 && prev(tubes(el)[3]) === "", "the next 1 s tick: the fade is over, the old digit is gone");
  ok(digits(el) === "1908", "digits now 1908 (" + digits(el) + ")");
  P.D.set(at(20, 0, 0)); P.tick();
  ok(digits(el) === "2000" && has(el, "cw-nx-go").length === 3, "19:08 to 20:00: the three that differ fade (" + digits(el) + ")");
}

// ---------------- 4. 12 hour: the first tube stays dark before 10; midnight ----------------
{
  const e12 = draw(page(at(9, 5, 0)), 760, 300, {}, {}, { format: "12h" });
  ok(digits(e12) === "905" && cur(tubes(e12)[0]) === "", "12h: 9:05 leaves the first tube unlit (" + digits(e12) + ")");
  const e13 = draw(page(at(13, 5, 0)), 760, 300, {}, {}, { format: "12h" });
  ok(digits(e13) === "105", "12h: 1:05 pm (" + digits(e13) + ")");
  const P2 = page(at(23, 59, 30)), e2 = draw(P2, 760, 300);
  P2.D.set(at(24, 0, 0)); P2.tick();
  ok(digits(e2) === "0000" && has(e2, "cw-nx-go").length === 4, "23:59 to 00:00: all four fade");
}

// ---------------- 5. lighter home / reduced motion: the digit just changes ----------------
{
  const P = page(at(19, 7, 30)), el = draw(P, 760, 300);
  P.sb.document.documentElement.classList.add("lighter");
  P.D.set(at(19, 8, 0)); P.tick();
  ok(digits(el) === "1908" && has(el, "cw-nx-go").length === 0, "html.lighter: 1908 shown, no fade started");
  const Q = page(at(19, 7, 30)), e2 = draw(Q, 760, 300);
  Q.sb.matchMedia = (q) => ({ matches: /reduce/.test(q) });
  Q.D.set(at(19, 8, 0)); Q.tick();
  ok(digits(e2) === "1908" && has(e2, "cw-nx-go").length === 0, "prefers-reduced-motion: 1908 shown, no fade started");
}

// ---------------- 6. the stylesheet: only transform and opacity move; the layers are small; no timers ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
  const sec = css.slice(css.indexOf("the Nixie clock"), css.indexOf("things typed at home"));
  const frames = sec.match(/@keyframes cw-nx-[a-z]+ \{[^@]*?\} \}/g) || [];
  ok(frames.length === 4, "four keyframe blocks for the nixie (" + frames.length + ")");
  ok(frames.every((f) => !/(left|top|width|height|margin|filter|box-shadow|background|color|text-shadow)\s*:/.test(f.replace(/@keyframes[^{]*\{/, ""))), "keyframes touch only transform / opacity");
  ok(/html\.lighter \.cw-nx-l/.test(sec) && /prefers-reduced-motion: reduce\) \{ \.cw-nx-l/.test(sec), "the stylesheet stops the glow, the dots and the fades on a lighter home and for reduced motion");
  ok(!/will-change/.test(sec), "no will-change");
  ok(badColours(sec).length === 0, "every colour in the stylesheet block is valid (" + badColours(sec).join(" | ") + ")");
  const js = fs.readFileSync(path.join(web, "widgets.js"), "utf8");
  const blk = js.slice(js.indexOf("R.nixie = function"), js.indexOf("the widget's own settings: To the minute"));
  ok(!/setInterval|setTimeout|requestAnimationFrame/.test(blk), "no timer of its own (the loader's one 1 s tick does all)");
  // composited area while it glows: four glow layers (the tubes) + the dots, as a share of the 1920 x 1080 screen
  const P = page(at(19, 7, 30)), el = draw(P, 760, 300);
  let area = 0;
  tubes(el).forEach((t) => { const m = /width:(\d+)px;height:(\d+)px/.exec(t.style.cssText); area += m[1] * m[2]; });
  has(el, "cw-nx-c").forEach((c) => { const m = /width:(\d+)px;height:(\d+)px/.exec(c.style.cssText); area += m[1] * m[2]; });
  const pct = area / (1920 * 1080) * 100;
  console.log("  glowing layers at 760 x 300: " + area + " px = " + pct.toFixed(1) + " % of the screen");
  ok(pct <= 8, "the moving layers are at most 8 % of the screen (" + pct.toFixed(1) + " %)");
}

// ---------------- 7. design.js knows the kind and its one option ----------------
{
  const CD = K.design();
  const o = K.kept(CD, "nixie", { format: "24h", junk: "x" });
  ok(o.format === "24h" && o.junk === undefined, "design.js keeps format, drops anything else (" + JSON.stringify(o) + ")");
  const d = JSON.parse(JSON.stringify(CD.sanitize({ objects: [{ id: "w", type: "widget", kind: "nixie" }] })));
  ok(d.objects.length === 1 && d.objects[0].kind === "nixie", "a nixie widget survives the design check");
  const C = K.home().C;
  ok(C.get("nixie") && C.get("nixie").name === "Nixie clock" && C.settings("nixie").some((s) => s.key === "format"), "widget-caps has the record and the 12 or 24 hour setting");
}

done();
