// Rising embers (design.home.embers: off | few | some | many; design.home.embers_from: all | left | centre | right): tiny glowing sparks
// lifting from the bottom of the screen, as if from a fire just below it, zigzagging up on the warm air, flickering as they cool and
// going out. `all` spreads them along the whole bottom edge; left / centre / right gathers them over one spot (a fireplace or a campfire
// in the photo). For fireplace, campfire, Ember and autumn designs. Off unless a design picks it. (Fireflies wander and pulse; embers
// only rise and die out.)
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). An ember is ONE tiny element
// (0.35-0.9 vw) with a glow picture drawn once; its rise, zigzag, flicker and fade are ONE CSS animation of transform + opacity on one of
// five paths. Nothing drawn per frame, no filter, no blend mode. 24 / 45 / 75 embers: well under 1 % of a screen. Under the cards.
// Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", from = "all", off = false, paused = false;
  var COUNT = { few: 24, some: 45, many: 75 };
  var SPOT = { all: [2, 98], left: [10, 30], centre: [40, 60], right: [70, 90] };   // where along the bottom they start, % of the width
  // five paths: [rise vh, zigzag vw] (the zigzag swings left and right twice on the way up)
  var PATHS = [[55, 1.6], [72, -2.2], [64, 2.6], [84, -1.4], [48, 2.0]];
  // ?fxloop=1 (showcase videos only): 8 or 4 s cycles, spread through them, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function ember(hot) {   // a white-hot core, orange round it, a soft red glow; hot = how bright (cooler ones are redder and fainter)
    var px = 24, c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, o = g.createRadialGradient(r, r, 0, r, r, r);
    o.addColorStop(0, "rgba(255,248,224," + hot + ")"); o.addColorStop(0.35, "rgba(255,176,72," + (0.95 * hot).toFixed(3) + ")");
    o.addColorStop(0.7, "rgba(235,96,32," + (0.45 * hot).toFixed(3) + ")"); o.addColorStop(1, "rgba(200,60,20,0)");
    g.fillStyle = o; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    var t = function (x, y, s) { return "transform:translate3d(" + x + "vw," + y + "vh,0) scale(" + s + ")"; };
    style.textContent = ".fx-embers{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-embers i{position:absolute;display:block;background-size:100% 100%;opacity:0;will-change:opacity,transform;" +
      "-webkit-animation-timing-function:ease-out;animation-timing-function:ease-out;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-embers.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-embers,.old-engine .fx-embers{display:none!important}" +
      // up with a zigzag; bright at first, flickering, shrinking as it cools, out before the top of its rise
      PATHS.map(function (p, k) {
        var h = p[0], z = p[1], y = function (f) { return +(-h * f).toFixed(1); };
        return kf("fx-ember" + k, "0%{opacity:0;" + t(0, 0, 1) + "}6%{opacity:1}20%{" + t(z, y(0.2), 1) + "}35%{opacity:.6}" +
          "45%{opacity:1;" + t(-z * 0.6, y(0.45), 0.85) + "}60%{opacity:.7}70%{" + t(z * 0.8, y(0.7), 0.7) + "}80%{opacity:.8}" +
          "100%{opacity:0;" + t(-z * 0.3, y(1), 0.4) + "}");
      }).join("");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var pics = [ember(1), ember(0.8)], spot = SPOT[from];
    host = doc.createElement("div"); host.className = "fx-embers" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      var s = Math.random() < 0.8 ? rnd(0.35, 0.55) : rnd(0.55, 0.9), d = LOOP ? (k % 3 ? 4 : 8) : rnd(4, 9), at = LOOP ? -((k * 8 / n) % d) : -rnd(0, d);
      var el = doc.createElement("i");
      el.style.cssText = "left:" + rnd(spot[0], spot[1]).toFixed(1) + "%;top:" + rnd(96, 101).toFixed(1) + "%;width:" + s.toFixed(2) + "vw;height:" + s.toFixed(2) + "vw;" +
        "background-image:url(" + pics[s > 0.55 ? 0 : 1] + ");-webkit-animation-name:fx-ember" + (k % 5) + ";animation-name:fx-ember" + (k % 5) + ";" +
        "-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s";
      host.appendChild(el);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientEmbers = {
    // amount: off | few | some | many; side: all | left | centre | right; disabled: Lighter / old engine / Loop
    set: function (amount, side, disabled) {
      var a = COUNT[amount] ? amount : "off", f = SPOT[side] ? side : "all", d = !!disabled;
      if (a === want && f === from && d === off && (host || a === "off" || d)) return;
      want = a; from = f; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, SPOT: SPOT, PATHS: PATHS
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
