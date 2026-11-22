// Drifting fog v2 (design.home.fog: off | light | medium | thick; design.home.fog_style: mist | warm | cool): a LIGHT-coloured haze that reads on
// any photo, a sharp sunset lake as well as a misty forest. Off unless a design picks it.
//   - banks at three depths (far / middle / near) that drift at different speeds and sizes (parallax), each one a soft picture with a few
//     bright wisps drawn into it, breathing thicker and thinner, and low ground-fog bands that hug the foot of the screen and slide
//     sideways for ever (a seamless tile)
//   - one static veil (a CSS gradient, nothing moves): the light-scatter trick without a filter, it lifts the dark parts of the photo
//     toward the fog colour so even a high-contrast picture shows that there is fog in front of it
// Made for a Fire TV stick: every animated layer is ONE element with ONE animation (transform + opacity, nothing else), at most 14 of
// them (the limit is 30; their boxes add up to about 0.8 / 1.8 / 2.9 screens); the pictures are drawn once on a canvas into data URLs; no blur / filter / shadow, no per-frame work, no CSS
// variables inside keyframes. Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home, the old
// engine or the Loop look (app.js ambientSync / pause / resume). It sits under the cards.
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", kind = "mist", off = false, paused = false, built = "";
  // fog colour (rgb) and how dense the middle of a bank is (0-1). Light: the fog has to be brighter than the dark parts of a photo.
  var STYLES = { mist: [[240, 245, 250], 0.78], warm: [[255, 234, 204], 0.76], cool: [[200, 218, 248], 0.78] };
  // how many banks at each depth (far = near the horizon, small and slow; near = big and quicker), ground-fog bands, strength of the veil
  var SPEC = { light: { far: 2, mid: 2, near: 0, gnd: 1, veil: 0.14 }, medium: { far: 3, mid: 3, near: 2, gnd: 1, veil: 0.2 }, thick: { far: 4, mid: 5, near: 3, gnd: 2, veil: 0.26 } };
  // per depth: lane (top .. bottom, % of the screen height), bank width (px), drift to each side (px), a full back-and-forth (s), picture density, opacity range
  var DEPTH = {
    far: { lane: [34, 52], w: 880, amp: 150, secs: [62, 90], op: [0.55, 0.9], grow: 1.0 },
    mid: { lane: [50, 74], w: 1180, amp: 280, secs: [40, 60], op: [0.6, 0.95], grow: 1.06 },
    near: { lane: [68, 92], w: 1560, amp: 440, secs: [26, 40], op: [0.7, 0.95], grow: 1.1 }
  };
  var GND = [{ tile: 960, secs: 48, dir: -1, op: [0.85, 1] }, { tile: 640, secs: 34, dir: 1, op: [0.8, 1] }];
  var GH = 170, BW = 512, BH = 128, SW = 1920, SH = 1080;
  function count(a) { var s = SPEC[a]; return s ? s.far + s.mid + s.near + Math.min(s.gnd, GND.length) : 0; }
  var COUNT = { light: count("light"), medium: count("medium"), thick: count("thick") };
  // ?fxloop=1 (showcase videos only): every cycle is exactly 8 s, positions come from a seeded generator, so an 8 s clip loops without a jump
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  var seed = 7;
  function rand() { if (!LOOP) return Math.random(); seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  function rnd(a, b) { return a + rand() * (b - a); }
  function col(rgb, a) { return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }
  function mix(rgb, t) { return [Math.round(rgb[0] + (255 - rgb[0]) * t), Math.round(rgb[1] + (255 - rgb[1]) * t), Math.round(rgb[2] + (255 - rgb[2]) * t)]; }
  // one soft oval (a radial gradient squashed to rx : ry), a gaussian-ish fall-off so there is no visible rim; drawn again at +-W for a tile
  function puff(g, cx, cy, rx, ry, rgb, a, wrap, W, rot) {
    var shifts = wrap ? [-W, 0, W] : [0], i, grad;
    for (i = 0; i < shifts.length; i++) {
      g.save(); g.translate(cx + shifts[i], cy); if (rot) g.rotate(rot); g.scale(1, ry / rx);
      grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, col(rgb, a)); grad.addColorStop(0.3, col(rgb, a * 0.8)); grad.addColorStop(0.6, col(rgb, a * 0.34));
      grad.addColorStop(0.85, col(rgb, a * 0.07)); grad.addColorStop(1, col(rgb, 0));
      g.fillStyle = grad; g.beginPath(); g.arc(0, 0, rx, 0, 6.2832); g.fill(); g.restore();
    }
  }
  // a bank: a body of overlapping puffs, thick in the middle and thin at the ends, with a few bright thin wisps through and over it
  function bankPic(rgb, dens, variant) {
    var c = doc.createElement("canvas"), g, i, bright = mix(rgb, 0.7), save = seed, mid, rx, ry, cx, wx, wr;
    c.width = BW; c.height = BH; g = c.getContext("2d");
    seed = 101 + variant * 977;
    for (i = 0; i < 11; i++) {
      mid = 0.5 + (rand() - 0.5) * 0.7; rx = BW * rnd(0.14, 0.26); ry = Math.min(BH * 0.46, rx * rnd(0.34, 0.5));
      cx = Math.max(rx, Math.min(BW - rx, mid * BW));
      puff(g, cx, BH * rnd(0.42, 0.6), rx, ry, rgb, dens * rnd(0.7, 1), false, BW);
    }
    for (i = 0; i < 4; i++) {
      wx = BW * rnd(0.3, 0.7); wr = BW * rnd(0.16, 0.3);
      puff(g, Math.max(wr, Math.min(BW - wr, wx)), BH * rnd(0.3, 0.72), wr, BH * rnd(0.07, 0.11), bright, dens * rnd(0.6, 0.85), false, BW, rnd(-0.12, 0.12));
    }
    seed = save; return c.toDataURL("image/png");
  }
  // the ground-fog band: opaque low down, a ragged soft top, wisps; the left and right edges meet, so it slides for ever
  function groundPic(rgb, dens, tile, variant) {
    var c = doc.createElement("canvas"), g, i, bright = mix(rgb, 0.7), save = seed, grad;
    c.width = tile; c.height = GH; g = c.getContext("2d"); seed = 313 + variant * 541;
    grad = g.createLinearGradient(0, 0, 0, GH);
    grad.addColorStop(0, col(rgb, 0)); grad.addColorStop(0.45, col(rgb, dens * 0.3)); grad.addColorStop(0.8, col(rgb, dens * 0.8)); grad.addColorStop(1, col(rgb, dens));
    g.fillStyle = grad; g.fillRect(0, 0, tile, GH);
    for (i = 0; i < Math.round(tile / 70); i++) puff(g, rnd(0, tile), GH * rnd(0.34, 0.6), rnd(90, 190), GH * rnd(0.2, 0.34), rgb, dens * rnd(0.55, 0.95), true, tile);
    for (i = 0; i < Math.round(tile / 260); i++) puff(g, rnd(0, tile), GH * rnd(0.3, 0.75), rnd(120, 230), GH * rnd(0.06, 0.09), bright, dens * rnd(0.6, 0.85), true, tile, rnd(-0.1, 0.1));
    seed = save; return c.toDataURL("image/png");
  }
  function kf(name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; }
  function tr(x, s) { return "transform:translate3d(" + Math.round(x) + "px,0,0)" + (s && s !== 1 ? " scale(" + s + ")" : ""); }
  // one back-and-forth with the opacity and a slow swell inside the SAME animation: ONE layer per bank
  function bankKf(name, d, mult, dir) {
    var a = Math.round(d.amp * mult) * dir, o = d.op;
    return kf(name, "0%{" + tr(-a, 1) + ";opacity:" + o[0] + "}50%{" + tr(a, d.grow) + ";opacity:" + o[1] + "}100%{" + tr(-a, 1) + ";opacity:" + o[0] + "}");
  }
  function css() {
    var mult = LOOP ? 0.5 : 1, k, text = ".fx-fog{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-fog i{position:absolute;display:block;will-change:transform,opacity;background-repeat:no-repeat;background-size:100% 100%;" +
      "-webkit-animation-timing-function:ease-in-out;animation-timing-function:ease-in-out;-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-fog i.fx-g{background-repeat:repeat-x;-webkit-animation-timing-function:linear;animation-timing-function:linear}" +
      ".fx-fog u{position:absolute;left:0;top:0;width:100%;height:100%;display:block}" +
      ".fx-fog.fx-paused i{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-fog,.old-engine .fx-fog{display:none!important}";
    for (k in DEPTH) text += bankKf("fx-" + k + "-f", DEPTH[k], mult, 1) + bankKf("fx-" + k + "-b", DEPTH[k], mult, -1);
    GND.forEach(function (gd, n) {
      var o = gd.op, a = gd.dir < 0 ? 0 : -gd.tile, b = gd.dir < 0 ? -gd.tile : 0;
      text += kf("fx-gnd" + n, "0%{" + tr(a, 1) + ";opacity:" + o[0] + "}50%{" + tr((a + b) / 2, 1) + ";opacity:" + o[1] + "}100%{" + tr(b, 1) + ";opacity:" + o[0] + "}");
    });
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    style.textContent = text;
  }
  function anim(el, name, secs, phase) {
    var s = secs.toFixed(2) + "s", dl = "-" + (phase * secs).toFixed(2) + "s";
    el.style.cssText += "-webkit-animation-name:" + name + ";animation-name:" + name + ";-webkit-animation-duration:" + s + ";animation-duration:" + s +
      ";-webkit-animation-delay:" + dl + ";animation-delay:" + dl + ";";
  }
  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    built = "";
    var sp = SPEC[want];
    if (!sp || off || calm() || !doc.body) return;
    css(); seed = 7;
    var st = STYLES[kind] || STYLES.mist, rgb = st[0], dens = st[1], pics = [0, 1, 2, 3].map(function (v) { return bankPic(rgb, dens, v); }), veil, n = 0, wc;
    host = doc.createElement("div"); host.className = "fx-fog" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    // the static veil: the light-scatter trick, a gradient that lifts the photo toward the fog colour, strongest low down
    veil = doc.createElement("u");
    veil.style.cssText = "background-image:linear-gradient(to bottom," + col(rgb, 0) + " 0%," + col(rgb, 0) + " 30%," + col(rgb, sp.veil * 0.5) + " 62%," + col(rgb, sp.veil) + " 100%)";
    host.appendChild(veil);
    ["far", "mid", "near"].forEach(function (k) {
      var d = DEPTH[k], c = sp[k], i, p, w, h, t, top, left;
      for (i = 0; i < c; i++) {
        p = doc.createElement("i"); w = Math.round(d.w * rnd(0.92, 1.1)); h = Math.round(w * BH / BW); t = (i + rnd(0.15, 0.85)) / c;
        top = (d.lane[0] + (d.lane[1] - d.lane[0]) * t) / 100 * SH - h / 2; left = (i + rnd(0, 1)) / c * (SW + w * 0.4) - w * 0.45;
        p.style.cssText = "left:" + Math.round(left) + "px;top:" + Math.round(top) + "px;width:" + w + "px;height:" + h + "px;background-image:url(" + pics[n % pics.length] + ");";
        anim(p, "fx-" + k + (i % 2 ? "-b" : "-f"), LOOP ? 8 : rnd(d.secs[0], d.secs[1]), rnd(0, 1));
        host.appendChild(p); n++;
      }
    });
    GND.slice(0, sp.gnd).forEach(function (gd, gi) {
      var p = doc.createElement("i"), tiles = Math.ceil(SW / gd.tile) + 1;
      p.className = "fx-g";
      p.style.cssText = "left:0;top:" + (SH - GH + (gi ? 4 : 18)) + "px;width:" + (tiles * gd.tile) + "px;height:" + GH + "px;background-size:" + gd.tile + "px " + GH + "px;background-image:url(" + groundPic(rgb, dens, gd.tile, gi) + ");";
      anim(p, "fx-gnd" + gi, LOOP ? 8 : gd.secs, gi ? 0.3 : 0);
      host.appendChild(p);
    });
    // right above the photo and the weather layer, under every card
    wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
    built = want + "|" + kind;
  }

  root.AmbientFog = {
    // amount: off | light | medium | thick; style: mist | warm | cool; disabled: Lighter / old engine / Loop
    set: function (amount, fogStyle, disabled) {
      var a = SPEC[amount] ? amount : "off", k = STYLES[fogStyle] ? fogStyle : "mist", d = !!disabled;
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
