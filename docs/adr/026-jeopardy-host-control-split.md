# ADR-026 — Jeopardy host / control split + dual-QR claim flow

**Status:** Accepted, 2026-04-27.

## Context

ADR-011 established Jeopardy with a single `host.html` file serving as both the TV big board and the host's control panel. In a real-room game (one TV, host's phone, players on phones or Xbox controllers), this conflation forces a bad choice:

- Run `host.html` on the TV → players see the host's private state during judging (the answer hint added in the previous turn leaks straight onto the 65" TV the room is watching).
- Run `host.html` on the host's phone → no big board, no shared display.

Real Jeopardy avoids this because the audience-facing board and the host's clue card are different physical objects. The host's clue card is private. That asymmetry is what makes judging meaningful and makes Final Jeopardy's hidden written answers possible.

## Decision

Split `games/jeopardy/host.html` into two surfaces:

- **`host.html`** — TV big-board view. Pure renderer of Firebase state. No write paths beyond room creation, the FJ canonical timer, and couch-controller binding (gamepads physically connect to the device running this script, so couch flow stays here).
- **`control.html`** *(new)* — Host phone control surface. Owns all game-flow writes: cell pick, Open Buzzing, Correct/Incorrect, Reveal, Daily Double couch wager, Final Jeopardy couch wager + answer, round transitions, Play Again. Sees official answers privately. Mobile-first portrait layout.

The TV anchors the room (creates it, holds the claim token). The host's phone scans the host control QR to claim ownership. Players still scan a separate player QR (multi-use) to join via `play.html?room=ABCD`.

### Dual-QR layout in TV lobby

Three columns:

```
┌─ JOIN AS PLAYER ─┐  ┌─ PLAYERS ──────┐  ┌─ HOST CONTROL ──┐
│  [room code]     │  │  player list   │  │  [smaller QR]   │
│  [BIG QR]        │  │  couch panel   │  │  Unclaimed →    │
│  play.html URL   │  │  + Add couch   │  │  Claimed (gray) │
└──────────────────┘  └────────────────┘  └─────────────────┘
```

The host control panel has a dashed gold border to mark "scan once." After successful claim it greys out and the QR clears — the room is locked to the holder until reset.

### Claim token model

On TV `host.html` load, `J.createRoom` generates an 8-hex-char token via `crypto.getRandomValues(new Uint8Array(4))`. The token is written to `meta/control/claimToken` and embedded in the host control QR as `control.html?room=ABCD&token=<8hex>`.

`control.html` flow on scan:
1. `signInAnonymously()` → `myUid`
2. Read `meta/control` snapshot
3. If `claimedBy === myUid`: re-entrant claim (page reload), proceed.
4. If `claimedBy !== null` and `!== myUid`: show "claimed by another device" error.
5. If `claimedBy === null` and provided token matches `claimToken`: write `claimedBy = myUid`, `claimedAt = serverTimestamp()`. Proceed.
6. If token mismatch: show "QR no longer valid" error.

The token is **not** validated by Firebase rules — rules only enforce "who can write," not "what token." The token's job is to prevent enumeration attacks on the `control.html?room=ABCD` URL (since the room code is short). Combined: 4-letter room code × 16⁸ token ≈ 1.4 × 10¹⁵ combinations — effectively unguessable in a party-game threat model.

### Anonymous UID persistence

Firebase JS SDK persists anonymous UIDs in IndexedDB across page reloads. Reloading `control.html` re-mints the same UID and the existing claim is honored. Clearing site data or going incognito gets a new UID — at which point the host needs to reset (see below).

### Reset flow

If the host phone dies (cleared cookies, lost device, switched to a different phone), the operator types `https://chases.house/games/jeopardy/host.html?reset=1&room=ABCD` directly into the TV's URL bar. This is **deliberately not a button** in the lobby — exposing one would invite trolls in a party setting (a guest could mash it during a game).

Reset flow:
1. URL contains `?reset=1&room=...` → TV shows a confirmation banner instead of the lobby.
2. Operator clicks Reset → `J.resetControl(roomCode)` writes a new `claimToken` and clears `claimedBy` to null.
3. Page reloads to `?room=...` (no reset param). The new claim token is rendered into a fresh QR. Old QR is now invalid.

Firebase rules require the writer of `meta/control` to be either the TV's UID (`meta/hostId`) or the current `claimedBy`. The TV always retains its UID across reloads, so the reset path works.

### Pre-claim TV state

