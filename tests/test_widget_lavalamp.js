// The Lava lamp widget (widgets.js R.lavalamp, widgets.css .cw-lv-*): a decorative glass lamp with slow wax blobs in the
// design's own colour; one lamp in a tall box, up to three in a wide one; moved by the stylesheet alone (transform and
// opacity), standing still on a lighter home / reduced motion, no timer, no filter.
// Run: node tests/test_widget_lavalamp.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Lava lamp");
const web = path.join(__dirname, "../tv-home/web");

console.log("Running Lava lamp tests...");

const T = K.home(Date.UTC(2026, 10, 21, 12));
const LOOK = { panel: "rgba(65, 11, 61, 0.66)", rim: "rgba(229, 108, 219, 0.34)", accent: "#F76EEC", ink: "#FAF5FA" };
const draw = (w, h, env, style) => T.W.render({ kind: "lavalamp", w, h, opts: {}, style: Object.assign({ panel: "none" }, style || {}) }, env || { look: LOOK });
const has = (el, c) => el.all().filter((e) => (e._cls || []).indexOf(c) >= 0);
const num = (s, k) => { const m = new RegExp("(?:^|;)" + k + ":(-?[\\d.]+)px").exec(s); return m ? parseFloat(m[1]) : NaN; };

// ---------------- 1. draws at every size ----------------
const shown = {};
K.sizes(T.C, "lavalamp").forEach(([id, w, h]) => {
  const el = draw(w, h);
  const lamps = has(el, "cw-lv");
  shown[id] = lamps.length;
  ok(lamps.length >= 1 && lamps.length <= 3, "lavalamp " + id + " (" + w + "x" + h + "): 1 to 3 lamps (" + lamps.length + ")");
  lamps.forEach((l) => {
    ok(has(l, "cw-lv-b").length === 5 && has(l, "cw-lv-pool").length === 1 && has(l, "cw-lv-tube").length === 1 && has(l, "cw-lv-cap").length === 1 && has(l, "cw-lv-base").length === 1 && has(l, "cw-lv-glow").length === 1,
      id + ": a lamp = glass tube, 5 blobs, a wax pool, cap, base and a glow");
    const lw = num(l.style.cssText, "width"), lh = num(l.style.cssText, "height");
    ok(lw > 0 && lh > lw * 2 && lh <= h + 0.5, id + ": the lamp is " + Math.round(lw) + "x" + Math.round(lh) + " px, inside the " + h + " px box and taller than wide");
  });
  ok(lamps.length * (num(lamps[0].style.cssText, "width") * 1.24) <= w + 1, id + ": the lamps fit across the " + w + " px box");
  ok(!/undefined|NaN|null/.test(el.all().map((e) => e.style.cssText || "").join(" ")), id + ": no NaN or undefined in any style");
  ok(el.textContent === "", id + ": no words at all (decorative)");
});
ok(shown.small === 1 && shown.tall === 1 && shown.wide === 3, "a square or tall box gets one lamp, a wide box three (small " + shown.small + ", tall " + shown.tall + ", wide " + shown.wide + ")");

