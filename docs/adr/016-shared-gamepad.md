# ADR-016: Shared gamepad utility & Jeopardy controller buzz

**Status**: Accepted
**Date**: 2026-04-24

## Context

Pac-Man (ADR-014) was the first game in the collection to use the Gamepad API. Its `games/pacman/input.js` mixed three concerns: keyboard scheme detection (WASD / Arrows / IJKL / Numpad), per-player slot binding, and raw browser Gamepad polling. As a single consumer this was fine, but Jeopardy needed a controller buzz — both for players who happen to play on a device with a controller plugged in (laptop with an Xbox pad), and for the more compelling "couch" use case where 2–4 people gather around the host's screen and each takes a controller, no phones required.

Two paths existed: copy-paste Pac-Man's gamepad logic into Jeopardy, or extract a shared utility. Copy-paste would create the exact thing CLAUDE.md's DRY principle calls out — "If you write similar code twice, stop and refactor before continuing." A shared utility also has to land on day one with a real refactor of Pac-Man, otherwise it's premature generality and YAGNI bait.

## Decision

Extracted the gamepad-only portion of Pac-Man's input layer into `games/shared/gamepad.js` (`window.SharedGamepad`). It owns: connect/disconnect listeners, `navigator.getGamepads()` polling, rising-edge button detection, D-pad + left-stick direction synthesis, and rumble. It owns nothing else — no slots, no schemes, no players, no Firebase. Each game builds its own binding/identity model on top.

Refactored Pac-Man's `input.js` to delegate to `SharedGamepad` while keeping its public `window.PacmanInput` API and behavior identical. Added a small bonus: rumble pulses on ghost-eaten and player-death events.

Added two Jeopardy entry points:

1. **Per-device buzz** (`play.html` + `player.js`): if a controller is plugged into the player's device, button A buzzes alongside the existing tap-the-button UX. Short rumble on successful buzz; longer rumble on lockout transition.
2. **Couch / hot-seat mode** (`host.html` + `couch.js` + `host.js`): the host clicks "Add couch player," names them, then presses A on an unassigned controller. The host's page writes that player to Firebase using a synthetic `playerId`. During buzzing, the host page polls each assigned controller and writes server-timestamped buzzes on their behalf. The host's existing scoreboard, judging, lockout, and scoring code (`renderPlayerList`, `renderScoreboard`, `processBuzzes`) all key off arbitrary `playerId` values and pick up synthetic players unmodified — zero rendering changes needed.

### Public API of `games/shared/gamepad.js`

```js
window.SharedGamepad = {
  init({ onConnect, onDisconnect }), teardown(),
  listGamepads(),                 // [{ index, id }]
  consumeButtonPress(index, btn), // rising edge per (index, btn)
  getDirection(index),            // d-pad + left stick → 'up'|'down'|'left'|'right'|null
  rumble(index, opts),            // dual-rumble; safe no-op when unsupported
  BUTTONS, AXIS_DEADZONE
}
```

`BUTTONS` exposes only the five button indices the codebase uses today: `A`, `DPAD_UP`, `DPAD_DOWN`, `DPAD_LEFT`, `DPAD_RIGHT`. The other 11 standard-mapping indices land when a consumer needs them.

> **Update (Underhearth, ADR-017)**: extended `BUTTONS` to the full Xbox table (`B`, `X`, `Y`, `LB`, `RB`, `LT`, `RT`, `BACK`, `START`, `LS`, `RS`). Underhearth needed all of them for its inventory + targeting + stairs + menu mappings (ADR-017 §3 *Gamepad*). The extension is purely additive; existing entries unchanged. Pac-Man's hardcoded `9` literal in [games/pacman/input.js](../../games/pacman/input.js) was simultaneously cleaned up to use `SG.BUTTONS.START`.

### Synthetic player identity for hot-seat

Each couch player gets a synthetic `playerId` of the form `${authUid}_pad_${timestamp}${random}`. The ID is **not** keyed on gamepad index, because indices change across reconnects (unplug controller 0, plug it back in, browser may report it as index 2). On disconnect the assignment moves to an "orphans" map and the Firebase player record is marked `connected: false`. On reconnect, if exactly one orphan's stored `gamepad.id` matches the new pad, the assignment auto-relinks. If two identical controllers cause an `id` collision, the host clicks a manual "Re-claim" button — preferable to silently mis-assigning controllers between players.

