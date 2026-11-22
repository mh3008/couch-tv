// Falling petals and leaves (design.home.petals: off | few | some | many; design.home.petals_style: sakura | autumn | gold):
// petals or leaves drifting down over the photo, swaying and fluttering as they fall. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). Each petal is two
// small elements: the outer one falls and sways (one transform animation), the inner one flutters (rotate + a scaleX flip,
// so it turns over like a real petal), both CSS animations of transform only, on pictures drawn once (a canvas made into an
// image). The page draws nothing per frame. 16 / 28 / 44 petals of 22-50 px: all of them together are about 1-4 % of the
// screen. Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or
// the Loop look (app.js ambientSync / pause / resume).
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", kind = "sakura", off = false, paused = false, built = "";
  var COUNT = { few: 16, some: 28, many: 44 };
  var STYLES = { sakura: [["#FFE4EC", "#FFB3C9", "#F48FB1"], ["#FFF0F5", "#FFC6D6", "#F7A1BE"]],
    autumn: [["#FFC15E", "#F2881D", "#B5470B"], ["#FF9B6A", "#E0532A", "#8E2312"], ["#F6D365", "#D99A1E", "#8A5A0B"]],
    gold: [["#FFF1B8", "#F6C945", "#B98510"], ["#FFE38A", "#E8B32A", "#9A6A06"]] };
  // ?fxloop=1 (showcase videos only): every fall takes 8 s and every flutter 2 or 4 s, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  // a sakura petal (a rounded drop with a notch at its tip) or a leaf (pointed oval with a midrib), lit from one side
  function picture(px, col, leaf) {
    var c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), s = px / 64;
    g.translate(px / 2, px / 2); g.scale(s, s);
    var grad = g.createLinearGradient(-22, -26, 22, 26);
    grad.addColorStop(0, col[0]); grad.addColorStop(0.55, col[1]); grad.addColorStop(1, col[2]);
    g.fillStyle = grad; g.beginPath();
    if (leaf) {
      g.moveTo(0, -28); g.bezierCurveTo(20, -18, 22, 12, 0, 28); g.bezierCurveTo(-22, 12, -20, -18, 0, -28);
    } else {
      g.moveTo(0, 26); g.bezierCurveTo(-24, 10, -20, -20, -6, -26); g.lineTo(0, -19); g.lineTo(6, -26); g.bezierCurveTo(20, -20, 24, 10, 0, 26);
    }
    g.closePath(); g.fill();
    g.strokeStyle = leaf ? "rgba(90,30,0,0.45)" : "rgba(255,255,255,0.45)"; g.lineWidth = leaf ? 1.6 : 1.2;
    g.beginPath(); g.moveTo(0, leaf ? 26 : 22); g.lineTo(0, leaf ? -24 : -12); g.stroke();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css(h) {
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    // four falls: top to bottom with a sway (px, worked out for this screen's height), and two flutters
    var S = [[50, -30, 60, 10], [-60, 20, -40, -10], [30, 70, -20, 40], [-40, -70, 30, -20]], top = -60, end = h + 60;
    var text = ".fx-petals{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-petals i{position:absolute;top:0;display:block;will-change:transform;-webkit-animation-timing-function:linear;animation-timing-function:linear;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-petals b{display:block;width:100%;height:100%;background-size:100% 100%;-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-petals.fx-paused i,.fx-petals.fx-paused b{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-petals,.old-engine .fx-petals{display:none!important}" +
      S.map(function (p, k) {
        var y = function (f) { return Math.round(top + (end - top) * f); };
        return kf("fx-fall" + k, "0%{transform:translate3d(0," + top + "px,0)}25%{transform:translate3d(" + p[0] + "px," + y(0.25) + "px,0)}" +
          "50%{transform:translate3d(" + p[1] + "px," + y(0.5) + "px,0)}75%{transform:translate3d(" + p[2] + "px," + y(0.75) + "px,0)}100%{transform:translate3d(" + p[3] + "px," + end + "px,0)}");
      }).join("") +
      kf("fx-flut0", "0%{transform:rotate(0deg) scaleX(1)}25%{transform:rotate(60deg) scaleX(.35)}50%{transform:rotate(140deg) scaleX(-1)}75%{transform:rotate(250deg) scaleX(-.4)}100%{transform:rotate(360deg) scaleX(1)}") +
      kf("fx-flut1", "0%{transform:rotate(0deg) scaleX(1)}30%{transform:rotate(-40deg) scaleX(-.6)}60%{transform:rotate(-120deg) scaleX(.5)}100%{transform:rotate(-360deg) scaleX(1)}");
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    style.textContent = text;
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    built = "";
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    var h = root.innerHeight || 1080;
    css(h);
    var leaf = kind !== "sakura", cols = STYLES[kind] || STYLES.sakura, pics = cols.map(function (c) { return picture(64, c, leaf); });
    host = doc.createElement("div"); host.className = "fx-petals" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var i = 0; i < n; i++) {
      var p = doc.createElement("i"), f = doc.createElement("b"), s = Math.round(rnd(leaf ? 24 : 22, leaf ? 50 : 40));
      var fall = LOOP ? 8 : rnd(10, 18) * (1 + (38 - Math.min(38, s)) / 60), flut = LOOP ? (i % 3 ? 2 : 4) : rnd(2.4, 5);
      var a1 = LOOP ? (i / n) * 8 : rnd(0, fall), a2 = LOOP ? (i * 0.53) % flut : rnd(0, flut);
      p.style.cssText = "left:" + rnd(0, 97).toFixed(1) + "%;width:" + s + "px;height:" + s + "px;" +
        "-webkit-animation-name:fx-fall" + (i % 4) + ";animation-name:fx-fall" + (i % 4) + ";-webkit-animation-duration:" + fall.toFixed(1) + "s;animation-duration:" + fall.toFixed(1) + "s;" +
        "-webkit-animation-delay:-" + a1.toFixed(2) + "s;animation-delay:-" + a1.toFixed(2) + "s";
      f.style.cssText = "background-image:url(" + pics[i % pics.length] + ");opacity:" + (s < 28 ? 0.8 : 0.95) + ";" +
        "-webkit-animation-name:fx-flut" + (i % 2) + ";animation-name:fx-flut" + (i % 2) + ";-webkit-animation-duration:" + flut.toFixed(1) + "s;animation-duration:" + flut.toFixed(1) + "s;" +
        "-webkit-animation-delay:-" + a2.toFixed(2) + "s;animation-delay:-" + a2.toFixed(2) + "s";
      p.appendChild(f); host.appendChild(p);
    }
    // right above the photo and the weather layer, under every card
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
    built = want + "|" + kind;
  }

  root.AmbientPetals = {
    // amount: off | few | some | many; style: sakura | autumn | gold; disabled: Lighter / old engine / Loop
    set: function (amount, petalStyle, disabled) {
      var a = COUNT[amount] ? amount : "off", k = STYLES[petalStyle] ? petalStyle : "sakura", d = !!disabled;
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
