// Koi in the pond (design.home.koi: off | few | some | many; design.home.koi_where: pond | all): a few koi gliding slowly across the
// water in a gentle S-curve, turning their heads along the way, each with its soft shadow on the water: white with red patches (kohaku),
// all gold (ogon), and black, red and white (showa). `pond` keeps them to the lower half of the photo (a pond, a lake shore), `all` lets
// them cross anywhere (a photo that is all water). For garden ponds, lakes and Japan designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A koi is ONE element with its
// picture drawn once (a 160 x 64 canvas, seen from above: shadow, tail, fins, a tapered body with its pattern); its swim is ONE CSS
// animation of transform (translate + a slow turn of the heading) on one of four paths, so the fish never wiggles its tail (that would be a
// second layer per fish). Nothing drawn per frame, no filter, no blend mode. 2 / 4 / 7 koi of 7-11 vw (koi_size medium; small 4-6, large 10-14): about 1 / 2 / 4 % of a screen (large: ~2x).
// Under the cards. Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the
// Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", where = "pond", size = "medium", off = false, paused = false;
  var COUNT = { few: 2, some: 4, many: 7 };
  var BAND = { pond: [50, 90], all: [12, 90] };   // % from the top
  var SIZE = { small: [4, 6], medium: [7, 11], large: [10, 14] };   // vw long: small for a distant lake, large for a close pond
  var KINDS = ["kohaku", "ogon", "showa"];
  var WAVE = [[5, 6], [-4, 7], [6, -5], [-6, -4]];   // four paths: up / down drift (vh) at 1/4 and 3/4 of the crossing
  // ?fxloop=1 (showcase videos only): 8 s cycles over a 30 vw stretch inside the screen, fading in and out, so an 8 s clip loops
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");
  var ACROSS = LOOP ? 30 : 140;   // vw swum per cycle (live: from off one side to off the other)

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function koi(kind) {   // head to the right
    var w = 160, h = 64, c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d"), cy = h / 2;
    var shadow = g.createRadialGradient(92, cy + 7, 4, 92, cy + 7, 58);   // a soft shadow on the water, below and behind the fish
    shadow.addColorStop(0, "rgba(0,20,30,0.32)"); shadow.addColorStop(1, "rgba(0,20,30,0)");
    g.fillStyle = shadow; g.beginPath(); g.ellipse(92, cy + 7, 58, 14, 0, 0, Math.PI * 2); g.fill();
    var fin = kind === "ogon" ? "rgba(255,205,110,0.55)" : "rgba(255,245,235,0.5)";
    g.fillStyle = fin;   // the tail: a soft fan behind the tail root
    g.beginPath(); g.moveTo(44, cy); g.quadraticCurveTo(22, cy - 20, 6, cy - 16); g.quadraticCurveTo(16, cy, 6, cy + 16); g.quadraticCurveTo(22, cy + 20, 44, cy); g.fill();
    g.beginPath(); g.ellipse(112, cy - 13, 12, 5, -0.5, 0, Math.PI * 2); g.fill();   // the pectoral fins
    g.beginPath(); g.ellipse(112, cy + 13, 12, 5, 0.5, 0, Math.PI * 2); g.fill();
    var body = function () {   // a spindle: round head on the right, tapering to the tail root
      g.beginPath(); g.moveTo(152, cy); g.bezierCurveTo(150, cy - 15, 112, cy - 17, 84, cy - 13); g.bezierCurveTo(62, cy - 10, 50, cy - 5, 42, cy);
      g.bezierCurveTo(50, cy + 5, 62, cy + 10, 84, cy + 13); g.bezierCurveTo(112, cy + 17, 150, cy + 15, 152, cy); g.closePath();
    };
    var base = kind === "ogon" ? "rgba(246,178,60,1)" : "rgba(250,246,240,1)";
    g.save(); body(); g.fillStyle = base; g.fill(); g.clip();
    var blot = function (x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
    if (kind === "kohaku") { blot(130, cy - 3, 16, 11, "rgba(222,58,40,1)"); blot(92, cy + 2, 18, 12, "rgba(222,58,40,1)"); blot(62, cy - 4, 9, 7, "rgba(222,58,40,1)"); }
    if (kind === "showa") { blot(128, cy, 14, 13, "rgba(30,28,30,1)"); blot(104, cy - 6, 14, 9, "rgba(214,56,40,1)"); blot(84, cy + 6, 12, 8, "rgba(30,28,30,1)"); blot(64, cy - 3, 10, 7, "rgba(214,56,40,1)"); }
    if (kind === "ogon") { var sheen = g.createLinearGradient(0, cy - 16, 0, cy + 16); sheen.addColorStop(0, "rgba(255,240,190,0.6)"); sheen.addColorStop(0.5, "rgba(255,240,190,0)"); sheen.addColorStop(1, "rgba(150,90,20,0.35)"); g.fillStyle = sheen; g.fillRect(40, cy - 18, 114, 36); }
    var spine = g.createLinearGradient(0, cy - 15, 0, cy + 15);   // rounded: a lighter spine, darker flanks
    spine.addColorStop(0, "rgba(0,0,0,0.18)"); spine.addColorStop(0.5, "rgba(255,255,255,0.12)"); spine.addColorStop(1, "rgba(0,0,0,0.18)");
    g.fillStyle = spine; g.fillRect(40, cy - 18, 114, 36);
    g.restore();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    var t = function (x, y, r) { return "transform:translate3d(" + x + "vw," + y + "vh,0) rotate(" + r + "deg)"; };
    var out = ".fx-koi{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-koi i{position:absolute;display:block;background-size:100% 100%;opacity:.85;will-change:transform" + (LOOP ? ",opacity" : "") + ";" +
      "-webkit-animation-timing-function:linear;animation-timing-function:linear;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-koi.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-koi,.old-engine .fx-koi{display:none!important}";
    // per path, two directions: rightwards (heading 0) and leftwards (heading 180); the heading turns with the S of the path
    WAVE.forEach(function (w, k) {
      [1, -1].forEach(function (dir) {
        var a = dir > 0 ? 0 : 180, x = function (f) { return +(dir * ACROSS * f).toFixed(2); }, turn = function (dy) { return a + dir * (dy > 0 ? 6 : -6); };
        var fade = LOOP ? function (o) { return "opacity:" + o + ";"; } : function () { return ""; };
        out += kf("fx-koi" + k + (dir > 0 ? "r" : "l"), "0%{" + fade(0) + t(0, 0, a) + "}" + (LOOP ? "12%{opacity:.85}" : "") +
          "25%{" + t(x(0.25), w[0], turn(w[0])) + "}50%{" + t(x(0.5), 0, turn(-w[0])) + "}75%{" + t(x(0.75), w[1], turn(w[1])) + "}" +
          (LOOP ? "88%{opacity:.85}" : "") + "100%{" + fade(0) + t(x(1), 0, a) + "}");
      });
    });
    style.textContent = out;
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var pics = KINDS.map(koi), band = BAND[where];
    host = doc.createElement("div"); host.className = "fx-koi" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      var dir = k % 2 ? -1 : 1, len = rnd(SIZE[size][0], SIZE[size][1]), d = LOOP ? 8 : rnd(45, 75), at = LOOP ? -(k * 8 / n) : -rnd(0, d);
      // live: from just off one side; LOOP: somewhere inside the screen
      var x0 = LOOP ? rnd(10, 60) + (dir > 0 ? 0 : 30) : (dir > 0 ? -len - 8 : 100 + 8);
      var el = doc.createElement("i");
      el.style.cssText = "left:" + x0.toFixed(1) + "vw;top:" + rnd(band[0], band[1] - 8).toFixed(1) + "%;width:" + len.toFixed(2) + "vw;height:" + (len * 64 / 160).toFixed(2) + "vw;" +
        "background-image:url(" + pics[k % 3] + ");-webkit-animation-name:fx-koi" + (k % 4) + (dir > 0 ? "r" : "l") + ";animation-name:fx-koi" + (k % 4) + (dir > 0 ? "r" : "l") + ";" +
        "-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s";
      host.appendChild(el);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientKoi = {
    // amount: off | few | some | many; where: pond | all; big: small | medium | large; disabled: Lighter / old engine / Loop
    set: function (amount, place, big, disabled) {
      var a = COUNT[amount] ? amount : "off", w = BAND[place] ? place : "pond", z = SIZE[big] ? big : "medium", d = !!disabled;
      if (a === want && w === where && z === size && d === off && (host || a === "off" || d)) return;
      want = a; where = w; size = z; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, BAND: BAND, SIZE: SIZE, KINDS: KINDS, WAVE: WAVE
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
