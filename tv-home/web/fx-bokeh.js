// Bokeh lights drift (design.home.bokeh: off | few | some | many; design.home.bokeh_colour: #rrggbb, else the design's
// accent): big soft out-of-focus discs of light, a bright rim and a pale fill like a camera's bokeh, drifting slowly over the
// photo and breathing brighter and dimmer. Near discs are bigger and fainter, far ones smaller and brighter. For city-at-night,
// Christmas, lo-fi rain and cosy designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA). A disc is ONE element
// with its picture drawn once (a 96 px canvas made into an image, stretched: it is soft anyway); its drift and breathing are ONE
// CSS animation of transform (translate) + opacity on one of four drift paths. The page draws nothing per frame, there is no
// blur filter and no blend mode. 10 / 16 / 24 discs of 2.5-11 vw: about 7 / 11 / 16 % of the screen in all. Nothing moves while
// the home is covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", colour = "", off = false, paused = false;
  var COUNT = { few: 10, some: 16, many: 24 };
  // four drift paths (vw / vh): out and back over one cycle, so a disc never wanders off
  var PATHS = [[4, -6], [-5, -4], [3, 5], [-4, 6]];
  // ?fxloop=1 (showcase videos only): every disc on an 8 s cycle, spread through it, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function hex(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
    return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [255, 196, 120];
  }
  function mixWhite(rgb, t) { return rgb.map(function (v) { return Math.round(v + (255 - v) * t); }); }
  // a disc: a pale even fill, a brighter rim just inside the edge, a soft fall-off outside it. a = how strong (near discs fainter)
  function disc(rgb, a) {
    var px = 96, c = doc.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), r = px / 2, o = g.createRadialGradient(r, r, 0, r, r, r), s = function (x) { return "rgba(" + rgb + "," + (x * a).toFixed(3) + ")"; };
    o.addColorStop(0, s(0.42)); o.addColorStop(0.68, s(0.5)); o.addColorStop(0.86, s(0.85)); o.addColorStop(0.94, s(0.45)); o.addColorStop(1, s(0));
    g.fillStyle = o; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c.toDataURL("image/png");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function css() {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var kf = function (name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; };
    style.textContent = ".fx-bokeh{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-bokeh i{position:absolute;display:block;border-radius:50%;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-bokeh.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-bokeh,.old-engine .fx-bokeh{display:none!important}" +
      PATHS.map(function (p, k) {
        return kf("fx-bokeh" + k, "0%,100%{opacity:.35;transform:translate3d(0,0,0)}50%{opacity:1;transform:translate3d(" + p[0] + "vw," + p[1] + "vh,0)}");
      }).join("");
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var n = COUNT[want];
    if (!n || off || calm() || !doc.body) return;
    css();
    var base = hex(colour), tints = [base, mixWhite(base, 0.18), mixWhite(base, 0.36)];
    // per tint: a far picture (small, bright) and a near one (big, faint)
    var pics = tints.map(function (t) { return [disc(t, 1), disc(t, 0.6)]; });
    host = doc.createElement("div"); host.className = "fx-bokeh" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      var near = Math.random() < 0.3, s = near ? rnd(7, 11) : rnd(2.5, 6), d = LOOP ? 8 : rnd(16, 30), at = LOOP ? -(k * 8 / n) : -rnd(0, d);
      var t = doc.createElement("i");
      t.style.cssText = "left:" + rnd(-2, 96).toFixed(1) + "%;top:" + rnd(-4, 86).toFixed(1) + "%;width:" + s.toFixed(1) + "vw;height:" + s.toFixed(1) + "vw;" +
        "background-image:url(" + pics[k % 3][near ? 1 : 0] + ");-webkit-animation-name:fx-bokeh" + (k % 4) + ";animation-name:fx-bokeh" + (k % 4) + ";" +
        "-webkit-animation-duration:" + d.toFixed(1) + "s;animation-duration:" + d.toFixed(1) + "s;-webkit-animation-delay:" + at.toFixed(2) + "s;animation-delay:" + at.toFixed(2) + "s";
      host.appendChild(t);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientBokeh = {
    // amount: off | few | some | many; colour: #rrggbb (the design's bokeh_colour, else its accent); disabled: Lighter / old engine / Loop
    set: function (amount, col, disabled) {
      var a = COUNT[amount] ? amount : "off", c = String(col || ""), d = !!disabled;
      if (a === want && c === colour && d === off && (host || a === "off" || d)) return;
      want = a; colour = c; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    COUNT: COUNT, PATHS: PATHS
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
