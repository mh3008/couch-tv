// Candle flicker glow (design.home.candle: off | one | two | three; design.home.candle_colour: #rrggbb, else warm candlelight):
// soft pools of warm light rising from the bottom edge, as if candles stood just below the screen, each flickering gently and
// unevenly on its own rhythm. For cosy, bedroom, Christmas, fireplace and night designs. Off unless a design picks it.
//
// Gentle on purpose: a candle simulator on GitHub carries an epilepsy warning. Here a glow only breathes between 72 % and 100 % of its
// brightness and 97-103 % of its size, never off, never a flash; the steps are uneven (so it reads as a flame) but no step is shorter
// than a fifth of a second.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A glow is ONE element with a
// radial picture drawn once (a 128 px canvas, stretched: it is soft anyway); its flicker is ONE CSS animation of transform (scale) +
// opacity. Nothing drawn per frame, no filter, no blend mode. A glow is 30 vw across, its centre on the bottom edge: about 16 % of a
// screen each, 16 / 32 / 48 % in all. Under the cards. Nothing moves while the home is covered, when the TV asks for less motion, in the
// Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", colour = "", off = false, paused = false;
  var SIZE = 30;   // vw across
  var PLACES = { one: [16], two: [16, 84], three: [16, 84, 50] };   // centres, % of the width (the bottom-left first)
  var CYCLES = [3.3, 4.1, 2.9];   // live seconds per glow: different, so the three never pulse together
  // the flicker: [% of the cycle, opacity, scale]; uneven, gentle, never below 0.72
  var STEPS = [[0, 0.86, 1], [9, 1, 1.02], [17, 0.78, 0.98], [24, 0.94, 1.01], [36, 0.72, 0.97], [45, 0.9, 1.01], [53, 1, 1.03],
    [62, 0.8, 0.98], [71, 0.95, 1.02], [80, 0.75, 0.97], [91, 0.92, 1.01], [100, 0.86, 1]];
  // ?fxloop=1 (showcase videos only): cycles of 8 / 4 / 2 s (they divide 8), so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function hex(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
    return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [255, 170, 90];
  }
  // a glow: a pale warm core fading through the colour to nothing
  function glow(rgb) {
    var px = 128, c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, o = g.createRadialGradient(r, r, 0, r, r, r);
    var core = rgb.map(function (v) { return Math.round(v + (255 - v) * 0.55); });
    o.addColorStop(0, "rgba(" + core + ",0.55)"); o.addColorStop(0.25, "rgba(" + rgb + ",0.38)"); o.addColorStop(0.6, "rgba(" + rgb + ",0.12)"); o.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = o; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    style.textContent = ".fx-candle{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-candle i{position:absolute;bottom:-" + SIZE / 2 + "vw;width:" + SIZE + "vw;height:" + SIZE + "vw;margin-left:-" + SIZE / 2 + "vw;display:block;" +
      "background-size:100% 100%;will-change:opacity,transform;-webkit-transform-origin:50% 50%;transform-origin:50% 50%;" +
      "-webkit-animation-name:fx-candle;animation-name:fx-candle;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-candle.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-candle,.old-engine .fx-candle{display:none!important}" +
      kf("fx-candle", STEPS.map(function (s) { return s[0] + "%{opacity:" + s[1] + ";transform:scale(" + s[2] + ")}"; }).join(""));
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var places = PLACES[want];
    if (!places || off || calm() || !doc.body) return;
    css();
    var pic = glow(hex(colour));
    host = doc.createElement("div"); host.className = "fx-candle" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < places.length; k++) {
      var d = LOOP ? 8 / Math.pow(2, k) : CYCLES[k], el = doc.createElement("i");
      el.style.cssText = "left:" + places[k] + "%;background-image:url(" + pic + ");-webkit-animation-duration:" + d + "s;animation-duration:" + d + "s;" +
        "-webkit-animation-delay:-" + (d * k / 3).toFixed(2) + "s;animation-delay:-" + (d * k / 3).toFixed(2) + "s";
      host.appendChild(el);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientCandle = {
    // amount: off | one | two | three; colour: #rrggbb (the design's candle_colour, else warm candlelight); disabled: Lighter / old engine / Loop
    set: function (amount, col, disabled) {
      var a = PLACES[amount] ? amount : "off", c = String(col || ""), d = !!disabled;
      if (a === want && c === colour && d === off && (host || a === "off" || d)) return;
      want = a; colour = c; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    PLACES: PLACES, STEPS: STEPS, CYCLES: CYCLES, SIZE: SIZE
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
