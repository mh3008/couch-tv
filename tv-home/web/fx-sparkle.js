// Sparkle on the edge of the snow (design.home.sparkle: off | few | some | many; design.home.sparkle_where: ground | all): tiny
// four-point glints catching the light on the snow, each hidden most of the time and then glinting for a moment (it grows, turns a
// little and fades), so only a handful sparkle at once. `ground` keeps them to the snowy lower part of the photo (62-96 % down),
// `all` scatters them over the whole picture (frost, ice, a snowy forest). For snow, winter and Christmas designs. Off unless chosen.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A glint is ONE small element
// (0.7-1.5 vw) with its star picture drawn once; the glint is ONE CSS animation of transform (scale + a small turn) + opacity, hidden for
// 80 % of its own 3-7 s cycle. Nothing drawn per frame, no filter, no blend mode. 30 / 60 / 100 glints: under 2 % of a screen in
// all, ~12 % of them visible at a time. Under the cards. Nothing moves while the home is covered, when the TV asks for less motion, in
// the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", where = "ground", off = false, paused = false;
  var COUNT = { few: 30, some: 60, many: 100 };
  var BAND = { ground: [62, 96], all: [5, 96] };   // % from the top
  // ?fxloop=1 (showcase videos only): cycles of 4 or 8 s, spread through them, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  // a glint: a bright core, four long thin rays (two long, two shorter at 45 deg), drawn once in ice-white
  function star() {
    var px = 64, c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2;
    var ray = function (len, wid, ang) {
      g.save(); g.translate(r, r); g.rotate(ang);
      var l = g.createLinearGradient(-len, 0, len, 0);
      l.addColorStop(0, "rgba(220,235,255,0)"); l.addColorStop(0.5, "rgba(255,255,255,0.95)"); l.addColorStop(1, "rgba(220,235,255,0)");
      g.fillStyle = l; g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, -wid); g.lineTo(len, 0); g.lineTo(0, wid); g.closePath(); g.fill(); g.restore();
    };
    ray(r, 2.2, 0); ray(r, 2.2, Math.PI / 2); ray(r * 0.55, 1.6, Math.PI / 4); ray(r * 0.55, 1.6, -Math.PI / 4);
    var core = g.createRadialGradient(r, r, 0, r, r, r * 0.3);
    core.addColorStop(0, "rgba(255,255,255,1)"); core.addColorStop(1, "rgba(220,235,255,0)");
    g.fillStyle = core; g.beginPath(); g.arc(r, r, r * 0.3, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    style.textContent = ".fx-sparkle{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-sparkle i{position:absolute;display:block;background-size:100% 100%;opacity:0;will-change:opacity,transform;" +
      "-webkit-animation-name:fx-glint;animation-name:fx-glint;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-sparkle.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-sparkle,.old-engine .fx-sparkle{display:none!important}" +
      // hidden for 80 % of the cycle, then a glint: grows and turns 25 deg while it brightens, then fades
      kf("fx-glint", "0%,80%{opacity:0;transform:scale(.2) rotate(0deg)}87%{opacity:1;transform:scale(1) rotate(12deg)}94%,100%{opacity:0;transform:scale(.3) rotate(25deg)}");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var pic = star(), band = BAND[where];
    host = doc.createElement("div"); host.className = "fx-sparkle" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      var s = Math.random() < 0.75 ? rnd(0.7, 1.05) : rnd(1.05, 1.5), d = LOOP ? (k % 2 ? 4 : 8) : rnd(3, 7), at = LOOP ? -((k * 8 / n) % d) : -rnd(0, d);
      var t = doc.createElement("i");
      t.style.cssText = "left:" + rnd(1, 98).toFixed(1) + "%;top:" + rnd(band[0], band[1]).toFixed(1) + "%;width:" + s.toFixed(2) + "vw;height:" + s.toFixed(2) + "vw;" +
        "margin:-" + (s / 2).toFixed(2) + "vw 0 0 -" + (s / 2).toFixed(2) + "vw;background-image:url(" + pic + ");" +
        "-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s";
      host.appendChild(t);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientSparkle = {
    // amount: off | few | some | many; where: ground | all; disabled: Lighter / old engine / Loop
    set: function (amount, place, disabled) {
      var a = COUNT[amount] ? amount : "off", w = BAND[place] ? place : "ground", d = !!disabled;
      if (a === want && w === where && d === off && (host || a === "off" || d)) return;
      want = a; where = w; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, BAND: BAND
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
