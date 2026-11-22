// Aurora shimmer (design.home.aurora: off | light | medium | heavy, design.home.aurora_style: green | violet | ice): curtains of
// northern light hang in the top of the sky, sway slowly, breathe, and rays of brighter light flare and run along them. For night,
// snow, mountain, lake and Christmas designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA, and no canvas is drawn per
// frame; no blur, no filter, no blend mode). Every picture (a curtain of a few hundred rays, a flare of brighter rays) is drawn ONCE
// on a canvas and used as a CSS background; the whole effect is CSS animation of transform + opacity. One curtain = one 1280x380
// layer (sway = translateX + skewX + scaleY from its bottom edge, opacity breathing) with 1-2 small 220x380 flare layers inside it
// that run along the curtain. Light = 2 curtains, medium = 3, heavy = 3 with two flares each: about 55 / 83 / 95 % of one screen.
// It sits under the cards (right after the weather layer), so nothing it draws can hide a widget. Nothing moves while the home is
// covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", wantStyle = "green", off = false, paused = false;
  var AMT = { light: [2, 1], medium: [3, 1], heavy: [3, 2] };         // curtains, flares per curtain
  // one colour per curtain (the third is the high violet fringe)
  var PALETTES = { green: [[90, 255, 160], [70, 235, 215], [185, 125, 255]], violet: [[205, 125, 255], [125, 150, 255], [255, 130, 215]], ice: [[125, 240, 255], [110, 200, 255], [170, 255, 225]] };
  var CW = 1280, CH = 380, FW = 220;                                  // curtain picture, flare picture width (same height)
  var SPOTS = [[-60, 24, 0], [640, 118, 1], [270, 214, 0]];            // left, top, mirrored? (a static scaleX(-1) on the wrapper)
  var N = 24;                                                         // samples per cycle: a periodic path, linear steps
  // ?fxloop=1 (showcase videos only): every cycle divides 8 s, in fixed places, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.round(a * 1000) / 1000 + ")"; }
  function seeded(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mix(c, k) { return [Math.round(c[0] + (255 - c[0]) * k), Math.round(c[1] + (255 - c[1]) * k), Math.round(c[2] + (255 - c[2]) * k)]; }
  function r2(v) { return Math.round(v * 100) / 100; }

  // one ray: a thin column, bright at its foot and hot white at the very bottom, fading to nothing up the sky
  function ray(g, c, x, w, top, foot, a) {
    var f = g.createLinearGradient(0, top, 0, foot + 16), white = mix(c, 0.65);
    f.addColorStop(0, rgba(c, 0)); f.addColorStop(0.45, rgba(c, a * 0.22)); f.addColorStop(0.8, rgba(c, a * 0.62));
    f.addColorStop(0.93, rgba(white, a)); f.addColorStop(1, rgba(c, 0));
    g.fillStyle = f; g.fillRect(x, top, w, foot + 16 - top);
  }
  // a curtain: a wavy bottom edge, rays of changing height and brightness along it, soft at both ends
  function curtain(seed, c) {
    var cv = doc.createElement("canvas"); cv.width = CW; cv.height = CH;
    var g = cv.getContext("2d"), R = seeded(seed), p = [R() * 6, R() * 6, R() * 6, R() * 6], x;
    var wash = g.createLinearGradient(0, 0, 0, CH);        // a faint body between the rays so the curtain is not a comb
    wash.addColorStop(0, rgba(c, 0)); wash.addColorStop(0.55, rgba(c, 0.07)); wash.addColorStop(0.85, rgba(c, 0.2)); wash.addColorStop(1, rgba(c, 0));
    for (x = 0; x < CW; x += 2.4) {
      var u = x / CW, win = Math.pow(Math.sin(Math.PI * u), 0.55);
      var foot = CH * 0.8 + 26 * Math.sin(x / 210 + p[0]) + 14 * Math.sin(x / 83 + p[1]);
      var n = 0.5 + 0.5 * (0.5 * Math.sin(x / 130 + p[2]) + 0.3 * Math.sin(x / 47 + p[3]) + 0.2 * Math.sin(x / 19 + p[0])), h = CH * (0.3 + 0.62 * n) * (0.6 + 0.4 * win);
      var bright = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x / 61 + p[1] + 2 * Math.sin(x / 233 + p[2])));
      var a = Math.min(1, (0.3 + 0.7 * bright) * win * (0.85 + 0.3 * R()));
      g.fillStyle = wash; g.globalAlpha = win; g.fillRect(x, 0, 2.6, foot + 16); g.globalAlpha = 1;
      ray(g, c, x, 3, foot - h, foot, a);
    }
    return cv.toDataURL("image/png");
  }
  // a flare: a clump of brighter, paler rays that tapers to nothing at both sides; it runs along a curtain and lights the rays it passes
  function flare(c) {
    var cv = doc.createElement("canvas"); cv.width = FW; cv.height = CH;
    var g = cv.getContext("2d"), R = seeded(404), pale = mix(c, 0.45), x;
    for (x = 0; x < FW; x += 3) {
      var win = Math.pow(Math.sin(Math.PI * x / FW), 1.4), foot = CH * 0.8 + 10 * Math.sin(x / 40), h = CH * (0.4 + 0.5 * R()) * (0.5 + 0.5 * win);
      ray(g, pale, x, 2.4, foot - h, foot, Math.min(1, 1.1 * win));
    }
    return cv.toDataURL("image/png");
  }
  function kf(name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; }

  // the sway: one closed path (so the cycle wraps with no jump): slide, lean and stretch from the bottom edge, and breathe in
  // opacity twice a cycle; sampled N times with linear steps, 0 % and 100 % the same.
  function sway() {
    var body = "", k, t, tau = 2 * Math.PI;
    for (k = 0; k <= N; k++) {
      t = (k % N) / N;
      var x = 80 * Math.sin(tau * t) + 26 * Math.sin(tau * 2 * t + 1), sk = 4.5 * Math.sin(tau * t + 0.8) + 1.2 * Math.sin(tau * 3 * t),
        sy = 1 + 0.13 * Math.sin(tau * 2 * t + 0.4) + 0.05 * Math.sin(tau * 3 * t + 2), o = 0.8 + 0.2 * Math.sin(tau * 2 * t + 2.1) - 0.06 * Math.cos(tau * 3 * t);
      body += r2(100 * k / N) + "%{opacity:" + r2(Math.min(1, o)) + ";transform:translateX(" + r2(x) + "px) skewX(" + r2(sk) + "deg) scaleY(" + r2(sy) + ")}";
    }
    return kf("fx-aur-sway", body);
  }
  // the flare: enters on one side dark, brightens, crosses the curtain, goes dark on the far side (dark at 0 % and 100 %)
  function run() {
    return kf("fx-aur-run", "0%{opacity:0;transform:translateX(-120px)}12%{opacity:0.55;transform:translateX(" + r2(CW * 0.1) + "px)}35%{opacity:1;transform:translateX(" + r2(CW * 0.33) + "px)}" +
      "60%{opacity:0.9;transform:translateX(" + r2(CW * 0.6) + "px)}85%{opacity:0.5;transform:translateX(" + r2(CW * 0.86) + "px)}100%{opacity:0;transform:translateX(" + CW + "px)}");
  }
  function css(pics) {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var anim = "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite;-webkit-animation-timing-function:linear;animation-timing-function:linear;";
    var out = ".fx-aurora{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-aurora b{position:absolute;display:block;width:" + CW + "px;height:" + CH + "px}" +
      ".fx-aurora b.m{-webkit-transform:scaleX(-1);transform:scaleX(-1)}" +
      ".fx-aurora i{position:absolute;display:block;left:0;top:0;width:100%;height:100%;opacity:0;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-transform-origin:50% 100%;transform-origin:50% 100%;-webkit-animation-name:fx-aur-sway;animation-name:fx-aur-sway;" + anim +
      "-webkit-animation-duration:inherit;animation-duration:inherit;-webkit-animation-delay:inherit;animation-delay:inherit}" +
      ".fx-aurora u{position:absolute;display:block;left:0;top:0;width:" + FW + "px;height:100%;opacity:0;background-size:100% 100%;background-image:url(" + pics.flare + ");" +
      "will-change:opacity,transform;-webkit-animation-name:fx-aur-run;animation-name:fx-aur-run;" + anim + "}" +
      ".fx-aurora.fx-paused i,.fx-aurora.fx-paused u{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-aurora,.old-engine .fx-aurora{display:none!important}";
    pics.curtains.forEach(function (u, n) { out += ".fx-aurora b.v" + n + " i{background-image:url(" + u + ")}"; });
    style.textContent = out + sway() + run();
  }
  function setAnim(el, dur, delay) {
    el.style.webkitAnimationDuration = el.style.animationDuration = r2(dur) + "s";
    el.style.webkitAnimationDelay = el.style.animationDelay = r2(delay) + "s";
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = AMT[want];
    if (!n || off || calm() || !doc.body) return;
    var pal = PALETTES[wantStyle] || PALETTES.green, pics = { curtains: pal.map(function (c, k) { return curtain(7 + k * 23, c); }), flare: flare(mix(pal[0], 0.2)) };
    css(pics);
    host = doc.createElement("div"); host.className = "fx-aurora" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    var q, k;
    for (q = 0; q < n[0]; q++) {
      var b = doc.createElement("b"), cyc = LOOP ? 8 : rnd(16, 26), sp = SPOTS[q];
      b.className = "v" + q + (sp[2] ? " m" : ""); b.style.left = sp[0] + "px"; b.style.top = sp[1] + "px";
      var i = doc.createElement("i"); setAnim(i, cyc, LOOP ? -((q * 2.7) % 8) : -rnd(0, cyc));
      b.appendChild(i);
      for (k = 0; k < n[1]; k++) {
        var u = doc.createElement("u"), d = LOOP ? 8 : rnd(9, 15);
        setAnim(u, d, LOOP ? -((q * 1.3 + k * 4) % 8) : -rnd(0, d));
        i.appendChild(u);
      }
      host.appendChild(b);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientAurora = {
    // amount: off | light | medium | heavy; style: green | violet | ice; disabled: Lighter / old engine / Loop
    set: function (amount, styleName, disabled) {
      var a = AMT[amount] ? amount : "off", s = PALETTES[styleName] ? styleName : "green", d = !!disabled;
      if (a === want && s === wantStyle && d === off && (host || a === "off" || d)) return;
      want = a; wantStyle = s; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    AMT: AMT, PALETTES: PALETTES
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
