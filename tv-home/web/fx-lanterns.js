// Floating sky lanterns (design.home.lanterns: off | few | some | many; design.home.lanterns_style: warm | red | gold): paper lanterns
// lit from inside rising slowly from below the screen, swaying a little as they go, fading high up; far ones small and dim, near ones
// bigger and brighter. For night skies, harbours, lakes, Lunar New Year, Diwali and Loy Krathong / Yi Peng designs. Off unless chosen.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A lantern is ONE element with its
// picture drawn once (a 64 x 88 canvas: a glowing rounded body, a darker rim, a soft halo); its rise, sway and fade are ONE CSS animation
// of transform + opacity on one of four paths. Nothing drawn per frame, no filter, no blend mode. 8 / 14 / 22 lanterns of 1.2-3.2 vw:
// about 2 / 3 / 5 % of a screen in all. Under the cards. Nothing moves while the home is covered, when the TV asks for less motion, in the
// Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", look = "warm", off = false, paused = false;
  var COUNT = { few: 8, some: 14, many: 22 };
  var STYLE = { warm: [255, 150, 60], red: [235, 70, 50], gold: [255, 196, 90] };
  var SWAY = [[1.5, -1.2], [-1.4, 1.6], [2.2, 0.8], [-0.9, -2.0]];   // four paths: sideways drift (vw) at 1/3 and 2/3 of the rise
  // ?fxloop=1 (showcase videos only): 8 s cycles over a shorter rise (55 vh), spread through the cycle, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");
  var RISE = LOOP ? 55 : 125;   // vh climbed per cycle (live: from below the screen to above it)

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function mix(rgb, to, t) { return rgb.map(function (v, i) { return Math.round(v + (to[i] - v) * t); }); }
  // a lantern: a soft halo, then a rounded paper body (wider at the top) glowing hot in its lower middle, a darker rim at top and bottom
  function lantern(rgb, a) {   // a: how strong (far lanterns get a fainter picture: the animation owns opacity)
    var w = 64, h = 88, c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d"), cx = w / 2, hot = mix(rgb, [255, 255, 255], 0.6), deep = mix(rgb, [0, 0, 0], 0.35);
    var halo = g.createRadialGradient(cx, h * 0.55, 4, cx, h * 0.55, w * 0.62);
    halo.addColorStop(0, "rgba(" + rgb + "," + (0.38 * a).toFixed(3) + ")"); halo.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    var x0 = w * 0.28, x1 = w * 0.72, y0 = h * 0.22, y1 = h * 0.82, bx0 = w * 0.34, bx1 = w * 0.66;
    var body = g.createRadialGradient(cx, h * 0.66, 2, cx, h * 0.56, w * 0.34);
    body.addColorStop(0, "rgba(" + hot + "," + a + ")"); body.addColorStop(0.55, "rgba(" + rgb + "," + (0.95 * a).toFixed(3) + ")"); body.addColorStop(1, "rgba(" + deep + "," + (0.9 * a).toFixed(3) + ")");
    g.fillStyle = body; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, y0 - h * 0.05, x1, y0);
    g.lineTo(bx1, y1); g.quadraticCurveTo(cx, y1 + h * 0.03, bx0, y1); g.closePath(); g.fill();
    g.fillStyle = "rgba(" + mix(deep, [0, 0, 0], 0.3) + "," + (0.85 * a).toFixed(3) + ")";
    g.fillRect(bx0, y1 - 1, bx1 - bx0, 3);   // the bottom ring the flame sits in
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    var t = function (x, y, r) { return "transform:translate3d(" + x + "vw," + y + "vh,0) rotate(" + r + "deg)"; };
    style.textContent = ".fx-lanterns{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-lanterns i{position:absolute;display:block;background-size:100% 100%;opacity:0;will-change:opacity,transform;" +
      "-webkit-animation-timing-function:linear;animation-timing-function:linear;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-lanterns.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-lanterns,.old-engine .fx-lanterns{display:none!important}" +
      // up RISE vh with a sideways sway and a little tilt; fade in over the first 8 %, out over the last 18 %
      SWAY.map(function (s, k) {
        return kf("fx-lantern" + k, "0%{opacity:0;" + t(0, 0, 0) + "}8%{opacity:1}33%{" + t(s[0], -RISE / 3, s[0] > 0 ? 3 : -3) + "}" +
          "66%{" + t(s[1], -2 * RISE / 3, s[1] > 0 ? 3 : -3) + "}82%{opacity:.85}100%{opacity:0;" + t(0, -RISE, 0) + "}");
      }).join("");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var rgb = STYLE[look], pics = [lantern(rgb, 0.55), lantern(rgb, 1)];   // far, near
    host = doc.createElement("div"); host.className = "fx-lanterns" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      // depth: 0 far (small, dim, slow) .. 1 near (big, bright, quicker)
      var z = Math.random(), w = 1.2 + 2 * z, d = LOOP ? 8 : 34 - 14 * z + rnd(-2, 2), at = LOOP ? -(k * 8 / n) : -rnd(0, d);
      var top = LOOP ? rnd(45, 100) : 104;   // live: they start just below the screen
      var el = doc.createElement("i");
      el.style.cssText = "left:" + rnd(3, 95).toFixed(1) + "%;top:" + top.toFixed(1) + "vh;width:" + w.toFixed(2) + "vw;height:" + (w * 88 / 64).toFixed(2) + "vw;" +
        "background-image:url(" + pics[z < 0.4 ? 0 : 1] + ");-webkit-animation-name:fx-lantern" + (k % 4) + ";animation-name:fx-lantern" + (k % 4) + ";" +
        "-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s;" +
        "z-index:" + Math.round(z * 10);
      host.appendChild(el);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientLanterns = {
    // amount: off | few | some | many; style: warm | red | gold; disabled: Lighter / old engine / Loop
    set: function (amount, st, disabled) {
      var a = COUNT[amount] ? amount : "off", s = STYLE[st] ? st : "warm", d = !!disabled;
      if (a === want && s === look && d === off && (host || a === "off" || d)) return;
      want = a; look = s; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, STYLE: STYLE, SWAY: SWAY
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
