# Cookbook — Rustic UI Kit

The warm-paper, hand-drawn-feeling cookbook surface. Cormorant Garamond display + Lora body + Caveat script accent + IBM Plex Mono for measurements. Terracotta primary, olive success, burgundy for "saved/favorite". Recipe cards tilt by ±0.4°.

## Files

- `index.html` — interactive demo (browse → recipe → cook mode)
- `Page.jsx` — paper background wrapper with vignette and grain
- `Header.jsx` — Cookbook masthead (smallcaps + display title + script tagline)
- `RecipeCard.jsx` — image card with title, blurb, time/serves/rating, heart toggle
- `Chip.jsx` — filter pill
- `RecipeView.jsx` — recipe detail (Ingredients column + Method numbered list)
- `ChefsNote.jsx` — call-out block on paper-deep
- `Buttons.jsx` — terracotta + ink + ghost buttons (letterpress 2px radius)

## Notes

- All paper backgrounds use a soft radial vignette (terracotta + olive at 5–6% alpha) on `#f3ead8`.
- Recipe cards tilt slightly to feel like actual photo prints on paper.
- Numbered method steps use big italic Cormorant numerals, not gold dots.
- Mono font is reserved for measurements (`3½ tbsp`, `425°F`).
