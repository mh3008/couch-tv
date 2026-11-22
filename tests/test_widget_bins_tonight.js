// Bin night (feat/bins-tonight): on the night itself the lids bob (transform only) and the card says "Put them out tonight";
// other nights stay still; a fortnightly rota shows next week's bins in a tall card. Run: node tests/test_widget_bins_tonight.js
const fs = require("fs");
const path = require("path");
const K = require("./web-widgets-kit");
const { ok, done } = K.counter("Bin night");
const NOW = new Date(2026, 10, 22, 19, 0, 0).getTime();   // Sunday 22 Nov 2026, 7pm
const T = K.home(NOW);
const W = T.W;
console.log("Running Bin night tests...");
const all = (el, out) => { out = out || []; out.push(el); (el.childNodes || []).forEach((c) => all(c, out)); return out; };
const going = (el) => all(el).filter((n) => /cw-bin-go/.test((n.attrs && n.attrs["class"]) || "")).length;
const draw = (opts, w, h) => W.render({ kind: "bins", w: w || 400, h: h || 360, opts }, {});

const tonight = draw({ weekday: 0 });
ok(/Put them out tonight/.test(tonight.textContent), "bin night itself: Put them out tonight (" + tonight.textContent.slice(0, 50) + ")");
ok(going(tonight) === 2, "both lids bob (" + going(tonight) + ")");
const tomorrow = draw({ weekday: 1 });
ok(/Tomorrow night/.test(tomorrow.textContent) && going(tomorrow) === 0, "tomorrow: the usual words, the lids still");
const thu = draw({ weekday: 4 });
ok(/Thursday night/.test(thu.textContent) && going(thu) === 0, "another night: still");
const rota = draw({ weekday: 0, alt: true, anchor: 0 });
ok(/Next week: Rubbish and (Recycling|Garden)/.test(rota.textContent), "a fortnightly rota in a tall card: next week's bins (" + rota.textContent + ")");
const rotaNow = /RubbishRecycling|RubbishGarden/.exec(rota.textContent.replace(/\s/g, ""));
ok(rotaNow && rota.textContent.indexOf("Next week: Rubbish and " + (rotaNow[0].indexOf("Recycling") > 0 ? "Garden" : "Recycling")) >= 0, "next week is the other bin");
ok(!/Next week/.test(draw({ weekday: 0, alt: true }, 400, 240).textContent), "a short card: no next-week line");
ok(!/Next week/.test(draw({ weekday: 0 }).textContent), "a weekly rota: no next-week line");
ok(!/Next week/.test(draw({ weekday: 0, alt: true }, 360, 360).textContent), "a narrow tall card: no next-week line (it would be cut off)");
const small = W.render({ kind: "bins", w: 260, h: 300, opts: { weekday: 0 } }, {});
ok(/Tonight/.test(small.textContent) && going(small) === 2, "a narrow card on the night: Tonight, lids bob");
const compact = W.render({ kind: "bins", w: 400, h: 150, opts: { weekday: 0 } }, {});
ok(going(compact) === 2, "the short (under 200 px) layout bobs too");
ok(going(W.render({ kind: "bins", w: 400, h: 150, opts: { weekday: 3 } }, {})) === 0, "the short layout, another night: still");
K.sizes(T.C, "bins").forEach(([id, w, h]) => {
  const el = W.render({ kind: "bins", w, h, opts: { weekday: 0 } }, {});
  ok(/Tonight|tonight/.test(el.textContent), "bins " + id + " on the night: says tonight (" + w + "x" + h + ")");
});
const css = fs.readFileSync(path.join(__dirname, "../tv-home/web/widgets.css"), "utf8");
const block = css.slice(css.indexOf("/* Bin night"));
const frames = (block.match(/@keyframes cw-bin-lid \{[^@]*/) || [""])[0];
ok(frames && !/(left|top|width|height|margin|opacity)\s*:/.test(frames), "the lid keyframes move transform only");
ok(/html\.lighter \.cw-bin-go/.test(block) && /prefers-reduced-motion/.test(block), "still on the Lighter home or with reduced motion");
done();
