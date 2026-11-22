// Heat shimmer (design.home.heat: off | light | medium | heavy, design.home.heat_style: warm | clear | ember): wavy ribbons of hot air
// rise from the bottom of the screen, sway and fade, a warm glow breathes along the bottom edge. For sunsets, deserts, beaches,
// fire, summer and warm designs. Off unless a design picks it.
//
// Honest note: real heat shimmer is a refraction (a displacement filter over the photo). A filter is exactly what the Fire TV stick
// cannot do, so this is the look of it, not the physics: the classic wavy "heat lines" (a bright core, a faint wide halo and a thin
// dark twin beside it, so each ribbon seems to bend the light) drifting upwards.
//
// Made for the stick (the rain v3 lesson: the limit is the total composited layer AREA, and no canvas is drawn per frame). Every picture
// (a ribbon sprite in three shapes, the glow) is drawn ONCE on a canvas and used as a CSS background; the whole effect is CSS animation of
// transform + opacity (no blur, filter, shadow, no CSS variables). One ribbon = one 200x640 layer; the glow = one 1920x300 layer: about
// 59 / 71 / 90 % of one screen (light / medium / heavy). It sits under the cards (right after the weather layer). Nothing moves while the home is
// covered, with reduced motion, in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", wantStyle = "warm", off = false, paused = false;
  var AMT = { light: 5, medium: 7, heavy: 10 };                       // ribbons
  var PALETTES = { warm: [255, 226, 170], clear: [255, 255, 255], ember: [255, 170, 110] };
  var GLOW = { warm: [255, 150, 60], clear: [255, 235, 200], ember: [255, 90, 30] };
  var W = 200, H = 640, GH = 300, STEPS = 16;
  // ?fxloop=1 (showcase videos only): every cycle divides 8 s, in fixed places, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function seeded(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function r2(v) { return Math.round(v * 100) / 100; }

  // one ribbon sprite: three tall S-curves of hot air. Each is a wide faint halo, a thin bright core and a thin dark twin a few px
  // aside (the "bend"); everything fades out at the top and the bottom so a ribbon has no edge.
  function ribbon(seed, c) {
    var cv = doc.createElement("canvas"); cv.width = W; cv.height = H;
    var g = cv.getContext("2d"), R = seeded(seed), k, y;
    for (k = 0; k < 3; k++) {
      var x0 = 40 + k * 60 + (R() - 0.5) * 16, amp = 16 + R() * 14, wl = 150 + R() * 90, ph = R() * 6.28, pts = [];
      for (y = 0; y <= H; y += 8) pts.push([x0 + Math.sin(y / wl * 6.283 + ph) * amp * (0.5 + 0.5 * Math.sin(y / H * 3.14)), y]);
      [[26, rgba(c, 0.07), 0], [11, rgba(c, 0.13), 0], [5, "rgba(20,10,0,0.16)", 5], [3, rgba(c, 0.5), 0], [1.4, "rgba(255,255,255,0.65)", 0]].forEach(function (p) {
        g.strokeStyle = p[1]; g.lineWidth = p[0]; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
        pts.forEach(function (q, i) { if (i) g.lineTo(q[0] + p[2], q[1]); else g.moveTo(q[0] + p[2], q[1]); });
        g.stroke();
      });
    }
    g.globalCompositeOperation = "destination-in";      // fade the top and the bottom of the sprite away
    var f = g.createLinearGradient(0, 0, 0, H);
    f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(0.22, "rgba(0,0,0,1)"); f.addColorStop(0.7, "rgba(0,0,0,1)"); f.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = f; g.fillRect(0, 0, W, H);
    return cv.toDataURL("image/png");
  }
  // the glow along the bottom edge: hot colour at the very bottom, thinning upwards, a few wide soft blobs so it is not a flat band
  function glow(c) {
    var cv = doc.createElement("canvas"); cv.width = 1920; cv.height = GH;
    var g = cv.getContext("2d"), f = g.createLinearGradient(0, GH, 0, 0), R = seeded(5), i;
    f.addColorStop(0, rgba(c, 0.5)); f.addColorStop(0.35, rgba(c, 0.22)); f.addColorStop(0.7, rgba(c, 0.06)); f.addColorStop(1, rgba(c, 0));
    g.fillStyle = f; g.fillRect(0, 0, 1920, GH);
    for (i = 0; i < 9; i++) {
      var x = R() * 1920, r = 160 + R() * 220, h = g.createRadialGradient(x, GH, 0, x, GH, r);
      h.addColorStop(0, rgba(c, 0.28)); h.addColorStop(1, rgba(c, 0));
      g.fillStyle = h; g.fillRect(x - r, GH - r, r * 2, r);
    }
    return cv.toDataURL("image/png");
  }
  function kf(name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; }
  // a ribbon's cycle: it rises ~720 px while swaying (a closed sine, sampled, so the 100 % frame meets the 0 % one in x), fades in, holds, fades
  // out; dark at 0 and 100 % so the loop is seamless. Three variants differ in sway size and phase.
  function rise(name, amp, ph, turns) {
    var body = "", i;
    for (i = 0; i <= STEPS; i++) {
      var t = i / STEPS, x = amp * Math.sin(6.2832 * (turns * t + ph)), y = 140 - 760 * t, s = 1 + 0.06 * Math.sin(6.2832 * (turns * t + ph + 0.25));
      var o = t < 0.2 ? t / 0.2 : t > 0.72 ? Math.max(0, (1 - t) / 0.28) : 1;
      body += r2(t * 100) + "%{opacity:" + r2(o) + ";transform:translate(" + r2(x) + "px," + r2(y) + "px) scaleX(" + r2(s) + ")}";
    }
    return kf(name, body);
  }
  function css(pics) {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var anim = "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite;-webkit-animation-timing-function:linear;animation-timing-function:linear;";
    var out = ".fx-heat{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-heat b{position:absolute;display:block;bottom:-40px;width:" + W + "px;height:" + H + "px}" +
      ".fx-heat i{position:absolute;display:block;left:0;top:0;width:100%;height:100%;opacity:0;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-animation-duration:inherit;animation-duration:inherit;-webkit-animation-delay:inherit;animation-delay:inherit;" + anim + "}" +
      ".fx-heat b.s0 i{-webkit-animation-name:fx-hea-0;animation-name:fx-hea-0}.fx-heat b.s1 i{-webkit-animation-name:fx-hea-1;animation-name:fx-hea-1}" +
      ".fx-heat b.s2 i{-webkit-animation-name:fx-hea-2;animation-name:fx-hea-2}" +
      ".fx-heat b.p0 i{background-image:url(" + pics.ribbons[0] + ")}.fx-heat b.p1 i{background-image:url(" + pics.ribbons[1] + ")}" +
      ".fx-heat u{position:absolute;display:block;left:0;bottom:0;width:100%;height:" + GH + "px;opacity:0.7;background-size:100% 100%;background-image:url(" + pics.glow + ");" +
      "will-change:opacity,transform;-webkit-transform-origin:50% 100%;transform-origin:50% 100%;-webkit-animation-name:fx-hea-glow;animation-name:fx-hea-glow;" + anim +
      "-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out}" +
      ".fx-heat.fx-paused i,.fx-heat.fx-paused u{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-heat,.old-engine .fx-heat{display:none!important}";
    out += rise("fx-hea-0", 22, 0, 2) + rise("fx-hea-1", 16, 0.33, 3) + rise("fx-hea-2", 28, 0.66, 1) +
      kf("fx-hea-glow", "0%,100%{opacity:0.62;transform:scaleY(0.9)}50%{opacity:1;transform:scaleY(1.12)}");
    style.textContent = out;
  }
  function setAnim(el, dur, delay) {
    el.style.webkitAnimationDuration = el.style.animationDuration = r2(dur) + "s";
    el.style.webkitAnimationDelay = el.style.animationDelay = r2(delay) + "s";
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = AMT[want];
    if (!n || off || calm() || !doc.body) return;
    var c = PALETTES[wantStyle] || PALETTES.warm, gc = GLOW[wantStyle] || GLOW.warm;
    css({ ribbons: [ribbon(3, c), ribbon(17, c)], glow: glow(gc) });
    host = doc.createElement("div"); host.className = "fx-heat" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    var gl = doc.createElement("u"); setAnim(gl, LOOP ? 4 : 5.5, 0); host.appendChild(gl);
    var R = seeded(41), q;
    for (q = 0; q < n; q++) {
      var b = doc.createElement("b"), i = doc.createElement("i"), cyc = LOOP ? 8 : rnd(8, 12);
      var x = (q + 0.5) / n * 1920 - W / 2 + (R() - 0.5) * 110, sc = 0.85 + R() * 0.4;
      b.className = "s" + (q % 3) + " p" + (q % 2);
      b.style.left = r2(x) + "px"; b.style.webkitTransformOrigin = b.style.transformOrigin = "50% 100%";
      b.style.webkitTransform = b.style.transform = (q % 2 ? "scale(-" + r2(sc) + "," + r2(sc) + ")" : "scale(" + r2(sc) + ")");
      setAnim(i, cyc, LOOP ? -((q * 8 / n) % 8) : -rnd(0, cyc));
      b.appendChild(i); host.appendChild(b);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientHeat = {
    // amount: off | light | medium | heavy; style: warm | clear | ember; disabled: Lighter / old engine / Loop
    set: function (amount, styleName, disabled) {
      var a = AMT[amount] ? amount : "off", s = PALETTES[styleName] ? styleName : "warm", d = !!disabled;
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
