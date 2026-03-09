# ADR-001: Chase's House Homepage Redesign

**Status**: Accepted
**Date**: 2026-03-09

## Context

The current homepage is a minimal "Coming soon" placeholder with system fonts and a plain dark background. The goal is to transform it into an ornate, visually distinctive personal landing page that leans into the "house" metaphor — warm, cozy, and inviting — with a navigation header linking to site sections.

## Design Direction: "Warm Hearth"

Walking into a warm, well-lit home on a cold evening. Rich wood tones, ambient golden light, textured surfaces.

### Typography (Google Fonts)

- **Display: Fraunces** (variable serif) — warm, quirky, handcrafted feel. Use `WONK: 1` and `SOFT: ~50` axes for distinctive character. For title, nav labels, and card headings.
- **Body: Bricolage Grotesque** (variable sans) — organic ink traps, personality without competing with Fraunces. For body text, tagline, labels.
- Font URL: `https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,100..900,0..100,0..1;1,9..144,100..900,0..100,0..1&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap`

### Color Palette (CSS variables)

| Variable | Value | Use |
|----------|-------|-----|
| `--bg-deep` | `#0d0b09` | Deepest background (warm near-black) |
| `--bg-main` | `#1a1612` | Main background (espresso) |
| `--bg-surface` | `#252018` | Raised surfaces, cards |
| `--bg-elevated` | `#302a1f` | Hover states |
| `--text-primary` | `#f0e6d3` | Body text (warm cream) |
| `--text-heading` | `#faf3e6` | Headings |
| `--text-muted` | `#9a8e7a` | "Coming soon" labels |
| `--text-faint` | `#5c5347` | Decorative, very dim |
| `--accent-gold` | `#c8943e` | Primary accent (amber gold) |
| `--accent-glow` | `#e8b04a` | Bright gold for hovers/glows |
| `--accent-ember` | `#a06828` | Darker gold, borders |
| `--terracotta` | `#b05a3a` | Warm red-orange, sparingly |
| `--sage` | `#6a7d5a` | Muted green accent |

### Background & Texture (3 layers)

1. **Base**: solid `--bg-deep`
2. **Ambient light** (`body::before`): Two soft radial gradients — amber upper-left, terracotta lower-right — at very low opacity (~0.04-0.06) simulating warm light pools
3. **Grain overlay** (`body::after`): Inline SVG `feTurbulence` filter at `opacity: 0.03` for subtle paper/wall texture

### Animation Plan (CSS-only, orchestrated page load)

Three `@keyframes`: `fadeSlideUp`, `fadeIn`, `warmGlow`

Stagger delays using CSS `--i` custom property (DRY):
1. Background glow fades in (0ms)
2. Title slides up (200ms) + warm glow loop starts (1000ms)
3. Tagline slides up (500ms)
4. Nav links stagger (700ms + N*80ms)
5. Games card slides up (1100ms)
6. Footer fades in (1400ms)

Includes `prefers-reduced-motion` media query.

## Page Structure

### Navigation Header
- **Home** — active (gold color, dot indicator, no link)
- **Games** — links to `/games/`, hover underline slides in from left
- **Music** — coming soon (muted, `::after` "soon" superscript label, `pointer-events: none`)
- **Blog** — coming soon
- **Links** — coming soon

### Hero Section
- Left-weighted layout (not centered) — editorial, asymmetric
- Title: "Chase's House" in Fraunces with warm glow animation
- Tagline below in Bricolage Grotesque

### Rooms Section
- Single card for Games — an inviting "doorway" with warm border, hover lift + glow
- No other cards yet (YAGNI)

### Footer
- Minimal, muted copyright

### Mobile Responsiveness
- Fluid typography via `clamp()`
- ~768px: layout shifts from left-weighted to centered
- ~480px: spacing tightens, nav wraps naturally
- All spacing uses `clamp()` / viewport-relative units

## Files to Modify/Create

1. **`index.html`** — Complete rewrite with inline `<style>`, semantic HTML, SVG filter, animations
2. **`games/index.html`** — New file. Same design language (colors, fonts, textures, nav) but Games is the active nav item. Placeholder content: "Games are on their way."

## Implementation Steps

1. Write `index.html` HTML structure (head, SVG filter, header/nav, hero, rooms, footer)
2. Add `<style>` block: CSS reset, `:root` variables, body base styles
3. Add typography styles (Fraunces for display, Bricolage for body, fluid `clamp()` sizing)
4. Add background layers (ambient gradients on `::before`, grain on `::after`)
5. Style layout: header, hero (left-weighted), rooms card, footer + responsive breakpoints
6. Style navigation: active state, hover underline, "coming soon" treatment
7. Style Games room card with border, hover effects
8. Add `@keyframes` and animation assignments with staggered delays
9. Add hover transitions (nav, card)
10. Create `games/` directory and `games/index.html` (matching design, Games active in nav)
11. Test via Chrome DevTools MCP: screenshots, console errors, animation check, nav verification

## Verification

1. Start local dev server on port 3003
2. Launch Chrome via MCP command (per CLAUDE.md)
3. Take screenshot — verify warm aesthetic, typography, layout
4. Take snapshot — verify semantic HTML structure
5. Check console for errors
6. Click Games nav link — verify navigation to /games/
7. Verify "coming soon" items are non-interactive
8. Resize viewport — verify responsive behavior
9. Check `prefers-reduced-motion` behavior
