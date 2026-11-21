// Procedural Web Audio Soundscapes for couch-tv (ekagra-codes, #81)
// Pure client-side synthesis, zero external files or streaming bandwidth needed.
// Rain, Fireplace, Ocean Waves and Brown Noise are ekagra-codes' (#81); the engine around them keeps their
// chain and their order. Added since: a richer fire (layered crackle, random pops, a low rumble, an
// occasional hiss), the mixes Rain + fire, Rain on window and Storm (distant thunder every 20 to 60 s),
// "Match the weather", and a 30 or 60 minute fade out.
// How it stays light: every sound is noise or a tiny buffer made once when the first sound starts (or an
// oscillator that lives for 100 ms), the moving parts are scheduled on the audio clock by ONE timer that
// looks 1 s ahead, and nothing is a file. The graph per mix: one gain bus, 2 to 4 looping noise sources
// through one filter each, and short one-shot sources for the events (a crackle, a pop, a drip, a roll of thunder).
// ES5 on purpose (webOS 3.x runs Chrome 38).
(function (root) {
  "use strict";

  var AudioCtx = root.AudioContext || root.webkitAudioContext;
  var ctx = null;
  var masterGain = null;   // the volume
  var faderGain = null;    // the sleep fade out, so changing the volume never fights it
  var currentType = "off";
  var currentVol = 0.5;
  var matchCeil = 0.3;     // "Match the weather" never plays louder than this, whatever the volume is
  var cur = null;          // the mix that is playing: { type, resolved, bus, nodes, ticks, state }
  var timer = null;
  var fadeTimer = null;
  var fadeInfo = null;     // { startsAt, endsAt, secs } in Date.now() time
  var listeners = [];
  var weatherSrc = null;   // function () -> WMO code or null (the home's live weather)

  // the first five keep ekagra-codes' order; new ones go after them
  var TYPES = ["off", "rain", "fire", "waves", "brown", "rainfire", "window", "storm", "match"];
  var LOOKAHEAD = 1.0, TICK_MS = 250;

  function getCtx() {
    if (!ctx && AudioCtx) {
      try {
        ctx = new AudioCtx();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---------------------------------------------------------------- what is made once
  // a 4-second stereo loop of pink noise (Paul Kellet), and the little buffers the events play
  var cache = null;   // { ac, noise, crackle[], pop[], tap[] }
  function buffersFor(ac) {
    if (cache && cache.ac === ac) return cache;
    var rate = ac.sampleRate || 44100;
    var len = rate * 4;
    var noise = ac.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = noise.getChannelData(ch);
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < len; i++) {
        var white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    cache = { ac: ac, noise: noise, crackle: null, pop: null, tap: null, fireBed: null };
    return cache;
  }
  function mono(ac, seconds) {
    var rate = ac.sampleRate || 44100;
    return ac.createBuffer(1, Math.max(1, Math.round(seconds * rate)), rate);
  }
  // fire crackle: a few tiny clicks, each a burst of noise that dies in a millisecond or two
  function crackleBufs(ac) {
    var c = buffersFor(ac);
    if (c.crackle) return c.crackle;
    var rate = ac.sampleRate || 44100, out = [];
    for (var v = 0; v < 12; v++) {
      var b = mono(ac, 0.14), d = b.getChannelData(0), n = 2 + Math.floor(Math.random() * 6), loud = 0.1 + Math.pow(Math.random(), 1.8) * 0.5;
      for (var k = 0; k < n; k++) {
        var pos = Math.floor(Math.random() * 0.1 * rate), amp = loud * (0.4 + Math.random() * 0.6) / 0.7, tau = (0.0003 + Math.random() * 0.0012) * rate;
        for (var i = 0; i < tau * 6 && pos + i < d.length; i++) d[pos + i] += amp * (Math.random() * 2 - 1) * Math.exp(-i / tau);
      }
      out.push(b);
    }
    c.crackle = out;
    return out;
  }
  // a log pop: a short low thump with a snap of noise on top
  function popBufs(ac) {
    var c = buffersFor(ac);
    if (c.pop) return c.pop;
    var rate = ac.sampleRate || 44100, out = [];
    for (var v = 0; v < 6; v++) {
      var b = mono(ac, 0.14), d = b.getChannelData(0), f = 70 + Math.random() * 110, tau = (0.018 + Math.random() * 0.02) * rate, tn = 0.004 * rate, loud = 0.32 + Math.random() * 0.4;
      for (var i = 0; i < d.length; i++) d[i] = loud * 0.8 * Math.sin(2 * Math.PI * f * i / rate) * Math.exp(-i / tau) + loud * 0.5 * (Math.random() * 2 - 1) * Math.exp(-i / tn);
      out.push(b);
    }
    c.pop = out;
    return out;
  }
  // a 0.9 s phrase of dense crackle (many tiny clicks in a few clusters): one source plays a whole second of it, so
  // the fire is thick without a node for every click
  function fireBed(ac) {
    var c = buffersFor(ac);
    if (c.fireBed) return c.fireBed;
    var rate = ac.sampleRate || 44100, out = [];
    for (var v = 0; v < 6; v++) {
      var b = mono(ac, 0.9), d = b.getChannelData(0), clusters = 3 + Math.floor(Math.random() * 3);
      for (var q = 0; q < clusters; q++) {
        var centre = Math.random() * 0.8, n = 4 + Math.floor(Math.random() * 9);
        for (var k = 0; k < n; k++) {
          var pos = Math.floor((centre + Math.random() * 0.08) * rate), amp = (0.15 + Math.random() * 0.5) * 0.22, tau = (0.0003 + Math.random() * 0.001) * rate;
          for (var i = 0; i < tau * 6 && pos + i < d.length; i++) d[pos + i] += amp * (Math.random() * 2 - 1) * Math.exp(-i / tau);
        }
      }
      out.push(b);
    }
    c.fireBed = out;
    return out;
  }
  // a 1.2 s phrase of rain ticking on glass (noise ticks with a ring around 2 to 4 kHz)
  function tapBufs(ac) {
    var c = buffersFor(ac);
    if (c.tap) return c.tap;
    var rate = ac.sampleRate || 44100, out = [];
    for (var v = 0; v < 4; v++) {
      var b = mono(ac, 1.2), d = b.getChannelData(0), n = 10 + Math.floor(Math.random() * 14);
      for (var k = 0; k < n; k++) {
        var pos = Math.floor(Math.random() * 1.1 * rate), amp = (0.2 + Math.random() * 0.8) * 0.2, f = 2200 + Math.random() * 2400, tau = 0.005 * rate, tn = 0.002 * rate, prev = 0;
        for (var i = 0; i < 0.04 * rate && pos + i < d.length; i++) {
          var w = Math.random() * 2 - 1;
          d[pos + i] += amp * (0.5 * (w - prev) * Math.exp(-i / tn) + 0.5 * Math.sin(2 * Math.PI * f * i / rate) * Math.exp(-i / tau));
          prev = w;
        }
      }
      out.push(b);
    }
    c.tap = out;
    return out;
  }

  // ---------------------------------------------------------------- small helpers for the mixes
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r(lo, hi) { return lo + Math.random() * (hi - lo); }
  function track(mix, n) { mix.nodes.push(n); return n; }
  function noiseSrc(ac, mix) {
    var s = ac.createBufferSource();
    s.buffer = buffersFor(ac).noise;
    s.loop = true;
    track(mix, s);
    return s;
  }
  function filt(ac, mix, type, f, q) {
    var n = ac.createBiquadFilter();
    n.type = type; n.frequency.value = f;
    if (q !== undefined) n.Q.value = q;
    return track(mix, n);
  }
  function gain(ac, mix, v) {
    var g = ac.createGain();
    g.gain.value = v;
    return track(mix, g);
  }
  function begin(s) { try { s.start(0, Math.random() * 3.5); } catch (e) { try { s.start(0); } catch (e2) {} } }
  // a one-shot buffer (a crackle, a pop, a tap): ONE node per event (its loudness is in the buffer, the layer's level is
  // one gain made once). Each event costs the TV about 1 ms to create, so the events are what the mixes count in
  function shot(ac, buf, when, dest, rate) {
    var s = ac.createBufferSource();
    s.buffer = buf;
    if (rate) s.playbackRate.value = rate;
    s.connect(dest);
    s.start(when);
  }
  function layer(ac, mix, level) {
    var g = gain(ac, mix, level);
    g.connect(mix.bus);
    return g;
  }
  // run `fire(t)` for every event that falls before `until`; the gap to the next is min..max seconds
  function every(mix, key, now, until, gapFn, fire) {
    var t = mix.state[key];
    if (t === undefined) t = now + gapFn();
    while (t < until) {
      if (t >= now - 0.05) fire(Math.max(t, now));
      t += gapFn();
    }
    mix.state[key] = t;
  }

  // ---------------------------------------------------------------- the layers
  // Rain: filtered noise bed + gentle gusts (ekagra-codes' chain; the numbers are theirs for plain rain)
  function addRain(ac, mix, level, lpF, bpF, bpQ) {
    var src = noiseSrc(ac, mix), lp = filt(ac, mix, "lowpass", lpF, undefined), bp = filt(ac, mix, "bandpass", bpF, bpQ), g = gain(ac, mix, 0.85 * level);
    src.connect(lp); lp.connect(bp); bp.connect(g); g.connect(mix.bus);
    begin(src);
    mix.ticks.push(function (now, until) {
      every(mix, "gust", now, until, function () { return 2.5; }, function (t) {
        g.gain.setTargetAtTime((0.75 + Math.random() * 0.35) * level, t, 1.2);
      });
    });
  }
  // Fire v2: a low rumble, the roar of the flames, layered crackle, random pops and an occasional hiss
  function addFire(ac, mix, level) {
    var cb = crackleBufs(ac), pb = popBufs(ac), fb = fireBed(ac);
    var rum = noiseSrc(ac, mix), rlp = filt(ac, mix, "lowpass", 170), rg = gain(ac, mix, 0.62 * level);
    rum.connect(rlp); rlp.connect(rg); rg.connect(mix.bus); begin(rum);
    var body = noiseSrc(ac, mix), bbp = filt(ac, mix, "bandpass", 520, 0.6), bg = gain(ac, mix, 0.1 * level);
    body.connect(bbp); bbp.connect(bg); bg.connect(mix.bus); begin(body);
    var ev = layer(ac, mix, level);
    var hs = noiseSrc(ac, mix), hbp = filt(ac, mix, "bandpass", 5200, 1.2), hg = gain(ac, mix, 0);
    hs.connect(hbp); hbp.connect(hg); hg.connect(mix.bus); begin(hs);
    mix.ticks.push(function (now, until) {
      // the flames breathe: the rumble and the roar swell and sag on their own time
      every(mix, "breathe", now, until, function () { return r(1.5, 3.5); }, function (t) {
        rg.gain.setTargetAtTime(r(0.45, 0.75) * level, t, 0.8);
        bg.gain.setTargetAtTime(r(0.05, 0.17) * level, t, 0.5);
      });
      // layered crackle: a thick bed of tiny clicks (a phrase a second, each at its own speed), and on top of it single sharp ones
      every(mix, "bed", now, until, function () { return r(0.8, 1.3); }, function (t) {
        shot(ac, pick(fb), t, ev, r(0.85, 1.25));
      });
      every(mix, "crackle", now, until, function () { return Math.random() < 0.2 ? r(0.03, 0.1) : r(0.3, 1.4); }, function (t) {
        shot(ac, pick(cb), t, ev, r(0.75, 1.45));
      });
      // a pop from a log, now and then
      every(mix, "pop", now, until, function () { return r(1.0, 4.5); }, function (t) {
        shot(ac, pick(pb), t, ev, r(0.8, 1.25));
      });
      // an occasional hiss, like steam off a wet log
      every(mix, "hiss", now, until, function () { return r(6, 16); }, function (t) {
        var peak = r(0.03, 0.07) * level, len = r(0.6, 1.4);
        hg.gain.setValueAtTime(0, t);
        hg.gain.linearRampToValueAtTime(peak, t + 0.15);
        hg.gain.linearRampToValueAtTime(peak * 0.6, t + len * 0.5);
        hg.gain.linearRampToValueAtTime(0, t + len);
      });
    });
  }
  // Rain on a window: the bed is dull (through glass), a thin shimmer on top, taps, and drips that plink
  function addWindow(ac, mix, level) {
    var tb = tapBufs(ac);
    addRain(ac, mix, 0.8 * level, 1500, 650, 0.8);
    var ev = layer(ac, mix, level);
    var sh = noiseSrc(ac, mix), hp = filt(ac, mix, "highpass", 3200), sg = gain(ac, mix, 0.05 * level);
    sh.connect(hp); hp.connect(sg); sg.connect(mix.bus); begin(sh);
    mix.ticks.push(function (now, until) {
      every(mix, "tap", now, until, function () { return r(0.7, 1.2); }, function (t) {
        shot(ac, pick(tb), t, ev, r(0.85, 1.25));
      });
      every(mix, "drip", now, until, function () { return r(0.9, 3.2); }, function (t) {
        var big = Math.random() < 0.15, o = ac.createOscillator(), g = ac.createGain(), f = big ? r(500, 800) : r(1100, 2600), len = big ? 0.16 : 0.09;
        o.type = "sine";
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.45, t + len);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime((big ? r(0.1, 0.18) : r(0.04, 0.12)) * level, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(ev);
        o.start(t); o.stop(t + len + 0.02);
      });
    });
  }
  // Storm: heavier rain, wind that comes and goes, and a roll of distant thunder every 20 to 60 s
  function thunder(ac, mix, t, strength) {
    var s = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain(), o = ac.createOscillator(), og = ac.createGain();
    s.buffer = buffersFor(ac).noise; s.loop = true;
    lp.type = "lowpass"; lp.frequency.value = r(70, 160); lp.Q.value = 0.8;
    var peak = 1.25 * strength, att = r(0.5, 1.4), at = t + att;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, at);
    // the roll: two or three swells before it dies away
    var bumps = 2 + Math.floor(Math.random() * 2), end = at;
    for (var i = 0; i < bumps; i++) {
      var dip = end + r(0.6, 1.4), up = dip + r(0.4, 0.9);
      g.gain.linearRampToValueAtTime(peak * r(0.3, 0.5), dip);
      g.gain.linearRampToValueAtTime(peak * r(0.55, 0.85), up);
      end = up;
    }
    var stopAt = end + r(2.2, 4.0);
    g.gain.linearRampToValueAtTime(0, stopAt);
    o.type = "sine"; o.frequency.setValueAtTime(r(38, 58), t); o.frequency.linearRampToValueAtTime(r(28, 40), stopAt);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.1 * strength, at); og.gain.linearRampToValueAtTime(0, stopAt);
    s.connect(lp); lp.connect(g); g.connect(mix.bus);
    o.connect(og); og.connect(mix.bus);
    // a roll that is still sounding when the mix is thrown away is stopped with it, and forgotten when it ends
    var parts = [s, lp, g, o, og];
    parts.forEach(function (n) { mix.nodes.push(n); });
    s.onended = function () {
      parts.forEach(function (n) { try { n.disconnect(); } catch (e) {} var k = mix.nodes.indexOf(n); if (k >= 0) mix.nodes.splice(k, 1); });
    };
    s.start(t, Math.random() * 3); s.stop(stopAt + 0.05);
    o.start(t); o.stop(stopAt + 0.05);
    return stopAt;
  }
  function addStorm(ac, mix, level) {
    addRain(ac, mix, 0.95 * level, 3400, 1500, 0.6);
    var w = noiseSrc(ac, mix), wbp = filt(ac, mix, "bandpass", 280, 0.9), wg = gain(ac, mix, 0.1 * level);
    w.connect(wbp); wbp.connect(wg); wg.connect(mix.bus); begin(w);
    mix.ticks.push(function (now, until) {
      every(mix, "wind", now, until, function () { return r(3, 6); }, function (t) { wg.gain.setTargetAtTime(r(0.02, 0.32) * level, t, 2.5); });
      // the first roll comes within a few seconds; after that, one every 20 to 60 s
      var first = mix.state.thunderFirst;
      every(mix, "thunder", now, until, function () {
        if (!first) { first = mix.state.thunderFirst = true; return r(6, 18); }
        return r(20, 60);
      }, function (t) { thunder(ac, mix, t, r(0.6, 1)); });
    });
  }

  // ---------------------------------------------------------------- the mixes
  // "match": what the live weather asks for. Light rain and drizzle: the soft rain on glass. Rain and showers: rain.
  // Thunder: storm. Dry, snow, fog or no weather yet: soft brown noise.
  function mixForWeather(code) {
    code = Number(code);
    if (code !== code || code === null) return "brown";
    if (code >= 95) return "storm";
    if (code === 63 || code === 65 || code === 66 || code === 67 || code === 81 || code === 82) return "rain";
    if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57 || code === 61 || code === 80) return "window";
    return "brown";
  }
  function liveWeatherMix() {
    var code = null;
    try { if (weatherSrc) code = weatherSrc(); } catch (e) { code = null; }
    if (code === null || code === undefined || code === "") return "brown";
    return mixForWeather(code);
  }

  function addType(ac, mix, type) {
    if (type === "brown") {
      var src = noiseSrc(ac, mix), lp = filt(ac, mix, "lowpass", 400);
      src.connect(lp); lp.connect(mix.bus); begin(src);
    } else if (type === "rain") {
      addRain(ac, mix, 1, 2400, 1100, 1.0);
    } else if (type === "waves") {
      var ws = noiseSrc(ac, mix), wf = filt(ac, mix, "lowpass", 350), wgn = gain(ac, mix, 0.6);
      var lfo = ac.createOscillator(), lfoGain = ac.createGain(), lfoAmp = ac.createGain();
      track(mix, lfo); track(mix, lfoGain); track(mix, lfoAmp);
      lfo.frequency.value = 0.08;       // ~12.5 s cycle
      lfoGain.gain.value = 250;         // cutoff sweeps +-250 Hz
      lfoAmp.gain.value = 0.35;         // gain sweeps
      lfo.connect(lfoGain); lfoGain.connect(wf.frequency);
      lfo.connect(lfoAmp); lfoAmp.connect(wgn.gain);
      ws.connect(wf); wf.connect(wgn); wgn.connect(mix.bus);
      lfo.start(); begin(ws);
    } else if (type === "fire") {
      addFire(ac, mix, 0.8);    // a little under full: a pop and a crackle landing together must not clip at volume 100%
    } else if (type === "rainfire") {
      addRain(ac, mix, 0.5, 2400, 1100, 1.0);
      addFire(ac, mix, 0.62);
    } else if (type === "window") {
      addWindow(ac, mix, 1);
    } else if (type === "storm") {
      addStorm(ac, mix, 1);
    }
  }

  // one mix on its own bus, so it can be faded out and thrown away on its own (the weather changing the mix)
  function buildMix(ac, out, type) {
    var mix = { type: type, resolved: type, bus: ac.createGain(), nodes: [], ticks: [], state: {}, born: ac.currentTime };
    mix.bus.gain.value = 1;
    mix.bus.connect(out);
    var inner = type;
    if (type === "match") { inner = mix.resolved = liveWeatherMix(); }
    addType(ac, mix, inner);
    return mix;
  }
  function tickMix(mix, now, until) {
    for (var i = 0; i < mix.ticks.length; i++) mix.ticks[i](now, until);
  }
  function killMix(mix, ms) {
    function dead() {
      mix.nodes.forEach(function (n) {
        try { if (n.stop) n.stop(); } catch (e) {}
        try { if (n.disconnect) n.disconnect(); } catch (e) {}
      });
      try { mix.bus.disconnect(); } catch (e) {}
    }
    if (ms) setTimeout(dead, ms); else dead();
  }

  // ---------------------------------------------------------------- playing
  function eff() { return currentType === "match" ? Math.min(currentVol, matchCeil) : currentVol; }
  function applyVolume(now) {
    var ac = getCtx();
    if (!ac || !masterGain) return;
    if (now) {
      masterGain.gain.cancelScheduledValues(ac.currentTime);
      masterGain.gain.setValueAtTime(eff(), ac.currentTime);
    } else {
      masterGain.gain.setTargetAtTime(eff(), ac.currentTime, 0.08);
    }
  }
  function ensureMaster(ac) {
    if (!masterGain) {
      faderGain = ac.createGain();
      faderGain.gain.setValueAtTime(1, ac.currentTime);
      faderGain.connect(ac.destination);
      masterGain = ac.createGain();
      masterGain.gain.setValueAtTime(currentVol, ac.currentTime);
      masterGain.connect(faderGain);
    }
    return masterGain;
  }
  function state() {
    return {
      type: currentType, mix: cur ? cur.resolved : "off", vol: currentVol, ceiling: matchCeil, effective: currentType === "off" ? 0 : eff(),
      fadeEnds: fadeInfo ? fadeInfo.endsAt : 0, fadeStarted: fadeInfo ? fadeInfo.startsAt : 0, fadeSecs: fadeInfo ? fadeInfo.secs : 0
    };
  }
  function emit() {
    var s = state();
    listeners.slice().forEach(function (fn) { try { fn(s); } catch (e) {} });
  }
  function onChange(fn) {
    listeners.push(fn);
    return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }

  // the single timer: it looks LOOKAHEAD s ahead and schedules what falls in that window
  function tick() {
    var ac = ctx;
    if (!ac || !cur) return;
    var now = ac.currentTime, until = now + LOOKAHEAD;
    tickMix(cur, now, until);
    if (cur.type === "match" && now - (cur.checked || cur.born) >= 60) {
      cur.checked = now;
      var want = liveWeatherMix();
      if (want !== cur.resolved) swapMatch(ac, want);
    }
  }
  function swapMatch(ac, want) {
    var old = cur, nu = { type: "match", resolved: want, bus: ac.createGain(), nodes: [], ticks: [], state: {}, born: ac.currentTime, checked: ac.currentTime };
    nu.bus.gain.setValueAtTime(0, ac.currentTime);
    nu.bus.gain.linearRampToValueAtTime(1, ac.currentTime + 2);
    nu.bus.connect(masterGain);
    addType(ac, nu, want);
    old.bus.gain.cancelScheduledValues(ac.currentTime);
    old.bus.gain.setValueAtTime(1, ac.currentTime);
    old.bus.gain.linearRampToValueAtTime(0, ac.currentTime + 2);
    killMix(old, 2200);
    cur = nu;
    emit();
  }
  function startTimer() {
    if (timer) return;
    timer = setInterval(tick, TICK_MS);
  }
  function clearFade() {
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    fadeInfo = null;
    if (ctx && faderGain) { faderGain.gain.cancelScheduledValues(ctx.currentTime); faderGain.gain.setValueAtTime(1, ctx.currentTime); }
  }
  function cleanNodes() {
    if (timer) { clearInterval(timer); timer = null; }
    if (cur) { killMix(cur, 0); cur = null; }
  }

  function play(type, vol, opts) {
    if (TYPES.indexOf(type) < 0) type = "off";
    if (typeof vol === "number") currentVol = clamp(vol, 0, 1);

    var ac = getCtx();
    if (!ac) return;
    ensureMaster(ac);

    if (type === "off") {
      stop();
      return;
    }

    cleanNodes();
    clearFade();
    currentType = type;
    // a new sound starts at the chosen volume, not where the last fade left it
    applyVolume(true);

    cur = buildMix(ac, masterGain, type);
    cur.checked = ac.currentTime;
    tickMix(cur, ac.currentTime, ac.currentTime + LOOKAHEAD);
    startTimer();
    var fm = opts && Number(opts.fadeMin);
    if (fm > 0) fadeOut(fm);
    emit();
  }

  function stop() {
    var was = currentType;
    currentType = "off";
    cleanNodes();
    clearFade();
    if (was !== "off") emit();
  }

  function setVolume(vol) {
    currentVol = clamp(vol, 0, 1);
    applyVolume(false);
    emit();
  }

  // the old API, kept: a ramp of the volume itself
  function fade(targetVol, durationSec) {
    var ac = getCtx();
    if (!ac || !masterGain) return;
    targetVol = clamp(targetVol, 0, 1);
    durationSec = durationSec || 2;
    masterGain.gain.linearRampToValueAtTime(targetVol, ac.currentTime + durationSec);
  }

  // the sleep fade out: from now to silence over `minutes`, then the sound stops. A smooth (1 - t)^2 curve, laid on
  // the audio clock in one go: no timer ticks along the way, one timer for the end
  function fadeOut(minutes) {
    var ac = ctx;
    minutes = Number(minutes);
    if (!ac || !faderGain || currentType === "off" || !(minutes > 0)) return false;
    var secs = minutes * 60, now = ac.currentTime, pts = new Float32Array(128);
    for (var i = 0; i < pts.length; i++) { var u = i / (pts.length - 1); pts[i] = (1 - u) * (1 - u); }
    faderGain.gain.cancelScheduledValues(now);
    faderGain.gain.setValueAtTime(1, now);
    try { faderGain.gain.setValueCurveAtTime(pts, now, secs); }
    catch (e) { faderGain.gain.linearRampToValueAtTime(0, now + secs); }
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(function () { fadeTimer = null; fadeInfo = null; stop(); }, secs * 1000 + 400);
    fadeInfo = { startsAt: Date.now(), endsAt: Date.now() + secs * 1000, secs: secs };
    emit();
    return true;
  }
  function cancelFade() { if (fadeInfo) { clearFade(); emit(); } }

  function setMatchCeiling(v) {
    matchCeil = clamp(Number(v) || 0, 0.05, 1);
    if (currentType === "match") applyVolume(false);
    emit();
  }
  function setWeatherSource(fn) { weatherSrc = typeof fn === "function" ? fn : null; }

  // Wake AudioContext on first user action (browser autoplay policy)
  function initUserGesture() {
    function unlock() {
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(function () {});
      }
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("click", unlock);
    }
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("click", unlock);
  }
  if (typeof window !== "undefined" && window.addEventListener) initUserGesture();

  root.Soundscape = {
    TYPES: TYPES,
    play: play,
    stop: stop,
    setVolume: setVolume,
    fade: fade,
    fadeOut: fadeOut,
    cancelFade: cancelFade,
    setMatchCeiling: setMatchCeiling,
    setWeatherSource: setWeatherSource,
    onChange: onChange,
    state: state,
    mixForWeather: mixForWeather,
    current: function () { return currentType; },
    volume: function () { return currentVol; },
    // for the tests and the cost measurements: build a mix on any AudioContext (an OfflineAudioContext too),
    // and lay all its events for the first `seconds` on that clock
    _build: function (ac, out, type, seconds) {
      var mix = buildMix(ac, out, type);
      tickMix(mix, ac.currentTime, ac.currentTime + (seconds || LOOKAHEAD));
      return mix;
    }
  };
})(typeof window !== "undefined" ? window : this);
