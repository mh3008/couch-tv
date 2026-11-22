// Drifting fog (design.home.fog: off | light | medium | thick; design.home.fog_style: mist | warm | cool): soft banks of fog
// rolling slowly side to side over the photo, breathing thicker and thinner. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA, not the layer count).
// Each bank is two elements: the outer one drifts (one transform animation, translate3d, back and forth), the inner one breathes
// (one opacity animation), on a soft picture drawn once (a canvas made into an image, stretched: no blur filter, no per-frame
// work). 3 / 5 / 7 banks of 700-1100 px by 180-340 px: light about 40 %, medium 65 %, thick 90 % of ONE screen in all.
// Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop
// look (app.js ambientSync / pause / resume). It sits under the cards.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", kind = "mist", off = false, paused = false, built = "";
  var COUNT = { light: 3, medium: 5, thick: 7 };
  // fog colour (rgb) and how dense the middle of a bank is
  var STYLES = { mist: [[244, 247, 252], 0.62], warm: [[255, 228, 190], 0.58], cool: [[188, 208, 244], 0.60] };
  // where the banks sit (top, % of the screen height; the foot of the screen first, the sky last) and how wide they are (px)
  var LANES = [[66, 1100], [44, 950], [80, 900], [28, 800], [56, 1000], [14, 700], [36, 850]];
  // ?fxloop=1 (showcase videos only): every drift leg takes 4 s or 2 s and every breath 4 or 2 s, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // a bank of fog: a band of overlapping soft blobs (radial gradients, squashed to ovals), thicker in the middle, thin at the ends
  function picture(rgb, dens, variant) {
    var W = 256, H = 96, c = doc.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d"), BLOBS = [[0.50, 0.55, 0.34, 1.0], [0.30, 0.50, 0.26, 0.85], [0.70, 0.52, 0.27, 0.9], [0.14, 0.58, 0.16, 0.55], [0.86, 0.55, 0.17, 0.6],
      [0.40, 0.40, 0.20, 0.7], [0.62, 0.66, 0.2, 0.7]], shift = [0, 0.05, -0.06][variant % 3];
    BLOBS.forEach(function (b) {
      var cx = (b[0] + shift * (b[0] < 0.5 ? 1 : -1)) * W, cy = b[1] * H, rx = b[2] * W, grad;
      g.save(); g.translate(cx, cy); g.scale(1, 0.36);
      grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, "rgba(" + rgb.join(",") + "," + (dens * b[3]).toFixed(3) + ")");
      grad.addColorStop(0.3, "rgba(" + rgb.join(",") + "," + (dens * b[3] * 0.78).toFixed(3) + ")");   // a gaussian-ish fall-off: no visible rim
      grad.addColorStop(0.6, "rgba(" + rgb.join(",") + "," + (dens * b[3] * 0.34).toFixed(3) + ")");
      grad.addColorStop(0.85, "rgba(" + rgb.join(",") + "," + (dens * b[3] * 0.07).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(" + rgb.join(",") + ",0)");
      g.fillStyle = grad; g.beginPath(); g.arc(0, 0, rx, 0, 6.2832); g.fill(); g.restore();
    });
    return c.toDataURL("image/png");
  }
  function css() {
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    var text = ".fx-fog{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-fog i{position:absolute;display:block;will-change:transform;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite;-webkit-animation-direction:alternate;animation-direction:alternate}" +
      ".fx-fog b{display:block;width:100%;height:100%;background-size:100% 100%;will-change:opacity;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite;-webkit-animation-direction:alternate;animation-direction:alternate;" +
      "-webkit-animation-name:fx-breathe;animation-name:fx-breathe}" +
      ".fx-fog.fx-paused i,.fx-fog.fx-paused b{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-fog,.old-engine .fx-fog{display:none!important}" +
      kf("fx-roll0", "0%{transform:translate3d(-260px,0,0)}100%{transform:translate3d(260px,0,0)}") +
      kf("fx-roll1", "0%{transform:translate3d(300px,0,0)}100%{transform:translate3d(-300px,0,0)}") +
      kf("fx-roll2", "0%{transform:translate3d(-180px,0,0)}100%{transform:translate3d(380px,0,0)}") +
      kf("fx-breathe", "0%{opacity:.38}100%{opacity:1}");
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    style.textContent = text;
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    built = "";
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var st = STYLES[kind] || STYLES.mist, pics = [0, 1, 2].map(function (v) { return picture(st[0], st[1], v); });
    host = doc.createElement("div"); host.className = "fx-fog" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var i = 0; i < n; i++) {
      var p = doc.createElement("i"), f = doc.createElement("b"), lane = LANES[i % LANES.length], w = Math.round(lane[1] * rnd(0.92, 1.08)), h = Math.round(w * rnd(0.26, 0.31));
      var roll = LOOP ? (i % 2 ? 2 : 4) : rnd(26, 48), breath = LOOP ? (i % 3 ? 4 : 2) : rnd(9, 17);
      var a1 = LOOP ? (i * 1.7) % roll : rnd(0, roll), a2 = LOOP ? (i * 0.9) % breath : rnd(0, breath);
      p.style.cssText = "left:" + Math.round(rnd(-8, 78) / 100 * 1920 - w * 0.2) + "px;top:" + Math.round(lane[0] / 100 * 1080 - h / 2) + "px;width:" + w + "px;height:" + h + "px;" +
        "-webkit-animation-name:fx-roll" + (i % 3) + ";animation-name:fx-roll" + (i % 3) + ";-webkit-animation-duration:" + roll.toFixed(1) + "s;animation-duration:" + roll.toFixed(1) + "s;" +
        "-webkit-animation-delay:-" + a1.toFixed(2) + "s;animation-delay:-" + a1.toFixed(2) + "s";
      f.style.cssText = "background-image:url(" + pics[i % pics.length] + ");" +
        "-webkit-animation-duration:" + breath.toFixed(1) + "s;animation-duration:" + breath.toFixed(1) + "s;" +
        "-webkit-animation-delay:-" + a2.toFixed(2) + "s;animation-delay:-" + a2.toFixed(2) + "s";
      p.appendChild(f); host.appendChild(p);
    }
    // right above the photo and the weather layer, under every card
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
    built = want + "|" + kind;
  }

  root.AmbientFog = {
    // amount: off | light | medium | thick; style: mist | warm | cool; disabled: Lighter / old engine / Loop
    set: function (amount, fogStyle, disabled) {
      var a = COUNT[amount] ? amount : "off", k = STYLES[fogStyle] ? fogStyle : "mist", d = !!disabled;
      if (a === want && k === kind && d === off && (host || a === "off" || d)) return;
      want = a; kind = k; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, STYLES: Object.keys(STYLES)
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
