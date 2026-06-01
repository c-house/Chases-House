---
name: chases-house-design
description: Use this skill to generate well-branded interfaces and assets for Chase's House (chases.house), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping in the brand's two coexisting scopes — the dark "Cabin in the Woods" chrome (with the forest-cabin artwork as backdrop) and the rustic paper Cookbook.
user-invocable: true
---

# Chase's House Design Skill

Read `README.md` first — it covers the brand context, the two visual scopes, the cabin-in-the-woods metaphor that drives every color choice, content tone, visual foundations, and iconography. Then explore `colors_and_type.css` for tokens, `assets/` for the forest illustrations and real imagery, `preview/` for individual specimens, and `ui_kits/` for full component recreations.

## The two scopes — pick one before you start

- **Cabin in the Woods (dark, `:root`)** — the homepage, games hub, files tool. Deep pine + moss + fog backdrop, with the `forest-house-landscape.png` / `forest-house-portrait.png` artwork as the primary background. Paper-warm cream text. **Gold is the cabin's lit window** — the only warm light in the scene; use it sparingly (one CTA per view, the active nav, the brand mark). Fraunces display + Bricolage Grotesque body. Use for app chrome, "rooms," utilities.
- **Rustic Paper (light, `.rustic`)** — the Cookbook. Warm cream paper, ink-brown serif, hand-drawn energy, a Caveat script accent, IBM Plex Mono for measurements. This is "inside the cabin at the kitchen table." Use for anything book-like, recipe-like, or warmly editorial.

Don't mix scopes inside one frame. Pick the surface, commit, and use the matching tokens + components.

## How to work

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of `assets/` — including the forest illustrations when you need the dark scope's atmosphere — and create static HTML files for the user to view. The UI kits in `ui_kits/<scope>/` are the canonical component recreations — read those JSX files first to see how each component is composed before rebuilding.

If working on production code, you can copy assets and read the rules in `README.md` to become an expert in designing with this brand. The CSS variables in `colors_and_type.css` are lifted directly from production — match those names if you're contributing back.

## If invoked without guidance

Ask the user what they want to build (a new "room" of the house? a recipe page? a deck? a slide for an announcement?), ask which scope they want, ask a few clarifying questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Voice quick-reference

- Hello-my-friends warmth. Personal, matter-of-fact, a little wry.
- "Welcome in. Make yourself at home." / "recipes worth keeping" / "made with butter and patience"
- The dark scope is *outside the cabin at dusk*. The rustic scope is *inside, at the kitchen table*. The gold is the same window, seen from each side.
- No marketing-speak. No emoji-as-UI. Unicode glyphs (♞ ♡ ★) and small bespoke SVG icons stand in for icon systems.
- Mono is reserved for measurements (`3½ tbsp`, `425°F`) and code.
