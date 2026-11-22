// Fireworks (design.home.fireworks: off | few | some | lots, design.home.fireworks_style: mixed | gold | cool | warm): rockets
// climb the sky part of the photo and burst into rings of glowing sparks that stretch out, droop and fade. For night, city,
// harbour, New Year and festive designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA, and no canvas is drawn per
// frame). Every picture (a spark streak, a flash glow) is drawn ONCE on a canvas and used as a CSS background; the whole show is
// CSS animation of transform + opacity. One burst = one tiny container with 24-32 spark streaks, one rocket and one flash, all on
// ONE cycle of 6-9 s: the rocket rises for the first 9 %, the flash and the sparks go off at 10 %, the sparks are gone by 52 %,
// and the rest of the cycle is dark, so a burst only costs layers, never JavaScript. The sparks share 24-32 keyframe sets
// (angles + droop written in, no CSS variables) across every burst. When a cycle ends (animationiteration, the burst is dark)
// the burst jumps to a new spot with a new colour. 2 / 3 / 4 bursts: 20 / 30 / 47 % of one screen in all (the flash glow is the
// biggest layer). Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old
// engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", wantStyle = "mixed", off = false, paused = false;
  var AMT = { few: [2, 24], some: [3, 32], lots: [4, 32] };           // bursts, sparks per burst
  var PALETTES = {
    mixed: [[255, 110, 100], [255, 205, 100], [120, 200, 255], [185, 140, 255], [120, 255, 190], [255, 150, 200]],
    gold: [[255, 200, 90], [255, 225, 150], [255, 170, 60], [255, 240, 205]],
    cool: [[120, 200, 255], [150, 160, 255], [190, 235, 255], [110, 255, 230]],
    warm: [[255, 110, 90], [255, 160, 60], [255, 205, 100], [255, 130, 150]]
  };
  var SPARK_W = 130, SPARK_H = 20, ROCKET_W = 200, ROCKET_H = 12, GLOW = 400, DROOP = 100;
  var RADII = [360, 320, 340, 290];     // sparks alternate between these distances, so a burst is a ring with some depth
  // ?fxloop=1 (showcase videos only): every cycle is 8 s with the bursts spread through it, in fixed places, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  // a streak: the bright head on the right (a white-hot core in the colour), the tail fading out to the left
  function streak(w, h, c) {
    var cv = doc.createElement("canvas"); cv.width = w; cv.height = h;
    var g = cv.getContext("2d"), tail = g.createLinearGradient(0, 0, w, 0), m = h / 2;
    tail.addColorStop(0, rgba(c, 0)); tail.addColorStop(0.4, rgba(c, 0.4)); tail.addColorStop(0.8, rgba(c, 0.95)); tail.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = tail; g.beginPath(); g.moveTo(0, m); g.lineTo(w * 0.35, m - m * 0.42); g.lineTo(w - m, m - m * 0.55); g.lineTo(w - m, m + m * 0.55); g.lineTo(w * 0.35, m + m * 0.42); g.closePath(); g.fill();
    var head = g.createRadialGradient(w - m, m, 0, w - m, m, m);
    head.addColorStop(0, "rgba(255,255,255,1)"); head.addColorStop(0.35, "rgba(255,255,255,0.95)"); head.addColorStop(0.6, rgba(c, 0.9)); head.addColorStop(1, rgba(c, 0));
    g.fillStyle = head; g.beginPath(); g.arc(w - m, m, m, 0, Math.PI * 2); g.fill();
    return cv.toDataURL("image/png");
  }
  // the flash at the burst's heart: a soft glow in the colour with a white centre
  function glow(px, c) {
    var cv = doc.createElement("canvas"); cv.width = cv.height = px;
    var g = cv.getContext("2d"), r = px / 2, f = g.createRadialGradient(r, r, 0, r, r, r);
    f.addColorStop(0, "rgba(255,255,255,1)"); f.addColorStop(0.12, rgba(c, 0.85)); f.addColorStop(0.4, rgba(c, 0.32)); f.addColorStop(0.7, rgba(c, 0.1)); f.addColorStop(1, rgba(c, 0));
    g.fillStyle = f; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return cv.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function kf(name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; }
  function px(v) { return (Math.round(v * 10) / 10) + "px"; }
  function tr(x, y, a, s) { return "transform:translate(" + px(x) + "," + px(y) + ") rotate(" + a + "deg) scaleX(" + s + ")"; }
  // a spark's flight, one row per keyframe: [% of the cycle, how far out (1 = its full radius), tail length (scaleX), opacity]. The sparks
  // shoot out fast and slow down smoothly (ease-out) while they sink (gravity grows with the square of the time) and glitter (the
  // opacity flicker); many small steps instead of three long ones, so the speed never jumps at a keyframe.
  var FLIGHT = [[10, 0, 0.4, 1], [13, 0.34, 0.7, 1], [17, 0.58, 1, 1], [22, 0.77, 1, 1], [27, 0.88, 0.9, 0.55], [31, 0.94, 0.8, 1],
    [35, 0.97, 0.7, 0.5], [40, 0.99, 0.55, 0.85], [46, 1, 0.4, 0.45]];
  function css(sparks, pal) {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var out = ".fx-fireworks{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-fireworks b{position:absolute;display:block;width:0;height:0}" +
      ".fx-fireworks i,.fx-fireworks s,.fx-fireworks u{position:absolute;display:block;left:0;top:0;opacity:0;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite;-webkit-animation-timing-function:linear;animation-timing-function:linear;" +
      "-webkit-animation-duration:inherit;animation-duration:inherit;-webkit-animation-delay:inherit;animation-delay:inherit}" +
      ".fx-fireworks i{width:" + SPARK_W + "px;height:" + SPARK_H + "px;margin:-" + SPARK_H / 2 + "px 0 0 -" + SPARK_W + "px;-webkit-transform-origin:100% 50%;transform-origin:100% 50%}" +
      ".fx-fireworks s{width:" + ROCKET_W + "px;height:" + ROCKET_H + "px;margin:-" + ROCKET_H / 2 + "px 0 0 -" + ROCKET_W + "px;-webkit-transform-origin:100% 50%;transform-origin:100% 50%;" +
      "-webkit-animation-name:fx-fwk-up;animation-name:fx-fwk-up;-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out}" +
      ".fx-fireworks u{width:" + GLOW + "px;height:" + GLOW + "px;margin:-" + GLOW / 2 + "px 0 0 -" + GLOW / 2 + "px;-webkit-animation-name:fx-fwk-glow;animation-name:fx-fwk-glow}" +
      ".fx-fireworks.fx-paused i,.fx-fireworks.fx-paused s,.fx-fireworks.fx-paused u{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-fireworks,.old-engine .fx-fireworks{display:none!important}";
    // one picture per colour: .cN on the burst colours its sparks, rocket and flash
    pal.forEach(function (c, n) {
      out += ".fx-fireworks b.c" + n + " i{background-image:url(" + streak(SPARK_W, SPARK_H, c) + ")}" +
        ".fx-fireworks b.c" + n + " s{background-image:url(" + streak(ROCKET_W, ROCKET_H, c) + ")}" +
        ".fx-fireworks b.c" + n + " u{background-image:url(" + glow(GLOW, c) + ")}";
    });
    // the rocket climbs 360 px (ease-out) in the first 9 % of the cycle, head up; the flash blooms at 10 %
    out += kf("fx-fwk-up", "0%{opacity:0;" + tr(0, 360, -90, 1) + "}2%{opacity:1}9%{opacity:1;" + tr(0, 0, -90, 1) + "}10%,100%{opacity:0;" + tr(0, 0, -90, 1) + "}") +
      kf("fx-fwk-glow", "0%,9%{opacity:0;transform:scale(.2)}10%{opacity:1;transform:scale(.4)}20%{opacity:0;transform:scale(1.3)}100%{opacity:0;transform:scale(1.4)}");
    // one keyframe set per spark: out along its own angle with a droop (gravity) and a tail that shortens; gone by 52 % of the cycle
    for (var k = 0; k < sparks; k++) {
      var a = k * 360 / sparks, rad = a * Math.PI / 180, r = RADII[k % RADII.length], x = r * Math.cos(rad), y = r * Math.sin(rad), A = a.toFixed(1);
      var body = "0%,9%{opacity:0;" + tr(0, 0, A, 0.3) + "}";
      FLIGHT.forEach(function (f) {
        var g = Math.pow((f[0] - 10) / 42, 2);
        body += f[0] + "%{opacity:" + f[3] + ";" + tr(x * f[1], y * f[1] + DROOP * g, A, f[2]) + "}";
      });
      out += kf("fx-fwk" + k, body + "52%,100%{opacity:0;" + tr(x, y + DROOP, A, 0.25) + "}");
    }
    style.textContent = out;
  }
  // where a burst goes off: the upper sky only (the lower half belongs to the cards and the dock)
  function place(b, left, top, scale, colour) {
    var sc = "scale(" + scale.toFixed(2) + ")";
    b.style.left = left.toFixed(1) + "%"; b.style.top = top.toFixed(1) + "%"; b.style.webkitTransform = sc; b.style.transform = sc;
    b.className = "c" + colour;
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = AMT[want];
    if (!n || off || calm() || !doc.body) return;
    var pal = PALETTES[wantStyle] || PALETTES.mixed, bursts = n[0], sparks = n[1];
    css(sparks, pal);
    host = doc.createElement("div"); host.className = "fx-fireworks" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var q = 0; q < bursts; q++) {
      var b = doc.createElement("b"), cyc = LOOP ? 8 : rnd(6, 9);
      // LOOP: fixed places spread across the sky, one burst after another; live: anywhere in the upper sky, each on its own cycle
      var left = LOOP ? 14 + (q + 0.5) * (72 / bursts) : rnd(10, 90), top = LOOP ? (q % 2 ? 36 : 22) : rnd(14, 44);
      var at = LOOP ? -((q * 8 / bursts) % 8) : -rnd(0, cyc);
      place(b, left, top, LOOP ? 1 : rnd(0.85, 1.15), (q + 1) % pal.length);
      b.style.webkitAnimationDuration = b.style.animationDuration = cyc.toFixed(2) + "s"; b.style.webkitAnimationDelay = b.style.animationDelay = at.toFixed(2) + "s";
      var u = doc.createElement("u"), s = doc.createElement("s");
      b.appendChild(u); b.appendChild(s);
      for (var k = 0; k < sparks; k++) {
        var i = doc.createElement("i");
        i.style.cssText = "-webkit-animation-name:fx-fwk" + k + ";animation-name:fx-fwk" + k;
        b.appendChild(i);
      }
      host.appendChild(b);
    }
    // a burst is dark when its cycle ends: move it somewhere else, in another colour (not in the showcase loop, which must repeat exactly)
    if (!LOOP && host.addEventListener) host.addEventListener("animationiteration", function (e) {
      var t = e.target, b = t && t.parentNode;
      if (!t || String(t.tagName).toLowerCase() !== "s" || !b) return;
      place(b, rnd(10, 90), rnd(14, 44), rnd(0.85, 1.15), Math.floor(Math.random() * pal.length));
    });
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientFireworks = {
    // amount: off | few | some | lots; style: mixed | gold | cool | warm; disabled: Lighter / old engine / Loop
    set: function (amount, styleName, disabled) {
      var a = AMT[amount] ? amount : "off", s = PALETTES[styleName] ? styleName : "mixed", d = !!disabled;
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
