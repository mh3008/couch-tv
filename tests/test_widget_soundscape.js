// The Soundscape card (widgets.js R.soundscape, widgets.css .cw-snd-*): a flame for the fire (it was a lightning bolt), the new mixes,
// falling rain / a flickering flame / a playing glow and a volume bar while it plays (only then), a card that listens to
// Soundscape.onChange and never leaks a listener, and a stylesheet that moves nothing but transform and opacity.
// Run: node tests/test_widget_soundscape.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Soundscape card");
const web = path.join(__dirname, "../tv-home/web");

console.log("Running Soundscape card tests...");

// a Soundscape stand-in: the state the card reads, and the listeners it adds
function fakeSnd(first) {
  const s = { st: Object.assign({ type: "off", mix: "off", vol: 0.5, ceiling: 0.3, effective: 0, fadeEnds: 0, fadeStarted: 0, fadeSecs: 0 }, first || {}), ls: [] };
  s.state = () => Object.assign({}, s.st);
  s.onChange = (fn) => { s.ls.push(fn); return () => { const i = s.ls.indexOf(fn); if (i >= 0) s.ls.splice(i, 1); }; };
  s.set = (o) => { Object.assign(s.st, o); s.ls.slice().forEach((f) => f(s.state())); };
  return s;
}
const names = [];
function home() {
  const T = K.home(Date.UTC(2026, 10, 21, 12));
  T.sb.TVIcons = { svg: (style, name) => { names.push(name); return "<svg></svg>"; } };
  return T;
}
const draw = (T, w, h, opts, env) => T.W.render({ kind: "soundscape", w, h, opts: opts || {} }, env || {});
const text = (el) => el.textContent;
const has = (el, c) => el.all().filter((e) => (e._cls || []).indexOf(c) >= 0);
const on = (el) => (el._cls || []).indexOf("cw-snd-on") >= 0;

const SOUNDS = ["rain", "fire", "waves", "brown", "rainfire", "window", "storm", "match"];

// ---------------- 1. every sound draws, idle, in both sizes ----------------
SOUNDS.forEach((snd) => [[160, 160, "tile"], [360, 160, "wide tile"]].forEach(([w, h, id]) => {
  const T = home();
  const el = draw(T, w, h, { sound: snd });
  ok(el.getAttribute("data-empty") !== "1" && !/undefined|NaN|null/.test(text(el)), snd + " " + id + ": draws, no stray words (" + JSON.stringify(text(el)) + ")");
  ok(el.getAttribute("data-act") === "sound" && el.getAttribute("data-arg") === snd, snd + " " + id + ": OK plays THIS card's mix (act sound, arg " + el.getAttribute("data-arg") + ")");
  ok(!on(el) && has(el, "cw-snd-fx").length === 1, snd + " " + id + ": idle = the plain card, nothing moving (the motion waits for .cw-snd-on)");
  ok(has(el, "cw-snd-vol").length === 1, snd + " " + id + ": the volume bar is there, hidden until it plays");
}));

// ---------------- 2. the icons: a flame for the fire ----------------
{
  names.length = 0;
  draw(home(), 160, 160, { sound: "fire" }); draw(home(), 160, 160, { sound: "rainfire" }); draw(home(), 160, 160, { sound: "storm" }); draw(home(), 160, 160, { sound: "window" });
  ok(names.join() === "flame,flame,storm,rain", "icons: Fire and Rain + fire draw a FLAME (not a bolt), Storm a storm cloud, Window rain a rain cloud (" + names.join() + ")");
  const sb = { window: {}, document: { documentElement: {} } }; sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(web, "icon-sets.js"), "utf8"), sb);
  const TI = sb.window.TVIcons;
  const styles = ["line", "solid", "duotone", "tile", "glass", "playful"];
  ok(styles.every((s) => { const f = TI.svg(s, "flame", 56, "currentColor"), b = TI.svg(s, "bolt", 56, "currentColor"); return /^<svg[\s>]/.test(f) && f !== b && !/<script|\son[a-z]+\s*=|javascript:/i.test(f); }), "the flame icon exists in all six icon styles and is plain svg, not the bolt");
  ok(TI.concepts.some((i) => i.id === "flame" && i.group === "weather"), "the flame is in the icon list the designer shows (weather group)");
}

