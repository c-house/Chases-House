# ADR-011: Jeopardy

**Status**: Accepted
**Date**: 2026-03-09

## Context

Jeopardy is the first multiplayer game on the site. All six existing games are single-player (vs AI or solo). A multiplayer trivia game introduces four new challenges: real-time communication across browsers, two distinct UIs (host screen vs player phones), user-created content (custom question boards), and a programmatic game host managing flow and state.

Research into competitors informed the architecture:
- **Jackbox Games** — room codes, phone controllers, shared host screen. The gold standard for party game UX.
- **Kahoot** — PIN-based lobbies, real-time buzzing via WebSockets, host-controlled pacing.
- **JeopardyLabs** — shared-screen Jeopardy with manual scoring. Simple but no remote play.

The site is static (GitHub Pages, no backend), so multiplayer requires an external real-time service.

## Decision

Built a Jackbox-style multiplayer Jeopardy game. A host screen displays the full board on a TV or projector. Players join on their phones by entering a 4-letter room code. Firebase Realtime Database handles state synchronization and buzz-in ordering. Rules are configurable with the full Jeopardy format enabled by default (Single Jeopardy → Double Jeopardy → Final Jeopardy).

### Multiplayer Architecture

Firebase Realtime DB via the v10 compat SDK loaded through CDN `<script>` tags (no build step). Anonymous authentication — room codes provide access control. The Firebase config is inlined in JS (standard for client-side Firebase; the API key is a public identifier, not a secret).

Buzz-in ordering uses `firebase.database.ServerValue.TIMESTAMP`. When the host opens buzzing, each player writes their buzz with a server timestamp. The server applies the timestamp on receipt, making ordering fair regardless of client clock differences. Players with faster connections have a slight advantage, which is inherent to any network buzzer and matches Jackbox's behavior.

Connection management uses `onDisconnect()` handlers:
- Host disconnect sets room status to `paused`; players see a "Host disconnected" overlay
- Player disconnect sets `connected: false`; game continues without them
- Reconnection restores state from Firebase (source of truth)

### Game Model (Jackbox-Style)

**Host screen** (TV/projector, landscape):
- Full Jeopardy board with categories and dollar values
- Clue display (full-screen text on blue background)
- Scoreboard with all player scores
- Judging controls (Correct / Incorrect buttons)
- Room code + QR code during lobby phase

**Player phones** (mobile-first, portrait):
- Buzzer button (large, 120px+ tap target, terracotta with pulse animation)
- Current score display
- Clue text (readable copy in case host screen is hard to see)
- Wager input (Daily Doubles and Final Jeopardy)
- Answer text input (Final Jeopardy only)

**Interaction model**:
- Host clicks clue cells on the board to select questions
- The picking player (last correct answerer) announces their choice verbally
- Regular clues: players buzz in, answer verbally, host judges Correct/Incorrect
- Final Jeopardy: players type answers on their phones, host reveals and judges each

### Game Flow State Machine

```
LOBBY → BOARD_REVEAL → PICKING → CLUE_DISPLAY → BUZZING → ANSWERING → JUDGING → PICKING...
ROUND_END → (Double Jeopardy) → BOARD_REVEAL → PICKING...
ROUND_END → FINAL_CATEGORY → FINAL_WAGER → FINAL_CLUE → FINAL_ANSWER → FINAL_JUDGING → GAME_OVER
```

Two levels of state tracked in Firebase:
- `meta/status`: `lobby`, `playing`, `final`, `ended`
- `game/currentClue/state`: `picking`, `reading`, `buzzing`, `answering`, `judging`, `revealed`

The host is the only writer of game state transitions. Players write only to: their own player node, buzz timestamps, wagers, and Final Jeopardy answers.

### Configurable Rules

All rules enabled by default. Host can toggle during setup:

| Rule | Default | Description |
|------|---------|-------------|
| Single Jeopardy | On | 6 categories × 5 clues, $200–$1000, 1 Daily Double |
| Double Jeopardy | On | 6 categories × 5 clues, $400–$2000, 2 Daily Doubles |
| Daily Doubles | On | Randomly assigned at game start, player wagers before answering alone |
| Final Jeopardy | On | Category reveal → wager → clue → typed answer → host judges |
| Buzz window | 5s | Time players have to buzz in after clue is read |

### Board Format (JSON)

```json
{
  "title": "General Knowledge",
  "author": "Chase",
  "rounds": [
    {
      "categories": [
        {
          "name": "Science",
          "clues": [
            { "value": 200, "clue": "This planet is known as the Red Planet", "answer": "Mars" },
            { "value": 400, "clue": "...", "answer": "..." },
            { "value": 600, "clue": "...", "answer": "..." },
            { "value": 800, "clue": "...", "answer": "..." },
            { "value": 1000, "clue": "...", "answer": "..." }
          ]
        }
      ],
      "dailyDoubles": 1
    }
  ],
  "final": {
    "category": "World History",
    "clue": "This ancient wonder was located in the city of Babylon",
    "answer": "The Hanging Gardens"
  }
}
```