### Firebase rules: runtime probe instead of build-time check

Hot-seat depends on Firebase Realtime DB rules permitting writes to `rooms/{code}/players/{anyPid}` and `…/buzzer/buzzedPlayers/{anyPid}` from any authenticated user, regardless of whether `pid === auth.uid`. Rules live in the Firebase console, not in the repo. Rather than gating the feature on a manual pre-flight check that a maintainer will skip, `JeopardyCouch` calls `Jeopardy.probeWritePermission(roomCode, synthId)` after the first couch player is added. If the probe fails (`permission_denied`), a toast surfaces "Controller mode unavailable: Firebase rules need updating" — at the moment a user tries to use the feature, when they can still fix it.

### Toast UX is per-game

The shared module fires raw `onConnect(idx, id)` / `onDisconnect` callbacks. Each consumer formats and renders its own toast (Pac-Man's toast existed already; Jeopardy's `play.html` and `host.html` each gained a small `#gp-toast` div with inline CSS). Extracting a shared toast component would have been over-reach — toast styling is per-page and likely to drift.

## What did not change

- `Jeopardy.joinRoom`'s lobby guard still applies for phone players. Hot-seat uses the new `joinRoomDirect` helper instead, which writes the player record without the "game already started" check so couch players can be added mid-game. Both paths use the same player-record shape (`{ name, score, connected, joinedAt }`), so the schema lives in one place.
- `Jeopardy.writeBuzz(roomCode, playerId)` is the single buzz writer. Both `player.js` (per-device) and `couch.js` (hot-seat) call it; the path string and `serverTimestamp` sentinel are not duplicated.
- Server-timestamp ordering in `host.js processBuzzes` was not touched. Phone buzzes and couch buzzes race fairly through the same Firebase node.

## Out of scope

- D-pad wager entry and Final-Jeopardy text answers via controller. Keyboard remains the input for those flows. Text via D-pad is a poor UX; revisit if a real consumer surfaces.
- Migrating Snake / Checkers / Sudoku / Crossword / Chess to use `SharedGamepad`. None of them have controller support today, and YAGNI says don't build for hypothetical consumers.
- Custom button remapping UI.
- Internal RAF inside `SharedGamepad` with a subscription/unsubscription model. Three small per-page poll loops (Pac-Man, Jeopardy player, Jeopardy host) are simpler at this scale; revisit if a fourth consumer shows up.
- Auto-recovery when two identical controllers cause an `id` collision on reconnect — the host uses the manual "Re-claim" button instead.

## Files

```
games/shared/
└── gamepad.js                        new — SharedGamepad

games/pacman/
├── input.js                          refactored — gamepad work delegates to SharedGamepad
├── game.js                           added rumble on ghost-eaten / death
└── index.html                        + script tag for ../shared/gamepad.js

games/jeopardy/
├── shared.js                         + writeBuzz, joinRoomDirect, probeWritePermission
├── couch.js                          new — JeopardyCouch hot-seat coordinator
├── player.js                         + gamepad poll loop, toast, rumble; uses writeBuzz
├── play.html                         + script tag, toast, inline CSS
├── host.js                           + couch panel render, "Add couch player" wiring
└── host.html                         + couch panel markup, toast, inline CSS

docs/adr/
└── 016-shared-gamepad.md             this file
```

## Verification

Pac-Man parity confirmed in browser via Chrome DevTools MCP — no console errors after the refactor; SharedGamepad exposes the trimmed BUTTONS set; bind+start+direction polling all work. Jeopardy host and player pages load without errors from the new code (the existing Firebase placeholder API key still throws at auth-time, unrelated to this change). The host lobby renders a "Couch Players" panel with the empty state and an "Add couch player" button next to the existing player list. Toast plumbing fires correctly on simulated `gamepadconnected` events on both pages. Full multi-controller end-to-end testing requires a real Firebase project and physical controllers, both of which are out of automated reach.
