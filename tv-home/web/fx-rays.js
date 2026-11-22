// Light rays through clouds (design.home.rays: off | few | some | many; rays_from: left | centre | right; rays_style: warm |
// white | gold): soft shafts of light fanning down from a sun just above the top edge of the photo, each swaying a little and
// breathing brighter and dimmer on its own slow cycle, with a faint glow where they start. For sunrise, forest, beach and
// cloudy-sky designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A ray is ONE element
// with a tapered, soft-edged beam picture drawn once at low resolution (a 48 x 256 canvas made into an image, stretched: it is
// soft anyway). A ray's sway and breathing are ONE CSS animation of transform (rotate about the sun) + opacity. The page draws
// nothing per frame, there is no blur filter and no blend mode. 4 / 6 / 8 rays of about 7 % of the screen each (about 28 / 42 / 56 %
// in all) + the glow, most of it off the top edge. Nothing moves while the home is covered, when the TV asks for less motion,
// in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", from = "left", tone = "warm", off = false, paused = false;
  var COUNT = { few: 4, some: 6, many: 8 };
  var FROM = { left: [7, -9], centre: [50, -12], right: [93, -9] };   // the sun: left % / top % of the screen
  var TONE = { warm: "255,238,205", white: "255,255,255", gold: "255,212,140" };
  // ?fxloop=1 (showcase videos only): every ray and the glow on an 8 s cycle, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  // a beam: narrow at the top (the sun), wide at the bottom; brightest just below the sun, fading out down the screen. The soft
  // edges are six stacked wedges, each a little narrower (no canvas filter: an old TV WebView may not have one)
  function beam(rgb) {
    var w = 48, h = 256, c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d"), m = w / 2;
    for (var k = 0; k < 6; k++) {
      var s = 1 - k * 0.15, top = 0.06 * w * s, bot = 0.5 * w * s, v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(" + rgb + ",0)"); v.addColorStop(0.06, "rgba(" + rgb + ",0.4)"); v.addColorStop(0.4, "rgba(" + rgb + ",0.26)"); v.addColorStop(0.75, "rgba(" + rgb + ",0.1)"); v.addColorStop(1, "rgba(" + rgb + ",0)");
      g.fillStyle = v; g.beginPath(); g.moveTo(m - top, 0); g.lineTo(m + top, 0); g.lineTo(m + bot, h); g.lineTo(m - bot, h); g.closePath(); g.fill();
    }
    return c.toDataURL("image/png");
  }
  function glow(rgb) {
    var px = 128, c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, o = g.createRadialGradient(r, r, 0, r, r, r);
    o.addColorStop(0, "rgba(" + rgb + ",0.75)"); o.addColorStop(0.3, "rgba(" + rgb + ",0.3)"); o.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = o; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // the rays' angles (deg, clockwise from straight down: negative = the ray falls to the right), spread over the fan
  function fan(n, f) {
    var a0 = f === "left" ? -12 : f === "right" ? 12 : -38, a1 = f === "left" ? -60 : f === "right" ? 60 : 38, out = [];
    for (var i = 0; i < n; i++) out.push(a0 + (a1 - a0) * (i + 0.5) / n + rnd(-2.5, 2.5));
    return out;
  }
  function css(angles, lo, hi) {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    style.textContent = ".fx-rays{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-rays i,.fx-rays b{position:absolute;display:block;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-rays i{-webkit-transform-origin:50% 0;transform-origin:50% 0}" +
      ".fx-rays.fx-paused i,.fx-rays.fx-paused b{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-rays,.old-engine .fx-rays{display:none!important}" +
      kf("fx-rayglow", "0%,100%{opacity:.45}50%{opacity:.8}") +
      // one keyframe set per ray, its angle written in (no CSS variables: an old TV WebView may not have them in keyframes)
      angles.map(function (a, k) {
        var sw = 1.4, p = function (d) { return "rotate(" + (a + d).toFixed(2) + "deg)"; };
        return kf("fx-ray" + k, "0%,100%{opacity:" + lo + ";transform:" + p(-sw) + "}50%{opacity:" + hi + ";transform:" + p(sw) + "}");
      }).join("");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    var angles = fan(n, from), sun = FROM[from], rgb = TONE[tone];
    css(angles, 0.35, want === "few" ? 1 : 0.9);
    var pic = beam(rgb);
    host = doc.createElement("div"); host.className = "fx-rays" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    var gl = doc.createElement("b"), gs = 34, gd = LOOP ? 8 : 12;   // the glow at the sun: 34vw across, mostly above the top edge
    gl.style.cssText = "left:" + sun[0] + "%;top:" + sun[1] + "%;width:" + gs + "vw;height:" + gs + "vw;margin-left:-" + gs / 2 + "vw;margin-top:-" + gs / 2 + "vw;" +
      "background-image:url(" + glow(rgb) + ");-webkit-animation-name:fx-rayglow;animation-name:fx-rayglow;-webkit-animation-duration:" + gd + "s;animation-duration:" + gd + "s";
    host.appendChild(gl);
    for (var k = 0; k < n; k++) {
      var r = doc.createElement("i"), w = rnd(6.5, 10.5), h = rnd(70, 96), cyc = LOOP ? 8 : rnd(10, 18), at = LOOP ? -(k * 8 / n) : -rnd(0, cyc);
      r.style.cssText = "left:" + sun[0] + "%;top:" + sun[1] + "%;width:" + w.toFixed(1) + "vw;height:" + h.toFixed(1) + "vh;margin-left:-" + (w / 2).toFixed(2) + "vw;" +
        "background-image:url(" + pic + ");-webkit-transform:rotate(" + angles[k].toFixed(2) + "deg);transform:rotate(" + angles[k].toFixed(2) + "deg);" +
        "-webkit-animation-name:fx-ray" + k + ";animation-name:fx-ray" + k + ";-webkit-animation-duration:" + cyc.toFixed(1) + "s;animation-duration:" + cyc.toFixed(1) + "s;" +
        "-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s";
      host.appendChild(r);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientRays = {
    // amount: off | few | some | many; side: left | centre | right; style: warm | white | gold; disabled: Lighter / old engine / Loop
    set: function (amount, side, look, disabled) {
      var a = COUNT[amount] ? amount : "off", f = FROM[side] ? side : "left", t = TONE[look] ? look : "warm", d = !!disabled;
      if (a === want && f === from && t === tone && d === off && (host || a === "off" || d)) return;
      want = a; from = f; tone = t; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, FROM: FROM, TONE: TONE
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
