# ADR-026 — Jeopardy host / control split + dual-QR claim flow

**Status:** Accepted, 2026-04-27. Code merged to branch `jeopardy-host-control-split`. **Pending two manual steps before production is live** — see [Deployment dependencies](#deployment-dependencies).

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

**Known race condition (not fixed):** `claimControl` is read-then-write (`once('value')` → `update()`), not a `runTransaction`. If two devices scan the host QR within the same Firebase round-trip window (a few hundred ms), both can read `claimedBy: null`, both can pass the token check, and both write `claimedBy = <their uid>`. The second write wins and "owns" the room, but both clients believe they hold control. In a party setting the operator scans the QR alone seconds after the TV boots; the window doesn't realistically open. Documented as a known gap; switching to `runTransaction` is a small fix in `shared.js` if it ever surfaces in the wild.

### Anonymous UID persistence

Firebase JS SDK persists anonymous UIDs in IndexedDB across page reloads. Reloading `control.html` re-mints the same UID and the existing claim is honored. Clearing site data or going incognito gets a new UID — at which point the host needs to reset (see below).

### TV reconnect & PAUSED-status restore

The TV's `setupHostDisconnect` registers an `onDisconnect().set(meta/status: PAUSED)` handler — players see "Host disconnected" overlay if the TV browser closes. On TV reload, `host.js init()` reads the current status; if it's PAUSED, the TV restores the appropriate status using a heuristic over `currentClue` and `finalJeopardy` presence:

- `finalJeopardy.state` exists → restore to `FINAL`
- otherwise `currentClue` exists → restore to `PLAYING`
- otherwise → `LOBBY`

`ENDED` is intentionally not restored — the game already finished, so falling through to LOBBY (which `play.html` interprets as "ready for next game") is appropriate. This was the cleanest heuristic without adding a separate `pre-pause-status` Firebase field.

### What if the host phone disconnects mid-game? (known gap)

`control.html` does **not** register an `onDisconnect` handler. If the host phone goes offline (lost wifi, browser closed, battery dead), `meta/status` stays at `PLAYING` and `claimedBy` keeps the dead phone's UID. Players on phones see no immediate signal; they're stuck waiting for the host to act.

Recovery requires the operator to reset host control via `host.html?reset=1&room=ABCD` on the TV, then claim from a fresh phone. This is acceptable for a party game (the operator notices their phone is dead and physically walks to the TV) but not graceful — there's no in-app prompt that says "host phone offline, scan reset URL on TV."

A clean future fix:
- `control.html` registers `meta/control/claimedBy/onDisconnect → null` (or to a `claimDroppedAt: serverTimestamp()` marker).
- `host.html` listens for that flag and, after some grace period (say 30s), automatically regenerates the token + shows a fresh QR. Players see a banner "Host disconnected, please wait."

Out of scope for ADR-026 — flagged as deferred work below.

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

### FJ auto-zero for ineligible players

Real-show rule: only positive-score contestants play Final Jeopardy. `renderFinalWagerRoster` enforces this by auto-writing both `wagers/$pid: 0` AND `answers/$pid: ''` for any player who can't wager — i.e. score ≤ 0 OR couch-without-an-input-yet. Two reasons we write both fields:

1. The chip flips straight to the "submitted" state visually, so the host doesn't get a stuck "pending" indicator.
2. `updateBeginJudgingButton` waits for every connected player to have an answer; without the auto-empty answer, a Bob-positive + Alice-negative game would hang forever after the FJ clue (Alice's `player.js` short-circuits before showing the answer form, so she has no UI path to submit one). This was a real bug found in browser testing — see verification.

The judging UI then shows "(no answer)" for those auto-empty players, host clicks Incorrect, score delta is `-0 = 0` (since wager is 0). Score stays put. Matches the real show's "you may put down your pencils" treatment for the contestants who couldn't wager.

### Pure helpers extracted to shared.js

Three functions moved from `host.js` (and duplicated in `player.js`) to `shared.js`:

- `J.isRoundComplete(boardState)` — was lines 921-930 of old host.js.
- `J.formatScore(n)` — was duplicated between host.js and player.js with slightly different rules. Unified to use `toLocaleString` everywhere.
- `J.getDDWagerLimits(score, round)` — pure version (takes score + round directly), replacing two impure module-scoped versions.

`player.js` adopted both `J.formatScore` and `J.getDDWagerLimits` in the review-fixups commit, deleting its local duplicates.

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

## Verification

Wave-by-wave end-to-end test on localhost via Chrome DevTools MCP, three isolated browser contexts (TV, host phone, two player phones). All passed:

| Wave | Verifies | Result |
|---|---|---|
| **A** | Two QRs render, host phone claim flow + UID separation, TV "Claimed" status, multi-player join shows in roster on both surfaces | ✓ |
| **B** | Cell pick → clue → Open Buzzing → buzz → Correct → score, picker reassigned, REVEALED publishes answer on TV. Most importantly: **`htmlContainsNitrogen: false` on TV during ANSWERING** — the answer doesn't leak | ✓ |
| **C** | Wrong answer → -$200, locked out, buzzing reopens, second player buzzes + correct → +$200, picker = winner | ✓ |
| **D** | Daily Double on phone picker, wager form on phone shows $5–max range, control sees wager + private answer, judge correct adds wager | ✓ |
| **F** | Round 1 complete → "Double Jeopardy is next" transition, Continue → currentRound = 2, picker = lowest scorer | ✓ |
| **G** | Final Jeopardy with mixed-eligibility roster (Bob $900, Alice -$200): Bob wagers + answers from phone, Alice auto-zeroes both wager + answer (after fix), Begin Judging enables, per-player judging UI shows name + answer + wager + private correct-answer | ✓ |
| **H** | Play Again clears scores → $0, status → lobby, board → all-unasked, returns to phase-lobby. No false-positive correct/incorrect audio cues during the score reset (the renderScoreboard guard fix from the review-fixups commit) | ✓ |
| **I** | `host.html?reset=1&room=…` shows confirmation banner, click Reset → token regenerated (`3df66d6b → 52111dd4`), claim cleared. Old control phone with stale token now sees "This QR is no longer valid" on reload | ✓ |

**Two real bugs found in browser, fixed in `dd1091f`:**

1. `audio.js` was eagerly probing for CC0 files via `new Audio(missing-url)`, which logs 404s to the Chrome console. Switched to fetch-HEAD probe — Chrome **also** logs fetch 404s to console. Final fix: explicit two-step opt-in via `KNOWN_FILES` array (currently empty); zero probes, zero console pollution. See ADR-027 for rationale.
2. Final Jeopardy was deadlocking when a phone player had ≤ $0. The auto-zero path wrote a 0 wager but no answer; `player.js` short-circuits before showing the answer form; `updateBeginJudgingButton` waited forever. Fixed by extending the auto-zero in `renderFinalWagerRoster` to also write an empty answer string.

Waves J (config toggles) and K (audio edges) verified by code review:

- `checkRoundComplete` and `onAllRoundsComplete` correctly branch on `config.enableDoubleJeopardy` / `config.enableFinalJeopardy`. With DJ off, round 1 complete jumps to FJ (or game-over if FJ is also off). With FJ off, all-rounds-done jumps to game-over.
- Buzz window setting parses from the `<select>` value and `(config && config.buzzWindowMs) || 5000` consumes it in `startBuzzTimer`. Logic is straightforward.
- Audio edges are guarded on `currentStatus === PLAYING || FINAL` in `renderScoreboard`, so the play-again score reset (LOBBY status) can't trigger correct/incorrect cues. Verified zero console activity during the Wave H reset.

The test artifact "control.js's local `boardState` is stale when bypassing cell clicks via direct Firebase writes" is **a test plumbing issue, not a code bug** — real users clicking cells through the UI keep `boardState` synced via `onCellClick`. Hardening control.js to also listen for board updates is YAGNI.

## Deployment dependencies

These are the manual steps required to take the merged branch live; the code alone is not sufficient.

| # | Step | Why |
|---|---|---|
| 1 | **Publish the Firebase rules diff above** via [Firebase console → Realtime Database → Rules](https://console.firebase.google.com/project/chases-house/database/chases-house-default-rtdb/rules) | The `kind` field allowlist is **load-bearing** — without it, `couch.js`'s `players/{synthId}/kind = 'couch'` write is silently rejected, so couch-player detection on `control.html` (DD wager UI, FJ couch flow) doesn't work in production. The `meta/control` rules are partially load-bearing (token regen on reset requires the TV's UID to write `meta/control/*`). |
| 2 | **Cloudflare cache purge** after first deploy | Per the team memory `reference_cloudflare_cache.md` — up to 4 hours stale otherwise. The previous Jeopardy deploy hit this exact issue and required an explicit purge from the CF caching dashboard. |
| 3 | (Optional, recommended) **Real-room hardware test** | All testing to date is localhost + multi-tab simulation. The 65" TV speakers + Xbox controllers + the actual phones the operator and players will use have not been exercised together. Audio synth volume, controller rumble feel, and TV speaker placement are best evaluated in situ. |

## Open follow-ups (not blocking; ordered roughly by impact)

### Functional gaps

1. **Host-phone-disconnect recovery** *(documented above under "What if the host phone disconnects mid-game")*. Today: operator must walk to the TV and type `?reset=1&room=…` URL. Future: control.html registers `claimedBy.onDisconnect → null`, host.html shows a "host disconnected, regenerating QR" banner and auto-resets after a grace period.

2. **`claimControl` write race** *(documented above under "Claim token model")*. Switch the read-then-write pair to `firebase.database().ref(...).transaction(...)` if simultaneous-claim ever surfaces. Low priority for party-game threat model.

3. **Per-player FJ judging mirror to TV.** Today the TV stays on the wager roster during the host's per-player judging UI. Cleaner: control.js writes `game/finalJeopardy/judging/{currentPid}` so the TV can reveal each player's answer + wager in sync with control's UI. Crosses with ADR-027 (the in-sync animation would be visual polish).

### Defense-in-depth

4. **Tighten Firebase rules on game-control paths** to enforce `auth.uid === claimedBy` for writes to `game/currentClue`, `game/buzzer/{isOpen,openedAt,lockedOut}`, `game/finalJeopardy/state`, `game/pickingPlayer`, `meta/status`, `board/$round/.../asked`. Currently those paths inherit the room's `auth != null` write rule. Adding the claim check is defense-in-depth — anyone in the room with the room code could in principle write game-flow state today, though there's no UI path that does so. Done carefully (so couch.js's TV-UID writes for buzz/player records aren't caught), this would close the threat-model gap. Watch out for: couch.js writes via TV's UID, not control's — so the rule for `game/buzzer/buzzedPlayers/{pid}` must allow `auth.uid === pid OR auth.uid === meta/hostId`.

5. **Multi-tab guard on control.html.** Two tabs of `control.html?room=…` open simultaneously by the same operator (browser back/forward, accidental new tab) both hold the same UID and both write game-flow state. Last write wins in Firebase but UI states diverge. Easy fix: control.html could write a `meta/control/claimedBy/sessionId` (random per-tab) and reject its own writes if `sessionId` doesn't match. Niche; not currently observed.

### Cross-cutting with ADR-027

6. **Cell-flip animation** — keyframes ship in ADR-027 but the JS plumbing is deferred. The board listener clobbers the in-flight `.flipping` class on re-render. Needs board-listener coordination. See ADR-027 for the proposed fix.

7. **First-cue audio gesture-unlock** — browsers block AudioContext until user interaction. The TV's first user gesture is typically "+ Add couch player." If the operator skips couch and goes straight to the host phone for game start, the TV's first audio cue (theme-sting on game start) will fail silently. ADR-027 documents this as a known gap; a future "click to enable sound" overlay on the TV pre-game would close it.

### Future-feature placeholders

8. **TTS clue narration** (ADR-025) plugs into the same `audio.js` module via a future `Audio.narrate(text)` method. The Open Buzzing edge in `host.js` would gate on the TTS audio-end event before allowing buzz-open. Out of scope here; ADR-025 is the planning doc.

9. **Builder.html DRY pass** — `builder.html` does its own validation of board JSON without using the new `J.formatScore` / `J.getDDWagerLimits` helpers because it doesn't render scores or wagers. No work needed today; flagged so future audits don't recommend a phantom refactor.

## Cross-references

- **ADR-011** (original Jeopardy) — referenced for the game model + Firebase schema.
- **ADR-016** (shared gamepad) — couch.js binding stays on the TV per its synth-ID design; the `kind: 'couch'` rule fix in this ADR is the long-overdue followup to a latent bug ADR-016 introduced.
- **ADR-017** (Firebase security) — rule pattern (manual deploy via console, ADR documents the diff). The `meta/control` subtree and the `kind` allowlist are additive, no other rules change.
- **ADR-025** (TTS, future) — documents how clue narration would integrate with `audio.js` once implemented.
- **ADR-027** (audio + visual polish) — companion ADR landing in the same PR, second commit.
