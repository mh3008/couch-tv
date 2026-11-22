// The flip clock (widgets.js R.flipclock, widgets.css .cw-fl-*): four split-flap cards in the design's glass colour,
// a digit that falls only when it changes, nothing moving at rest, instant change on a lighter home / reduced
// motion, and a stylesheet that moves nothing but transform and opacity.
// Run: node tests/test_widget_flipclock.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const K = require("./web-widgets-kit");
const { fakeDocument, fixedDate } = require("./fake-dom");
const { ok, done } = K.counter("Flip clock");
const web = path.join(__dirname, "../tv-home/web");

console.log("Running Flip clock tests...");

// a page whose 1 s tick we can fire by hand (the real one is the loader's single setInterval)
function page(at) {
  const D = fixedDate(Date); D.set(at);
  let tick = null;
  const sb = { document: fakeDocument(), Date: D, setInterval: (f) => { tick = f; return 1; }, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, console, Promise, JSON, Math };
  sb.window = sb; vm.createContext(sb);
  ["widget-web.js", "widget-caps.js", "widgets.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(web, f), "utf8"), sb, { filename: f }));
  return { W: sb.window.CouchWidgets, D, sb, tick: () => tick() };
}
const draw = (P, w, h, env, style) => {
  const el = P.W.render({ kind: "flipclock", w, h, opts: { format: "24h" }, style: style || {} }, env || {});
  P.sb.document.documentElement.appendChild(el);   // the 1 s tick only serves widgets that are on the page
  return el;
};
const has = (el, c) => el.all().filter((e) => (e._cls || []).indexOf(c) >= 0);
const cards = (el) => has(el, "cw-fl");
const face = (c, part) => has(c, part)[0].textContent;
const digits = (el) => cards(el).map((c) => face(c, "cw-fl-t")).join("");
const at = (h, m, s) => new Date(2026, 10, 21, h, m, s || 0).getTime();   // local time, as the TV reads it

// ---------------- 1. draws at every size, four cards, the right digits ----------------
K.sizes(K.home().C, "flipclock").forEach(([id, w, h]) => {
  const P = page(at(10, 9, 30)), el = draw(P, w, h);
  ok(cards(el).length === 4 && digits(el) === "1009", "flipclock " + id + " (" + w + "x" + h + "): four cards showing 1009 (" + digits(el) + ")");
  ok(has(el, "cw-fl-go").length === 0, id + ": at rest no flap is moving (no cw-fl-go)");
  ok(!/undefined|NaN|null/.test(el.textContent), id + ": no stray words");
  cards(el).forEach((c) => ok(["cw-fl-t", "cw-fl-b", "cw-fl-ft", "cw-fl-fb"].every((k) => has(c, k).length >= 1), id + ": a card has its still halves and its two flaps"));
});

// ---------------- 2. the design's glass colour and ink ----------------
{
  const P = page(at(10, 9, 30));
  const el = draw(P, 760, 300, { look: { panel: "rgba(19, 13, 11, 0.72)", ink: "#F5E6CC", accent: "#F78B1D" } });
  const c = cards(el)[0], st = c.style.cssText;
  ok(st.indexOf("--fl-b:rgb(19, 13, 11)") >= 0, "the card face is the design's panel colour (" + st.match(/--fl-b:[^;]*/) + ")");
  ok(/color:rgba\(245, 230, 204/.test(st), "the digits take look.ink (" + st.match(/;color:[^;]*/) + ")");
  ok(el.all().some((e) => /background:#F78B1D/.test(e.style.cssText || "")), "the two dots take the accent");
  const bad = draw(page(at(10, 9, 30)), 760, 300, { look: { panel: "rgba(240, 240, 240, 0.7)", ink: "#f4f4f4" } });
  ok(!/color:rgba\(244, 244, 244/.test(cards(bad)[0].style.cssText), "ink too close to the face colour is swapped for one that reads");
  const plain = draw(page(at(10, 9, 30)), 760, 300);
  ok(plain.all().length > 0 && cards(plain)[0].style.cssText.indexOf("--fl-b:rgb(31, 31, 35)") >= 0, "no look at all: the old dark card colour");
}

// ---------------- 3. the minute changes: only the digits that change flip ----------------
{
  const P = page(at(10, 9, 30)), el = draw(P, 760, 300);
  P.D.set(at(10, 9, 50)); P.tick();
  ok(has(el, "cw-fl-go").length === 0, "same minute: nothing flips");
  P.D.set(at(10, 10, 0)); P.tick();
  const go = cards(el).map((c) => c._cls.indexOf("cw-fl-go") >= 0);
  ok(go.join() === "false,false,true,true", "10:09 to 10:10: the two minute digits flip, the hour does not (" + go + ")");
  const m = cards(el)[3];
  ok(face(m, "cw-fl-ft") === "9" && face(m, "cw-fl-fb") === "0", "the falling flap shows the old digit (9), the one under it the new (0)");
  ok(has(m, "cw-fl-b")[0].textContent === "9" && has(m, "cw-fl-t")[0].textContent === "0", "the still bottom keeps 9 until the flap lands, the still top already shows 0");
  P.D.set(at(10, 10, 1)); P.tick();   // the next 1 s tick: the 0.6 s flap has landed
  ok(has(el, "cw-fl-go").length === 0 && has(cards(el)[3], "cw-fl-b")[0].textContent === "0", "after 0.8 s the card settles: no flap, bottom shows 0");
  ok(digits(el) === "1010", "digits now 1010 (" + digits(el) + ")");
  P.D.set(at(11, 0, 0)); P.tick();
  ok(digits(el) === "1100" && has(el, "cw-fl-go").length === 2, "10:10 to 11:00: the two digits that differ flip (" + digits(el) + ")");
}

// ---------------- 4. 12 hour, midnight ----------------
{
  const P = page(at(9, 5, 0)), el = draw(P, 760, 300, {}, {});
  el.all();
  const e12 = P.W.render({ kind: "flipclock", w: 760, h: 300, opts: { format: "12h" } }, {});
  ok(digits(e12) === "0905", "12h: 9:05 pads to 0905 as before (" + digits(e12) + ")");
  const P2 = page(at(23, 59, 30)), e2 = draw(P2, 760, 300);
  P2.D.set(at(24, 0, 0)); P2.tick();
  ok(digits(e2) === "0000" && has(e2, "cw-fl-go").length === 4, "23:59 to 00:00: all four flip");
}

// ---------------- 5. lighter home / reduced motion: the digit just changes ----------------
{
  const P = page(at(10, 9, 30)), el = draw(P, 760, 300);
  P.sb.document.documentElement.classList.add("lighter");
  P.D.set(at(10, 10, 0)); P.tick();
  ok(digits(el) === "1010" && has(el, "cw-fl-go").length === 0, "html.lighter: 1010 shown, no flap started");
  const Q = page(at(10, 9, 30)), e2 = draw(Q, 760, 300);
  Q.sb.matchMedia = (q) => ({ matches: /reduce/.test(q) });
  Q.D.set(at(10, 10, 0)); Q.tick();
  ok(digits(e2) === "1010" && has(e2, "cw-fl-go").length === 0, "prefers-reduced-motion: 1010 shown, no flap started");
}

// ---------------- 6. the stylesheet moves nothing but transform and opacity ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
  const frames = css.match(/@keyframes cw-fl-[a-z-]+ \{[^@]*?\} \}/g) || [];
  ok(frames.length === 4, "four keyframe blocks for the flip (" + frames.length + ")");
  ok(frames.every((f) => !/(left|top|width|height|margin|filter|box-shadow|background)\s*:/.test(f.replace(/@keyframes[^{]*\{/, ""))), "keyframes touch only transform / opacity");
  ok(/html\.lighter \.cw-fl-ft/.test(css) && /prefers-reduced-motion: reduce\) \{ \.cw-fl-go/.test(css), "the stylesheet switches the flaps off on a lighter home and for reduced motion");
  ok(!/will-change/.test(css.slice(css.indexOf("the flip clock"), css.indexOf("things typed at home"))), "no will-change: nothing is promoted while at rest");
  const js = fs.readFileSync(path.join(web, "widgets.js"), "utf8");
  const blk = js.slice(js.indexOf("R.flipclock = function"), js.indexOf("R.wordclock = function"));
  ok(!/setInterval|setTimeout|requestAnimationFrame/.test(blk), "the card has no timer of its own (the loader's one 1 s tick does all)");
}

done();
