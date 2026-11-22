// Lightning (design.home.lightning: off | rare | storm): now and then the sky lights up, a quick double flicker, and
// about half the time a jagged bolt cracks down through it. For Storm and rain designs (pairs with weather_effect rain).
// Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). The flash is ONE
// layer over the sky only (the top 55 % of the screen, a soft gradient that fades out downwards), moved by opacity alone,
// and it is taken off the page (display: none) between flashes, so most of the time it costs nothing; a bolt is one
// small picture drawn once (midpoint displacement on a canvas) and shown for the flash. Flashes come every 8-22 s
// ("storm": 4-11 s) from a timer; nothing runs while the home is covered, when the TV asks for less motion, in the
// Lighter home or in the Loop look (app.js ambientSync / pause / resume).
(function (root) {
  "use strict";
  var doc = root.document, host = null, sky = null, bolts = [], style = null, want = "off", off = false, paused = false, timer = null;
  var GAP = { rare: [8000, 22000], storm: [4000, 11000] };
  // ?fxloop=1 (showcase videos only): a fixed 8 s timeline (a flash at 0.8 s, a flash + bolt at 4.6 s), driven by CSS so a clip loops
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // a bolt: midpoint displacement from top to bottom, a few side forks, a glow under a white core
  function boltPicture(w, h) {
    var c = doc.createElement("canvas"); c.width = w; c.height = h;
    var g = c.getContext("2d");
    function path(x1, y1, x2, y2, d, out) {
      if (d < 6) { out.push([x2, y2]); return; }
      var mx = (x1 + x2) / 2 + rnd(-d, d) * 0.5, my = (y1 + y2) / 2;
      path(x1, y1, mx, my, d / 2, out); path(mx, my, x2, y2, d / 2, out);
    }
    var main = [[w / 2, 0]]; path(w / 2, 0, w / 2 + rnd(-w / 5, w / 5), h, w * 0.6, main);
    var draw = function (pts, width, colour, blur) {
      g.save(); g.strokeStyle = colour; g.lineWidth = width; g.lineJoin = "round"; g.shadowColor = "rgba(170,200,255,0.9)"; g.shadowBlur = blur;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.restore();
    };
    draw(main, 10, "rgba(190,210,255,0.6)", 34); draw(main, 4, "rgba(255,255,255,1)", 14);
    for (var f = 0; f < 3; f++) {   // forks from part way down the main bolt
      var at = main[Math.floor(rnd(0.2, 0.7) * main.length)], fork = [at];
      path(at[0], at[1], at[0] + rnd(-w / 3, w / 3), at[1] + rnd(h * 0.15, h * 0.3), w * 0.25, fork);
      draw(fork, 2.2, "rgba(230,240,255,0.8)", 12);
    }
    return c.toDataURL("image/png");
  }
  function css() {
    if (style) return;
    style = doc.createElement("style");
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body + "}@keyframes " + name + "{" + body + "}"; };
    style.textContent = ".fx-light{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-light b{position:absolute;left:0;top:0;width:100%;height:55%;display:none;opacity:0;will-change:opacity;" +
      "background:radial-gradient(ellipse 80% 100% at 50% 0%,rgba(240,246,255,.97),rgba(205,222,255,.62) 40%,rgba(170,200,255,.18) 70%,rgba(160,190,255,0) 92%)}" +
      ".fx-light i{position:absolute;top:0;width:300px;height:640px;display:none;opacity:0;background-size:100% 100%;will-change:opacity}" +
      ".fx-light .fx-on{display:block;-webkit-animation:fx-flash .9s linear 1 forwards;animation:fx-flash .9s linear 1 forwards}" +
      // a real flicker: bright, a dip, brighter, then out
      kf("fx-flash", "0%{opacity:0}6%{opacity:.95}14%{opacity:.25}22%{opacity:1}45%{opacity:.5}100%{opacity:0}") +
      // the showcase timeline (8 s): a flash at 0.8 s, a flash + bolt at 4.6 s
      kf("fx-loop-sky", "0%,9%{opacity:0}10%{opacity:.9}11.5%{opacity:.2}13%{opacity:1}17%{opacity:.4}22%,56%{opacity:0}57.5%{opacity:1}59%{opacity:.3}60.5%{opacity:1}66%{opacity:.4}72%,100%{opacity:0}") +
      kf("fx-loop-bolt", "0%,57%{opacity:0}57.5%{opacity:1}59%{opacity:.2}60.5%{opacity:1}64%{opacity:.5}68%,100%{opacity:0}") +
      ".fx-light.fx-loop b{display:block;-webkit-animation:fx-loop-sky 8s linear infinite;animation:fx-loop-sky 8s linear infinite}" +
      ".fx-light.fx-loop i.fx-b0{display:block;-webkit-animation:fx-loop-bolt 8s linear infinite;animation:fx-loop-bolt 8s linear infinite}" +
      ".fx-light.fx-paused *{-webkit-animation-play-state:paused!important;animation-play-state:paused!important}" +
      ".lighter .fx-light,.old-engine .fx-light{display:none!important}";
    doc.head.appendChild(style);
  }
  function flash() {
    if (!host || paused) return;
    var withBolt = Math.random() < 0.5, b = withBolt ? bolts[Math.floor(Math.random() * bolts.length)] : null;
    [sky, b].forEach(function (el) { if (!el) return; el.classList.remove("fx-on"); void el.offsetWidth; el.classList.add("fx-on"); });
    if (b) b.style.left = rnd(8, 78).toFixed(1) + "%";
    root.setTimeout(function () { [sky, b].forEach(function (el) { if (el) el.classList.remove("fx-on"); }); }, 1000);   // off the page again
    next();
  }
  function next() {
    if (timer) root.clearTimeout(timer);
    timer = null;
    var g = GAP[want];
    if (!host || !g || paused || LOOP) return;
    timer = root.setTimeout(flash, rnd(g[0], g[1]));
  }
  function build() {
    if (timer) { root.clearTimeout(timer); timer = null; }
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; sky = null; bolts = []; }
    if (!GAP[want] || off || calm() || !doc.body) return;
    css();
    host = doc.createElement("div"); host.className = "fx-light" + (LOOP ? " fx-loop" : "") + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    sky = doc.createElement("b"); host.appendChild(sky);
    for (var k = 0; k < 2; k++) { var i = doc.createElement("i"); i.className = "fx-b" + k; i.style.backgroundImage = "url(" + boltPicture(300, 640) + ")"; i.style.left = (k ? 62 : 22) + "%"; host.appendChild(i); bolts.push(i); }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
    next();
  }

  root.AmbientLightning = {
    // amount: off | rare | storm; disabled: Lighter / old engine / Loop
    set: function (amount, disabled) {
      var a = GAP[amount] ? amount : "off", d = !!disabled;
      if (a === want && d === off && (host || a === "off" || d)) return;
      want = a; off = d; build();
    },
    pause: function () { paused = true; if (timer) { root.clearTimeout(timer); timer = null; } if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); next(); },
    flash: flash,   // tests, and a designer preview
    on: function () { return !!host; },
    GAP: GAP
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
