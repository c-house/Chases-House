# ADR-002: Custom SVG Favicon

**Status**: Accepted
**Date**: 2026-03-09

## Context

The site had no favicon, so browsers displayed a generic blank/globe icon in tabs and bookmarks. A custom favicon reinforces the "Chase's House" brand and warm hearth aesthetic.

## Decision

Use an SVG favicon served as a single file (`/favicon.svg`), referenced via `<link rel="icon" type="image/svg+xml">` in all HTML pages.

### Why SVG

- Scales perfectly at any size (16x16 through high-DPI)
- Supports gradients and fine detail without multiple raster files
- No build step or image tooling required
- Tiny file size (~500 bytes)
- Supported by all modern browsers (Chrome, Firefox, Safari 15.4+, Edge)

### Design

- **House silhouette** in dark fill (`#1e1e21`) with ember-colored stroke (`#a06828`)
- **Glowing window** using a radial gradient (`#e8b04a` → `#c8943e`) — the warm hearth
- **Chimney with smoke wisps** in semi-transparent ember for subtle detail
- Bold, simple shapes optimized for readability at 16x16

### Alternatives Considered

- **ICO/PNG multi-size bundle**: More complexity, requires image tooling, no real benefit for the target audience (modern browsers)
- **Emoji favicon via `<link>` data URI**: Quick but not on-brand
- **Text-based favicon ("C")**: Too generic, doesn't convey the house concept

## Files Changed

- `favicon.svg` — New file (the icon itself)
- `index.html` — Added `<link rel="icon">` in `<head>`
- `games/index.html` — Added `<link rel="icon">` in `<head>`
