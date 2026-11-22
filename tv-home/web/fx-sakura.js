// Sakura storm (design.home.sakura_storm: off | breeze | gale | storm; design.home.sakura_style: pink | white | dusk):
// a wind-driven blizzard of blossom petals blowing across the photo in gusts, from left to right and down, tumbling as they go,
// with big soft petals rushing past close to the camera and pale streaks of wind. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA, not the number of
// layers). Every petal is ONE small element with ONE CSS animation of transform only (the path across the screen, the
// swirl, the turn and the edge-on flip are all in the same keyframes), on a picture drawn once (a canvas made into an
// image); the wind streaks are one picture each that slides and fades (transform + opacity). The page draws nothing per
// frame: no filter, no blur (the close petals are drawn soft, once), no blend mode. Petals fly in gusts: the petals of a
// gust start together, so a wave of them blows through, then a lull, then the next one (an 8 s wind cycle). Total layer
// area, worst case with every petal turned to its widest: 18 / 32 / 55 % of a screen (breeze / gale / storm). Nothing moves while the home is covered, when the TV asks
// for less motion, in the Lighter home, the old engine or the Loop look (app.js ambientSync / pause / resume).
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", kind = "pink", off = false, paused = false;
  var COUNT = { breeze: 50, gale: 90, storm: 150 }, GUSTS = { breeze: 1, gale: 2, storm: 3 }, STREAKS = { breeze: 2, gale: 4, storm: 6 };
  // petal colours light to dark (lit from the top left), and the wind streak's tint
  var STYLES = {
    pink: { cols: [["#FFF1F5", "#FFC2D4", "#F48FB1"], ["#FFE4EC", "#FFADC6", "#EC7FA3"], ["#FFFFFF", "#FFD6E2", "#F7A8C2"]], wind: "255,235,242" },
    white: { cols: [["#FFFFFF", "#FFF4F7", "#F8D7E1"], ["#FFFFFF", "#FFEAF0", "#F2C6D4"], ["#FFFDFD", "#FFE0EA", "#EBB8CB"]], wind: "255,255,255" },
    dusk: { cols: [["#FF9EC0", "#E0508A", "#A8245F"], ["#FFB3CF", "#EF6FA2", "#B83A76"], ["#F78DB4", "#D43F7D", "#8E1B4D"]], wind: "255,196,220" }
  };
  var PERIOD = 8;   // the wind cycle in seconds; the close petals go round twice in it. ?fxloop=1 (showcase videos only) changes nothing
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");
  var NV = 8, STEPS = 32;

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  // a seeded random for the showcase clip (the same storm every render, so the loop repeats exactly); the real thing is random
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = Math.random;
  function rnd(a, b) { return a + R() * (b - a); }
  function pick(list) { return list[Math.floor(R() * list.length) % list.length]; }

  // a blossom petal: a rounded drop with a notch at the tip and a soft centre vein, lit from one corner; soft = a close petal, drawn
  // with a feathered edge and less opaque (it is out of focus), drawn once
  function petal(px, col, soft) {
    var c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), s = px / 64;
    g.translate(px / 2, px / 2); g.scale(s, s);
    var grad = g.createLinearGradient(-22, -26, 22, 26);
    grad.addColorStop(0, col[0]); grad.addColorStop(0.55, col[1]); grad.addColorStop(1, col[2]);
    var path = function () {
      g.beginPath(); g.moveTo(0, 26); g.bezierCurveTo(-24, 10, -20, -20, -6, -26); g.lineTo(0, -19); g.lineTo(6, -26); g.bezierCurveTo(20, -20, 24, 10, 0, 26); g.closePath();
    };
    g.fillStyle = grad;
    if (soft) {
      // feathered: a few growing, fainter copies make the soft edge with no filter
      for (var k = 3; k >= 0; k--) { g.globalAlpha = k === 0 ? 0.8 : 0.1; g.save(); g.scale(1 + k * 0.045, 1 + k * 0.045); path(); g.fill(); g.restore(); }
      g.globalAlpha = 1;
    } else {
      path(); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 22); g.lineTo(0, -12); g.stroke();
      g.strokeStyle = "rgba(190,60,100,0.18)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-8, 8, -10, -4, -9, -16); g.moveTo(0, 22); g.bezierCurveTo(8, 8, 10, -4, 9, -16); g.stroke();
    }
    return c.toDataURL("image/png");
  }
  // a wind streak: a long soft lens of pale light
  function streak(tint) {
    var c = doc.createElement("canvas"); c.width = 256; c.height = 24;
    var g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(" + tint + ",0)"); grad.addColorStop(0.7, "rgba(" + tint + ",0.55)"); grad.addColorStop(1, "rgba(" + tint + ",0)");
    g.fillStyle = grad; g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(170, 0, 256, 12); g.quadraticCurveTo(170, 24, 0, 12); g.closePath(); g.fill();
    return c.toDataURL("image/png");
  }
  function f1(n) { return Math.round(n * 10) / 10; }
  // The path of one petal over its crossing (t = 0..1), all in one transform: from off the left edge to off the right edge, falling
  // as it goes, swirling on the way (x and y sway in whole cycles, so the lines stay smooth), turning end over end and flipping edge-on.
  function variant(w, h) {
    var ax = rnd(35, 120), ay = rnd(60, 190), cx = pick([1, 2]), cy = pick([1, 2, 3]), px = rnd(0, 6.283), py = rnd(0, 6.283);
    var dy = rnd(0.1, 0.42) * h, pad = ax + 200, turns = pick([-3, -2, -1, 1, 2, 3]), r0 = rnd(0, 360), fl = pick([2, 3, 4]), pf = rnd(0, 6.283);
    var rows = [];
    for (var i = 0; i <= STEPS; i++) {
      var t = i / STEPS, T = 6.283185 * t;
      var x = -pad + (w + 2 * pad) * t + ax * Math.sin(cx * T + px) - ax * Math.sin(px) * (1 - t);
      var y = dy * t + ay * Math.sin(cy * T + py);
      var s = Math.cos(fl * T + pf);
      rows.push(f1(100 * t) + "%{transform:translate3d(" + f1(x) + "px," + f1(y) + "px,0) rotate(" + f1(r0 + turns * 360 * t) + "deg) scaleX(" + (Math.round(s * 100) / 100) + ")}");
    }
    return rows.join("");
  }
  function css(w, h, wind) {
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    var text = ".fx-sakura{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-sakura i,.fx-sakura u{position:absolute;left:0;display:block;will-change:transform;background-size:100% 100%;-webkit-animation-timing-function:linear;animation-timing-function:linear;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-sakura.fx-paused i,.fx-sakura.fx-paused u{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-sakura,.old-engine .fx-sakura{display:none!important}";
    for (var v = 0; v < NV; v++) text += kf("fx-sak" + v, variant(w, h));
    // wind streak: slides across tilted with the wind and fades up and down, dark at both ends
    var sl = [], sr = 7;
    for (var i = 0; i <= 8; i++) { var t = i / 8; sl.push(f1(100 * t) + "%{opacity:" + f1(Math.sin(Math.PI * t) * 0.9) + ";transform:translate3d(" + f1(-760 + (w + 1000) * t) + "px," + f1(t * (w + 1000) * 0.12) + "px,0) rotate(" + sr + "deg)}"); }
    return text + kf("fx-sakw", sl.join(""));
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    if (LOOP) R = mulberry(2211); else R = Math.random;
    var w = root.innerWidth || 1920, h = root.innerHeight || 1080, st = STYLES[kind] || STYLES.pink;
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    style.textContent = css(w, h);
    // pictures: 3 colours x (sharp small, sharp mid, soft close)
    var far = st.cols.map(function (c) { return petal(64, c, false); }), near = st.cols.map(function (c) { return petal(128, c, true); });
    host = doc.createElement("div"); host.className = "fx-sakura" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    var G = GUSTS[want], gusted = Math.round(n * 0.75);
    for (var i = 0; i < n; i++) {
      // depth: far (small, slow, 45 %), mid (40 %), close (15 %, big, soft, twice as fast)
      var z = i % 20 < 9 ? 0 : i % 20 < 17 ? 1 : 2;
      var size = z === 0 ? rnd(20, 34) : z === 1 ? rnd(34, 62) : rnd(80, 135), dur = z === 2 ? PERIOD / 2 : PERIOD;
      var top = rnd(-4, 92) * h / 100;
      // the petals of a gust start together (a diagonal wavefront: the lower ones a little later); the rest are spread through the cycle
      var phase = i < gusted ? (i % G) / G + rnd(-0.07, 0.07) + (top / h) * 0.09 : rnd(0, 1);
      var e = doc.createElement("i"), px = Math.round(size), back = (((phase % 1) + 1) % 1 * dur).toFixed(2); if (+back >= dur) back = "0.00";
      var pic = z === 2 ? near[i % near.length] : far[i % far.length];
      e.style.cssText = "top:" + Math.round(top) + "px;width:" + px + "px;height:" + px + "px;background-image:url(" + pic + ");opacity:" + (z === 0 ? 0.7 : z === 1 ? 0.92 : 0.85) + ";" +
        "-webkit-animation-name:fx-sak" + (i % NV) + ";animation-name:fx-sak" + (i % NV) + ";-webkit-animation-duration:" + dur + "s;animation-duration:" + dur + "s;" +
        "-webkit-animation-delay:-" + back + "s;animation-delay:-" + back + "s";
      host.appendChild(e);
    }
    var wsrc = streak(st.wind), ns = STREAKS[want];
    for (var k = 0; k < ns; k++) {
      var u = doc.createElement("u"), dd = k % 2 ? PERIOD : PERIOD / 2, at = ((k / ns) * PERIOD) % dd;
      u.style.cssText = "top:" + Math.round((0.08 + 0.78 * ((k * 0.37) % 1)) * h) + "px;width:720px;height:44px;background-image:url(" + wsrc + ");opacity:0;" +
        "-webkit-animation-name:fx-sakw;animation-name:fx-sakw;-webkit-animation-duration:" + dd + "s;animation-duration:" + dd + "s;" +
        "-webkit-animation-delay:-" + at.toFixed(2) + "s;animation-delay:-" + at.toFixed(2) + "s";
      host.appendChild(u);
    }
    // right above the photo and the weather layer, under every card
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientSakura = {
    // amount: off | breeze | gale | storm; style: pink | white | dusk; disabled: Lighter / old engine / Loop
    set: function (amount, sakuraStyle, disabled) {
      var a = COUNT[amount] ? amount : "off", k = STYLES[sakuraStyle] ? sakuraStyle : "pink", d = !!disabled;
      if (a === want && k === kind && d === off && (host || a === "off" || d)) return;
      want = a; kind = k; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, STYLES: Object.keys(STYLES)
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
