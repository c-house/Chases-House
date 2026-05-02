# ADR-017: Persistent global high-score leaderboard (Snake)

**Status**: Accepted
**Date**: 2026-04-24

## Context

Snake (ADR-008) and the other solo games each tracked a personal best in `localStorage` only. There was no way for the user to see how their score compared to anyone else's, and a cleared browser meant a wiped record. Firebase was already running for Jeopardy multiplayer (ADR-011) — same project, same anonymous auth — so a global high-score board could ride on existing infrastructure with no new service.

Two paths existed:

1. Inline a one-off submit/fetch path in `games/snake/game.js` and copy/paste the Firebase config from Jeopardy.
2. Extract Firebase init into a shared module first, then layer a leaderboard module on top — paying the refactor cost up front so the next game (Crossword has the right shape) can plug in by adding three script tags.

Option 1 trips the project's DRY rule on day one (`CLAUDE.md`: "If you write similar code twice, stop and refactor before continuing"). Option 2 has two concrete consumers for the Firebase extraction (Jeopardy already uses it, Snake adds a second), which is the precedent ADR-016 set for when extraction is justified vs. premature generality.

## Decision

Three new shared modules under `games/shared/`, all IIFE + `window.X`:

- **`firebase.js`** (`window.SharedFirebase`) — owns the public Firebase config, idempotent `initializeApp`, anonymous sign-in (cached promise), `ref(path)`, `serverTimestamp()`. Throws on access if the SDK isn't loaded — converts script-tag-order bugs from "silent break at game-over" to "loud console error."
- **`player-handle.js`** (`window.PlayerHandle`) — `get`/`set`/`ensure` for a site-wide display name in `localStorage`. Lazy modal prompt: only invoked when a score qualifies for submission, so first-time visitors aren't interrupted on the start screen. Modal is built with `document.createElement` and inline styles; no per-game CSS.
- **`leaderboard.js`** (`window.SharedLeaderboard`) — `submit({game, difficulty, score, name})` and `fetchTop({game, difficulty, limit})`. Submit performs a per-uid collapse: query `orderByChild('uid').equalTo(uid)`, keep the best existing entry, `update()` it if the new score is higher, push a new one if absent, `remove()` any stragglers. Fetch reads `orderByChild('score').limitToLast(N*4)`, dedupes by uid client-side as a safety net, sorts best-first, slices to N. Errors are swallowed and surfaced via `{rank: null, error: ...}` so a Firebase outage degrades to "Leaderboard unavailable" rather than crashing `endGame()`.

Refactored `games/jeopardy/shared.js` to delegate Firebase ops to `SharedFirebase`. The `initFirebase`, `signInAnonymously`, `ref`, and `serverTimestamp` function names are preserved (and still exported on `window.Jeopardy`) as thin pass-throughs, so all existing call sites and the public API are unchanged. Loaded `../shared/firebase.js` in `host.html`, `play.html`, `builder.html` (the index page has no scripts).

Wired Snake's `endGame()` (`games/snake/game.js`) with a locals-before-await pattern: `finalScore`, `priorBest`, and `finalDifficulty` are captured before any async work. After the synchronous game-over render, if `finalScore > priorBest`, an async helper prompts for a handle (lazy), submits, and updates the overlay with rank — but two `if (!gameOver) return` re-checks guard the post-await UI mutations so a Space-mid-prompt restart doesn't draw rank text over a fresh game. Added a "View Leaderboard" entry point on both the start and game-over overlays plus an Escape-closeable panel, with a self-row highlight for the current player handle.

### Database schema

```
/leaderboards/
  snake/
    easy/    { <pushId>: { name, score, ts, uid } }
    medium/  { ... }
    hard/    { ... }
    extreme/ { ... }
```

Raw points stored (descending fetch via `limitToLast`). Indexed `["score", "uid"]` per difficulty. Existing `rooms/...` subtree unchanged.

### Security rules (applied via Firebase console, not in repo)

```json
"leaderboards": {
  "$game": {
    "$diff": {
      ".indexOn": ["score", "uid"],
      ".read": true,
      "$entry": {
        ".write": "auth != null && ((!data.exists() && newData.child('uid').val() === auth.uid) || data.child('uid').val() === auth.uid || (data.exists() && !newData.exists() && data.child('uid').val() === auth.uid))",
        ".validate": "newData.hasChildren(['name','score','ts','uid'])",
        "name":  { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 20" },
        "score": { ".validate": "newData.isNumber()" },
        "ts":    { ".validate": "newData.val() === now" },
        "uid":   { ".validate": "newData.val() === auth.uid" }
      }
    }
  }
}
```

Anonymous users can create, modify, or delete only entries owned by their own UID. Public read.

## Trade-offs

- **Score tampering is possible.** A determined console user can call `SharedLeaderboard.submit` with arbitrary numbers. Security rules constrain length/types/uid ownership, not gameplay legitimacy. Acceptable for a personal site; a global solo leaderboard isn't worth a server-side validator.
- **Per-uid uniqueness is best-effort.** Firebase rules can't query sibling nodes, so concurrent retries from two tabs can briefly produce duplicate rows. The submit path collapses them on next write, and `fetchTop` dedupes by uid on display, so the user-visible board is always single-entry-per-uid.
- **Eager script loading.** Snake now loads three Firebase CDN scripts and three shared modules on every visit, even for users who never qualify for the leaderboard. Acceptable on a small static site; lazy-loading is possible but adds complexity that wasn't justified by the current scope.
- **Snake-only initial scope.** Crossword has a working `BEST_TIMES_KEY` and is the obvious next consumer; it'll motivate adding a `direction`/`format` indirection inside `leaderboard.js` at the time it lands, rather than designing it speculatively now.

## What we did not build

A dedicated `/games/leaderboard/` page that aggregates across games. In-game panels cover the request without an extra page to maintain; deferred until/unless a real need surfaces.

## Files changed

**Added**: `games/shared/firebase.js`, `games/shared/player-handle.js`, `games/shared/leaderboard.js`, `docs/adr/017-shared-leaderboard.md`.

**Modified**: `games/jeopardy/shared.js` (delegated Firebase ops); `games/jeopardy/{host,play,builder}.html` (new script tag); `games/snake/game.js` (endGame hook + leaderboard panel); `games/snake/index.html` (script tags + overlay + panel CSS).