// ---------------- 2. the design's colour ----------------
{
  const el = draw(360, 560), css = el.all().map((e) => e.style.cssText || "").join("\n");
  ok(/rgba\(247, 110, 236/.test(css), "the blobs are the design's accent (247, 110, 236)");
  ok(/rgba\(65, 11, 61, 0\.55\)/.test(css), "the glass is look.panel");
  ok(css.indexOf("border:2px solid rgba(229, 108, 219, 0.34)") >= 0, "the tube rim is look.rim");
  const own = draw(360, 560, { look: LOOK }, { accent: "#33c3ff" }), c2 = own.all().map((e) => e.style.cssText || "").join("\n");
  ok(/rgba\(51, 195, 255/.test(c2) && !/rgba\(247, 110, 236/.test(c2), "a widget accent beats the look's");
  const bare = draw(360, 560, {}), c3 = bare.all().map((e) => e.style.cssText || "").join("\n");
  ok(/rgba\(255, 106, 61/.test(c3), "no look at all: the default orange");
}

// ---------------- 3. the lamps are out of step ----------------
{
  const el = draw(760, 360), ls = has(el, "cw-lv");
  const delays = ls.map((l) => has(l, "cw-lv-b").map((b) => /animation-delay:(-[\d.]+s)/.exec(b.style.cssText)[1]).join(","));
  ok(new Set(delays).size === ls.length, "each of the " + ls.length + " lamps has its own blob phases");
  const one = has(ls[0], "cw-lv-b").map((b) => /animation-delay:(-[\d.]+s)/.exec(b.style.cssText)[1]);
  ok(new Set(one).size === 5 && one.every((d) => parseFloat(d) <= 0 && parseFloat(d) > -24), "the five blobs of a lamp start at five different points of the 24 s cycle");
}

// ---------------- 4. the stylesheet moves nothing but transform and opacity ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
  const from = css.indexOf("Lava lamp (widgets.js R.lavalamp)");
  const block = css.slice(from);
  const frames = block.match(/@keyframes cw-lv-[a-z0-9]+ \{.*?\} \}/g) || [];
  ok(frames.length === 7, "7 keyframe sets (5 blobs, pool, glow): " + frames.length);
  ok(frames.every((f) => !/(left|top|right|bottom|width|height|margin|padding|filter|box-shadow|background|border)[a-z-]*\s*:/.test(f.replace(/@keyframes[^{]*\{/, ""))), "keyframes touch only transform and opacity");
  ok(!/(filter|backdrop-filter|box-shadow|mix-blend-mode|blur)\s*[:(]/.test(block), "no filter, blur, blend or shadow anywhere in the lamp's css");
  const rules = block.split("\n").filter((l) => /^\.cw-lv/.test(l)).join("\n");
  ok(!/will-change: (?!transform)/.test(rules), "will-change only ever names transform");
  ok(/html\.lighter \.cw-lv-b, html\.lighter \.cw-lv-pool, html\.lighter \.cw-lv-glow \{[^}]*animation: none/.test(block), "Lighter home: the animations are off");
  ok(/prefers-reduced-motion: reduce\) \{ \.cw-lv-b, \.cw-lv-pool, \.cw-lv-glow \{[^}]*animation: none/.test(block), "reduced motion: the animations are off");
  ok([1, 2, 3, 4, 5].every((i) => new RegExp("html\\.lighter \\.cw-lv-" + i + " \\{[^}]*translate").test(block)), "on a lighter home each blob stands part-way up (not all piled at the bottom)");
  const secs = block.match(/animation: [^;]*?(\d+)s/g) || [];
  ok(secs.every((s) => 24 % parseInt(/(\d+)s/.exec(s)[1], 10) === 0 || /alternate/.test(s) && 24 % (2 * parseInt(/(\d+)s/.exec(s)[1], 10)) === 0), "every cycle divides 24 s, so a clip at 3x loops in 8 s (" + secs.join(" | ") + ")");
}

// ---------------- 5. light: layer area and timers ----------------
{
  const w = 760, h = 560, el = draw(w, h), blobs = has(el, "cw-lv-b");
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
  const size = {}; [1, 2, 3, 4, 5].forEach((i) => { size[i] = parseInt(new RegExp("\\.cw-lv-" + i + " \\{ left: \\d+%; width: (\\d+)%").exec(css)[1], 10) / 100; });
  const lw = num(has(el, "cw-lv")[0].style.cssText, "width");
  const area = has(el, "cw-lv").length * [1, 2, 3, 4, 5].reduce((a, i) => a + Math.pow(size[i] * lw, 2), 0);
  ok(blobs.length === has(el, "cw-lv").length * 5 && area / (1920 * 1080) < 0.08, "the moving blobs add up to " + (100 * area / (1920 * 1080)).toFixed(2) + " % of a 1080p screen (the bubbles effect was held to 4-8 %, three lamps in a 760 px box is the worst case)");
  const js = fs.readFileSync(path.join(web, "widgets.js"), "utf8");
  const blk = js.slice(js.indexOf("R.lavalamp = function"), js.indexOf("function arc(f)"));
  ok(!/setInterval|setTimeout|requestAnimationFrame|live\(/.test(blk), "the lamp has no timer and no live() tick: the stylesheet does all the moving");
}

// ---------------- 6. design.js and the capability record ----------------
{
  const CD = K.design();
  const kept = JSON.parse(JSON.stringify(CD.sanitize({ objects: [{ id: "l", type: "widget", kind: "lavalamp", opts: { label: "x", speed: 5 } }] })));
  ok(kept.objects.length === 1 && kept.objects[0].kind === "lavalamp", "design.js accepts the kind lavalamp");
  ok(JSON.stringify(kept.objects[0].opts || {}) === "{}", "it takes no options: any opts are dropped (" + JSON.stringify(kept.objects[0].opts) + ")");
  const c = T.C.get("lavalamp");
  ok(c && c.status === "works" && /^[A-Z]/.test(c.name) && c.sizes.min[0] === 2 && c.sizes.min[1] === 4, "widget-caps: a record, works, minimum 2x4");
  ok(c.ok.indexOf("Nothing") === 0, "OK does nothing: it is to look at");
}

done();
