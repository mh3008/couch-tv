// The Orrery widget (feat/orrery): the eight planets round the sun at their real heliocentric longitudes, worked out from their J2000 orbital
// elements (mean longitude + the equation of the centre), seen from above the north pole; pace "now" (still, the sun breathing) or "spin"
// (a time-lapse, one second = one day, tied to the wall clock so a redraw never jumps). No live calls, no data. Checks the maths against
// known facts, the drawing at every size, the moving parts (transform + opacity only) and the design.js options.
// Run: node tests/test_widget_orrery.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Orrery");
const NOW = Date.UTC(2026, 10, 22, 12, 0);
const T = K.home(NOW);
const W = T.W, k = W.kit;
console.log("Running Orrery tests...");

// ---------------- 1. the maths ----------------
const P = Object.fromEntries(k.PLANETS.map((p) => [p[0], p]));
const at = (name, ms) => k.planetAt(P[name], ms);
const diff = (a, b) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return Math.min(d, 360 - d); };
ok(k.PLANETS.length === 8 && k.PLANETS.map((p) => p[0]).join() === "Mercury,Venus,Earth,Mars,Jupiter,Saturn,Uranus,Neptune", "the eight planets, in order out from the sun");
// the Sun's ecliptic longitude seen from Earth is Earth's heliocentric longitude + 180: ~0 deg at the March equinox, ~90 at the June solstice
const eq = Date.UTC(2026, 2, 20, 14, 46), sol = Date.UTC(2026, 5, 21, 8, 24), dec = Date.UTC(2026, 11, 21, 20, 50);
ok(diff(at("Earth", eq) + 180, 0) < 1.5, "Earth at the March 2026 equinox: the Sun at 0 deg (" + ((at("Earth", eq) + 180) % 360).toFixed(2) + ")");
ok(diff(at("Earth", sol) + 180, 90) < 1.5, "the June 2026 solstice: the Sun at 90 deg (" + ((at("Earth", sol) + 180) % 360).toFixed(2) + ")");
ok(diff(at("Earth", dec) + 180, 270) < 1.5, "the December 2026 solstice: the Sun at 270 deg (" + ((at("Earth", dec) + 180) % 360).toFixed(2) + ")");
ok(diff(at("Earth", NOW), at("Earth", NOW + 365.256 * 86400000)) < 0.1, "a year later Earth is back where it was");
ok(diff(at("Mars", NOW), at("Mars", NOW + 686.98 * 86400000)) < 0.2 && diff(at("Mercury", NOW), at("Mercury", NOW + 87.969 * 86400000)) < 0.3, "Mars and Mercury come round on their own periods");
const move = (n) => diff(at(n, NOW + 86400000), at(n, NOW));
ok(move("Mercury") > move("Venus") && move("Venus") > move("Earth") && move("Earth") > move("Mars") && move("Mars") > move("Jupiter") && move("Jupiter") > move("Neptune"), "the further out, the slower (Kepler)");
ok(k.PLANETS.every((p) => { const a = k.planetAt(p, NOW); return a >= 0 && a < 360; }), "every longitude in 0-360");
// the equation of the centre matters for Mercury and Mars (eccentric): it moves them off their mean longitude by up to ~23 / ~11 deg
ok(k.PLANETS.find((p) => p[0] === "Mercury")[3] > 0.2 && k.PLANETS.find((p) => p[0] === "Venus")[3] < 0.01, "Mercury's orbit eccentric, Venus's nearly round");

// ---------------- 2. the time-lapse clock ----------------
const mid = new Date(NOW); mid.setHours(0, 0, 0, 0);
ok(k.spinDate(mid.getTime()) === mid.getTime(), "spin: at midnight the time-lapse shows the real day");
ok(k.spinDate(mid.getTime() + 10000) === mid.getTime() + 10 * 86400000, "spin: 10 seconds later it is 10 days on (1 s = 1 day)");
ok(k.spinDate(NOW + 1000) - k.spinDate(NOW) === 86400000, "spin: continuous, so a redraw lands where the turning planets already are");

