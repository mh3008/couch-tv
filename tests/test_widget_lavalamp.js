// The Lava lamp widget (widgets.js R.lavalamp, widgets.css .cw-lv-*): a decorative glass lamp in the design's own colour,
// built from pre-rendered SVG sprites (opaque glass body with a warm glow, chrome cap + base, glossy wax blobs, a wax pool,
// and "neck" sprites that make the blobs visibly merge and split); moved by the stylesheet alone (transform and opacity),
// standing still on a lighter home / reduced motion, no timer, no filter. One lamp in any box.
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
// the sprites are inline SVG pictures in a url("data:image/svg+xml,...") background: decode them to read their stops and shapes
const picOf = (e) => { const m = /url\("data:image\/svg\+xml,([^"]*)"\)/.exec((e && e.style.cssText) || ""); return m ? decodeURIComponent(m[1]) : ""; };
const pics = (el) => el.all().concat([el]).map(picOf).filter(Boolean);
const allCss = (el) => el.all().map((e) => e.style.cssText || "").join("\n");
const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
const block = css.slice(css.indexOf("Lava lamp (widgets.js R.lavalamp)"));

// ---------------- 1. draws at every size ----------------
const shown = {};
K.sizes(T.C, "lavalamp").forEach(([id, w, h]) => {
  const el = draw(w, h);
  const lamps = has(el, "cw-lv");
  shown[id] = lamps.length;
  ok(lamps.length === 1, "lavalamp " + id + " (" + w + "x" + h + "): exactly one lamp");
  const l = lamps[0];
  ok(has(l, "cw-lv-b").length === 4 && has(l, "cw-lv-n").length === 5 && has(l, "cw-lv-pool").length === 1 && has(l, "cw-lv-back").length === 1 &&
    has(l, "cw-lv-stage").length === 1 && has(l, "cw-lv-bulb").length === 1 && has(l, "cw-lv-halo").length === 1,
    id + ": a lamp = back picture (cap, glass, base), 4 blobs, 5 necks, a wax pool, a bulb glow and a halo");
  const lw = num(l.style.cssText, "width"), lh = num(l.style.cssText, "height");
  ok(lw > 0 && Math.abs(lh - lw * 2.56) < 1 && lh <= h + 0.5 && lw <= 230, id + ": the lamp is " + Math.round(lw) + "x" + Math.round(lh) + " px (2.56 tall), inside the " + h + " px box, at most 230 wide");
  ok(lw * 1.3 <= w + 1, id + ": it fits across the " + w + " px box with its halo room");
  const hl = has(l, "cw-lv-halo")[0].style.cssText, hm = num(hl, "left");
  ok(-hm <= (w - lw) / 2 && -hm <= lw * 0.28 + 1, id + ": the halo stays inside the box (" + Math.round(-hm) + " px each side)");
  ok(!/undefined|NaN|null/.test(allCss(el)) && pics(el).every((s) => !/undefined|NaN|null/.test(s)), id + ": no NaN or undefined in any style or picture");
  ok(el.textContent === "", id + ": no words at all (decorative)");
});
ok(Object.keys(shown).length >= 4 && Object.values(shown).every((n) => n === 1), "every size gets one lamp (the moving layers stay in budget)");

