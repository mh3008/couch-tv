// Sakura storm (design.home.sakura_storm: off | breeze | gale | storm; design.home.sakura_style: pink | white | dusk):
// a wind-driven blizzard of blossom petals blowing across the photo in gusts, from left to right and down, with big soft
// petals rushing past close to the camera and pale streaks of wind. Off unless a design picks it.
//
// Made for a Fire TV stick. What costs there is the NUMBER of separately animated layers (shooting stars failed at 84 tiny layers
// under 1 % of the screen), so a storm is at most 30 layers however many petals it has: the petals are drawn into SWARMS, each swarm
// ONE picture (a handful of petals, each in its own pose: turned, tipped, edge-on; drawn once on a canvas) that is ONE layer with ONE
// CSS animation of transform only (the path across the screen, the swirl and a gentle turn to and fro of the whole swarm). The swarms
// of a gust start together, so a wave of petals blows through, then a lull, then the next one (an 8 s wind cycle). The wind streaks
// are pictures that slide and fade (transform + opacity), two streaks to a layer. The page draws nothing per frame: no filter, no
// blur (the close petals are drawn soft, once), no blend mode. Layers, worst case: breeze 13, gale 20, storm 29. Nothing moves
// while the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look (app.js
// ambientSync / pause / resume).
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", kind = "pink", off = false, paused = false, stats = { petals: 0, layers: 0, swarms: 0 };
  var COUNT = { breeze: 50, gale: 90, storm: 150 }, GUSTS = { breeze: 1, gale: 2, storm: 3 };
  // swarm layers per depth (far, mid, close) and wind-streak layers (two streaks each): the layer budget, 30 at most
  var SWARMS = { breeze: [3, 6, 3], gale: [4, 9, 5], storm: [6, 12, 8] }, STREAKL = { breeze: 1, gale: 2, storm: 3 };
  var SIZE = [[20, 34], [34, 62], [80, 135]], BOX = [[360, 210], [300, 200], [440, 260]];   // a petal's size and a swarm's box, per depth
  var ALPHA = [0.7, 0.92, 0.85], PS = [1, 1.5, 1];                                           // the haze baked into the picture, and its resolution
  // petal colours light to dark (lit from the top left), and the wind streak's tint
  var STYLES = {
    pink: { cols: [["#FFF1F5", "#FFC2D4", "#F48FB1"], ["#FFE4EC", "#FFADC6", "#EC7FA3"], ["#FFFFFF", "#FFD6E2", "#F7A8C2"]], wind: "255,235,242" },
    white: { cols: [["#FFFFFF", "#FFF4F7", "#F8D7E1"], ["#FFFFFF", "#FFEAF0", "#F2C6D4"], ["#FFFDFD", "#FFE0EA", "#EBB8CB"]], wind: "255,255,255" },
    dusk: { cols: [["#FF9EC0", "#E0508A", "#A8245F"], ["#FFB3CF", "#EF6FA2", "#B83A76"], ["#F78DB4", "#D43F7D", "#8E1B4D"]], wind: "255,196,220" }
  };
  var PERIOD = 8;   // the wind cycle in seconds; the close swarms go round twice in it. ?fxloop=1 (showcase videos only) changes nothing
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");
  var NV = 8, STEPS = 32;

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  // a seeded random for the showcase clip (the same storm every render, so the loop repeats exactly); the real thing is random
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = Math.random;
  function rnd(a, b) { return a + R() * (b - a); }
  function pick(list) { return list[Math.floor(R() * list.length) % list.length]; }
  function f1(n) { return Math.round(n * 10) / 10; }

  // a blossom petal at (cx, cy), s px, turned by rot and seen at width sx (-1..1: edge-on to flat, either side up): a rounded drop
  // with a notch at the tip and a soft centre vein, lit from one corner; soft = a close petal, drawn with a feathered edge (it is out
  // of focus). alpha = the haze of its depth, baked in
  function petal(g, cx, cy, s, col, soft, rot, sx, alpha) {
    g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(s / 64 * sx, s / 64);
    var grad = g.createLinearGradient(-22, -26, 22, 26);
    grad.addColorStop(0, col[0]); grad.addColorStop(0.55, col[1]); grad.addColorStop(1, col[2]);
    var path = function () {
      g.beginPath(); g.moveTo(0, 26); g.bezierCurveTo(-24, 10, -20, -20, -6, -26); g.lineTo(0, -19); g.lineTo(6, -26); g.bezierCurveTo(20, -20, 24, 10, 0, 26); g.closePath();
    };
    g.fillStyle = grad;
    if (soft) {
      // feathered: a few growing, fainter copies make the soft edge with no filter
      for (var k = 3; k >= 0; k--) { g.globalAlpha = alpha * (k === 0 ? 0.8 : 0.1); g.save(); g.scale(1 + k * 0.045, 1 + k * 0.045); path(); g.fill(); g.restore(); }
    } else {
      g.globalAlpha = alpha; path(); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 22); g.lineTo(0, -12); g.stroke();
      g.strokeStyle = "rgba(190,60,100,0.18)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-8, 8, -10, -4, -9, -16); g.moveTo(0, 22); g.bezierCurveTo(8, 8, 10, -4, 9, -16); g.stroke();
    }
    g.restore();
  }
  // where the petals of one swarm sit in its box (spread, not stacked), each with its own turn and its own width
  function scatter(m, z, bw, bh, ncols) {
    var out = [], i, t, k, c, ok, s;
    for (i = 0; i < m; i++) {
      s = rnd(SIZE[z][0], SIZE[z][1]);
      for (t = 0; t < 40; t++) {
        c = { x: rnd(s * 0.5, bw - s * 0.5), y: rnd(s * 0.5, bh - s * 0.5), s: s };
        ok = true; for (k = 0; k < out.length; k++) if (Math.abs(out[k].x - c.x) < (out[k].s + s) * 0.38 && Math.abs(out[k].y - c.y) < (out[k].s + s) * 0.38) ok = false;
        if (ok) break;
      }
      c.rot = rnd(0, 6.283); c.sx = (R() < 0.5 ? -1 : 1) * (z === 2 ? rnd(0.55, 1) : rnd(0.28, 1)); c.col = Math.floor(R() * ncols) % ncols;
      out.push(c);
    }
    return out;
  }
  // one swarm's picture: its petals, drawn once
  function swarmPic(z, petals, st) {
    var bw = BOX[z][0], bh = BOX[z][1], c = doc.createElement("canvas"), i, p;
    c.width = Math.round(bw * PS[z]); c.height = Math.round(bh * PS[z]);
    var g = c.getContext("2d"); g.scale(PS[z], PS[z]);
    for (i = 0; i < petals.length; i++) { p = petals[i]; petal(g, p.x, p.y, p.s, st.cols[p.col], z === 2, p.rot, p.sx, ALPHA[z]); }
    return c.toDataURL("image/png");
  }
  // wind streaks: long soft lenses of pale light, two to a picture (a gap between them)
  function streaks(tint) {
    var c = doc.createElement("canvas"); c.width = 256; c.height = 140;
    var g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 256, 0), y;
    grad.addColorStop(0, "rgba(" + tint + ",0)"); grad.addColorStop(0.7, "rgba(" + tint + ",0.55)"); grad.addColorStop(1, "rgba(" + tint + ",0)");
    g.fillStyle = grad;
    for (y = 0; y < 2; y++) { g.save(); g.translate(0, y * 106); g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(170, 0, 256, 12); g.quadraticCurveTo(170, 24, 0, 12); g.closePath(); g.fill(); g.restore(); }
    return c.toDataURL("image/png");
  }
  // The path of one swarm over its crossing (t = 0..1), all in one transform: from off the left edge to off the right edge, falling as
  // it goes, swirling on the way (x and y sway in whole cycles, so the lines stay smooth), the whole swarm turning a little to and fro.
  function variant(w, h) {
    var ax = rnd(35, 120), ay = rnd(40, 150), cx = pick([1, 2]), cy = pick([1, 2, 3]), px = rnd(0, 6.283), py = rnd(0, 6.283);
    var dy = rnd(0.1, 0.42) * h, pad = 480 + ax, ar = rnd(7, 18), cr = pick([1, 2]), pr = rnd(0, 6.283);
    var rows = [];
    for (var i = 0; i <= STEPS; i++) {
      var t = i / STEPS, T = 6.283185 * t;
      var x = -pad + (w + 2 * pad) * t + ax * Math.sin(cx * T + px) - ax * Math.sin(px) * (1 - t);
      var y = dy * t + ay * Math.sin(cy * T + py);
      rows.push(f1(100 * t) + "%{transform:translate3d(" + f1(x) + "px," + f1(y) + "px,0) rotate(" + f1(ar * Math.sin(cr * T + pr)) + "deg)}");
    }
    return rows.join("");
  }
  function css(w, h) {
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
    host = doc.createElement("div"); host.className = "fx-sakura" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    // depth: far (small, slow, 45 %), mid (40 %), close (15 %, big, soft, twice as fast); the petals of a depth are shared out over its swarms
    var perZ = [0, 0, 0], i, z, s, q = 0, G = GUSTS[want], S = SWARMS[want], nsw = S[0] + S[1] + S[2], gusted = Math.round(nsw * 0.75);
    for (i = 0; i < n; i++) perZ[i % 20 < 9 ? 0 : i % 20 < 17 ? 1 : 2]++;
    stats = { petals: 0, layers: 0, swarms: nsw };
    for (z = 0; z < 3; z++) {
      for (s = 0; s < S[z]; s++, q++) {
        var m = Math.floor(perZ[z] / S[z]) + (s < perZ[z] % S[z] ? 1 : 0), bw = BOX[z][0], bh = BOX[z][1], dur = z === 2 ? PERIOD / 2 : PERIOD;
        var top = rnd(-4, 92) * h / 100;
        // the swarms of a gust start together (a diagonal wavefront: the lower ones a little later); the rest are spread through the cycle
        var phase = q < gusted ? (q % G) / G + rnd(-0.07, 0.07) + (top / h) * 0.09 : rnd(0, 1);
        var e = doc.createElement("i"), back = (((phase % 1) + 1) % 1 * dur).toFixed(2); if (+back >= dur) back = "0.00";
        e.style.cssText = "top:" + Math.round(top) + "px;width:" + bw + "px;height:" + bh + "px;background-image:url(" + swarmPic(z, scatter(m, z, bw, bh, st.cols.length), st) + ");" +
          "-webkit-animation-name:fx-sak" + (q % NV) + ";animation-name:fx-sak" + (q % NV) + ";-webkit-animation-duration:" + dur + "s;animation-duration:" + dur + "s;" +
          "-webkit-animation-delay:-" + back + "s;animation-delay:-" + back + "s";
        host.appendChild(e); stats.petals += m;
      }
    }
    var wsrc = streaks(st.wind), ns = STREAKL[want];
    for (var k = 0; k < ns; k++) {
      var u = doc.createElement("u"), dd = k % 2 ? PERIOD : PERIOD / 2, at = ((k / ns) * PERIOD) % dd;
      u.style.cssText = "top:" + Math.round((0.06 + 0.66 * ((k * 0.37) % 1)) * h) + "px;width:720px;height:257px;background-image:url(" + wsrc + ");opacity:0;" +
        "-webkit-animation-name:fx-sakw;animation-name:fx-sakw;-webkit-animation-duration:" + dd + "s;animation-duration:" + dd + "s;" +
        "-webkit-animation-delay:-" + at.toFixed(2) + "s;animation-delay:-" + at.toFixed(2) + "s";
      host.appendChild(u);
    }
    stats.layers = host.childNodes.length;
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
    stats: function () { return { petals: stats.petals, layers: stats.layers, swarms: stats.swarms }; },   // what the last build made (the tests count them)
    COUNT: COUNT, STYLES: Object.keys(STYLES)
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