// ---------------- 3. drawing it ----------------
// the fake DOM has no innerHTML: a small dump of tags, classes, styles and data-planet, enough for the structure checks below
const dump = (e) => !e || e.nodeType === 3 ? "" : "<" + String(e.tagName || "").toLowerCase() + (e.className ? ' class="' + e.className + '"' : "") +
  (e.style && e.style.cssText ? ' style="' + e.style.cssText + '"' : "") + (e.attrs && e.attrs["data-planet"] ? ' data-planet="' + e.attrs["data-planet"] + '"' : "") + ">" +
  (e.childNodes || []).map(dump).join("") + "</" + String(e.tagName || "").toLowerCase() + ">";
const env = { data: {} };
K.sizes(T.C, "orrery").forEach(([id, w, h]) => {
  const el = W.render({ kind: "orrery", w, h }, env);
  const dh = dump(el);
  ok(!el.getAttribute("data-empty") && /cw-orb-sun/.test(dh) && (dh.match(/data-planet=/g) || []).length === 8, "orrery " + id + ": the sun and eight planets");
});
const big = W.render({ kind: "orrery", w: 460, h: 460 }, env), html = dump(big);
ok(/The planets today/.test(big.textContent) && /not to scale/.test(big.textContent), "now: says it is today, and that the rings are not to scale");
ok(/cw-orb-sun/.test(html) && !/cw-orb-go/.test(html), "now: the sun breathes, the planets stand still");
ok(html.indexOf('data-planet="Saturn"') > 0 && /cw-orb-ringed/.test(html) && /cw-orb-you/.test(html), "Saturn has its ring, Earth its 'you are here' ring");
const spin = W.render({ kind: "orrery", w: 460, h: 460, opts: { pace: "spin" } }, env), sh = dump(spin);
ok(/1 day a second/.test(spin.textContent) && (sh.match(/cw-orb-go/g) || []).length === 8, "spin: every planet's spinner turns, labelled 1 day a second");
const durs = [...sh.matchAll(/cw-orb-go[^>]*?animation-duration:([\d.]+)s/g)].map((m) => +m[1]);
ok(durs.length === 8 && Math.abs(durs[2] - 365.3) < 0.5 && Math.abs(durs[0] - 88) < 0.5 && durs.every((d, i) => !i || d > durs[i - 1]), "spin: one lap per orbital period in seconds (Mercury 88 s, Earth 365 s, outwards slower)");
ok(/class="cw-orb-arm"[^>]*rotate\(-?[\d.]+deg\)[^>]*><i class="cw-orb-arm cw-orb-go"/.test(sh), "spin: a still arm for the place, a spinner inside it for the turn (no animation-composition)");

// ---------------- 4. CSS, design.js ----------------
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8"), block = css.slice(css.indexOf("/* Orrery"));
const kfs = (block.match(/@keyframes[^{]*\{[^@]*\}\s*\}/g) || []).join("");
ok(/cw-orb-glow/.test(kfs) && /cw-orb-turn/.test(kfs) && !/(left|top|width|height|margin|background)\s*:/.test(kfs.replace(/transform:[^;}]*|opacity:[^;}]*/g, "")), "widgets.css: the moving parts use transform + opacity only");
ok(!/animation-composition|filter|blend/.test(block), "widgets.css: no animation-composition, filter or blend");
ok(/html\.lighter \.cw-orb-sun, html\.lighter \.cw-orb-go/.test(block) && /prefers-reduced-motion/.test(block), "still on the Lighter home and with reduced motion");
const CD = K.design();
ok(K.kept(CD, "orrery", { pace: "spin", label: "Sky" }).pace === "spin", "design.js: orrery keeps pace spin");
ok(K.kept(CD, "orrery", { pace: "warp" }).pace === undefined, "design.js: an unknown pace is dropped (now)");
done();
