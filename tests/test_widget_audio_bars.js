// Audio bars (feat/audio-bars): opts.bars on Now playing and Soundscape draws five bars in the accent that dance while sound
// plays (scaleY only); off by default; Now playing only while the song plays; Soundscape only while a sound is on
// (soundscape.js marks html[data-sound]). Still on the Lighter home, the Loop look, with reduced motion; paused when covered.
// Run: node tests/test_widget_audio_bars.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Audio bars");
const T = K.home(new Date(2026, 10, 22, 20, 0, 0).getTime());
const W = T.W;
console.log("Running Audio bars tests...");
const all = (el, out) => { out = out || []; out.push(el); (el.childNodes || []).forEach((c) => all(c, out)); return out; };
const cls = (n) => (n.attrs && n.attrs["class"]) || n.className || "";
const has = (n, c) => (" " + cls(n) + " ").indexOf(" " + c + " ") >= 0;
const count = (el, c) => all(el).filter((n) => has(n, c)).length;
const song = (state) => ({ data: { music: { title: "Low Tide", artist: "Saltwater", state, position: 40, duration: 200 } } });
const np = (opts, state, w, h) => W.render({ kind: "nowplaying", w: w || 800, h: h || 360, opts }, song(state || "playing"));

// Now playing
ok(count(np({}), "cw-eq") === 0, "off by default");
ok(count(np({ bars: true }), "cw-eq") === 1 && count(np({ bars: true }), "cw-eq-b") === 5, "bars: five bars while the song plays");
ok(count(np({ bars: true }, "paused"), "cw-eq") === 0, "paused: no bars");
ok(count(np({ bars: true }, "idle"), "cw-eq") === 0, "stopped: no bars");
ok(count(np({ bars: true }, "playing", 360, 560), "cw-eq") === 1, "the tall layout: bars on the cover");
const tile = np({ bars: true }, "playing", 260, 260);
ok(count(tile, "cw-eq") === 1, "a tile: the bars where the pause button was");
ok(count(np({}, "playing", 260, 260), "cw-eq") === 0, "a tile without bars: as before");
ok(count(W.render({ kind: "nowplaying", w: 800, h: 360, opts: { bars: true } }, { demo: true }), "cw-eq") === 1, "the demo song plays: bars");
// out of step: five different delays, durations that divide 8 s
const bs = all(np({ bars: true })).filter((n) => has(n, "cw-eq-b"));
const css = (n, k) => ((n.style && n.style.cssText) || (n.attrs && n.attrs.style) || "").replace(new RegExp(".*(^|;)" + k + ":(-?[\\d.]+)s.*"), "$2");
const dl = bs.map((n) => css(n, "animation-delay")), du = bs.map((n) => +css(n, "animation-duration"));
ok(new Set(dl).size === 5, "each bar starts at its own place (" + dl.join(", ") + ")");
ok(du.every((d) => d > 0 && Math.abs(8 / d - Math.round(8 / d)) < 1e-9), "every bar's loop divides 8 s (" + du.join(", ") + ")");

// Soundscape: the bars are always in the card with bars on, and CSS shows them while a sound is on
const sc = (opts, w, h) => W.render({ kind: "soundscape", w: w || 400, h: h || 360, opts }, {});
ok(count(sc({ sound: "rain" }), "cw-eq") === 0, "soundscape: off by default");
ok(count(sc({ sound: "rain", bars: true }), "cw-eq-sound") === 1, "soundscape: bars ready, shown while a sound is on");
ok(count(sc({ sound: "fire", bars: true }, 260, 160), "cw-eq-sound") === 1, "a small soundscape tile too");
ok(/Rain/.test(sc({ sound: "rain", bars: true }).textContent), "the card still names its sound");

// soundscape.js marks the page with the sound that is on
const html = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
const sb = { document: { documentElement: html }, console, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, Float32Array, Math, addEventListener() {}, removeEventListener() {} };
sb.window = sb;
sb.AudioContext = function () { const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: { value: 0, setValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {} }, Q: { value: 0 }, buffer: null, loop: false, type: "" });
  return { state: "running", currentTime: 0, sampleRate: 8000, destination: {}, createGain: node, createBiquadFilter: node, createBufferSource: node, createOscillator: node, createDynamicsCompressor: node,
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), resume: () => Promise.resolve() }; };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../tv-home/web/soundscape.js"), "utf8"), sb);
sb.Soundscape.play("rain", 0.5);
ok(html.attrs["data-sound"] === "rain", "soundscape.js: playing rain marks data-sound=rain (" + html.attrs["data-sound"] + ")");
sb.Soundscape.stop();
ok(html.attrs["data-sound"] === "off", "stopped: data-sound=off");

// design.js keeps bars on these two only
const CD = K.design();
ok(K.kept(CD, "nowplaying", { bars: true }).bars === true && K.kept(CD, "soundscape", { sound: "rain", bars: true }).bars === true, "design.js keeps bars on both");
ok(K.kept(CD, "clock", { bars: true }).bars === undefined, "not on other cards");

// CSS
const wcss = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const block = wcss.slice(wcss.indexOf("/* Audio bars"));
const kf = (block.match(/@keyframes cw-eq \{[^@]*/) || [""])[0];
ok(kf && !/(height|width|top|left|margin|opacity|filter)\s*:/.test(kf) && /scaleY/.test(kf), "keyframes: scaleY only");
ok(/\.cw-eq-sound \{ display: none; \}/.test(block) && ["rain", "fire", "waves", "brown"].every((t) => block.indexOf('html[data-sound="' + t + '"] .cw-eq-sound') >= 0), "soundscape bars only while a sound is on");
ok(/html\.lighter \.cw-eq-b, html\.theme-loop \.cw-eq-b/.test(block) && /prefers-reduced-motion[^}]*\.cw-eq-b/.test(block), "standing still on the Lighter home, the Loop look, reduced motion");
ok(/html\.cw-still \[class\*="cw-"\][^{]*\{[^}]*animation-play-state: paused/.test(wcss), "paused while the home is covered");
done();
