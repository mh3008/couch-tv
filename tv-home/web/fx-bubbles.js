// Bubbles (design.home.bubbles: off | light | medium | many): soft glowing bubbles rising slowly over the photo,
// for the sea designs (Jellyfish, Ocean, Bioluminescence). Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA, not the
// number of things moving). Each bubble is ONE small element with a picture drawn once (a canvas made into an
// image when the effect starts), moved by a CSS animation of transform and opacity only, so the GPU moves it and
// the page draws nothing per frame. 12 / 18 / 28 bubbles of 36-140 px (big enough to read in a phone clip): all of
// them together are about 4-8 % of the screen's area. The tint is the design's own accent colour (look.accent), lightened, so the bubbles match the glass.
// Nothing moves while the home is covered (an app, the screensaver), when the TV asks for less motion, in the
// Lighter home, or in the Loop look (app.js ambientSync / pause / resume).
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", tint = "", off = false, paused = false;
  var COUNT = { light: 12, medium: 18, many: 28 };
  // ?fxloop=1 (showcase videos only): every bubble takes exactly 8 s and they are spread evenly, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function hex(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
    return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [170, 230, 255];
  }
  // a bubble picture: a thin bright rim, a faint glow round it, a see-through middle and one highlight
  function picture(px, rgb) {
    var c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, lr = rgb.map(function (v) { return Math.round(v + (255 - v) * 0.55); });
    var glow = g.createRadialGradient(r, r, r * 0.2, r, r, r);
    glow.addColorStop(0, "rgba(" + lr + ",0.06)"); glow.addColorStop(0.62, "rgba(" + lr + ",0.14)"); glow.addColorStop(0.8, "rgba(" + lr + ",0.75)");
    glow.addColorStop(0.88, "rgba(" + rgb + ",0.45)"); glow.addColorStop(1, "rgba(" + rgb + ",0)");   // a glow in the design's own colour round the rim
    g.fillStyle = glow; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = Math.max(1.5, px / 30); g.beginPath(); g.arc(r, r, r * 0.8, 0, Math.PI * 2); g.stroke();
    var hl = g.createRadialGradient(r * 0.62, r * 0.55, 0, r * 0.62, r * 0.55, r * 0.32);
    hl.addColorStop(0, "rgba(255,255,255,0.85)"); hl.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hl; g.beginPath(); g.arc(r * 0.62, r * 0.55, r * 0.32, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function css() {
    if (style) return;
    style = doc.createElement("style");
    // three sways so the bubbles don't rise in step; each one rises past the top (-112vh) and fades in and out
    var sway = [[0, 18, -10, 14], [0, -16, 12, -8], [0, 10, 22, 6]];
    style.textContent = ".fx-bubbles{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-bubbles i{position:absolute;bottom:-150px;display:block;background-size:100% 100%;will-change:transform,opacity;opacity:0;" +
      "-webkit-animation-timing-function:linear;animation-timing-function:linear;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-bubbles.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-bubbles,.old-engine .fx-bubbles{display:none!important}" +
      sway.map(function (s, k) {
        var f = "0%{opacity:0;transform:translate3d(0,0,0)}8%{opacity:1}30%{transform:translate3d(" + s[1] + "px,-34vh,0)}60%{transform:translate3d(" + s[2] + "px,-68vh,0)}" +
          "88%{opacity:1}100%{opacity:0;transform:translate3d(" + s[3] + "px,-112vh,0)}";
        return "@-webkit-keyframes fx-bub" + k + "{" + f.replace(/transform:/g, "-webkit-transform:") + "}@keyframes fx-bub" + k + "{" + f + "}";
      }).join("");
    doc.head.appendChild(style);
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var rgb = hex(tint), pics = [picture(112, rgb), picture(180, rgb), picture(280, rgb)];
    host = doc.createElement("div"); host.className = "fx-bubbles" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var i = 0; i < n; i++) {
      var b = doc.createElement("i"), big = Math.random(), s = Math.round(big < 0.5 ? rnd(36, 56) : big < 0.85 ? rnd(60, 90) : rnd(100, 140));
      var dur = LOOP ? 8 : s < 58 ? rnd(9, 12) : s < 92 ? rnd(11, 14) : rnd(14, 18);   // big bubbles rise more slowly
      var at = LOOP ? (i / n) * 8 + rnd(0, 8 / n) : rnd(0, dur);
      b.style.cssText = "left:" + rnd(2, 96).toFixed(1) + "%;width:" + s + "px;height:" + s + "px;background-image:url(" + pics[s < 58 ? 0 : s < 92 ? 1 : 2] + ");" +
        "-webkit-animation-name:fx-bub" + (i % 3) + ";animation-name:fx-bub" + (i % 3) + ";-webkit-animation-duration:" + dur.toFixed(1) + "s;animation-duration:" + dur.toFixed(1) + "s;" +
        "-webkit-animation-delay:-" + at.toFixed(2) + "s;animation-delay:-" + at.toFixed(2) + "s";
      host.appendChild(b);
    }
    // right above the photo and the weather layer, under every card (the same stacking level, later in the page)
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientBubbles = {
    // amount: off | light | medium | many; colour: the design's accent (#rrggbb); disabled: Lighter / old engine / Loop
    set: function (amount, colour, disabled) {
      var a = COUNT[amount] ? amount : "off", c = String(colour || ""), d = !!disabled;
      if (a === want && c === tint && d === off && (host || a === "off" || d)) return;
      want = a; tint = c; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
