# ADR-008: Snake

**Status**: Accepted
**Date**: 2026-03-09

## Context

Snake is a classic arcade game that diversifies the collection with real-time solo gameplay. No AI opponent — it tests different technical patterns: game loop, keyboard input, canvas rendering, and collision detection.

## Decision

Built a classic Snake game where the player controls a snake that grows by eating food. Game ends on collision with walls or self. Score equals food items eaten.

### Difficulty Levels

Difficulty scales via snake speed (game tick interval):

| Level | Tick Speed |
|-------|-----------|
| Easy | 200ms |
| Medium | 130ms |
| Hard | 80ms |
| Extreme | 50ms |

### Game Mechanics

Grid-based movement on a `<canvas>` element using `setInterval` (not `requestAnimationFrame` — intentional for discrete tick-based movement). Canvas dynamically sizes to the viewport and snaps to grid-aligned pixel dimensions for crisp rendering. Direction changes queue into `nextDirection` and apply at tick start, preventing same-tick reversals.

Self-collision uses a "safe tail" optimization — the tail segment is excluded from collision checks since it vacates before the head arrives on non-eating ticks.

### Key Design Decisions

- Snake body rendered with color gradient via `lerpColor` (ember tail → gold body), head in bright gold with directional eyes using vector math for perpendicular eye placement
- Food renders with shadow blur glow pass + radial gradient for a warm ember look
- Arrow keys, WASD for desktop; swipe gestures on mobile (30px threshold, below = tap to pause)
- Per-difficulty high scores stored in `localStorage` as `'snake-highscores'` object
- Three overlay states (start/pause/gameover) toggled via `hidden` HTML attribute
- Pause via spacebar or canvas tap
- No score counter shared between difficulties

## Files Changed

- `games/snake/index.html` — Game page with canvas element, overlays, inline CSS (258 lines)
- `games/snake/game.js` — Game loop, input, collision, canvas rendering (427 lines)
- `games/index.html` — Snake card added to gallery

## Verification

- Snake moves correctly in all four directions
- Collision detection works (walls and self)
- Food never spawns overlapping the snake body
- Each difficulty level feels appropriately fast
- Mobile swipe controls work; tap toggles pause
- High scores persist per-difficulty across reloads
