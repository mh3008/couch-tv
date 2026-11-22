// Drifting clouds (design.home.clouds: off | few | some | many; design.home.clouds_style: white | grey | dusk): soft clouds drifting
// slowly across the sky from left to right, far ones small, faint and slow, near ones bigger, brighter and quicker, so the sky has depth.
// For skies with room: beaches, fields, mountains, sunrise and sunset designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A cloud is ONE element with its
// picture drawn once (a 256 x 112 canvas of overlapping soft puffs with a greyer underside; three different shapes); its drift is ONE CSS
// animation of transform across the sky, from just off the left edge to just off the right one. Nothing drawn per frame, no filter, no
// blend mode. 4 / 7 / 11 clouds of 12-30 vw: about 14 / 24 / 38 % of a screen in all. Under the cards. Nothing moves while the home is
// covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look.
// The real drift is slow (a crossing takes 1-3 minutes); the showcase loop (?fxloop=1) is a time-lapse: a crossing in 8 s.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", look = "white", off = false, paused = false;
  var COUNT = { few: 4, some: 7, many: 11 };
  var TONE = { white: [[255, 255, 255], [214, 222, 232]], grey: [[226, 230, 236], [150, 158, 170]], dusk: [[255, 226, 214], [196, 140, 150]] };   // top, underside
  var BAND = [3, 30];   // % from the top: the sky (above most horizons: a cloud in front of a mountain top looks wrong)
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  // a cloud: soft round puffs along a flat-ish base, bigger in the middle; the underside a little darker. seed picks the shape
  function cloud(tone, a, seed) {
    var w = 256, h = 112, c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d"), top = tone[0], under = tone[1], rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var n = 11 + Math.floor(rnd() * 5);
    for (var k = 0; k < n; k++) {
      var f = k / (n - 1), x = 28 + f * 200 + (rnd() - 0.5) * 18, peak = Math.sin(f * Math.PI), r = 16 + peak * 26 + rnd() * 10, y = 84 - peak * 26 - rnd() * 10;
      var p = g.createRadialGradient(x, y, r * 0.15, x, y, r);
      var mid = top.map(function (v, i) { return Math.round(v + (under[i] - v) * Math.min(1, Math.max(0, (y - 50) / 40))); });
      p.addColorStop(0, "rgba(" + mid + "," + (0.55 * a).toFixed(3) + ")"); p.addColorStop(0.7, "rgba(" + mid + "," + (0.3 * a).toFixed(3) + ")"); p.addColorStop(1, "rgba(" + mid + ",0)");
      g.fillStyle = p; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    style.textContent = ".fx-clouds{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-clouds i{position:absolute;display:block;background-size:100% 100%;will-change:transform;" +
      "-webkit-animation-name:fx-cloud;animation-name:fx-cloud;-webkit-animation-timing-function:linear;animation-timing-function:linear;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-clouds.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-clouds,.old-engine .fx-clouds{display:none!important}" +
      // from its start just off the left edge (left: -width) to just off the right one: 100 vw + its own width, set per cloud below
      kf("fx-cloud", "from{transform:translate3d(0,0,0)}to{transform:translate3d(130vw,0,0)}");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var tone = TONE[look], far = [cloud(tone, 0.55, 11), cloud(tone, 0.55, 23)], near = [cloud(tone, 1, 37), cloud(tone, 1, 51), cloud(tone, 1, 67)];
    host = doc.createElement("div"); host.className = "fx-clouds" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      // depth: 0 far (small, faint, high, slow) .. 1 near (big, bright, lower, quicker)
      var z = k / Math.max(1, n - 1), w = 12 + 18 * z + rnd(-1.5, 1.5), d = LOOP ? 8 : 190 - 110 * z + rnd(-10, 10), at = LOOP ? -(k * 8 / n) : -rnd(0, d);
      var el = doc.createElement("i");
      el.style.cssText = "left:-30vw;top:" + (BAND[0] + (BAND[1] - BAND[0]) * (0.25 * (1 - z) + 0.75 * Math.random() * (0.4 + 0.6 * z))).toFixed(1) + "%;" +
        "width:" + w.toFixed(2) + "vw;height:" + (w * 112 / 256).toFixed(2) + "vw;background-image:url(" + (z < 0.4 ? far[k % 2] : near[k % 3]) + ");" +
        "-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s;" +
        "z-index:" + Math.round(z * 10);
      host.appendChild(el);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientClouds = {
    // amount: off | few | some | many; style: white | grey | dusk; disabled: Lighter / old engine / Loop
    set: function (amount, st, disabled) {
      var a = COUNT[amount] ? amount : "off", s = TONE[st] ? st : "white", d = !!disabled;
      if (a === want && s === look && d === off && (host || a === "off" || d)) return;
      want = a; look = s; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, TONE: TONE, BAND: BAND
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
