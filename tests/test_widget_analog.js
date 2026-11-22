// The analogue clock (widgets.js R.analog, widgets.css .cw-an-s): a second hand that sweeps by a CSS animation, started at
// the clock's own second, re-aligned only when it has drifted, hands that follow the time, still on a lighter home.
// Run: node tests/test_widget_analog.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const K = require("./web-widgets-kit");
const { fakeDocument, fixedDate } = require("./fake-dom");
const { ok, done } = K.counter("Analogue clock");
const web = path.join(__dirname, "../tv-home/web");

console.log("Running Analogue clock tests...");

function page(at) {
  const D = fixedDate(Date); D.set(at);
  let tick = null;
  const sb = { document: fakeDocument(), Date: D, setInterval: (f) => { tick = f; return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, console, Promise, JSON, Math };
  sb.window = sb; vm.createContext(sb);
  ["widget-web.js", "widget-caps.js", "widgets.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sb, { filename: f }));
  return { W: sb.window.CouchWidgets, C: sb.window.CouchWidgetCaps, D, sb, tick: () => tick() };
}
const at = (h, m, s, ms) => new Date(2026, 10, 21, h, m, s, ms || 0).getTime();
const draw = (P, w, h, opts, style) => { const el = P.W.render({ kind: "analog", w, h, opts: opts || {}, style: style || {} }, {}); P.sb.document.documentElement.appendChild(el); return el; };
const all = (el) => el.all();
const hands = (el) => all(el).filter((e) => e.tagName === "LINE" && e.getAttribute("transform") !== null && !/ 50 50\)$/.test("") && e.getAttribute("y1") !== "4.6");
const rot = (e) => parseFloat(/rotate\((-?[\d.]+)/.exec(e.getAttribute("transform"))[1]);
const sweep = (el) => all(el).filter((e) => e.tagName === "G")[0];
const delay = (g) => { const m = /animation-delay:-([\d.]+)s/.exec(g.style.cssText); return m ? parseFloat(m[1]) : null; };

// ---------------- 1. draws at every size ----------------
K.sizes(page(at(10, 8, 20)).C, "analog").forEach(([id, w, h]) => {
  const P = page(at(10, 8, 20)), el = draw(P, w, h);
  const svg = all(el).filter((e) => e.tagName === "SVG")[0];
  ok(!!svg && all(el).filter((e) => e.tagName === "LINE").length >= 6 && all(el).filter((e) => e.tagName === "CIRCLE").length >= 10, "analog " + id + " (" + w + "x" + h + "): a face with marks, hands and a centre");
  ok(!!sweep(el) && sweep(el).getAttribute("class") === "cw-an-s", id + ": the second hand is a group with the sweep class");
  ok(!/NaN|undefined/.test(all(el).map((e) => JSON.stringify(e.attrs) + (e.style.cssText || "")).join(" ")), id + ": no NaN");
});

// ---------------- 2. the sweep starts at the clock's own second ----------------
{
  const P = page(at(10, 8, 20, 500)), el = draw(P, 360, 360), g = sweep(el);
  ok(delay(g) === 20.5, "10:08:20.5: the sweep starts 20.5 s into its turn (delay -" + delay(g) + "s)");
  const P2 = page(at(10, 8, 59, 900)), g2 = sweep(draw(P2, 360, 360));
  ok(delay(g2) === 59.9, "59.9 s: delay -59.9s");
  const P3 = page(at(0, 0, 0, 0)), g3 = sweep(draw(P3, 360, 360));
  ok(delay(g3) === 0, "midnight: delay 0");
}

// ---------------- 3. the hands follow the time ----------------
{
  const P = page(at(10, 10, 30)), el = draw(P, 360, 360);
  const [hh, mm] = all(el).filter((e) => e.tagName === "LINE" && e.getAttribute("y1") !== "4.6" && e.getAttribute("stroke-width") !== "1" && e.getAttribute("transform") && !/^rotate\((0|30|60|90|120|150|180|210|240|270|300|330) 50 50\)$/.test(e.getAttribute("transform")));
  ok(Math.abs(rot(hh) - (10 * 30 + 10 / 2)) < 0.01, "10:10 hour hand at 305 degrees (" + rot(hh) + ")");
  ok(Math.abs(rot(mm) - (10 * 6 + 30 / 10)) < 0.01, "10:10:30 minute hand at 63 degrees, creeping with the seconds (" + rot(mm) + ")");
  P.D.set(at(10, 11, 0)); P.tick();
  ok(Math.abs(rot(mm) - 66) < 0.01 && Math.abs(rot(hh) - 305.5) < 0.01, "a tick at 10:11:00 moves them (minute 66, hour 305.5)");
}

// ---------------- 4. re-aligned only when it has drifted ----------------
{
  const P = page(at(10, 0, 10)), g = sweep(draw(P, 360, 360));
  const css0 = g.style.cssText;
  P.D.set(at(10, 0, 40)); P.tick();
  ok(g.style.cssText === css0, "30 s later on a steady clock the hand is where it should be: the animation is NOT touched (no jump)");
  g.getAnimations = () => [{ currentTime: 40000 }];   // the engine says the hand is at 40 s: right
  P.D.set(at(10, 1, 40)); P.tick();
  ok(g.style.cssText === css0, "the animation's own time agrees with the clock: not touched");
  g.getAnimations = () => [{ currentTime: 5000 }];   // the engine says 5 s, the clock says 20 s (a throttled page, a clock set by the network): re-align
  P.D.set(at(10, 2, 20)); P.tick();
  ok(g.style.cssText !== css0 && delay(g) === 20, "the hand is 15 s off: re-aligned to the clock (delay -" + delay(g) + "s)");
}

// ---------------- 5. no second hand, lighter home, reduced motion ----------------
{
  const P = page(at(10, 8, 20)), el = draw(P, 360, 360, { seconds: false });
  ok(!sweep(el), "seconds: false = no second hand");
  const Q = page(at(10, 8, 20)); Q.sb.document.documentElement.classList.add("lighter");
  const e2 = draw(Q, 360, 360), g = sweep(e2);
  ok(g.getAttribute("transform") === "rotate(120 50 50)" && delay(g) === null, "lighter home: the hand sits at 120 degrees and ticks, no sweep delay");
  Q.D.set(at(10, 8, 21)); Q.tick();
  ok(g.getAttribute("transform") === "rotate(126 50 50)", "lighter home: a tick moves it one second");
  const R = page(at(10, 8, 20)); R.sb.matchMedia = (q) => ({ matches: /reduce/.test(q) });
  const g3 = sweep(draw(R, 360, 360));
  ok(g3.getAttribute("transform") === "rotate(120 50 50)", "reduced motion: the same, stepped");
}

// ---------------- 6. the colours ----------------
{
  const P = page(at(10, 8, 20)), el = draw(P, 360, 360, {}, { accent: "#33c3ff" });
  ok(all(el).some((e) => e.getAttribute("stroke") === "#33c3ff"), "the widget accent colours the second hand");
  ok(all(sweep(draw(page(at(10, 8, 20)), 360, 360))).some((e) => e.getAttribute("stroke") === "#ff6a3d"), "no accent: the old orange");
}

// ---------------- 7. light ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8"), block = css.slice(css.indexOf("Analogue clock (widgets.js R.analog)"));
  const fr = block.match(/@keyframes cw-an-sweep \{.*?\} \}/g) || [];
  ok(fr.length === 1 && /rotate\(0deg\)/.test(fr[0]) && /rotate\(360deg\)/.test(fr[0]) && !/(left|top|width|height|opacity|filter)\s*:/.test(fr[0].replace(/@keyframes[^{]*\{/, "")), "one keyframe set: a full turn of transform, nothing else");
  ok(/animation: cw-an-sweep 60s linear infinite/.test(block), "60 s a turn, linear");
  ok(!/(filter|box-shadow|blur)\s*[:(]/.test(block), "no filter, blur or shadow");
  ok(/html\.lighter \.cw-an-s/.test(block) && /prefers-reduced-motion: reduce\) \{ \.cw-an-s/.test(block), "lighter home + reduced motion switch the sweep off");
  const js = fs.readFileSync(path.join(web, "widgets.js"), "utf8"), body = js.slice(js.indexOf("R.analog = function"), js.indexOf("R.flipclock = function"));
  ok(!/setInterval|setTimeout|requestAnimationFrame/.test(body) && /live\(root, 30000/.test(body), "no timer of its own: the loader's tick every 30 s, down from every second");
}

done();
