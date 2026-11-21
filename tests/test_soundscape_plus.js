// Soundscape+ (tv-home/web/soundscape.js): the richer fire, the new mixes (Rain + fire, Rain on window, Storm), Match the weather,
// the 30 / 60 minute fade out and the volume ceiling, driven in node on a fake AudioContext and a virtual clock (no sound is
// made here; tests/test_soundscape_browser.mjs renders the real audio in Chromium). Run: node tests/test_soundscape_plus.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; console.log("  ok  " + m); };
console.log("Running Soundscape+ tests...");

const src = fs.readFileSync(path.join(__dirname, "../tv-home/web/soundscape.js"), "utf8");

// ---------------- a fake Web Audio and a virtual clock ----------------
class Param {
  constructor(v) { this.value = v === undefined ? 0 : v; this.calls = []; }
  setValueAtTime(v, t) { this.calls.push(["set", v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v, t) { this.calls.push(["lin", v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { this.calls.push(["exp", v, t]); return this; }
  setTargetAtTime(v, t, tc) { this.calls.push(["target", v, t, tc]); return this; }
  setValueCurveAtTime(c, t, d) { this.calls.push(["curve", c, t, d]); return this; }
  cancelScheduledValues(t) { this.calls.push(["cancel", t]); return this; }
}
function makeWorld() {
  const clock = { ms: 1000000, timers: [], seq: 0 };
  const all = [];
  class Node {
    constructor(kind, ac) {
      this.kind = kind; this.ac = ac; this.out = []; this.stopped = false; this.started = null; this.disconnected = false; this.stopAt = null;
      this.gain = new Param(1); this.frequency = new Param(350); this.Q = new Param(1); this.playbackRate = new Param(1);
      this.type = "sine"; this.loop = false; this.buffer = null; all.push(this);
    }
    connect(d) { this.out.push(d); return d; }
    disconnect() { this.disconnected = true; this.out = []; }
    start(when, off) { this.started = when === undefined ? this.ac.currentTime : when; this.offset = off; }
    stop(when) { this.stopped = true; this.stopAt = when; }
  }
  class AC {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = "running"; this.destination = new Node("dest", this); }
    resume() { return Promise.resolve(); }
    createGain() { return new Node("gain", this); }
    createBiquadFilter() { return new Node("filter", this); }
    createBufferSource() { return new Node("source", this); }
    createOscillator() { return new Node("osc", this); }
    createBuffer(ch, len, rate) { const d = []; for (let i = 0; i < ch; i++) d.push(new Float32Array(len)); return { length: len, sampleRate: rate, numberOfChannels: ch, duration: len / rate, getChannelData: (i) => d[i] }; }
  }
  const sb = {
    AudioContext: AC, console, Math, JSON, Promise, Float32Array,
    setInterval(fn, ms) { const id = ++clock.seq; clock.timers.push({ id, fn, every: ms, at: clock.ms + ms }); return id; },
    clearInterval(id) { clock.timers = clock.timers.filter((t) => t.id !== id); },
    setTimeout(fn, ms) { const id = ++clock.seq; clock.timers.push({ id, fn, every: 0, at: clock.ms + ms }); return id; },
    clearTimeout(id) { clock.timers = clock.timers.filter((t) => t.id !== id); },
    addEventListener() {}, removeEventListener() {}
  };
  sb.Date = class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.ms); } static now() { return clock.ms; } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(src, sb, { filename: "soundscape.js" });
  const S = sb.window.Soundscape;
  const ctx = () => { const d = all.find((n) => n.kind === "dest"); return d ? d.ac : null; };
  // advance the virtual clock (and the audio clock with it), firing timers in order
  function advance(sec) {
    const end = clock.ms + sec * 1000;
    for (;;) {
      const due = clock.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      const dt = due.at - clock.ms; clock.ms = due.at; if (ctx()) ctx().currentTime += dt / 1000;
      if (due.every) due.at += due.every; else clock.timers = clock.timers.filter((t) => t !== due);
      due.fn();
    }
    const rest = end - clock.ms; clock.ms = end; if (ctx()) ctx().currentTime += rest / 1000;
  }
  const nodes = (kind) => all.filter((n) => n.kind === kind);
  return { S, sb, clock, all, advance, ctx, nodes };
}
// the one-shot buffer sources (crackle, pop, tap phrases): not looping, and started
const shots = (W) => W.nodes("source").filter((n) => !n.loop && n.started !== null);
const loops = (W) => W.nodes("source").filter((n) => n.loop);
// the master gain: the gain that feeds the fader gain that feeds the destination
const masterOf = (W) => { const dest = W.nodes("dest")[0]; const fader = W.nodes("gain").filter((g) => g.out[0] === dest)[0]; return W.nodes("gain").filter((g) => g.out[0] === fader)[0]; };
const faderOf = (W) => { const dest = W.nodes("dest")[0]; return W.nodes("gain").filter((g) => g.out[0] === dest)[0]; };
const lastLevel = (g) => g.gain.calls.filter((c) => c[0] === "set" || c[0] === "target").pop()[1];

// ---------------- 1. the list of sounds ----------------
{
  const W = makeWorld();
  ok(JSON.stringify(W.S.TYPES.slice(0, 5)) === JSON.stringify(["off", "rain", "fire", "waves", "brown"]), "ekagra-codes' five keep their order, so the Soundscape button and a saved setting still mean the same thing");
  ok(W.S.TYPES.slice(5).join() === "rainfire,window,storm,match", "new: rainfire, window, storm, match (" + W.S.TYPES.join(",") + ")");
  ok(["play", "stop", "setVolume", "fade", "current", "volume"].every((k) => typeof W.S[k] === "function"), "the old API is all still there");
  W.S.play("nonsense", 0.4);
  ok(W.S.current() === "off", "an unknown type is off");
}

// ---------------- 2. every mix starts, plays on and stops cleanly ----------------
["rain", "fire", "waves", "brown", "rainfire", "window", "storm", "match"].forEach((type) => {
  const W = makeWorld();
  W.S.setWeatherSource(() => 63);
  W.S.play(type, 0.5);
  ok(W.S.current() === type, type + ": plays");
  W.advance(45);
  const every = W.clock.timers.filter((t) => t.every === 250).length;
  ok(every === 1, type + ": ONE 250 ms timer looks ahead, nothing per event (" + every + ")");
  const total = W.all.length;
  W.S.stop();
  ok(W.S.current() === "off" && W.clock.timers.length === 0, type + ": stop leaves no timer behind");
  ok(loops(W).every((n) => n.stopped && n.disconnected), type + ": every looping source is stopped and disconnected");
  ok(W.all.length === total, type + ": nothing is made after stop");
});

// ---------------- 3. Fire v2: layered crackle, pops, a low rumble, an occasional hiss ----------------
{
  const W = makeWorld();
  W.S.play("fire", 0.5);
  W.advance(60);
  const fl = W.nodes("filter");
  ok(fl.some((f) => f.type === "lowpass" && f.frequency.value < 250), "fire: a low rumble (a low-pass bed)");
  ok(fl.some((f) => f.type === "bandpass" && f.frequency.value > 300 && f.frequency.value < 800), "fire: the roar of the flames (a mid band)");
  ok(fl.some((f) => f.type === "bandpass" && f.frequency.value > 4000), "fire: a high band for the hiss");
  ok(loops(W).length === 3, "fire: three looping beds (rumble, roar, hiss), no more (" + loops(W).length + ")");
  const sh = shots(W), perSec = sh.length / 60;
  ok(perSec > 1.5 && perSec < 6, "fire: crackle, bed and pops come at " + perSec.toFixed(1) + " events a second, light enough for a stick (1.5 to 6)");
  const lens = {}; sh.forEach((n) => { const k = n.buffer.duration.toFixed(2); lens[k] = (lens[k] || 0) + 1; });
  ok(lens["0.90"] > 30, "fire: the crackle bed (a 0.9 s phrase of tiny clicks) plays about every second: " + JSON.stringify(lens));
  ok(lens["0.14"] > 25, "fire: single sharp clicks and random log pops are heard (" + lens["0.14"] + " in a minute)");
  ok(sh.every((n) => n.out.length === 1 && n.out[0].kind === "gain"), "fire: each event is ONE source straight into the layer's one gain (its loudness is in the buffer)");
  const hiss = W.nodes("gain").filter((g) => g.out.length && g.gain.calls.some((c) => c[0] === "lin" && c[1] === 0) && g.gain.calls.some((c) => c[0] === "set" && c[1] === 0 && c[2] > 0))[0];
  const hisses = hiss ? hiss.gain.calls.filter((c) => c[0] === "set" && c[1] === 0 && c[2] > 0).length : 0;
  ok(hisses >= 2 && hisses <= 12, "fire: an occasional hiss (" + hisses + " in a minute, one every 6 to 16 s)");
  const breathe = W.nodes("gain").reduce((n, g) => n + g.gain.calls.filter((c) => c[0] === "target").length, 0);
  ok(breathe > 20, "fire: the flames breathe (the rumble and the roar swell and sag, " + breathe + " moves)");
}

// ---------------- 4. Rain + fire ----------------
{
  const W = makeWorld();
  W.S.play("rainfire", 0.5);
  W.advance(30);
  const fl = W.nodes("filter");
  ok(fl.some((f) => f.type === "lowpass" && f.frequency.value === 2400) && fl.some((f) => f.type === "lowpass" && f.frequency.value < 250), "rainfire: the rain bed AND the fire's rumble");
  ok(shots(W).length > 40, "rainfire: with the fire's crackle (" + shots(W).length + " events in 30 s)");
}

// ---------------- 5. Rain on window: drips and taps ----------------
{
  const W = makeWorld();
  W.S.play("window", 0.5);
  W.advance(60);
  const drips = W.nodes("osc");
  ok(drips.length >= 10 && drips.length <= 60, "window: drips plink (" + drips.length + " in a minute)");
  ok(drips.every((o) => o.type === "sine" && o.frequency.calls.some((c) => c[0] === "exp") && o.stopAt !== null), "window: each drip is a sine that falls in pitch and stops by itself");
  const f0 = drips.map((o) => o.frequency.calls[0][1]);
  ok(Math.min(...f0) >= 500 && Math.max(...f0) <= 2600, "window: drips sit between 500 and 2600 Hz (" + Math.round(Math.min(...f0)) + " to " + Math.round(Math.max(...f0)) + ")");
  const taps = shots(W).filter((n) => n.buffer.duration.toFixed(1) === "1.2");
  ok(taps.length >= 40, "window: taps of rain on glass (" + taps.length + ")");
  const dull = W.nodes("filter").filter((f) => f.type === "lowpass");
  ok(dull.length >= 1 && dull[0].frequency.value <= 1600, "window: the bed is dull, as heard through glass (low-pass " + dull[0].frequency.value + " Hz)");
}

// ---------------- 6. Storm: thunder every 20 to 60 s ----------------
{
  const W = makeWorld();
  W.S.play("storm", 0.5);
  W.advance(600);
  // each thunder starts one sub oscillator at 38-58 Hz
  const th = W.nodes("osc").filter((o) => o.frequency.calls[0][1] >= 38 && o.frequency.calls[0][1] <= 58);
  const at = th.map((o) => o.started);
  ok(th.length >= 8 && th.length <= 28, "storm: " + th.length + " rolls of thunder in 10 minutes (one every 20 to 60 s)");
  ok(at[0] >= 6 && at[0] <= 18.5, "storm: the first roll comes within seconds (" + at[0].toFixed(1) + " s)");
  const gaps = at.slice(1).map((v, i) => v - at[i]);
  ok(gaps.every((g) => g >= 19.9 && g <= 60.1), "storm: every gap after it is 20 to 60 s (" + Math.min(...gaps).toFixed(0) + " to " + Math.max(...gaps).toFixed(0) + ")");
  const roll = W.nodes("source").filter((n) => n.loop && n.out[0] && n.out[0].kind === "filter" && n.out[0].type === "lowpass" && n.out[0].frequency.value >= 70 && n.out[0].frequency.value <= 160);
  ok(roll.length >= th.length, "storm: a thunder is low-passed noise under 160 Hz plus a sub-bass sine");
  const len = th[0].stopAt - th[0].started;
  ok(len > 3 && len < 14, "storm: a roll lasts " + len.toFixed(1) + " s, with swells before it dies away");
  ok(W.nodes("filter").some((f) => f.type === "bandpass" && f.frequency.value >= 1400), "storm: heavier rain than plain rain (a wider top)");
  ok(W.nodes("filter").some((f) => f.type === "bandpass" && f.frequency.value < 400), "storm: and wind that comes and goes");
}

// ---------------- 7. Match the weather ----------------
{
  const W = makeWorld();
  const S = W.S;
  const want = { 0: "brown", 3: "brown", 45: "brown", 51: "window", 53: "window", 55: "window", 56: "window", 57: "window", 61: "window", 63: "rain", 65: "rain", 66: "rain", 67: "rain", 71: "brown", 75: "brown", 80: "window", 81: "rain", 82: "rain", 85: "brown", 95: "storm", 96: "storm", 99: "storm" };
  const wrong = Object.keys(want).filter((k) => S.mixForWeather(+k) !== want[k]);
  ok(wrong.length === 0, "match: WMO code -> mix: rain and showers = rain, thunder = storm, light rain or drizzle = soft rain on glass, dry, snow or fog = soft brown noise" + (wrong.length ? " WRONG: " + wrong : ""));
  ok(S.mixForWeather("x") === "brown" && S.mixForWeather(undefined) === "brown", "match: junk is soft, not a crash");
  let code = null;
  S.setWeatherSource(() => code);
  S.play("match", 1);
  ok(S.state().mix === "brown" && S.current() === "match", "match: no weather yet = soft");
  S.stop();
  code = 65; S.play("match", 1);
  ok(S.state().mix === "rain", "match: rain now = rain");
  S.stop();
  code = 96; S.play("match", 1);
  ok(S.state().mix === "storm", "match: a thunderstorm = storm");
  // the weather changes: within a minute the mix follows, crossfaded, the old one thrown away
  const before = W.all.length;
  code = 61;
  W.advance(40); ok(S.state().mix === "storm", "match: it does not flip-flop within the minute (still storm at 40 s)");
  W.advance(30);
  ok(S.state().mix === "window", "match: the weather turned to light rain, so the mix did (" + S.state().mix + ")");
  ok(W.all.length > before, "match: the new mix was built");
  ok(W.nodes("gain").some((g) => g.gain.calls.some((c) => c[0] === "lin" && c[1] === 0 && c[2] > 60)), "match: the old mix is faded out over two seconds");
  W.advance(3);
  ok(loops(W).filter((n) => n.stopped && n.disconnected).length >= 3, "match: then its sources are stopped and disconnected");
  S.stop();
  // the volume ceiling
  const W1 = makeWorld(), S1 = W1.S;
  S1.play("match", 1);
  ok(S1.state().ceiling === 0.3 && Math.abs(S1.state().effective - 0.3) < 1e-9, "match: the ceiling is low by default (30%): volume 100% plays at " + S1.state().effective);
  ok(Math.abs(lastLevel(masterOf(W1)) - 0.3) < 1e-9, "match: the master gain is really at the ceiling");
  S1.setMatchCeiling(0.1);
  ok(Math.abs(S1.state().effective - 0.1) < 1e-9 && Math.abs(lastLevel(masterOf(W1)) - 0.1) < 1e-9, "match: a lower ceiling lowers it at once");
  S1.setVolume(0.05);
  ok(Math.abs(S1.state().effective - 0.05) < 1e-9, "match: a volume under the ceiling stays as it is");
  S1.setMatchCeiling(0.5); S1.setVolume(1);
  ok(Math.abs(S1.state().effective - 0.5) < 1e-9, "match: a higher ceiling lets it up to 50%");
  S1.setMatchCeiling(99); ok(S1.state().ceiling === 1, "match: the ceiling is clamped to 1");
  S1.setMatchCeiling(0); ok(S1.state().ceiling === 0.05, "match: and never 0 (it would make a silent card)");
  S1.play("rain", 1);
  ok(S1.state().effective === 1 && Math.abs(lastLevel(masterOf(W1)) - 1) < 1e-9, "other mixes ignore the ceiling");
}

// ---------------- 8. Sleep fade out: 30 or 60 minutes ----------------
{
  const W = makeWorld(), S = W.S;
  S.play("rain", 0.5, { fadeMin: 30 });
  const st = S.state();
  ok(st.fadeSecs === 1800 && st.fadeEnds - st.fadeStarted === 1800000, "fade: 30 minutes = 1800 s");
  const curve = faderOf(W).gain.calls.filter((c) => c[0] === "curve")[0];
  ok(curve && curve[3] === 1800 && curve[1][0] === 1 && curve[1][curve[1].length - 1] === 0, "fade: one curve on the audio clock, 1800 s, from full to silence");
  const mono = Array.prototype.every.call(curve[1], (v, i, a) => i === 0 || v <= a[i - 1]);
  ok(mono && curve[1][64] > 0.2 && curve[1][64] < 0.3, "fade: a smooth falling curve ((1 - t)^2: " + curve[1][64].toFixed(2) + " halfway)");
  ok(W.clock.timers.filter((t) => t.every === 0).length === 1, "fade: one timer, for the end");
  W.advance(1799);
  ok(S.current() === "rain", "fade: still playing a second before the end");
  W.advance(2);
  ok(S.current() === "off" && S.state().fadeEnds === 0 && W.clock.timers.length === 0, "fade: stops when it has faded, and leaves nothing running");
  S.play("fire", 0.5, { fadeMin: 60 });
  ok(S.state().fadeSecs === 3600, "fade: 60 minutes");
  S.setVolume(0.8);
  ok(S.state().fadeSecs === 3600 && S.state().vol === 0.8, "fade: changing the volume does not break the fade (it has its own gain)");
  S.cancelFade();
  ok(S.state().fadeEnds === 0 && W.clock.timers.filter((t) => t.every === 0).length === 0 && S.current() === "fire", "fade: can be cancelled, the sound plays on");
  ok(lastLevel(faderOf(W)) === 1, "fade: and the fader is back at full");
  S.play("rain", 0.5, { fadeMin: 30 }); S.play("waves", 0.5);
  ok(S.state().fadeEnds === 0, "fade: a new sound starts without the old fade");
  ok(S.fadeOut(0) === false && S.fadeOut(-5) === false && S.fadeOut("x") === false, "fade: 0, negative or junk minutes do nothing");
  S.stop();
  ok(S.fadeOut(30) === false, "fade: nothing to fade when nothing plays");
  S.play("brown", 0.5, { fadeMin: 45 });
  ok(S.state().fadeSecs === 2700, "fade: the engine takes any minutes (the TV's setting offers 30 and 60)");
}

// ---------------- 9. the card listens: onChange ----------------
{
  const W = makeWorld(), S = W.S;
  const seen = [];
  const off = S.onChange((s) => seen.push(s.type + ":" + s.effective));
  S.play("storm", 0.6);
  S.setVolume(0.2);
  S.stop();
  ok(seen.join() === "storm:0.6,storm:0.2,off:0", "onChange: play, volume and stop each tell the cards (" + seen.join(" ") + ")");
  off(); S.play("rain", 0.5);
  ok(seen.length === 3, "onChange: the returned function stops listening");
  const S2 = makeWorld().S; S2.onChange(() => { throw new Error("a bad listener"); }); S2.play("rain", 0.5);
  ok(S2.current() === "rain", "onChange: a listener that throws cannot stop the sound");
}

// ---------------- 10. old behaviour kept ----------------
{
  const W = makeWorld(), S = W.S;
  S.play("rain", 0.7);
  ok(S.volume() === 0.7, "volume is what play() was given");
  S.setVolume(7); ok(S.volume() === 1, "volume clamps to 1");
  S.setVolume(-1); ok(S.volume() === 0, "and to 0");
  S.play("rain", 0.5);
  const m = masterOf(W), calls = m.gain.calls;
  ok(calls.some((c) => c[0] === "cancel") && lastLevel(m) === 0.5, "play after a fade starts at the chosen volume");
  S.fade(0.2, 5);
  const ramp = m.gain.calls.filter((c) => c[0] === "lin").pop();
  ok(ramp && ramp[1] === 0.2 && Math.abs(ramp[2] - (W.ctx().currentTime + 5)) < 1e-9, "the old fade() ramp still runs");
  ok(W.nodes("filter").some((f) => f.type === "lowpass" && f.frequency.value === 2400) && W.nodes("filter").some((f) => f.type === "bandpass" && f.frequency.value === 1100 && f.Q.value === 1), "plain rain is still ekagra-codes' chain (low-pass 2400, band-pass 1100 Q 1)");
  const g = W.nodes("gain").filter((n) => n.gain.value === 0.85 * 1)[0];
  ok(!!g, "and its bed gain 0.85");
}

// ---------------- 11. written for the old WebViews ----------------
{
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
  ok(!/=>/.test(code) && !/\blet\b/.test(code) && !/\bconst\b/.test(code) && !/`/.test(code), "ES5 only: no arrow functions, let, const or template strings (webOS 3.x runs Chrome 38)");
  ok(!/createStereoPanner|AudioWorklet|decodeAudioData|fetch\(|XMLHttpRequest/.test(code), "no API a Chrome 38 TV lacks, and no file or network: every sound is made on the TV");
  ok(/ekagra-codes/.test(src) && /#81/.test(src), "ekagra-codes' credit (#81) stays at the top of the file");
}

console.log("\nSoundscape+: " + passed + " checks passed");
