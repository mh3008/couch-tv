// Every colour value written in an effect file (tv-home/web/fx-*.js and ambient-weather.js) is a valid hex or rgb(a) colour.
// Why: an alpha string inside an rgba colour made the canvas throw in a real browser and the waves page never drew; the VM tests did not notice (22 Nov).
// Checks every "#hex" and every complete "rgb(a)(...)" string literal in the source, plus the pieces of rgba colours built with +
// (the alpha part must be a number, never quoted). Per-effect tests also validate every colour the canvas is given at run time.
// Run: node tests/test_fx_colours.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "tv-home/web");
const files = fs.readdirSync(dir).filter((f) => /^fx-.*\.js$/.test(f) || f === "ambient-weather.js");
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/;
function valid(c) {
  if (HEX.test(c)) return true;
  const m = RGBA.exec(c);
  return !!(m && +m[1] <= 255 && +m[2] <= 255 && +m[3] <= 255 && (m[4] === undefined || (+m[4] >= 0 && +m[4] <= 1)));
}
let n = 0;
assert.ok(files.length >= 2, "found effect files");
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  // "#abc" literals that look like colours (3-8 hex-ish characters, not an id or a url fragment such as "#weather")
  for (const m of src.matchAll(/(["'])(#[0-9A-Za-z]{3,8})\1/g)) {
    if (!/^#[0-9a-fA-F]+$/.test(m[2]) && /^#[0-9A-Za-z]*\d/.test(m[2]) === false) continue;   // an id like "#weather"
    assert.ok(valid(m[2]), f + ": not a valid hex colour: " + m[2]); n++;
  }
  // complete literals, rgba(...) or rgb(...)
  for (const m of src.matchAll(/(["'])(rgba?\([^"'+]*\))\1/g)) { assert.ok(valid(m[2]), f + ": not a valid rgb(a) colour: " + m[2]); n++; }
  // rgba colours built with +: the head literal must be "rgba(" + numbers..., the alpha must be a number (never a quoted string)
  for (const m of src.matchAll(/(["'])rgba?\([^"'()]*\1\s*\+[^;]*?\+\s*(["'])[^"']*\)\2/g)) {
    assert.ok(!/(,|\()\s*\\?["']\d*\.?\d+\\?["']\s*\)/.test(m[0]), f + ": an alpha in quotes inside an rgba colour: " + m[0]); n++;
  }
  assert.ok(!/rgba\([^)]*,\s*["'](?:[0-9.]+)["']\s*\)/.test(src), f + ": a quoted alpha in an rgba colour");
  assert.ok(!/rgba\([^)]*(NaN|undefined|null)/.test(src), f + ": NaN / undefined in an rgba colour");
}
// the checker itself rejects the known-bad shapes
for (const bad of ["rgba(255,0,0,0.5x)", "rgba(255,0,0,\"0.5\")", "#GGG", "rgba(300,0,0,1)", "rgba(1,2,3,1.5)", "rgba(1,2)", "#12345"]) assert.ok(!valid(bad), bad + " is rejected");
for (const good of ["#FFF", "#ffffff80", "rgba(255,235,242,0)", "rgb(1, 2, 3)", "rgba(0,0,0,.5)"]) assert.ok(valid(good), good + " is accepted");
console.log("All " + files.length + " effect files: " + n + " colour literals checked, every one valid.");