Per design intent (you don't want trolls or spectators to know the layout before the game starts), the TV pre-game state is intentionally minimal:

- Pre-claim: QRs + room code + player list + couch panel. No board, no rules, no game preview.
- Post-claim, pre-start: same as above, plus a "Host has claimed control" status pill. The host configures rules + selects a board on their phone.
- Game start (control writes `meta/status = PLAYING`): TV transitions to board phase. Categories + values become visible for the first time.

### Where each surface listens / writes

| Path | TV (host.html) | Phone (control.html) | Player phone (play.html) |
|---|---|---|---|
| `meta/control/{claimToken,claimedBy,claimedAt}` | Listen + reset (TV's UID) | Listen + claim | — |
| `meta/status` | Listen + onDisconnect → PAUSED | Write (LOBBY/PLAYING/FINAL/ENDED) | Listen |
| `meta/config` | Listen | Write at Start Game | Listen |
| `players/*` | Listen + write own (couch records) | Listen + write score on judge | Listen + write own |
| `game/currentRound` | Listen | Write on round transition | Listen |
| `game/currentClue` | Listen | Write on cell pick | Listen |
| `game/buzzer/{isOpen,openedAt,lockedOut}` | Listen | Write | Listen |
| `game/buzzer/buzzedPlayers/$pid` | Write (couch buzz via couch.js) | Listen | Write own |
| `game/dailyDouble` | Listen | Write (couch picker wager) | Write (phone picker wager) |
| `game/finalJeopardy/state` | Listen | Write | Listen |
| `game/finalJeopardy/wagers/$pid` | Listen | Write (couch wagers from cards) | Write own |
| `game/finalJeopardy/answers/$pid` | Listen | Write (couch answers from cards) | Write own |
| `game/finalJeopardy/judged/$pid` | Listen | Write | Listen |
| `game/pickingPlayer` | Listen | Write | Listen |
| `board/round{1,2}/categories/.../asked` | Listen | Write on cell pick | — |
| `board/round{1,2}/categories/.../dailyDouble` | — | Write at game start (random placement) | — |

Couch player binding (controller → synthetic player record) stays on the TV because the Gamepad API only sees gamepads connected to the device running the script. The couch synth-ID prefix continues to use the TV's UID per ADR-016.

### Couch player flow with this split

- **Couch DD wager:** picker speaks the wager out loud (matches real show — DD wagers aren't secret). Host types it on `control.html`'s DD overlay, which writes to `game/dailyDouble` along the same path a phone player would.
- **Couch FJ wager:** wager must remain secret until reveal, so couch players write on an index card. After all phone wagers come in, host types each couch player's wager on `control.html`'s Final Jeopardy wager roster (inline input per couch player).
- **Couch FJ answer:** same — written on card, host types in.

This means a one-time accessory: a small stack of index cards + pens for couch players. ~$3 of paper goods preserves real-show simultaneity without adding hardware.

### Pure helpers extracted to shared.js

Three functions moved from `host.js` (and duplicated in `player.js`) to `shared.js`:

- `J.isRoundComplete(boardState)` — was lines 921-930 of old host.js.
- `J.formatScore(n)` — was duplicated between host.js and player.js with slightly different rules. Unified to use `toLocaleString` everywhere.
- `J.getDDWagerLimits(score, round)` — pure version (takes score + round directly), replacing two impure module-scoped versions.

`player.js` should adopt these in a follow-up; not load-bearing for ADR-026.

## Firebase rules diff (manual deploy via console)

Per ADR-017's existing pattern, rules live in the Firebase console, not in the repo. The published rule set must be updated when this lands. Diff against current rules:

```diff
 "rooms": {
   "$roomCode": {
     ".read": "auth != null",
     ".write": "auth != null",
     ".validate": "$roomCode.matches(/^[A-Z]{4}$/)",
+
+    "meta": {
+      "control": {
+        "claimToken": {
+          ".write": "auth.uid === root.child('rooms').child($roomCode).child('meta/hostId').val()"
+        },
+        "claimedBy": {
+          ".write": "auth.uid === root.child('rooms').child($roomCode).child('meta/hostId').val() || (data.val() === null && newData.val() === auth.uid)"
+        },
+        "claimedAt": {
+          ".write": "auth.uid === root.child('rooms').child($roomCode).child('meta/hostId').val() || data.parent().child('claimedBy').val() === auth.uid"
+        }
+      }
+    },

     "players": {
       "$playerId": {
         "name":      { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length < 40" },
         "score":     { ".validate": "newData.isNumber()" },
         "connected": { ".validate": "newData.isBoolean()" },
         "joinedAt":  { ".validate": "newData.isNumber()" },
+        "kind":      { ".validate": "newData.isString() && newData.val().length < 16" },
         "_probe":    { ".validate": "newData.isBoolean()" },
         "$other":    { ".validate": false }
       }
     },
```

The `kind` field allowlist fixes an existing latent bug: ADR-016 introduced a `kind: 'couch'` write in `couch.js completeBind` (line 161-ish), but the existing `$other: false` rule blocked it. The write was failing silently. With `kind` now allowed, couch detection on `control.html` (via `players[pid].kind === 'couch'`) starts working as designed.

**Note:** I deliberately did NOT add `auth.uid === claimedBy` write restrictions to `game/currentClue`, `game/buzzer/isOpen`, etc. in this iteration. Tightening those requires the host phone to first claim, then start the game — which is the intended flow, and works without rule enforcement. Adding the rules is defense-in-depth and a good follow-up, but doing it carelessly could lock out legitimate writes during the room's lifecycle (e.g. couch.js writing buzzes via the TV UID). Conservative rule of "permissive parent" from ADR-017 still applies. Tighten in a future ADR after a few sessions confirm nothing breaks.

## Files changed

| File | Change |
|---|---|
| `games/jeopardy/shared.js` | + `isRoundComplete`, `formatScore`, `getDDWagerLimits`, `generateClaimToken`, `claimControl`, `resetControl` exposed via `window.Jeopardy`. `createRoom` now stamps `meta/control` subtree and accepts null boardData. |
| `games/jeopardy/host.html` | Stripped: removed config panel, start button, board cell click, all judging UI, all wager forms, all action buttons. Added: second QR `#control-qr`, claim status pill, `?reset=1` confirmation banner. |
| `games/jeopardy/host.js` | Pure renderer. All write paths removed except createRoom + resetControl. Listens to Firebase, updates DOM, runs FJ 30s timer locally, animates buzz timer from `openedAt`. Couch.js wiring preserved. |
| `games/jeopardy/control.html` | New file — phone-first portrait layout for the host's control surface. Phases: claim, lobby, board, clue, daily-double, round-transition, final, game-over. |
| `games/jeopardy/control.js` | New file — extracted game-flow logic from old host.js. Owns cell pick, Open Buzzing, judging, DD/FJ couch wager+answer entry, round transitions, Play Again. |
| `docs/adr/026-jeopardy-host-control-split.md` | This document. |

## What didn't change

- `games/jeopardy/play.html` and `player.js`: no changes; players are unaffected by the split.
- `games/jeopardy/couch.js`: stays on the TV. The `kind: 'couch'` write that was silently failing now lands (rule fix above).
- `games/jeopardy/builder.html`: local-only board authoring tool, no Firebase, untouched.
- Firebase project structure: same `chases-house` project, same anonymous-only auth, same RTDB instance. Only the rules block changes.

## Verification (after manual rules deploy)

End-to-end smoke test:

1. Open `host.html` on TV. Two QRs render. Claim status: "Unclaimed". Player list: empty.
2. Scan host control QR on phone → `control.html` loads, claim succeeds, lobby appears with config panel.
3. TV reflects: "Claimed" + control QR clears.
4. Scan player QR on a second device → `play.html`, join with name. Player list updates on both TV and control.
5. Plug in a controller on the TV's machine, click "+ Add couch player" on the TV, name it, press A → couch player appears in list with "couch" tag on control phone.
6. On control phone: select board, toggle rules, click Start Game. TV transitions to board phase.
7. Tap a cell on control phone → TV shows the clue, control phone shows clue + answer hint privately.
8. Tap Open Buzzing → both surfaces enter buzzing state, timers animate. Phone player buzzes → TV highlights their score chip, control shows their name.
9. Tap Correct → score updates on TV with no answer leakage during judging; state moves to REVEALED, TV shows the answer publicly.
10. Hit a Daily Double on a couch picker → control's wager input appears, host types speaker's wager. Game continues.
11. Complete Round 1, transition to Double Jeopardy, then Final Jeopardy. Phone players wager + answer. Couch player FJ wager and answer entered by host on control.
12. Game ends, standings render on TV. Play Again resets.
13. Refresh control phone → still claimed (UID persists via IndexedDB).
14. Type `host.html?reset=1&room=ABCD` on TV → confirmation banner → click Reset → new QR appears. Old control phone session sees "claimed-by-other" error if it tries to act.

## Open follow-ups (not blocking)

- Tighten Firebase rules to enforce `auth.uid === claimedBy` on game-control paths after a few sessions confirm couch + control writes don't get caught in the cross-fire. Defense-in-depth, not currently load-bearing.
- Mirror the currently-judged FJ player to `game/finalJeopardy/judging/$pid` so the TV can reveal each player's answer in sync with control's per-player judging UI. Today the TV stays on the wager roster during judging.
- ADR-027 (audio + visual polish) lands in the same PR as a separate commit.