// ---------------- 2. opaque glass, the design's colour ----------------
{
  const el = draw(360, 560), back = picOf(has(el, "cw-lv-back")[0]);
  ok(/id="lq"/.test(back) && /url\(#lq\)/.test(back), "the glass body is filled with the liquid gradient");
  const lq = /<linearGradient id="lq"[^>]*>(.*?)<\/linearGradient>/.exec(back)[1];
  ok(!/stop-opacity/.test(lq) && (lq.match(/<stop /g) || []).length === 3, "the liquid gradient has no transparency at any stop: the photo cannot show through the glass");
  ok(/<path d="M[^"]*Z" fill="url\(#lq\)"\/>/.test(back), "the liquid fills the whole glass outline (one closed path)");
  const dark = /offset="0" stop-color="(#[0-9a-f]{6})"/.exec(lq)[1], r = parseInt(dark.slice(1, 3), 16), g = parseInt(dark.slice(3, 5), 16), b = parseInt(dark.slice(5, 7), 16);
  ok(r < 60 && g < 60 && b < 60, "the liquid is deep and dark (" + dark + "), so the wax reads against it");
  ok(/id="lm"/.test(back) && /M28,19 C28,7/.test(back) && /M24,208 L76,208/.test(back), "a chrome cap and a flared chrome base are drawn in the same picture");
  const all = pics(el).join("\n") + allCss(el);
  ok(/#f76eec/.test(all) && /rgba\(247, 110, 236/.test(allCss(el)), "wax and glow are the design's accent (#f76eec)");
  const own = draw(360, 560, { look: LOOK }, { accent: "#33c3ff" }), c2 = pics(own).join("\n");
  ok(/#33c3ff/.test(c2) && !/#f76eec/.test(c2), "a widget accent beats the look's");
  const c3 = pics(draw(360, 560, {})).join("\n");
  ok(/#ff6a3d/.test(c3), "no look at all: the default orange");
  const blob = picOf(has(el, "cw-lv-b")[0]);
  ok(/<circle[^>]*fill="url\(#w\)"/.test(blob) && /<ellipse[^>]*fill="url\(#s\)"/.test(blob) && /fill="url\(#r\)"/.test(blob), "a blob is shaded: a body gradient, a glossy highlight and a warm rim light");
}

// ---------------- 3. the stylesheet moves nothing but transform and opacity ----------------
const kf = {};
block.split(/\r?\n/).filter((l) => /^@keyframes cw-lv-/.test(l)).forEach((l) => { kf[/@keyframes (cw-lv-[a-z0-9]+)/.exec(l)[1]] = l; });
{
  const names = Object.keys(kf).sort();
  ok(names.join(",") === "cw-lv-bulb,cw-lv-k1,cw-lv-k2,cw-lv-k3,cw-lv-k4,cw-lv-n1,cw-lv-n2,cw-lv-n3,cw-lv-n4,cw-lv-n5,cw-lv-pool", "11 keyframe sets: 4 blobs, 5 necks, the pool, the bulb (" + names.join(" ") + ")");
  ok(names.every((n) => !/(left|top|right|bottom|width|height|margin|padding|filter|box-shadow|background|border)[a-z-]*\s*:/.test(kf[n].replace(/@keyframes[^{]*\{/, ""))), "keyframes touch only transform and opacity");
  ok(!/(filter|backdrop-filter|box-shadow|mix-blend-mode|blur|clip-path|mask)\s*[:(]/.test(block), "no filter, blur, blend, mask, clip-path or shadow anywhere in the lamp's css");
  const rules = block.split("\n").filter((l) => /^\.cw-lv/.test(l)).join("\n");
  ok(!/will-change: (?!transform|opacity|transform, opacity)/.test(rules), "will-change only ever names transform and / or opacity");
  ok(/html\.lighter \.cw-lv-b, html\.lighter \.cw-lv-n, html\.lighter \.cw-lv-pool, html\.lighter \.cw-lv-bulb \{[^}]*animation: none/.test(block), "Lighter home: the animations are off");
  ok(/prefers-reduced-motion: reduce\) \{ \.cw-lv-b, \.cw-lv-n, \.cw-lv-pool, \.cw-lv-bulb \{[^}]*animation: none/.test(block), "reduced motion: the animations are off");
  ok([1, 2, 3, 4].every((i) => new RegExp("html\\.lighter \\.cw-lv-" + i + " \\{[^}]*translate").test(block)) && /reduce\) \{ \.cw-lv-1 \{[^}]*translate/.test(block), "standing still, each blob is part-way up (not all piled at the bottom)");
  const secs = (block.match(/animation: [^;]*?(\d+)s/g) || []);
  ok(secs.length >= 4 && secs.every((s) => { const n = parseInt(/(\d+)s/.exec(s)[1], 10); return 24 % n === 0 || (/alternate/.test(s) && 24 % (2 * n) === 0); }), "every cycle divides 24 s, so a clip at 3x loops in 8 s (" + secs.join(" | ") + ")");
  ok(!/-webkit-keyframes cw-lv/.test(block), "the keyframes are written once (the stylesheet stays small)");
}

// ---------------- 4. the wax stays inside the glass, and the blobs really merge and split ----------------
{
  const HW = [[0, 21], [0.08, 22.5], [0.25, 28], [0.5, 36], [0.72, 43], [0.86, 47], [0.93, 44.5], [0.98, 38.5], [1, 33]];
  const hw = (u) => { u = Math.max(0, Math.min(1, u)); for (let i = 1; i < HW.length; i++) if (u <= HW[i][0]) { const a = HW[i - 1], b = HW[i], t = (1 - Math.cos(Math.PI * (u - a[0]) / (b[0] - a[0]))) / 2; return a[1] + (b[1] - a[1]) * t; } return 33; };
  const wid = {}; [1, 2, 3, 4].forEach((i) => { wid[i] = parseFloat(new RegExp("\\.cw-lv-" + i + " \\{ width: ([\\d.]+)%").exec(block)[1]); });
  const series = (name) => kf[name].match(/-?[\d.]+% \{[^}]*\}/g).map((s) => ({ t: parseFloat(s), tr: /translate\((-?[\d.]+)%, (-?[\d.]+)%\)/.exec(s), sc: /scale\((-?[\d.]+), (-?[\d.]+)\)/.exec(s), rot: /rotate\((-?[\d.]+)deg\)/.exec(s), op: /opacity: ([\d.]+)/.exec(s) }));
  let worst = 99; const ctr = {};
  [1, 2, 3, 4].forEach((i) => {
    const S = series("cw-lv-k" + i), w = wid[i], r = w / 2; ctr[i] = [];
    ok(S.length === 49 && S[0].t === 0 && S[48].t === 100, "blob " + i + ": 49 keyframes, 0 to 100 %");
    ok(S[0].tr[1] === S[48].tr[1] && S[0].tr[2] === S[48].tr[2], "blob " + i + ": the last keyframe equals the first, so it loops with no jump");
    S.forEach((s) => { const x = parseFloat(s.tr[1]) * w / 100 + r, y = parseFloat(s.tr[2]) * w / 100 + r, re = r * Math.sqrt(parseFloat(s.sc[1]) * parseFloat(s.sc[2])); ctr[i].push([x, y, re]); worst = Math.min(worst, hw(y / 190) - Math.abs(x - 50) - re); });
  });
  ok(worst >= 1, "no blob touches the glass: the nearest edge is " + worst.toFixed(1) + " units from the wall");
  [1, 2, 3, 4, 5].forEach((i) => {
    const S = series("cw-lv-n" + i), op = S.map((s) => parseFloat(s.op[1]));
    ok(S[0].op[1] === S[48].op[1] && S[0].tr[1] === S[48].tr[1], "neck " + i + ": loops with no jump");
    ok(Math.min.apply(null, op) === 0 && Math.max.apply(null, op) >= 0.9, "neck " + i + ": fully gone and fully there in the cycle (it forms and snaps)");
    const on = op.filter((o) => o > 0.1).length / op.length;
    ok(on > 0.1 && on < 0.75, "neck " + i + ": visible " + Math.round(on * 100) + " % of the cycle (not a permanent string)");
    const th = S.filter((s, k) => op[k] > 0.1).map((s) => parseFloat(s.sc[2]));
    ok(Math.max.apply(null, th) > Math.min.apply(null, th) * 1.3, "neck " + i + ": it thickens as the blobs meet and thins as they part (" + Math.min.apply(null, th).toFixed(2) + " to " + Math.max.apply(null, th).toFixed(2) + ")");
  });
  // ---------------- 5. light: layer area and timers ----------------
  let area = 0;   // worst-case boxes of every moving layer, in units^2 of a lamp 100 wide
  [1, 2, 3, 4].forEach((i) => { area += wid[i] * wid[i]; });
  [1, 2, 3, 4, 5].forEach((i) => {
    let m = 0; series("cw-lv-n" + i).forEach((s) => { const a = Math.abs(parseFloat(s.rot[1])) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), L = 50 * parseFloat(s.sc[1]), Hh = 30 * parseFloat(s.sc[2]); m = Math.max(m, (L * c + Hh * sn) * (L * sn + Hh * c)); });
    area += m;
  });
  area += 100 * 36 + 70 * 38;   // the pool and the bulb glow (the glare is part of the still back picture)
  const top = 230 / 100, small = 200 / 100;   // widest lamp (230 px) and a 4x6 box's lamp (200 px)
  const pctTop = 100 * area * top * top / (1920 * 1080), pctTall = 100 * area * small * small / (1920 * 1080);
  ok(pctTop <= 5, "the moving layers add up to " + pctTall.toFixed(2) + " % of a 1080p screen in a 4x6 box and " + pctTop.toFixed(2) + " % at the 230 px cap (budget 5 %)");
  const js = fs.readFileSync(path.join(web, "widgets.js"), "utf8");
  const blk = js.slice(js.indexOf("R.lavalamp = function"), js.indexOf("function arc(f)"));
  ok(!/setInterval|setTimeout|requestAnimationFrame|live\(|createElement\("canvas"\)|getContext|filter|feGaussianBlur|feColorMatrix/.test(blk.replace(/\/\/[^\n]*/g, "")), "the lamp has no timer, no canvas and no filter: the stylesheet does all the moving");
  ok(css.length < 120000 && block.length < 40000, "the lamp's stylesheet block is " + Math.round(block.length / 1000) + " KB");
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
