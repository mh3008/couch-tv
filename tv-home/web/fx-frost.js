// Frost creeping on the glass (design.home.frost: off | light | medium | heavy, design.home.frost_style: ice | aqua | rose): ice
// ferns grow in from the corners of the screen, glints twinkle on the crystal tips, then the frost thaws and creeps in again from
// somewhere else. For winter, Christmas, snow, mountain and cosy designs. Off unless a design picks it.
//
// Made for a Fire TV stick (the rain v3 lesson: the stick's limit is the total composited layer AREA, and no canvas is drawn per
// frame). Every picture (a corner of ice ferns, a strip of rime, a glint) is drawn ONCE on a canvas and used as a CSS background;
// the whole effect is CSS animation of transform + opacity. One corner = one 760x520 layer that grows from its corner (scale, ease-out
// in nine small steps) while it fades in, holds, then thaws; its glints are tiny children on ONE short cycle each. Light = 2
// corners, medium = 4, heavy = 4 + a strip of rime along the top and the bottom edge: about 38 / 76 / 98 % of one screen in all.
// It sits under the cards (right after the weather layer), so nothing it draws can hide a widget. Nothing moves while the home is
// covered, when the TV asks for less motion, in the Lighter home, the old engine or the Loop look.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", wantStyle = "ice", off = false, paused = false;
  var AMT = { light: [2, 0], medium: [4, 0], heavy: [4, 2] };        // corners, edge strips
  var PALETTES = { ice: [205, 228, 255], aqua: [140, 225, 240], rose: [255, 205, 225] };
  var CW = 760, CH = 520, EDGE_H = 120, GL = 56;                     // corner picture, edge strip height, glint size
  var CORNERS = ["tl", "br", "tr", "bl"];                            // light uses the first two (a diagonal pair)
  var GLINTS = 6;                                                    // per corner
  // ?fxloop=1 (showcase videos only): every cycle divides 8 s, in fixed places, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function seeded(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mix(c, k) { return [Math.round(c[0] + (255 - c[0]) * k), Math.round(c[1] + (255 - c[1]) * k), Math.round(c[2] + (255 - c[2]) * k)]; }

  // one corner of ice: a soft haze, milky patches, ferns growing out of the corner (stem -> branches -> twigs) and bright tips.
  // Returns the picture and the tip spots (the glints sit on them). Drawn at the top-left; the other corners mirror it.
  function corner(seed, c) {
    var cv = doc.createElement("canvas"); cv.width = CW; cv.height = CH;
    var g = cv.getContext("2d"), R = seeded(seed), tips = [], white = mix(c, 0.7), core = mix(c, 0.45);
    var haze = g.createRadialGradient(0, 0, 0, 0, 0, 720);
    haze.addColorStop(0, rgba(c, 0.9)); haze.addColorStop(0.3, rgba(c, 0.62)); haze.addColorStop(0.62, rgba(c, 0.28)); haze.addColorStop(1, rgba(c, 0));
    g.fillStyle = haze; g.fillRect(0, 0, CW, CH);
    for (var p = 0; p < 340; p++) {        // milky frost patches, thicker near the corner
      var rr = Math.pow(R(), 0.85) * 640, aa = R() * Math.PI / 2, x = rr * Math.cos(aa), y = rr * Math.sin(aa), s = 8 + R() * 30;
      g.fillStyle = rgba(c, 0.07 + 0.2 * (1 - rr / 640)); g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
    function limb(x, y, ang, len, depth, w) {     // a fern limb: wobbling stem, side branches on both sides, a bright tip
      var step = depth === 0 ? 20 : depth === 1 ? 12 : 8, n = Math.max(3, Math.floor(len / step)), px = x, py = y, a = ang, pts = [[x, y]], k;
      for (k = 1; k <= n; k++) {
        a += (R() - 0.5) * 0.16; px += Math.cos(a) * step; py += Math.sin(a) * step; pts.push([px, py]);
      }
      [[w * 3.6, 0.2, c], [w, 0.95, white]].forEach(function (pass) {     // a wide faint stroke under a thin bright one = glow without a blur
        g.strokeStyle = rgba(pass[2], pass[1]); g.lineWidth = pass[0]; g.lineCap = "round";
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
      });
      if (depth < 3) {
        for (k = 2; k < pts.length; k += (depth === 0 ? 1 : depth === 1 ? 1 : 3)) {
          var t = k / pts.length, bl = len * (depth === 0 ? 0.42 : 0.5) * (1 - t * 0.75), side = (k % 2 ? 1 : -1) * (0.85 + R() * 0.3);
          if (bl > 14) limb(pts[k][0], pts[k][1], a + side, bl, depth + 1, Math.max(1.1, w * 0.7));
        }
      }
      var e = pts[pts.length - 1];
      if (e[0] > 0 && e[0] < CW && e[1] > 0 && e[1] < CH) {
        g.fillStyle = "rgba(255,255,255,0.95)"; g.beginPath(); g.arc(e[0], e[1], 1.6 + (2 - depth) * 0.6, 0, Math.PI * 2); g.fill();
        if (depth === 0 || (depth === 1 && R() < 0.3)) tips.push([e[0], e[1]]);
      }
    }
    var stems = 11, s0;
    for (s0 = 0; s0 < stems; s0++) limb(0, 0, (4 + (s0 + R() * 0.7) * (82 / stems)) * Math.PI / 180, 460 + R() * 280, 0, 4.4);
    // crisp rime dots near the corner
    for (p = 0; p < 90; p++) { var q = Math.pow(R(), 1.5) * 380, b = R() * Math.PI / 2; g.fillStyle = "rgba(255,255,255," + (0.35 + R() * 0.5) + ")"; g.beginPath(); g.arc(q * Math.cos(b), q * Math.sin(b), 0.8 + R() * 1.4, 0, Math.PI * 2); g.fill(); }
    return { url: cv.toDataURL("image/png"), tips: tips };
  }
  // a strip of rime along the top edge (mirrored for the bottom): haze that thins downwards, hoar crystals standing off the edge
  function strip(c) {
    var cv = doc.createElement("canvas"); cv.width = 1920; cv.height = EDGE_H;
    var g = cv.getContext("2d"), R = seeded(77), f = g.createLinearGradient(0, 0, 0, EDGE_H);
    f.addColorStop(0, rgba(c, 0.85)); f.addColorStop(0.4, rgba(c, 0.4)); f.addColorStop(1, rgba(c, 0));
    g.fillStyle = f; g.fillRect(0, 0, 1920, EDGE_H);
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 2; g.lineCap = "round";
    for (var i = 0; i < 420; i++) {
      var x = R() * 1920, h = 6 + Math.pow(R(), 2.2) * 46, a = Math.PI / 2 + (R() - 0.5) * 1.6;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + Math.cos(a) * h, Math.sin(a) * h); g.stroke();
      g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(x + Math.cos(a) * h, Math.sin(a) * h, 1.3, 0, Math.PI * 2); g.fill();
    }
    return cv.toDataURL("image/png");
  }
  // a four-point glint: two thin crossing spikes and a white heart
  function glint(c) {
    var cv = doc.createElement("canvas"); cv.width = cv.height = GL;
    var g = cv.getContext("2d"), m = GL / 2, k;
    for (k = 0; k < 2; k++) {
      var f = k ? g.createLinearGradient(0, m, GL, m) : g.createLinearGradient(m, 0, m, GL);
      f.addColorStop(0, rgba(c, 0)); f.addColorStop(0.5, "rgba(255,255,255,1)"); f.addColorStop(1, rgba(c, 0));
      g.fillStyle = f; g.beginPath();
      if (k) { g.moveTo(0, m); g.lineTo(m, m - 2.2); g.lineTo(GL, m); g.lineTo(m, m + 2.2); } else { g.moveTo(m, 0); g.lineTo(m + 2.2, m); g.lineTo(m, GL); g.lineTo(m - 2.2, m); }
      g.closePath(); g.fill();
    }
    var h = g.createRadialGradient(m, m, 0, m, m, 12);
    h.addColorStop(0, "rgba(255,255,255,1)"); h.addColorStop(0.4, rgba(c, 0.6)); h.addColorStop(1, rgba(c, 0));
    g.fillStyle = h; g.beginPath(); g.arc(m, m, 12, 0, Math.PI * 2); g.fill();
    return cv.toDataURL("image/png");
  }
  function kf(name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; }
  function r2(v) { return Math.round(v * 100) / 100; }

  // the creep, one row per keyframe: [% of the cycle]. The frost grows out of its corner fast and slows down (ease-out, nine small
  // steps, cubic), fades in as it goes, holds and drifts a little, then thaws (fades while it swells slightly); dark from 98 % to the end.
  var GROW = [4, 7, 10, 14, 18, 23, 29, 36, 46];
  function creep(name, axis, from) {
    var body = "0%{opacity:0;transform:" + axis(from) + "}";
    GROW.forEach(function (p) {
      var u = (p - 4) / 42, e = 1 - Math.pow(1 - u, 3);
      body += p + "%{opacity:" + r2(Math.min(1, (p - 4) / 16)) + ";transform:" + axis(from + (1 - from) * e) + "}";
    });
    body += "72%{opacity:1;transform:" + axis(1.03) + "}86%{opacity:0.55;transform:" + axis(1.04) + "}98%{opacity:0;transform:" + axis(1.05) + "}100%{opacity:0;transform:" + axis(from) + "}";
    return kf(name, body);
  }
  function css(pal, pics, strips) {
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var anim = "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite;-webkit-animation-timing-function:linear;animation-timing-function:linear;";
    var out = ".fx-frost{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-frost b{position:absolute;display:block;width:" + CW + "px;height:" + CH + "px}" +
      ".fx-frost b.e{width:100%;height:" + EDGE_H + "px;left:0}" +
      ".fx-frost b.tl{left:0;top:0}.fx-frost b.tr{right:0;top:0;-webkit-transform:scaleX(-1);transform:scaleX(-1)}" +
      ".fx-frost b.bl{left:0;bottom:0;-webkit-transform:scaleY(-1);transform:scaleY(-1)}.fx-frost b.br{right:0;bottom:0;-webkit-transform:scale(-1,-1);transform:scale(-1,-1)}" +
      ".fx-frost b.top{top:0}.fx-frost b.bot{bottom:0;-webkit-transform:scaleY(-1);transform:scaleY(-1)}" +
      ".fx-frost i{position:absolute;display:block;left:0;top:0;width:100%;height:100%;opacity:0;background-size:100% 100%;will-change:opacity,transform;" +
      "-webkit-transform-origin:0 0;transform-origin:0 0;-webkit-animation-name:fx-frs-grow;animation-name:fx-frs-grow;" + anim +
      "-webkit-animation-duration:inherit;animation-duration:inherit;-webkit-animation-delay:inherit;animation-delay:inherit}" +
      ".fx-frost b.e i{-webkit-animation-name:fx-frs-edge;animation-name:fx-frs-edge;background-image:url(" + strips + ")}" +
      ".fx-frost u{position:absolute;display:block;width:" + GL + "px;height:" + GL + "px;margin:-" + GL / 2 + "px 0 0 -" + GL / 2 + "px;opacity:0;background-size:100% 100%;" +
      "background-image:url(" + pics.glint + ");will-change:opacity,transform;-webkit-animation-name:fx-frs-tw;animation-name:fx-frs-tw;" + anim +
      "-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out}" +
      ".fx-frost.fx-paused i,.fx-frost.fx-paused u{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-frost,.old-engine .fx-frost{display:none!important}";
    pics.corners.forEach(function (p, n) { out += ".fx-frost b.v" + n + " i{background-image:url(" + p.url + ")}"; });
    out += creep("fx-frs-grow", function (s) { return "scale(" + r2(s) + ")"; }, 0.25) + creep("fx-frs-edge", function (s) { return "scaleY(" + r2(s) + ")"; }, 0.2) +
      kf("fx-frs-tw", "0%,100%{opacity:0;transform:scale(0.3) rotate(-25deg)}50%{opacity:1;transform:scale(1) rotate(0deg)}");
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
    var c = PALETTES[wantStyle] || PALETTES.ice, pics = { corners: [corner(11, c), corner(29, c)], glint: glint(c) };
    css(c, pics, n[1] ? strip(c) : "AA");
    host = doc.createElement("div"); host.className = "fx-frost" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    var q, k;
    for (q = 0; q < n[0]; q++) {
      var b = doc.createElement("b"), v = q % 2, cyc = LOOP ? 8 : rnd(20, 28), pic = pics.corners[v];
      b.className = CORNERS[q] + " v" + v; setAnim(b, cyc, LOOP ? -((q * 2) % 8) : -rnd(0, cyc));
      var i = doc.createElement("i"); b.appendChild(i);
      for (k = 0; k < GLINTS; k++) {
        var u = doc.createElement("u"), tip = pic.tips[(k * 5 + q) % Math.max(1, pic.tips.length)] || [200 + k * 60, 120 + k * 40], d = LOOP ? [2, 4, 2, 8, 4, 2][k] : rnd(2.4, 4.2);
        u.style.left = r2(tip[0]) + "px"; u.style.top = r2(tip[1]) + "px";
        setAnim(u, d, LOOP ? -((k * 0.5 + q * 0.25) % d) : -rnd(0, d));
        i.appendChild(u);
      }
      host.appendChild(b);
    }
    for (q = 0; q < n[1]; q++) {
      var e = doc.createElement("b"), ei = doc.createElement("i"), cy2 = LOOP ? 8 : rnd(20, 28);
      e.className = "e " + (q ? "bot" : "top"); setAnim(e, cy2, LOOP ? -(1 + q * 4) : -rnd(0, cy2)); e.appendChild(ei); host.appendChild(e);
    }
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientFrost = {
    // amount: off | light | medium | heavy; style: ice | aqua | rose; disabled: Lighter / old engine / Loop
    set: function (amount, styleName, disabled) {
      var a = AMT[amount] ? amount : "off", s = PALETTES[styleName] ? styleName : "ice", d = !!disabled;
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
