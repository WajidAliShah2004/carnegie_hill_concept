# Where every colour comes from

No colour in any of the four concepts was chosen by eye. Each palette is built from
anchor colours measured directly out of the shop's own photographs in `/assets`, then
extended into a light and dark ramp in OKLCH so the hue and the character of the
original colour survive at every step.

## The anchors

Each value below is the median pixel of a named region of a named photo.

| Anchor | Hex | Read from |
|---|---|---|
| Mat board | `#DADDDB` | `work-17.jpg`, the mat around the engraving |
| Frame black | `#13161F` | `work-01.jpg`, the frame |
| Gilt | `#A18547` | `work-24.jpg`, the gilt frame |
| Window mullion | `#2D1E13` | `storefront.jpg`, the black window frames |
| Moulding face | `#907E6D` | `samples.jpg`, the face of a sample |
| Awning | `#8A4856` | `storefront.jpg`, the awning, clear of the lettering |
| Facade | `#B38F21` | `storefront.jpg`, the yellow shutter |

Three of these were a surprise and all three changed the designs:

- The shop's mat board is a **cool grey green**, not the warm cream that framing is
  usually drawn with. Concept 1 is built on that.
- The frame black is a **blue black**, not a neutral or a warm one. Concept 2 uses it
  as its only ground.
- The gilt is **olive and dusty**, not bright yellow. The earlier draft of concept 3
  used `#C9A035`, which was picked by eye and is much brighter than any gold in the
  shop.

## The ramps

Anchors are converted to OKLCH, held at their measured hue, and stepped in lightness.
Chroma is reduced towards both ends of each ramp so no step leaves the sRGB gamut and
no step turns candy coloured. The script that does this is not part of the site; the
resulting values are written into each concept's `:root` block with a comment naming
the photo they came from.

## Contrast

Every pair of colours that carries text was checked before it shipped:

- body text against its background: 4.5:1 or better
- large display text and non text interface parts: 3:1 or better

Two pairs failed the first pass and were corrected rather than accepted. Heritage
craft's secondary text was darkened to `#675849`, and Mat board's focus ring was moved
off the gilt, which measured 2.96:1 against the page, onto the ink at 14.8:1.

Hairlines that only separate content, and carry no meaning on their own, sit below 3:1
on purpose. Nothing is indicated by colour alone.
