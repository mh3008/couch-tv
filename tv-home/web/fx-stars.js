// Shooting stars + twinkle (design.home.stars: off | few | some | many): stars twinkling in the sky part of the photo, and
// now and then a shooting star streaking down across it. For night, space, aurora and city-at-night designs. Off unless a
// design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). Every star is ONE small
// element with a glow picture drawn once (a canvas made into an image): a twinkle is a CSS animation of opacity + scale. A
// shooting star is one streak picture (drawn once) on a long CSS cycle: it is invisible for most of it, then slides fast along
// a diagonal while it fades in and out (transform + opacity only). The page draws nothing per frame. 30 / 50 / 80 stars of
// 6-16 px and 2 / 3 / 4 shooting stars: about 0.2 % of the screen for the stars, one streak at a time ~0.3 %. Nothing moves while
// the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", off = false, paused = false;
  var COUNT = { few: [30, 2], some: [50, 3], many: [80, 4] };
  // only these twinkle (one layer each); the rest are painted into ONE still sky picture. The 22 Nov stick bench: 80 twinkling layers
  // + 4 streaks missed 24.8 % of frames (bar 10 %): on the stick the cost was the number of animated layers, not their area
  var TWINKLE = { few: 12, some: 16, many: 20 };
  // ?fxloop=1 (showcase videos only): twinkles of 2 / 4 s and shooting stars on an 8 s cycle, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function star(px) {
    var c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, glow = g.createRadialGradient(r, r, 0, r, r, r);
    glow.addColorStop(0, "rgba(255,255,255,1)"); glow.addColorStop(0.18, "rgba(235,242,255,0.95)"); glow.addColorStop(0.45, "rgba(190,210,255,0.28)"); glow.addColorStop(1, "rgba(190,210,255,0)");
    g.fillStyle = glow; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  // a streak: a bright head on the right, a tail fading out to the left (the element is rotated to the fall's angle)
  function streak(w, h) {
    var c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d"), tail = g.createLinearGradient(0, 0, w, 0), m = h / 2;
    tail.addColorStop(0, "rgba(180,205,255,0)"); tail.addColorStop(0.7, "rgba(210,225,255,0.55)"); tail.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = tail; g.beginPath(); g.moveTo(0, m); g.lineTo(w - m, m - m * 0.55); g.lineTo(w - m, m + m * 0.55); g.closePath(); g.fill();
    var head = g.createRadialGradient(w - m, m, 0, w - m, m, m);
    head.addColorStop(0, "rgba(255,255,255,1)"); head.addColorStop(0.35, "rgba(225,235,255,0.7)"); head.addColorStop(1, "rgba(200,220,255,0)");
    g.fillStyle = head; g.beginPath(); g.arc(w - m, m, m, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // the still part of the sky: m small soft stars painted once on a 960 x 384 canvas that covers the top 62 % of the screen
  function sky(m) {
    var c = doc.createElement("canvas"); c.width = 960; c.height = 384;
    var g = c.getContext("2d");
    for (var k = 0; k < m; k++) {
      var x = rnd(8, 952), y = rnd(4, 380), r = Math.random() < 0.8 ? rnd(1.6, 2.8) : rnd(2.8, 4.2), a = rnd(0.45, 0.9);
      var o = g.createRadialGradient(x, y, 0, x, y, r * 2);
      o.addColorStop(0, "rgba(255,255,255," + a.toFixed(2) + ")"); o.addColorStop(0.35, "rgba(225,235,255," + (a * 0.55).toFixed(2) + ")"); o.addColorStop(1, "rgba(200,215,255,0)");
      g.fillStyle = o; g.beginPath(); g.arc(x, y, r * 2, 0, Math.PI * 2); g.fill();
    }
    var b = doc.createElement("b"); b.className = "fx-stars-sky"; b.style.cssText = "background-image:url(" + c.toDataURL("image/png") + ")";
    return b;
  }
  function css(angles) {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    // a shooting star: still and hidden until 85 % of its cycle, then 12 % of the cycle to slide 760 px along its own direction
    style.textContent = ".fx-stars{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-stars i{position:absolute;display:block;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-animation:fx-twinkle 3s ease-in-out infinite;animation:fx-twinkle 3s ease-in-out infinite}" +
      ".fx-stars s{position:absolute;display:block;width:360px;height:16px;background-size:100% 100%;opacity:0;will-change:opacity,transform;" +
      "-webkit-transform-origin:100% 50%;transform-origin:100% 50%;-webkit-animation-timing-function:linear;animation-timing-function:linear;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-stars.fx-paused i,.fx-stars.fx-paused s{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".fx-stars .fx-stars-sky{position:absolute;left:0;top:0;width:100%;height:62%;display:block;background-size:100% 100%}" +
      ".lighter .fx-stars,.old-engine .fx-stars{display:none!important}" +
      kf("fx-twinkle", "0%,100%{opacity:.25;transform:scale(.7)}50%{opacity:1;transform:scale(1.15)}") +
      // one keyframe set per shooting star, its angle written in (no CSS variables: an old TV WebView may not have them in keyframes)
      angles.map(function (a, k) {
        var r = "rotate(" + a.toFixed(1) + "deg) ";
        return kf("fx-shoot" + k, "0%,85%{opacity:0;transform:" + r + "translate3d(0,0,0)}86%{opacity:1}94%{opacity:.9}97%,100%{opacity:0;transform:" + r + "translate3d(760px,0,0)}");
      }).join("");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    var angles = [];
    for (var q = 0; q < n[1]; q++) angles.push(q % 2 === 0 ? rnd(18, 32) : 180 - rnd(18, 32));   // even: falls to the right, odd: to the left
    css(angles);
    var pics = [star(32), star(48)], tail = streak(360, 16), tw = TWINKLE[want];
    host = doc.createElement("div"); host.className = "fx-stars" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    host.appendChild(sky(n[0] - tw));   // the still stars: one picture, never animated
    for (var i = 0; i < tw; i++) {
      var t = doc.createElement("i"), s = Math.round(Math.random() < 0.75 ? rnd(6, 10) : rnd(11, 16)), d = LOOP ? (i % 2 ? 2 : 4) : rnd(2, 5.5);
      t.style.cssText = "left:" + rnd(1, 98).toFixed(1) + "%;top:" + rnd(1, 62).toFixed(1) + "%;width:" + s + "px;height:" + s + "px;background-image:url(" + pics[s < 11 ? 0 : 1] + ");" +
        "-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;-webkit-animation-delay:-" + rnd(0, d).toFixed(2) + "s;animation-delay:-" + rnd(0, d).toFixed(2) + "s";
      host.appendChild(t);
    }
    // shooting stars: each its own cycle (LOOP: all 8 s, spread through it), starting in the upper sky, falling left or right
    for (var k = 0; k < n[1]; k++) {
      var m = doc.createElement("s"), cyc = LOOP ? 8 : rnd(9, 17), right = k % 2 === 0, ang = angles[k];
      var at = LOOP ? -(8 - (k + 0.5) * 8 / n[1] + 6.8) % 8 : -rnd(0, cyc);
      m.style.cssText = "left:" + (right ? rnd(4, 50) : rnd(45, 90)).toFixed(1) + "%;top:" + rnd(3, 30).toFixed(1) + "%;margin-left:-360px;margin-top:-8px;" +
        "background-image:url(" + tail + ");-webkit-transform:rotate(" + ang.toFixed(1) + "deg);transform:rotate(" + ang.toFixed(1) + "deg);" +
        "-webkit-animation-name:fx-shoot" + k + ";animation-name:fx-shoot" + k + ";-webkit-animation-duration:" + cyc.toFixed(1) + "s;animation-duration:" + cyc.toFixed(1) + "s;-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s";
      host.appendChild(m);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientStars = {
    // amount: off | few | some | many; disabled: Lighter / old engine / Loop
    set: function (amount, disabled) {
      var a = COUNT[amount] ? amount : "off", d = !!disabled;
      if (a === want && d === off && (host || a === "off" || d)) return;
      want = a; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