// ---------------- 3. the card comes alive while it plays ----------------
{
  const T = home(), S = fakeSnd();
  T.sb.Soundscape = S;
  const el = draw(T, 360, 160, { sound: "rain" });
  ok(!on(el) && /Soundscape/.test(text(el)), "playing: idle it says Soundscape");
  S.set({ type: "rain", mix: "rain", vol: 0.5, effective: 0.5 });
  ok(on(el) && /Playing/.test(text(el)), "playing: starting the mix turns the card on and says Playing");
  const w = (el.all().filter((e) => (e._cls || []).indexOf("cw-snd-volw") >= 0)[0].style.cssText.match(/width:(\d+)%/) || [])[1];
  ok(+w === 50, "playing: the volume bar shows the volume (" + w + "%)");
  S.set({ effective: 0.8, vol: 0.8 });
  ok(el.all().filter((e) => (e._cls || []).indexOf("cw-snd-volw") >= 0)[0].style.cssText.indexOf("width:80%") >= 0, "playing: and follows it");
  S.set({ type: "fire", mix: "fire" });
  ok(!on(el) && /Soundscape/.test(text(el)), "playing: another mix starting turns this card off (it is not the one playing)");
  S.set({ type: "rain", mix: "rain", effective: 0.4, vol: 0.4, fadeStarted: T.D.now() - 60000, fadeEnds: T.D.now() + 1740000, fadeSecs: 1800 });
  const volf = el.all().filter((e) => (e._cls || []).indexOf("cw-snd-volf") >= 0)[0];
  ok(/Fading out/.test(text(el)) && /cw-snd-fadevol 1800s linear -60\.0s 1 forwards/.test(volf.style.cssText), "playing: a fade out shows: the bar empties by itself with one CSS animation of the whole fade, started 60 s in (" + volf.style.cssText.slice(0, 60) + ")");
  S.set({ type: "off", mix: "off", effective: 0, fadeEnds: 0 });
  ok(!on(el) && volf.style.cssText === "", "playing: stopped = back to the plain card");
}
// match shows what it matched
{
  const T = home(), S = fakeSnd();
  T.sb.Soundscape = S;
  const el = draw(T, 360, 160, { sound: "match" });
  ok(/Follows the weather/.test(text(el)), "match: idle it says it follows the weather");
  S.set({ type: "match", mix: "storm", effective: 0.3 });
  ok(/Storm now/.test(text(el)), "match: playing it says what it picked (Storm now)");
  S.set({ mix: "window" }); ok(/Light rain now/.test(text(el)), "match: Light rain now");
  S.set({ mix: "brown" }); ok(/Soft now/.test(text(el)), "match: Soft now");
  S.set({ mix: "rain" }); ok(/Rain now/.test(text(el)), "match: Rain now");
}
// the card's own fade
{
  const T = home();
  const el = draw(T, 360, 160, { sound: "storm", fade: 30 });
  ok(el.getAttribute("data-arg") === "storm:30" && /Fades out in 30 min/.test(text(el)), "fade: a card with fade 30 passes it on and says so (" + el.getAttribute("data-arg") + ")");
  ok(draw(T, 360, 160, { sound: "storm", fade: 60 }).getAttribute("data-arg") === "storm:60", "fade: 60 too");
  ok(draw(T, 360, 160, { sound: "storm", fade: 45 }).getAttribute("data-arg") === "storm", "fade: any other number is no fade");
}

// ---------------- 4. the designer and the gallery show it playing ----------------
SOUNDS.forEach((snd) => {
  const T = home();
  const el = draw(T, 360, 160, { sound: snd }, { demo: true, designer: true });
  ok(on(el) && el.getAttribute("data-empty") !== "1", snd + ": in the designer and the gallery the card is shown playing (a thumbnail should move)");
});
{
  const T = home(), S = fakeSnd(); T.sb.Soundscape = S;
  draw(T, 360, 160, { sound: "rain" }, { demo: true });
  ok(S.ls.length === 0, "the demo card does not listen to anything");
}

// ---------------- 5. what moves in each card ----------------
{
  const T = home();
  const n = (snd, c) => has(draw(T, 360, 160, { sound: snd }), c).length;
  ok(n("rain", "cw-snd-col") === 9 && n("window", "cw-snd-bead") === 5 && n("storm", "cw-snd-col") === 10 && n("rainfire", "cw-snd-col") === 5, "drops: rain 9, window rain 5 slow beads, storm 10, rain + fire 5");
  ok(n("fire", "cw-snd-em") === 4 && n("rainfire", "cw-snd-em") === 3 && n("rain", "cw-snd-em") === 0, "embers: fire 4, rain + fire 3, none in rain");
  ok(n("storm", "cw-snd-flash") === 1 && n("rain", "cw-snd-flash") === 0, "the storm has a flash of lightning, the rain does not");
  ok(n("fire", "cw-snd-flick") === 1 && n("rainfire", "cw-snd-flick") === 1 && n("rain", "cw-snd-flick") === 0, "the flame icon flickers on the fire cards only");
  ok(n("waves", "cw-snd-swell") === 1 && n("brown", "cw-snd-swell") === 1, "waves and brown noise breathe slowly");
  const tile = draw(T, 160, 160, { sound: "rain" }), wide = draw(T, 360, 160, { sound: "rain" });
  ok(!/Soundscape/.test(text(tile)) && /Soundscape/.test(text(wide)), "the small tile has only the name (readable from 3 m), the wide tile has the line too");
  const cols = has(wide, "cw-snd-col").map((c) => c.style.cssText.match(/left:(\d+)%/)[1] * 1);
  ok(cols.every((c) => c >= 8 && c <= 92) && new Set(cols).size === cols.length, "the drops are spread across the card (" + cols.join(",") + "%)");
  const dur = has(wide, "cw-snd-col").map((c) => +c.style.cssText.match(/animation-duration:([\d.]+)s/)[1]);
  ok(new Set(dur).size > 3 && dur.every((d) => d >= 1.1 && d <= 2), "and fall at different speeds (" + dur.join(",") + " s)");
}

