// Fireflies (design.home.fireflies: off | few | some | many; design.home.fireflies_colour: #rrggbb, else the design's
// accent): warm glowing motes drifting over the photo and pulsing softly, for night, forest and space designs.
// Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). Each firefly is
// ONE small element with a glow picture drawn once (a canvas made into an image), moved by two CSS animations on
// transform and opacity only (a slow wander and a pulse), so the GPU moves it and the page draws nothing per frame.
// 24 / 40 / 60 motes of 24-64 px (big enough to read in a phone clip): all of them together are about 2-8 % of the screen. Nothing moves while the home is
// covered, when the TV asks for less motion, in the Lighter home, or in the Loop look (app.js ambientSync / pause / resume).
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", tint = "", off = false, paused = false;
  var COUNT = { few: 24, some: 40, many: 60 };
  // ?fxloop=1 (showcase videos only): every wander takes 8 s and every pulse 2 s, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function hex(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
    return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [255, 214, 120];
  }
  // a mote: a white-hot centre, the colour round it, a wide soft halo
  function picture(px, rgb) {
    var c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, lr = rgb.map(function (v) { return Math.round(v + (255 - v) * 0.45); });
    var glow = g.createRadialGradient(r, r, 0, r, r, r);
    glow.addColorStop(0, "rgba(255,255,240,1)"); glow.addColorStop(0.16, "rgba(" + lr + ",1)"); glow.addColorStop(0.34, "rgba(" + rgb + ",0.7)");
    glow.addColorStop(0.6, "rgba(" + rgb + ",0.16)"); glow.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = glow; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css() {
    if (style) return;
    style = doc.createElement("style");
    // four wanders (closed loops, so a mote ends where it began), a pulse that dims and swells
    var W = [[[60, -40], [110, 20], [40, 70]], [[-70, -30], [-20, -90], [50, -50]], [[40, 60], [-50, 90], [-80, 20]], [[-60, 40], [10, 100], [70, 30]]];
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    style.textContent = ".fx-flies{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-flies i{position:absolute;display:block;background-size:100% 100%;will-change:transform,opacity;opacity:.2;" +
      "-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-flies.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-flies,.old-engine .fx-flies{display:none!important}" +
      W.map(function (p, k) {
        return kf("fx-fly" + k, "0%,100%{transform:translate3d(0,0,0)}25%{transform:translate3d(" + p[0][0] + "px," + p[0][1] + "px,0)}" +
          "50%{transform:translate3d(" + p[1][0] + "px," + p[1][1] + "px,0)}75%{transform:translate3d(" + p[2][0] + "px," + p[2][1] + "px,0)}");
      }).join("") + kf("fx-glow", "0%,100%{opacity:.15}45%{opacity:1}60%{opacity:.85}");
    doc.head.appendChild(style);
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var rgb = hex(tint), pics = [picture(96, rgb), picture(160, rgb)];
    host = doc.createElement("div"); host.className = "fx-flies" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var i = 0; i < n; i++) {
      var f = doc.createElement("i"), s = Math.round(Math.random() < 0.65 ? rnd(24, 40) : rnd(44, 64));
      var wander = LOOP ? 8 : rnd(12, 22), pulse = LOOP ? 2 : rnd(2.2, 4.4);
      var a1 = LOOP ? (i / n) * 8 : rnd(0, wander), a2 = LOOP ? (i * 0.37) % 2 : rnd(0, pulse);
      f.style.cssText = "left:" + rnd(2, 96).toFixed(1) + "%;top:" + rnd(6, 90).toFixed(1) + "%;width:" + s + "px;height:" + s + "px;background-image:url(" + pics[s < 42 ? 0 : 1] + ");" +
        "-webkit-animation-name:fx-fly" + (i % 4) + ",fx-glow;animation-name:fx-fly" + (i % 4) + ",fx-glow;" +
        "-webkit-animation-duration:" + wander.toFixed(1) + "s," + pulse.toFixed(1) + "s;animation-duration:" + wander.toFixed(1) + "s," + pulse.toFixed(1) + "s;" +
        "-webkit-animation-delay:-" + a1.toFixed(2) + "s,-" + a2.toFixed(2) + "s;animation-delay:-" + a1.toFixed(2) + "s,-" + a2.toFixed(2) + "s";
      host.appendChild(f);
    }
    // right above the photo and the weather layer, under every card
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientFireflies = {
    // amount: off | few | some | many; colour: #rrggbb (the design's fireflies_colour, else its accent); disabled: Lighter / old engine / Loop
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
