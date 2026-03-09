# Jeopardy Game — Implementation Plan
_Last updated: 2026-03-09_

## In Progress
(none)

## Todo

- [ ] **[JP-003]** Build `index.html` — Jeopardy landing page [ui]
  - Create `games/jeopardy/index.html` with three action cards: Host a Game, Join a Game, Board Builder
  - Host links to `host.html`, Join links to `play.html`, Builder links to `builder.html`
  - Inline CSS matching Warm Hearth theme (deep blue Jeopardy accent, gold text)
  - Consistent site header/footer/nav via `/styles.css`
  - Responsive layout
  - Depends on: (none)

- [ ] **[JP-004]** Build `host.html` — Host screen HTML structure + inline CSS [ui]
  - Create `games/jeopardy/host.html` with all phase sections (hidden/shown via JS):
    - Lobby: room code display, QR code area, player list, board selector, rules config toggles, Start Game button
    - Board: 6-column grid with category headers and 5 dollar-value rows
    - Clue overlay: full-screen blue background with white clue text
    - Buzzer status: who buzzed, timer bar
    - Judging controls: Correct / Incorrect buttons, current player name
    - Scoreboard: all player names and scores
    - Daily Double: wager display
    - Final Jeopardy: category reveal, wager collection status, clue, answer reveals, per-player judging
    - Game Over: final standings, play again button
  - Landscape-optimized for 1080p+; show "designed for large screen" warning on mobile
  - Include `<script>` tags for Firebase CDN SDK, QR code library CDN, `shared.js`, `host.js`
  - Depends on: (none)

- [ ] **[JP-005]** Build `play.html` — Player screen HTML structure + inline CSS [ui]
  - Create `games/jeopardy/play.html` with all phase sections:
    - Join: room code input, name input, Join button
    - Lobby: waiting message, player list, host status
    - Playing: buzzer button (120px+ tap target, terracotta with pulse animation), current score, clue text copy
    - Daily Double wager: wager input (only shown to picking player)
    - Final Jeopardy: wager input, clue text, answer text input, submit button
    - Game Over: final score, standings
  - Mobile-first portrait layout; large tap targets; minimal chrome
  - Include `<script>` tags for Firebase CDN SDK, `shared.js`, `player.js`
  - Depends on: (none)

- [ ] **[JP-006]** Build `host.js` — Lobby phase logic [engine]
  - Create `games/jeopardy/host.js`
  - On load: Firebase anonymous auth, generate host ID
  - Board selection: load shipped `boards/sample.json` + any localStorage boards from builder
  - Rules config: wire toggle switches to config object (Daily Doubles, Final Jeopardy, buzz window)
  - Create room: call `Jeopardy.createRoom()`, display 4-letter room code and QR code
  - Player list: listen for player joins/leaves in Firebase, update lobby UI
  - Start Game: validate ≥1 player, randomly place Daily Doubles, transition to `playing` status
  - Depends on: JP-001, JP-002, JP-004

- [ ] **[JP-007]** Build `player.js` — Join + lobby phase logic [engine]
  - Create `games/jeopardy/player.js`
  - On load: Firebase anonymous auth, generate player ID
  - Join flow: validate room code, call `Jeopardy.joinRoom()`, transition to lobby view
  - Lobby: listen for room status changes, display player list, show "Waiting for host" message
  - Listen for game start → transition to playing view
  - Depends on: JP-002, JP-005

- [ ] **[JP-008]** Extend `host.js` — Board rendering + clue selection [engine]
  - Render the Jeopardy board grid: 6 category headers + 5×6 dollar-value cells
  - Style asked clues differently (dimmed/empty)
  - Click a cell → write `currentClue` to Firebase (categoryIndex, clueIndex, state: `reading`, text, answer, value)
  - Full-screen clue overlay with the clue text on deep blue background
  - "Open Buzzing" button on clue overlay to transition state to `buzzing`
  - Depends on: JP-006

- [ ] **[JP-009]** Extend `host.js` — Core game flow: buzzing → judging → score [engine]
  - Buzzing state: open buzzer in Firebase, start buzz window countdown timer (5s default)
  - Listen for buzz timestamps, determine first buzzer (earliest server timestamp)
  - Display who buzzed in; transition to `answering` state
  - Judging controls: Correct button → add clue value to player score, set picking player, return to board
  - Incorrect button → deduct value, lock out player, reopen buzzing for remaining players
  - If no one buzzes in time or all locked out → reveal answer, return to board
  - Picking player: track last correct answerer (or random for first clue)
  - Display picking player name on board view
  - Update scoreboard after every judgment
  - Depends on: JP-008

