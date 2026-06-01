# Chase's House — App Chrome UI Kit

The dark "warm hearth" surface — the homepage at `chases.house`, the games hub, the file-decryption tool. Fraunces display + Bricolage body + the gold/ember accent ramp on near-black surfaces.

## Files

- `index.html` — interactive demo (homepage → game grid → in-game state)
- `Nav.jsx` — top nav with active link
- `Hero.jsx` — fluid h1 with WONK + warm-glow shimmer
- `RoomCard.jsx` — game card with hover lift and tag
- `Button.jsx` — primary, link, disabled
- `Field.jsx` — labelled input with focus border
- `Banner.jsx` — warn / error / success
- `Footer.jsx` — wordmark + copyright

## Notes

- All sizes use the fluid `clamp()` rhythm from `colors_and_type.css`.
- Hover state on cards: ember → gold border, lift 4px, gold-tinted shadow.
- No emoji as UI; unicode glyphs (`♞`, `🍳`, `♛`) at 1.75–1.8rem with 0.7–0.9 opacity stand in for icons in the production code.
