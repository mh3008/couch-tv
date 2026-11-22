// Gentle sea waves at the bottom edge (design.home.waves: off | low | some | high; design.home.waves_colour: #rrggbb, else sea teal):
// two or three soft wave strips along the bottom of the screen, each drifting sideways at its own speed and rising and falling a
// little, the back one darker, the front one lighter with a pale crest. For beach, ocean, lake and harbour designs. Off unless a
// design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A strip is ONE element whose
// background is a wave picture drawn once (a 256 x 96 canvas made into an image) repeated sideways; the element is one wave period
// wider than the screen and slides by exactly one period per cycle, so it loops without a seam. Its drift and bob are ONE CSS
// animation of transform. The page draws nothing per frame, no filter, no blend mode. low = 2 strips up to 10 vh, some = 3 up to
// 14 vh, high = 3 up to 18 vh: about 21 / 41 / 53 % of one screen in all (each strip is 125 vw wide). Under the cards (the dock sits on top of the water). Nothing
// moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", colour = "", off = false, paused = false;
  var P = 25;   // the wave period, in vw
  // per amount: the strips back to front, each [height vh, live cycle s, direction (1 = drifts left), bob vh]
  var STRIPS = {
    low: [[10, 13, 1, 0.5], [7, 9, -1, 0.4]],
    some: [[14, 15, 1, 0.7], [11, 11, -1, 0.6], [8, 8, 1, 0.5]],
    high: [[18, 15, 1, 0.9], [14, 11, -1, 0.8], [10, 8, 1, 0.6]]
  };
  // ?fxloop=1 (showcase videos only): every strip on an 8 s cycle, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function hex(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
    return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [34, 120, 150];
  }
  function mix(rgb, to, t) { return rgb.map(function (v, i) { return Math.round(v + (to[i] - v) * t); }); }
  // one wave period: a smooth crest (two half sines, a long gentle one and a shorter one, so the strip doesn't look machine-made),
  // filled with the water colour fading down, and a pale crest line along the top when `crest`
  function wave(rgb, a, crest, k) {   // a: the strip's alpha, a NUMBER (a "0.50" string made rgba(...,NaN) and a page error, 22 Nov)
    var w = 256, h = 96, c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d"), y = function (x) { var t = x / w * Math.PI * 2; return 26 + 14 * Math.sin(t + k) + 5 * Math.sin(2 * t + 2 * k + 1); };
    g.beginPath(); g.moveTo(0, h);
    for (var x = 0; x <= w; x += 4) g.lineTo(x, y(x));
    g.lineTo(w, h); g.closePath();
    var f = g.createLinearGradient(0, 8, 0, h);
    f.addColorStop(0, "rgba(" + rgb + "," + a + ")"); f.addColorStop(1, "rgba(" + mix(rgb, [0, 0, 0], 0.35) + "," + Math.min(1, a + 0.15) + ")");
    g.fillStyle = f; g.fill();
    if (crest) {
      g.beginPath(); g.moveTo(0, y(0));
      for (var x2 = 4; x2 <= w; x2 += 4) g.lineTo(x2, y(x2));
      g.lineWidth = 3; g.strokeStyle = "rgba(" + mix(rgb, [255, 255, 255], 0.75) + ",0.55)"; g.stroke();
    }
    return c.toDataURL("image/png");
  }
  function css(strips) {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    var t = function (x, y) { return "transform:translate3d(" + x + "vw," + y + "vh,0)"; };
    style.textContent = ".fx-waves{position:fixed;left:0;right:0;bottom:0;height:20vh;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-waves i{position:absolute;left:0;bottom:-1vh;width:" + (100 + P) + "vw;display:block;background-repeat:repeat-x;background-position:0 0;" +
      "background-size:" + P + "vw 100%;will-change:transform;-webkit-animation-timing-function:linear;animation-timing-function:linear;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-waves.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-waves,.old-engine .fx-waves{display:none!important}" +
      // drift: exactly one period per cycle (a seamless loop); bob: up and down twice per cycle. Leftward strips go 0 -> -P,
      // rightward ones -P -> 0 (the strip is one period wider than the screen, so its right edge never shows)
      strips.map(function (s, k) {
        var x0 = s[2] > 0 ? 0 : -P, x1 = s[2] > 0 ? -P : 0, b = s[3], q = function (f) { return +(x0 + (x1 - x0) * f).toFixed(2); };
        return kf("fx-wave" + k, "0%{" + t(x0, 0) + "}25%{" + t(q(0.25), -b) + "}50%{" + t(q(0.5), 0) + "}75%{" + t(q(0.75), -b) + "}100%{" + t(x1, 0) + "}");
      }).join("");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var strips = STRIPS[want];
    if (!strips || off || calm() || !doc.body) return;
    css(strips);
    var base = hex(colour), n = strips.length;
    host = doc.createElement("div"); host.className = "fx-waves" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      // back to front: darker and more see-through at the back, lighter with a crest at the front
      var front = k === n - 1, rgb = k === 0 ? mix(base, [0, 0, 0], 0.3) : front ? mix(base, [255, 255, 255], 0.12) : base;
      var s = strips[k], d = LOOP ? 8 : s[1], el = doc.createElement("i");
      el.style.cssText = "height:" + s[0] + "vh;background-image:url(" + wave(rgb, +(0.5 + 0.18 * k).toFixed(2), front, k * 1.7) + ");" +
        "-webkit-animation-name:fx-wave" + k + ";animation-name:fx-wave" + k + ";-webkit-animation-duration:" + d + "s;animation-duration:" + d + "s;" +
        "-webkit-animation-delay:-" + (LOOP ? 0 : (d * k / n).toFixed(2)) + "s;animation-delay:-" + (LOOP ? 0 : (d * k / n).toFixed(2)) + "s";
      host.appendChild(el);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientWaves = {
    // amount: off | low | some | high; colour: #rrggbb (the design's waves_colour, else sea teal); disabled: Lighter / old engine / Loop
    set: function (amount, col, disabled) {
      var a = STRIPS[amount] ? amount : "off", c = String(col || ""), d = !!disabled;
      if (a === want && c === colour && d === off && (host || a === "off" || d)) return;
      want = a; colour = c; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    STRIPS: STRIPS, P: P
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
