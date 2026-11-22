# Card gradient (iridescent glass cards)

A widget card on `panel: "colour"` can be drawn as coloured glass: two or three colour stops, an angle (or a radial), a thin
light rim and a soft sheen. It is one static CSS background plus one box-shadow on the panel layer the card already has:
no `backdrop-filter`, no filter, no animation, no extra element. That is why it is cheap on a Fire TV Stick (the stick's cost is
layer count; this adds none) and why it is not the frosted `panel: "glass"` blur.

## Keys (a widget's `style`)

| key | values | what |
|---|---|---|
| `colour` | colour | first stop (already existed) |
| `colour2` | colour | second stop. Without it (and without `look.card_colour2`) the card is drawn as before |
| `colour3` | colour | optional third stop (needs `colour2`) |
| `angle` | 0..360 | linear angle in degrees (default 160, like the background) |
| `radial` | true / false | radial instead of linear (same shape as the background's radial) |
| `opacity` | 0.2..1 | already existed; with a gradient it is baked into the stops so the rim and sheen stay bright |
| `rim` | true / false | thin light edge: white hairline, light at the top left, tinted by the last stop at the bottom right |
| `sheen` | true / false | soft white sheen at the top left |
| `gradient` | `off` | opts one card out of the design's gradient (a flat `colour`) |

A colour is `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(r, g, b)` or `rgba(r, g, b, a)` (0..255, alpha 0..1). The new keys use a
stricter check than `colour`: a malformed value such as `rgba(1,2,3,)` or a quoted alpha is dropped, never passed to the page.

## Once for the whole design (`look`)

`look.card_colour`, `card_colour2`, `card_colour3`, `card_angle`, `card_radial`, `card_opacity` (0.2..1), `card_rim`, `card_sheen`.
Every `panel: "colour"` card takes them; a card's own `style` wins; a card with `style.colour2` does not borrow the look's third stop.

## Words stay readable

The ink is `auto`: white or dark, whichever reads better on EVERY point of the gradient (25 samples, so a lilac-into-pink dip is
caught, and the sheen counted where it hurts a white ink). A stop that still falls short of 4.55:1 is pulled toward black or white
until it passes. This is guaranteed against the card's own colours. A translucent card over a photo also depends on the photo:
check it against the picture (the designs repo's `card-gradient/tools/card_glass.py` does, per card).

## Older couch-tv

A TV or Studio without this code keeps `panel`, `colour`, `gradient: "soft"` and `opacity` and drops the rest (design.js
`sanWStyle` / look sanitiser read only their own key lists): the card is the first colour with the soft shade, still translucent, words
readable. Always give each card its own `colour` (and `gradient: "soft"`, `opacity`) so that fallback is a good card; put the
extra stops, angle, rim and sheen on top.

Tests: `tests/test_card_gradient.js` (sanitise, ranges, bad colours, stock fallback, ink on every blend, every colour a valid
rgba/hex, static) and `tests/test_card_gradient_browser.mjs` (real Chromium: no page errors, computed styles, no animation or blur,
words >= 4.5:1 on the drawn pixels).