- [ ] **[JP-010]** Extend `player.js` — Buzzer + live game state [engine]
  - Listen for `currentClue` changes in Firebase → display clue text on player screen
  - Buzzer button: enabled only during `buzzing` state, terracotta color with pulse animation
  - On buzz: write player ID + `firebase.database.ServerValue.TIMESTAMP` to `buzzer/buzzedPlayers`
  - After buzzing: show "Waiting for host..." message
  - Lockout: if host marks incorrect, add player to `lockedOut`, disable buzzer
  - Live score: update score display on Firebase changes
  - Show current game state (who's picking, who buzzed, answer revealed)
  - Depends on: JP-007, JP-009

- [ ] **[JP-011]** Daily Double handling on host + player [engine]
  - At game start (JP-006 already places randomly): mark Daily Double cells in Firebase board data
  - When host clicks a Daily Double cell: transition to `dailyDouble` state instead of normal buzzing
  - Host UI: show "Daily Double!" overlay, display picking player name, wait for wager
  - Player UI: only the picking player sees wager input (min $5, max = score or highest clue value if score < that)
  - Player submits wager → written to Firebase → host sees wager amount
  - Host reads clue aloud, player answers verbally
  - Host judges Correct (add wager) / Incorrect (deduct wager) → return to board
  - Depends on: JP-009, JP-010

- [ ] **[JP-012]** Round transitions — Single → Double Jeopardy [engine]
  - Track current round (1 or 2) in Firebase `game/currentRound`
  - After all clues in Round 1 asked → "Round 1 Complete" overlay → transition to Round 2
  - Load Round 2 board data (doubled values: $400–$2000, 2 Daily Doubles)
  - Re-render board with Round 2 categories and values
  - Picking player for Round 2 start = player with lowest score (Jeopardy rule)
  - Skip Round 2 if Double Jeopardy is disabled in config
  - Depends on: JP-011

- [ ] **[JP-013]** Final Jeopardy flow [engine]
  - After last round complete → check if Final Jeopardy enabled in config
  - Host: display Final Jeopardy category (text only, no clue yet)
  - All players: wager input (min $0, max = current score; players with $0 or less can't wager)
  - Host: wait for all wagers submitted → display clue text
  - Players: 30-second timer to type answer and submit
  - Host: reveal each player's answer one at a time, judge Correct/Incorrect
  - Correct → add wager to score; Incorrect → deduct wager
  - After all judged → transition to Game Over with final standings
  - Depends on: JP-012

- [ ] **[JP-014]** Game over + connection management [engine]
  - Game Over screen: final standings sorted by score, winner highlighted
  - "Play Again" button → return to lobby with same room code, reset game state
  - Host disconnect: set room `meta/status` to `paused` via `onDisconnect()` handler
  - Player sees "Host disconnected" overlay when status = `paused`
  - Host reconnect: restore from Firebase state, resume game
  - Player disconnect: set `connected: false` via `onDisconnect()` handler
  - Game continues without disconnected player; they can rejoin and restore state
  - Depends on: JP-013

- [ ] **[JP-015]** Build `builder.html` — Board builder UI [ui]
  - Create `games/jeopardy/builder.html` with form-based board authoring UI
  - Tabbed interface: Round 1 / Round 2 / Final Jeopardy tabs
  - Each round tab: 6 category name inputs, each with 5 clue/answer text field pairs
  - Dollar values auto-filled and not editable ($200–$1000 for R1, $400–$2000 for R2)
  - Final tab: single category, clue, and answer field
  - Board title and author fields at top
  - Action buttons: Save, Load, Export JSON, Import JSON, Clear
  - Inline CSS matching Warm Hearth theme
  - Include `<script>` tags for `shared.js` (for validation) and `builder.js`
  - Depends on: (none)

- [ ] **[JP-016]** Build `builder.js` — Builder logic + persistence [engine]
  - Create `games/jeopardy/builder.js`
  - Form handling: read all inputs into board JSON matching ADR-011 schema
  - Live validation: highlight missing clues, empty answers, wrong category count; show error summary
  - Save to localStorage: key = `jeopardy-board-{title}`, store board JSON
  - Load from localStorage: populate form from saved board
  - Export: download board as `.json` file
  - Import: file upload input OR paste JSON into textarea, validate, populate form
  - Clear: reset all fields with confirmation prompt
  - No Firebase required — purely local authoring tool
  - Depends on: JP-015

- [ ] **[JP-017]** Add Jeopardy card to `games/index.html` gallery [ui]
  - Add a Jeopardy game card to the games gallery page
  - Include "Multiplayer" tag/badge to distinguish from single-player games
  - Card links to `games/jeopardy/`
  - Match existing card style (title, description, thumbnail area)
  - Depends on: JP-003

## Done

- [x] **[JP-001]** Seed sample board JSON data file [data]
  _Completed: Created `games/jeopardy/boards/sample.json` with a full "General Knowledge" board. Round 1 has 6 categories (Science, World Geography, American History, Pop Culture, Food & Drink, Literature) × 5 clues ($200–$1000, dailyDoubles: 1). Round 2 has 6 categories (Space Exploration, Music, World Leaders, Technology, Sports, Mythology) × 5 clues ($400–$2000, dailyDoubles: 2). Final Jeopardy: "Ancient Wonders" — The Great Pyramid of Giza. All trivia is accurate and real. Schema matches ADR-011 exactly. Files changed: `games/jeopardy/boards/sample.json`._

- [x] **[JP-002]** Build `shared.js` — Firebase init, room management, `window.Jeopardy` module [infra]
  _Completed: Created `games/jeopardy/shared.js` using IIFE + `window.Jeopardy` pattern (matching chess game's `window.ChessEngine`). Includes: Firebase v10 compat SDK init with inlined config, anonymous auth via `signInAnonymously()`, collision-checked 4-letter room code generation (omits I/O to avoid confusion), `createRoom()` / `joinRoom()` / `leaveRoom()` with full Firebase writes and `onDisconnect()` handler for player connection tracking, `validateBoard()` that checks all ADR-011 schema requirements (title, rounds, categories, clues, values, final). Constants exported: `STATUS` (lobby/playing/final/ended/paused), `CLUE_STATE` (picking/reading/buzzing/answering/judging/revealed), `FINAL_STATE`, `DEFAULT_CONFIG` (buzzWindowMs: 5000), `ROUND_VALUES`. All 19 browser tests pass (module loading, constants, validation of sample.json, invalid board rejection). Files changed: `games/jeopardy/shared.js`._