- Each round has exactly 6 categories with 5 clues each
- Round 1 values: $200/$400/$600/$800/$1000. Round 2 doubled: $400–$2000
- Daily Doubles are randomly placed at game start, not specified in the JSON (matches real show)
- `final` is required when Final Jeopardy is enabled
- Sample boards ship with the game; custom boards saved to localStorage via the builder

### Firebase Database Structure

```
rooms/{roomCode}/
  meta/
    hostId, status, createdAt, boardId
    config/
      enableDailyDoubles, enableFinalJeopardy, buzzWindowMs
  board/
    round1/categories: [{name, clues: [{value, clue, answer, asked, dailyDouble}]}]
    round2/categories: [...]
    final/{category, clue, answer}
  players/{playerId}/
    name, score, connected, joinedAt
  game/
    currentClue/
      categoryIndex, clueIndex, state, text, answer, value, dailyDouble
    pickingPlayer
    buzzer/
      open, currentBuzzer
      buzzedPlayers/{playerId}: serverTimestamp
      lockedOut/{playerId}: true
    dailyDouble/{playerId, wager, answer}
    finalJeopardy/
      state, wagers/{playerId}, answers/{playerId}, judged/{playerId}
```

### Board Builder

Separate page (`builder.html`) with a form-based UI:
- Tabbed interface for Round 1 / Round 2 / Final Jeopardy
- 6 category name inputs per round, each with 5 clue/answer pair fields
- Values auto-filled per round (not editable)
- Save to localStorage, export as `.json` file, import from file or paste
- Live validation (missing clues, empty answers, wrong category count)
- No Firebase required — purely a local authoring tool

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Real-time backend | Firebase Realtime DB (CDN) | Free tier, no build step, server timestamps for buzz ordering |
| Authentication | Anonymous | Party game among friends; YAGNI for full auth |
| Host/Player UI | Separate HTML files | Completely different UIs and target devices; SRP |
| Answer input | Verbal (regular) + typed (Final) | Natural party game feel; matches real show |
| Category picking | Host clicks, player announces verbally | Avoids miniature board on phones; simpler |
| Buzz ordering | Firebase server timestamps | Fair and authoritative; cannot be spoofed |
| Board storage | localStorage + shipped JSON files | No backend needed for content management |
| Daily Double placement | Random at game start | Matches real Jeopardy; keeps boards replayable |
| QR code | Lightweight CDN library | Easy phone joining in party settings |
| Shared JS module | `window.Jeopardy` global | Follows `window.ChessEngine` pattern for cross-file communication |

### Styling

- Deep blue board cells (`#0d1a3a`) with accent-gold dollar values — Jeopardy feel within the Warm Hearth theme
- Clue reveal: white text on deep blue full-screen overlay (closest to TV show aesthetic)
- Host view: landscape-optimized for 1080p+; shows "designed for large screen" warning on mobile
- Player view: mobile-first portrait; large buzzer tap target; minimal chrome
- Buzzer button: terracotta (`#b05a3a`) with glow/pulse animation when active
- Category headers: accent-gold text on elevated background
- Site header/footer/nav consistent with all other pages via `/styles.css`

## Files Changed

- `games/jeopardy/index.html` — Landing page: Host a Game / Join a Game / Board Builder
- `games/jeopardy/host.html` — Host screen with inline CSS (lobby, board, clue display, judging)
- `games/jeopardy/host.js` — Host game logic, board rendering, game flow control
- `games/jeopardy/play.html` — Player screen, mobile-first with inline CSS
- `games/jeopardy/player.js` — Buzzer, score display, wager/answer input
- `games/jeopardy/shared.js` — Firebase init, room create/join, constants, board validation, `window.Jeopardy` module
- `games/jeopardy/builder.html` — Board builder UI with inline CSS
- `games/jeopardy/builder.js` — Board builder logic, localStorage persistence, import/export
- `games/jeopardy/boards/sample.json` — Sample board (General Knowledge)
- `games/index.html` — Jeopardy card added to gallery with "Multiplayer" tag

## Verification

- Host creates room, 4-letter room code and QR code displayed
- 2+ players join via room code on phones, appear in lobby
- Clue selection → buzzer opens → first buzz detected → host judges → score updates
- Picking player rotates to last correct answerer
- Daily Double: wager input shown only to picking player, single-player verbal answer
- Final Jeopardy: category reveal → all players wager → clue → typed answers → host judges each
- Round transitions (Single → Double → Final) work correctly
- Board builder creates valid JSON, saves to localStorage, loads in host setup
- Host view renders correctly on desktop/TV (landscape 1080p+)
- Player view renders correctly on phones (portrait, large tap targets)
- Host disconnect pauses game; player disconnect handled gracefully
- Warm Hearth theme consistency (colors, fonts, shared nav/footer)
