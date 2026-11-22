// Birds crossing the sky (design.home.birds: off | few | flock | many; design.home.birds_style: dark | light | dusk):
// small flocks of birds (a loose cluster far away, a V of mid-size birds, a close pair or trio) crossing the picture now and then,
// each bird beating its wings. Off unless a design picks it.
//
// Made for a Fire TV stick (the stick's limit is the total composited layer AREA, not the number of layers). A bird is TWO small
// elements: the body (a picture drawn once, which also carries the bird's path across the screen: transform only) and its wings (a
// second picture drawn once, a child that beats by scaleY alone: up, flat, down, flat, up). The birds of a flock share one path and
// one delay, so the formation holds; two variants of the path differ only by a small slow bob, so the flock is not a rigid block.
// The page draws nothing per frame: no filter, no blur, no blend mode, no opacity trick. Total layer area, worst case (many): about 16 %
// of a screen (the test counts it). Nothing moves while the home is covered, when the TV asks for less motion, in the Lighter home,
// the old engine or the Loop look (app.js ambientSync / pause / resume).
(function (root) {
  "use strict";
  var doc = root.document, host = null, style = null, want = "off", kind = "dark", off = false, paused = false;
  // z: 0 far (small, slow, a little hazy), 1 mid, 2 close (big, fast). D: seconds to cross; gap: seconds of empty sky before the next crossing
  var FLOCKS = {
    few: [{ z: 0, n: 6, lay: "loose", dir: 1, y: 0.2, D: 36, gap: 30 }, { z: 1, n: 3, lay: "v", dir: -1, y: 0.32, D: 26, gap: 70 }],
    flock: [{ z: 0, n: 9, lay: "loose", dir: 1, y: 0.18, D: 36, gap: 14 }, { z: 1, n: 5, lay: "v", dir: -1, y: 0.3, D: 26, gap: 24 },
      { z: 2, n: 2, lay: "v", dir: 1, y: 0.24, D: 14, gap: 50 }],
    many: [{ z: 0, n: 10, lay: "loose", dir: 1, y: 0.16, D: 34, gap: 8 }, { z: 1, n: 7, lay: "v", dir: -1, y: 0.3, D: 24, gap: 10 },
      { z: 2, n: 3, lay: "v", dir: 1, y: 0.22, D: 13, gap: 26 }, { z: 0, n: 7, lay: "loose", dir: -1, y: 0.07, D: 40, gap: 6 }]
  };
  var STYLES = {
    dark: { body: ["#1C2431", "#35414F"], wing: ["#1C2431", "#445163"] },
    light: { body: ["#FFFFFF", "#DCE4EE"], wing: ["#FFFFFF", "#B7C4D4"] },
    dusk: { body: ["#3B1F36", "#5C3050"], wing: ["#3B1F36", "#6E3A5E"] }
  };
  var SPAN = [[40, 56], [72, 104], [150, 205]], HAZE = [0.8, 0.94, 1];
  var FLAPN = [20, 16, 12];   // beats per 8 s (a whole number, so the 8 s showcase loop repeats exactly)
  var LOOP = /[?&]fxloop=1(?:&|$)/.test((root.location && root.location.search) || "");
  var STEPS = 48;

  function calm() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = Math.random;
  function rnd(a, b) { return a + R() * (b - a); }
  function pick(list) { return list[Math.floor(R() * list.length) % list.length]; }
  function f1(n) { return Math.round(n * 10) / 10; }
  function f2(n) { return Math.round(n * 100) / 100; }

  // the body, seen from the side, facing right: tail, body, head, beak (drawn in a 128 x 64 box, shown at any size)
  function body(px, cols) {
    var c = doc.createElement("canvas"); c.width = px; c.height = px / 2;
    var g = c.getContext("2d"), s = px / 128, grad;
    g.scale(s, s);
    grad = g.createLinearGradient(40, 28, 90, 40); grad.addColorStop(0, cols[0]); grad.addColorStop(1, cols[1]);
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(40, 30); g.lineTo(56, 32.5); g.lineTo(56, 36.5); g.lineTo(40, 39); g.closePath(); g.fill();
    g.beginPath(); g.ellipse ? g.ellipse(66, 34.5, 14, 4.8, 0, 0, 6.2832) : g.arc(66, 34.5, 9, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(80, 32.5, 3.8, 0, 6.2832); g.fill();
    g.beginPath(); g.moveTo(83, 31.2); g.lineTo(91, 33); g.lineTo(83, 34.4); g.closePath(); g.fill();
    return c.toDataURL("image/png");
  }
  // both wings, tips up, a gull's arched wing; flapped with scaleY from the shoulder line
  function wings(px, cols) {
    var c = doc.createElement("canvas"); c.width = px; c.height = px / 2;
    var g = c.getContext("2d"), s = px / 128, grad, side;
    g.scale(s, s);
    grad = g.createLinearGradient(64, 34, 3, 14); grad.addColorStop(0, cols[0]); grad.addColorStop(1, cols[1]);
    g.fillStyle = grad;
    for (side = 0; side < 2; side++) {
      g.save(); if (side) { g.translate(128, 0); g.scale(-1, 1); }
      g.beginPath(); g.moveTo(67, 34); g.bezierCurveTo(52, 20, 30, 9, 3, 15); g.bezierCurveTo(26, 20, 45, 30, 67, 38.5); g.closePath(); g.fill();
      g.restore();
    }
    return c.toDataURL("image/png");
  }

  // wing beat: scaleY 1 (tips up) -> -0.76 (tips down) -> 1. Burst: four beats, then a glide with the wings held up a little
  function flapKf(burst) {
    var rows = [], i, t, k, j;
    if (!burst) {
      for (i = 0; i <= 12; i++) { t = i / 12; rows.push(f1(100 * t) + "%{transform:scaleY(" + f2(0.12 + 0.88 * Math.cos(6.283185 * t)) + ")}"); }
    } else {
      for (k = 0; k < 4; k++) for (j = 0; j < 8; j++) { t = (k * 8 + j) / 32; rows.push(f2(50 * t) + "%{transform:scaleY(" + f2(0.12 + 0.88 * Math.cos(6.283185 * 4 * t)) + ")}"); }
      rows.push("50%{transform:scaleY(1)}", "58%{transform:scaleY(0.4)}", "92%{transform:scaleY(0.4)}", "100%{transform:scaleY(1)}");
    }
    return rows.join("");
  }
  // one flock's path (all in one transform): off the screen at one edge to off the other, drifting a little, bobbing slowly (whole
  // cycles, so the line is smooth); frac < 1 holds the end position (off the screen) for the rest of the cycle = the empty sky
  function pathKf(w, h, spec, pad, frac, cyc, amp, phase, slope) {
    var rows = [], i, t, x, y, y0 = spec.y * h;
    for (i = 0; i <= STEPS; i++) {
      t = i / STEPS;
      x = spec.dir > 0 ? -pad + (w + 2 * pad) * t : w + pad - (w + 2 * pad) * t;
      y = y0 + slope * h * (t - 0.5) + amp * Math.sin(6.283185 * cyc * t + phase);
      rows.push(f1(100 * frac * t) + "%{transform:translate3d(" + f1(x) + "px," + f1(y) + "px,0) scaleX(" + spec.dir + ")}");
    }
    if (frac < 1) rows.push("100%" + rows[rows.length - 1].replace(/^[\d.]+%/, ""));
    return rows.join("");
  }
  // formation offsets in the direction of flight (u: along, behind the leader is negative; v: across), then mirrored for a flock flying left
  function layout(spec, span) {
    var n = spec.n, out = [{ u: 0, v: 0 }], i, tries, c, ok, p, gx = span * 0.78, gy = span * 0.42;
    if (spec.lay === "v") {
      for (i = 1; i < n; i++) { var row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; out.push({ u: -row * gx + rnd(-0.08, 0.08) * span, v: side * row * gy + rnd(-0.08, 0.08) * span }); }
    } else {
      for (i = 1; i < n; i++) {
        for (tries = 0; tries < 60; tries++) {
          c = { u: -rnd(0, 1) * n * span * 0.42, v: rnd(-1, 1) * Math.max(1.5, n * 0.28) * span * 0.55 };
          ok = true; for (p = 0; p < out.length; p++) if (Math.abs(out[p].u - c.u) < span * 0.8 && Math.abs(out[p].v - c.v) < span * 0.5) ok = false;
          if (ok) break;
        }
        out.push(c);
      }
    }
    return out;
  }
  function kf(name, body) { return "@-webkit-keyframes " + name + "{" + body.replace(/transform:/g, "-webkit-transform:") + "}@keyframes " + name + "{" + body + "}"; }
  function an(name, dur, delay) {
    return "-webkit-animation-name:" + name + ";animation-name:" + name + ";-webkit-animation-duration:" + dur + "s;animation-duration:" + dur + "s;" +
      "-webkit-animation-delay:-" + delay + "s;animation-delay:-" + delay + "s";
  }
  function back(x, dur) { var b = (((x % dur) + dur) % dur).toFixed(2); return +b >= dur ? "0.00" : b; }

  function build() {
    if (host) { host.parentNode && host.parentNode.removeChild(host); host = null; }
    var list = FLOCKS[want];
    if (!list || off || calm() || !doc.body) return;
    R = LOOP ? mulberry(3009) : Math.random;
    var w = root.innerWidth || 1920, h = root.innerHeight || 1080, st = STYLES[kind] || STYLES.dark, fi, v, i;
    if (!style) { style = doc.createElement("style"); doc.head.appendChild(style); }
    var css = ".fx-birds{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}" +
      ".fx-birds i,.fx-birds u{position:absolute;display:block;will-change:transform;background-size:100% 100%;-webkit-animation-timing-function:linear;animation-timing-function:linear;" +
      "-webkit-animation-iteration-count:infinite;animation-iteration-count:infinite}" +
      ".fx-birds i{left:0;top:0}.fx-birds u{left:0;top:0;width:100%;height:100%;-webkit-transform-origin:50% 53%;transform-origin:50% 53%}" +
      ".fx-birds.fx-paused i,.fx-birds.fx-paused u{-webkit-animation-play-state:paused;animation-play-state:paused}" +
      ".lighter .fx-birds,.old-engine .fx-birds{display:none!important}" + kf("fx-bflapc", flapKf(false)) + kf("fx-bflapb", flapKf(true));
    var pics = { small: [body(96, st.body), wings(96, st.wing)], big: [body(192, st.body), wings(192, st.wing)] };
    host = doc.createElement("div"); host.className = "fx-birds" + (paused ? " fx-paused" : ""); host.setAttribute("aria-hidden", "true");
    for (fi = 0; fi < list.length; fi++) {
      var spec = list[fi], z = spec.z, span = rnd(SPAN[z][0], SPAN[z][1]);
      var P = LOOP ? (z === 2 ? 4 : 8) : spec.D + spec.gap, frac = LOOP ? 1 : spec.D / P;
      var form = layout(spec, span), fw = 0;
      for (i = 0; i < form.length; i++) fw = Math.max(fw, Math.abs(form[i].u));
      var pad = fw + span * 1.2 + 60, cyc = LOOP ? 2 : Math.max(3, Math.round(spec.D / 5)), slope = rnd(-0.05, 0.05);
      for (v = 0; v < 2; v++) css += kf("fx-bpath" + fi + "_" + v, pathKf(w, h, spec, pad, frac, cyc, [4, 7, 11][z], v * 3.1 + rnd(0, 0.6), slope));
      var delay = LOOP ? back((fi * 0.37 % 1) * P, P) : back(rnd(0, P), P);
      for (i = 0; i < form.length; i++) {
        var size = Math.round(span * rnd(0.9, 1.1)), pic = pics[z === 2 ? "big" : "small"];
        var e = doc.createElement("i"), u = doc.createElement("u");
        e.style.cssText = "left:" + Math.round(spec.dir * form[i].u) + "px;top:" + Math.round(form[i].v) + "px;width:" + size + "px;height:" + Math.round(size / 2) + "px;background-image:url(" + pic[0] + ");opacity:" + HAZE[z] + ";" + an("fx-bpath" + fi + "_" + (i % 2), P, delay);
        var burst = z > 0 && i % 2 === 1, fd = burst ? 4 : 8 / (FLAPN[z] + (i % 3) - 1);
        u.style.cssText = "background-image:url(" + pic[1] + ");" + an(burst ? "fx-bflapb" : "fx-bflapc", fd, back(rnd(0, fd), fd));
        e.appendChild(u); host.appendChild(e);
      }
    }
    style.textContent = css;
    // right above the photo and the weather layer, under every card
    var wc = doc.getElementById("weather-canvas");
    if (wc && wc.parentNode) wc.parentNode.insertBefore(host, wc.nextSibling); else doc.body.appendChild(host);
  }

  root.AmbientBirds = {
    // amount: off | few | flock | many; style: dark | light | dusk; disabled: Lighter / old engine / Loop
    set: function (amount, birdStyle, disabled) {
      var a = FLOCKS[amount] ? amount : "off", k = STYLES[birdStyle] ? birdStyle : "dark", d = !!disabled;
      if (a === want && k === kind && d === off && (host || a === "off" || d)) return;
      want = a; kind = k; off = d; build();
    },
    pause: function () { paused = true; if (host) host.classList.add("fx-paused"); },
    resume: function () { paused = false; if (host) host.classList.remove("fx-paused"); },
    on: function () { return !!host; },
    AMOUNTS: Object.keys(FLOCKS), STYLES: Object.keys(STYLES)
  };
  try { root.matchMedia("(prefers-reduced-motion: reduce)").addListener(function () { build(); }); } catch (e) {}
})(this);