// ---------------- 6. no listener leaks ----------------
{
  const T = home(), S = fakeSnd(); T.sb.Soundscape = S;
  const root = draw(T, 360, 160, { sound: "rain" });
  ok(S.ls.length === 1, "one listener per card");
  // the home draws a widget again into the same box: the old listener goes
  const rootAgain = T.W.render({ kind: "soundscape", w: 360, h: 160, opts: { sound: "rain" } }, {});
  ok(S.ls.length === 2, "two cards = two listeners");
  // a card that is no longer on the page stops listening on the next change
  T.sb.document.body = { contains: (x) => x === root };
  S.set({ type: "rain", mix: "rain", effective: 0.5 });
  ok(S.ls.length === 2, "a card on the page keeps listening");
  T.sb.document.body = { contains: () => false };
  S.set({ effective: 0.4 });
  ok(S.ls.length === 1, "a card that was on the page and is gone stops listening (" + S.ls.length + " left: the one never shown)");
  const T2 = home(); T2.sb.Soundscape = undefined;
  ok(draw(T2, 360, 160, { sound: "rain" }).getAttribute("data-empty") !== "1", "without Soundscape (a preview) the card still draws");
}

// ---------------- 7. the stylesheet moves nothing but transform and opacity, and only while playing ----------------
{
  const css = fs.readFileSync(path.join(web, "widgets.css"), "utf8");
  const from = css.indexOf("/* Soundscape card");
  const sec = css.slice(from);
  const frames = {}, re = /@(?:-webkit-)?keyframes\s+(cw-snd-[a-z]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
  let m;
  while ((m = re.exec(sec))) {
    const props = (frames[m[1]] = frames[m[1]] || new Set());
    m[2].replace(/\{([^}]*)\}/g, (_, body) => { body.split(";").forEach((d) => { const p = d.split(":")[0].trim(); if (p) props.add(p); }); return ""; });
  }
  const ks = Object.keys(frames);
  ok(ks.length === 8, "eight keyframe sets (glow, fall, bead, ember, flick, flash, swell, fadevol): " + ks.join(","));
  const moved = new Set(); ks.forEach((k) => frames[k].forEach((p) => moved.add(p)));
  ok([...moved].every((p) => /^(-webkit-)?transform$|^opacity$/.test(p)), "the card animates only transform and opacity (" + [...moved].join(", ") + "): no layout, no repaint");
  ok((sec.match(/@-webkit-keyframes/g) || []).length === (sec.match(/@keyframes/g) || []).length, "every keyframe set is prefixed for older WebViews too");
  const rules = sec.split("}").map((r) => r.trim()).filter((r) => /animation\s*:/.test(r) && !/none/.test(r) && !/^@/.test(r) && !/keyframes/.test(r.split("{")[0]));
  const loose = rules.filter((r) => !/\.cw-snd-on /.test(r.split("{")[0]));
  ok(rules.length === 7 && loose.length === 0, "every animation runs only under .cw-snd-on (" + rules.length + " rules): an idle card costs nothing" + (loose.length ? " LOOSE: " + loose[0].slice(0, 60) : ""));
  ok(/html\.lighter \.cw-snd-fx \*/.test(sec) && /prefers-reduced-motion: reduce\) \{ \.cw-snd-fx \*/.test(sec), "still on the Lighter home and when the TV asks for less motion");
  ok(!/(^|[^-])filter\s*:|backdrop-filter|box-shadow\s*:[^;]*0 0 \d+px \d+px[^;]*;[^}]*animation/.test(sec.replace(/html\.lighter[^}]*\}/, "")), "no filter in the card's styles");
}

// ---------------- 8. the design and the setup record ----------------
{
  const CD = K.design();
  SOUNDS.forEach((s) => ok(K.kept(CD, "soundscape", { sound: s }).sound === s, "a design keeps sound: " + s));
  const k = K.kept(CD, "soundscape", { sound: "storm", fade: 30, url: "x", volume: 9 });
  ok(k.sound === "storm" && k.fade === 30 && k.url === undefined && k.volume === undefined, "a design keeps the sound and the fade, nothing else");
  ok(K.kept(CD, "soundscape", { sound: "storm", fade: 45 }).fade === undefined && K.kept(CD, "soundscape", { sound: "nope" }).sound === undefined, "a fade that is not 30 or 60, and a sound that is not one of ours, are dropped");
  const T = home();
  const cap = T.C.get("soundscape");
  ok(cap.status === "works" && T.C.need("soundscape", "Google TV") === "works" && T.C.need("soundscape", "VIDAA") === "works", "widget-caps: works on every TV");
  ok(cap.sizes.s.join() === "tile,wtile" && cap.sizes.min.join() === "2,2", "sizes: 2x2 and 4x2");
  ok(/rain on a window/.test(cap.what) && /storm/.test(cap.what) && /weather/.test(cap.what), "widget-caps: says what it can play");
}
done();
