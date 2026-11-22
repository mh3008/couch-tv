// Drifting dust motes in sun (design.home.dust: off | few | some | many; design.home.dust_from: left | right): one soft shaft of
// sunlight slanting down from a top corner, and tiny motes of dust floating in it, wandering slowly and twinkling as they catch the
// light. For sunny rooms, forests, sunrise and cosy daytime designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). The shaft is ONE still element
// (a soft beam picture drawn once, rotated once: it never animates). A mote is ONE tiny element (0.15-0.4 vw) with a glow picture drawn
// once; its wander and twinkle are ONE CSS animation of transform + opacity on one of six slow paths. The motes are NOT clipped to the
// shaft (a rotated clip would be a GPU mask): each is placed inside the shaft by the numbers and wanders only a little, so it stays in
// the light. Nothing drawn per frame, no filter, no blend mode. The shaft is ~26 % of a screen (22 vw x 120 vh), painted once; of 40 / 70 / 110 motes, 14 / 20 / 28 move (the rest are
// still specks in a second picture over the shaft): well under 1 % of a screen.
// Under the cards. Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the
// Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", from = "left", off = false, paused = false;
  var COUNT = { few: 40, some: 70, many: 110 };   // motes in all
  // only these wander and twinkle (one layer each); the rest are painted as still specks into one picture over the shaft (Design Lessons
  // 15b, 22 Nov: the stick's cost is the number of animated layers: shooting stars with 84 missed 24.8 % of frames)
  var ANIM = { few: 14, some: 20, many: 28 };
  var SHAFT = { w: 22, len: 120, tilt: 28, x: 12, y: -8 };   // width vw, length vh, degrees from straight down, top end (vw from its side, vh)
  // six slow wander paths: [dx vw, dy vh] at 25 / 50 / 75 % of the cycle (back home at 100 %)
  var PATHS = [[[1.2, -1.5], [2.0, 0.6], [0.6, 1.8]], [[-1.4, 1.0], [-0.4, 2.2], [0.9, 1.1]], [[0.8, 1.6], [-1.0, 2.4], [-1.5, 0.8]],
    [[-0.9, -1.2], [0.7, -2.0], [1.3, -0.4]], [[1.6, 0.4], [0.9, -1.4], [-0.6, -0.9]], [[-1.1, -0.3], [-1.8, 1.3], [-0.2, 1.9]]];
  var VH = 9 / 16;   // 1 vh in vw on a 16:9 screen
  // ?fxloop=1 (showcase videos only): every mote on an 8 s cycle, spread through it, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function mote() {   // a soft warm-white speck
    var px = 16, c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, o = g.createRadialGradient(r, r, 0, r, r, r);
    o.addColorStop(0, "rgba(255,250,235,1)"); o.addColorStop(0.35, "rgba(255,240,210,0.7)"); o.addColorStop(1, "rgba(255,235,200,0)");
    g.fillStyle = o; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function beam() {   // the shaft: soft edges across, brightest near the top, fading down its length
    var w = 32, h = 128, c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d");
    for (var k = 0; k < 5; k++) {
      var s = 1 - k * 0.18, x0 = w / 2 * (1 - s), v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(255,244,220,0.10)"); v.addColorStop(0.3, "rgba(255,244,220,0.07)"); v.addColorStop(1, "rgba(255,244,220,0)");
      g.fillStyle = v; g.fillRect(x0, 0, w * s, h);
    }
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // the still motes: m soft specks painted once on a canvas the shape of the shaft (laid over it, turned with it, never animated)
  function specks(m) {
    var w = 176, h = 480, c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d");
    for (var k = 0; k < m; k++) {
      var x = rnd(0.14, 0.86) * w, y = rnd(0.06, 0.9) * h, r = rnd(1.2, 2.6), a = rnd(0.3, 0.75);
      var o = g.createRadialGradient(x, y, 0, x, y, r * 2);
      o.addColorStop(0, "rgba(255,250,235," + a.toFixed(2) + ")"); o.addColorStop(1, "rgba(255,235,200,0)");
      g.fillStyle = o; g.beginPath(); g.arc(x, y, r * 2, 0, Math.PI * 2); g.fill();
    }
    return c.toDataURL("image/png");
  }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    var tr = function (p) { return "transform:translate3d(" + p[0] + "vw," + p[1] + "vh,0)"; };
    style.textContent = ".fx-dust{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-dust b{position:absolute;display:block;background-size:100% 100%;-webkit-transform-origin:50% 0;transform-origin:50% 0}" +
      ".fx-dust i{position:absolute;display:block;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-dust.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-dust,.old-engine .fx-dust{display:none!important}" +
      // a mote twinkles twice per cycle as it turns in the light (0.25 -> 1 -> 0.35 -> 0.9 -> 0.25)
      PATHS.map(function (p, k) {
        return kf("fx-dust" + k, "0%,100%{opacity:.25;" + tr([0, 0]) + "}25%{opacity:1;" + tr(p[0]) + "}50%{opacity:.35;" + tr(p[1]) + "}75%{opacity:.9;" + tr(p[2]) + "}");
      }).join("");
  }
  // a point inside the shaft: s along it (0..1 of its length), u across it (-0.5..0.5 of its width) -> [left vw, top vh]
  function inShaft(s, u) {
    var dir = from === "right" ? -1 : 1, a = SHAFT.tilt * Math.PI / 180, L = SHAFT.len * VH;   // the length in vw units
    var x0 = from === "right" ? 100 - SHAFT.x : SHAFT.x, y0 = SHAFT.y * VH;
    var x = x0 + dir * (Math.sin(a) * s * L + Math.cos(a) * u * SHAFT.w), y = y0 + Math.cos(a) * s * L - Math.sin(a) * u * SHAFT.w;   // (across: u's sign mirrors with the side, harmless: u is symmetric)
    return [+x.toFixed(2), +(y / VH).toFixed(2)];
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var dir = from === "right" ? -1 : 1;
    host = doc.createElement("div"); host.className = "fx-dust" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    var sh = doc.createElement("b"), x0 = from === "right" ? 100 - SHAFT.x : SHAFT.x;
    sh.style.cssText = "left:" + x0 + "vw;top:" + SHAFT.y + "vh;width:" + SHAFT.w + "vw;height:" + SHAFT.len + "vh;margin-left:-" + SHAFT.w / 2 + "vw;" +
      "background-image:url(" + beam() + ");-webkit-transform:rotate(" + (-dir * SHAFT.tilt) + "deg);transform:rotate(" + (-dir * SHAFT.tilt) + "deg)";
    host.appendChild(sh);
    var still = doc.createElement("b"), a = ANIM[want];
    still.style.cssText = sh.style.cssText.replace(/background-image:url\([^)]*\)/, "background-image:url(" + specks(n - a) + ")");
    host.appendChild(still);
    var pic = mote();
    for (var k = 0; k < a; k++) {
      var p = inShaft(rnd(0.06, 0.9), rnd(-0.38, 0.38)), s = (Math.random() < 0.8 ? rnd(0.15, 0.26) : rnd(0.27, 0.4)), d = LOOP ? 8 : rnd(9, 20), at = LOOP ? -(k * 8 / n) : -rnd(0, d);
      var m = doc.createElement("i");
      m.style.cssText = "left:" + p[0] + "vw;top:" + p[1] + "vh;width:" + s.toFixed(2) + "vw;height:" + s.toFixed(2) + "vw;background-image:url(" + pic + ");" +
        "-webkit-animation-name:fx-dust" + (k % 6) + ";animation-name:fx-dust" + (k % 6) + ";-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;" +
        "-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s";
      host.appendChild(m);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientDust = {
    // amount: off | few | some | many; side: left | right (the top corner the sun comes from); disabled: Lighter / old engine / Loop
    set: function (amount, side, disabled) {
      var a = COUNT[amount] ? amount : "off", f = side === "right" ? "right" : "left", d = !!disabled;
      if (a === want && f === from && d === off && (host || a === "off" || d)) return;
      want = a; from = f; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    inShaft: function (s, u, side) { var keep = from; from = side === "right" ? "right" : "left"; var p = inShaft(s, u); from = keep; return p; },
    COUNT: COUNT, ANIM: ANIM, SHAFT: SHAFT, PATHS: PATHS
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
