# Jeopardy Game — Implementation Plan
_Last updated: 2026-03-09_

## In Progress
(none)

## Todo

- [ ] **[JP-007]** Build `player.js` — Join + lobby phase logic [engine]
  - Acceptance: Player can enter room code and name, join room via Firebase, see lobby with player list; game start transitions player to playing view
  - Files: `games/jeopardy/player.js`
  - On load: Firebase anonymous auth, generate player ID
  - Join flow: validate room code, call `Jeopardy.joinRoom()`, transition to lobby view
  - Lobby: listen for room status changes, display player list, show "Waiting for host" message
  - Listen for game start → transition to playing view
  - Depends on: JP-002, JP-005

- [ ] **[JP-008]** Extend `host.js` — Board rendering + clue selection [engine]
  - Acceptance: 6×5 board grid renders with category headers and dollar values; clicking a cell writes `currentClue` to Firebase and shows full-screen clue overlay; asked clues appear dimmed; "Open Buzzing" button transitions state to `buzzing`
  - Files: `games/jeopardy/host.js`
  - Render the Jeopardy board grid: 6 category headers + 5×6 dollar-value cells
  - Style asked clues differently (dimmed/empty)
  - Click a cell → write `currentClue` to Firebase (categoryIndex, clueIndex, state: `reading`, text, answer, value)
  - Full-screen clue overlay with the clue text on deep blue background
  - "Open Buzzing" button on clue overlay to transition state to `buzzing`
  - Depends on: JP-006

- [ ] **[JP-009]** Extend `host.js` — Core game flow: buzzing → judging → score [engine]
  - Acceptance: Buzzer opens with countdown timer; first buzz (by server timestamp) is recognized; Correct adds value to score, Incorrect deducts and locks out; no-buzz timeout reveals answer and returns to board; scoreboard updates after every judgment
  - Files: `games/jeopardy/host.js`
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
  - Acceptance: Player sees clue text when host selects a clue; buzzer button enables only during `buzzing` state with pulse animation; buzzing writes server timestamp to Firebase; lockout disables buzzer after incorrect answer; score updates live
  - Files: `games/jeopardy/player.js`
  - Listen for `currentClue` changes in Firebase → display clue text on player screen
  - Buzzer button: enabled only during `buzzing` state, terracotta color with pulse animation
  - On buzz: write player ID + `firebase.database.ServerValue.TIMESTAMP` to `buzzer/buzzedPlayers`
  - After buzzing: show "Waiting for host..." message
  - Lockout: if host marks incorrect, add player to `lockedOut`, disable buzzer
  - Live score: update score display on Firebase changes
  - Show current game state (who's picking, who buzzed, answer revealed)
  - Depends on: JP-007, JP-009

- [ ] **[JP-011]** Daily Double handling on host + player [engine]
  - Acceptance: Daily Double cell triggers wager flow instead of buzzing; only picking player sees wager input; wager min/max enforced; host sees wager, judges correct/incorrect, score adjusts by wager amount
  - Files: `games/jeopardy/host.js`, `games/jeopardy/player.js`
  - At game start (JP-006 already places randomly): mark Daily Double cells in Firebase board data
  - When host clicks a Daily Double cell: transition to `dailyDouble` state instead of normal buzzing
  - Host UI: show "Daily Double!" overlay, display picking player name, wait for wager
  - Player UI: only the picking player sees wager input (min $5, max = score or highest clue value if score < that)
  - Player submits wager → written to Firebase → host sees wager amount
  - Host reads clue aloud, player answers verbally
  - Host judges Correct (add wager) / Incorrect (deduct wager) → return to board
  - Depends on: JP-009, JP-010

- [ ] **[JP-012]** Round transitions — Single → Double Jeopardy [engine]
  - Acceptance: After all Round 1 clues asked, "Round 1 Complete" overlay appears; Round 2 board loads with doubled values and 2 Daily Doubles; lowest-scoring player picks first in Round 2; Double Jeopardy skipped if disabled in config
  - Files: `games/jeopardy/host.js`
  - Track current round (1 or 2) in Firebase `game/currentRound`
  - After all clues in Round 1 asked → "Round 1 Complete" overlay → transition to Round 2
  - Load Round 2 board data (doubled values: $400–$2000, 2 Daily Doubles)
  - Re-render board with Round 2 categories and values
  - Picking player for Round 2 start = player with lowest score (Jeopardy rule)
  - Skip Round 2 if Double Jeopardy is disabled in config
  - Depends on: JP-011

- [ ] **[JP-013]** Final Jeopardy flow [engine]
  - Acceptance: Final Jeopardy category reveals first; all players submit wagers (clamped 0–score); clue shown with 30s timer; players type answers; host judges each player; scores adjust; game transitions to Game Over
  - Files: `games/jeopardy/host.js`, `games/jeopardy/player.js`
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
  - Acceptance: Game Over shows final standings sorted by score with winner highlighted; "Play Again" returns to lobby with same room; host disconnect shows "Host disconnected" on players; player disconnect allows rejoin with state restoration
  - Files: `games/jeopardy/host.js`, `games/jeopardy/player.js`
  - Game Over screen: final standings sorted by score, winner highlighted
  - "Play Again" button → return to lobby with same room code, reset game state
  - Host disconnect: set room `meta/status` to `paused` via `onDisconnect()` handler
  - Player sees "Host disconnected" overlay when status = `paused`
  - Host reconnect: restore from Firebase state, resume game
  - Player disconnect: set `connected: false` via `onDisconnect()` handler
  - Game continues without disconnected player; they can rejoin and restore state
  - Depends on: JP-013

- [ ] **[JP-015]** Build `builder.html` — Board builder UI [ui]
  - Acceptance: `builder.html` loads with no console errors; tabbed interface shows Round 1 / Round 2 / Final Jeopardy; each round has 6 category inputs with 5 clue/answer pairs; dollar values are auto-filled and non-editable; action buttons (Save/Load/Export/Import/Clear) are present
  - Files: `games/jeopardy/builder.html`
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
  - Acceptance: Form data serializes to valid board JSON matching ADR-011 schema; validation highlights missing fields; Save persists to localStorage; Load populates form; Export downloads .json file; Import accepts file upload and populates form; Clear resets with confirmation
  - Files: `games/jeopardy/builder.js`
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
  - Acceptance: Jeopardy card appears in games gallery with "Multiplayer" badge; card links to `games/jeopardy/`; styling matches existing cards
  - Files: `games/index.html`
  - Add a Jeopardy game card to the games gallery page
  - Include "Multiplayer" tag/badge to distinguish from single-player games
  - Card links to `games/jeopardy/`
  - Match existing card style (title, description, thumbnail area)
  - Depends on: JP-003

## Done

- [x] **[JP-006]** Build `host.js` — Lobby phase logic [engine]
  - Acceptance: Host page creates a Firebase room with 4-letter code; QR code renders; player joins appear in lobby list; Start Game button validates ≥1 player and transitions to `playing` status
  - Files: `games/jeopardy/host.js`
  _Completed: Built `games/jeopardy/host.js` with full lobby phase logic using IIFE + `window.Jeopardy` module pattern. On load: Firebase anonymous auth → host ID generation → auto-creates room. Board selection: fetches shipped `boards/sample.json` + loads any `jeopardy-board-*` localStorage boards from builder, validates with `J.validateBoard()`, populates `<select>` dropdown dynamically. Config: reads toggle checkboxes (Double Jeopardy, Daily Doubles, Final Jeopardy) and buzz window select into config object. Room creation: calls `J.createRoom()`, displays 4-letter room code, renders QR code via QRCode.js (cdnjs CDN), sets join URL. Host disconnect handler sets room status to `paused` via `onDisconnect()`. Player list: Firebase `.on('value')` listener on `rooms/{code}/players` — renders player items with sage dot (faded when disconnected), updates count, enables Start Game button when ≥1 player. Start Game: places Daily Doubles randomly (1 in Round 1, 2 in Round 2 — avoids top row matching real show), picks random first player, writes `meta/status: playing` + `game/pickingPlayer` to Firebase, transitions to board phase. Phase management via `showPhase()` toggles `.active` class. Verified: page loads, lobby UI renders correctly at desktop resolution, board selector populated, all toggles functional, Start button disabled by default. Files changed: `games/jeopardy/host.js`._

- [x] **[JP-005]** Build `play.html` — Player screen HTML structure + inline CSS [ui]
  - Acceptance: `play.html` loads with no console errors; all phase sections present (hidden by default except join); mobile-first portrait layout works at 375px; buzzer button is 120px+ tap target
  - Files: `games/jeopardy/play.html`
  _Completed: Built `games/jeopardy/play.html` with all 6 game phases: Join (room code input with uppercase styling, name input, Join button with gold CTA), Lobby (room code display, player name, waiting pulse animation, player list), Playing (score bar with name/value, game status message, deep blue clue area with value label, 120px+ circular buzzer button with terracotta color and pulse animation), Daily Double (gold title with text shadow, wager input with range display, submit button, waiting state), Final Jeopardy (category display, wager input, clue area, timer bar, answer text input, submit button, waiting state), Game Over (large final score display, ranked standings list with winner/you highlighting). Also includes host-disconnected overlay (fixed z-200, warning icon + reconnect message) and back-to-Jeopardy link. Mobile-first portrait layout with max-width 480px, clamp-based fluid sizing, all inputs full-width. Buzzer is `clamp(120px, 40vw, 180px)` circular tap target. Script tags: Firebase v10 compat SDK (app, database, auth) + shared.js + player.js. Zero console errors on desktop and mobile (375px). Files changed: `games/jeopardy/play.html`._

- [x] **[JP-001]** Seed sample board JSON data file [data]
  - Acceptance: Valid JSON matching ADR-011 board schema with 2 rounds + Final Jeopardy
  - Files: `games/jeopardy/boards/sample.json`
  _Completed: Created `games/jeopardy/boards/sample.json` with a full "General Knowledge" board. Round 1 has 6 categories (Science, World Geography, American History, Pop Culture, Food & Drink, Literature) × 5 clues ($200–$1000, dailyDoubles: 1). Round 2 has 6 categories (Space Exploration, Music, World Leaders, Technology, Sports, Mythology) × 5 clues ($400–$2000, dailyDoubles: 2). Final Jeopardy: "Ancient Wonders" — The Great Pyramid of Giza. All trivia is accurate and real. Schema matches ADR-011 exactly. Files changed: `games/jeopardy/boards/sample.json`._

- [x] **[JP-002]** Build `shared.js` — Firebase init, room management, `window.Jeopardy` module [infra]
  - Acceptance: `window.Jeopardy` module loads with createRoom/joinRoom/leaveRoom/validateBoard functions; Firebase initializes; constants exported
  - Files: `games/jeopardy/shared.js`
  _Completed: Created `games/jeopardy/shared.js` using IIFE + `window.Jeopardy` pattern (matching chess game's `window.ChessEngine`). Includes: Firebase v10 compat SDK init with inlined config, anonymous auth via `signInAnonymously()`, collision-checked 4-letter room code generation (omits I/O to avoid confusion), `createRoom()` / `joinRoom()` / `leaveRoom()` with full Firebase writes and `onDisconnect()` handler for player connection tracking, `validateBoard()` that checks all ADR-011 schema requirements (title, rounds, categories, clues, values, final). Constants exported: `STATUS` (lobby/playing/final/ended/paused), `CLUE_STATE` (picking/reading/buzzing/answering/judging/revealed), `FINAL_STATE`, `DEFAULT_CONFIG` (buzzWindowMs: 5000), `ROUND_VALUES`. All 19 browser tests pass (module loading, constants, validation of sample.json, invalid board rejection). Files changed: `games/jeopardy/shared.js`._

- [x] **[JP-003]** Build `index.html` — Jeopardy landing page [ui]
  - Acceptance: Landing page loads with 3 action cards (Host/Join/Builder) linking to correct pages; no console errors; responsive layout
  - Files: `games/jeopardy/index.html`
  _Completed: Created `games/jeopardy/index.html` with three action cards: Host a Game (links to host.html, "big screen" tag), Join a Game (links to play.html, "mobile" tag), Board Builder (links to builder.html, "tool" tag). Inline CSS matching Warm Hearth theme with shared `/styles.css` for header/footer/nav. Responsive layout — cards use `auto-fit` grid that stacks on mobile. Icons use HTML entities (TV, phone, notepad). Verified desktop (1525px) and mobile (375px) rendering with no console errors. Files changed: `games/jeopardy/index.html`._

- [x] **[JP-004]** Build `host.html` — Host screen HTML structure + inline CSS [ui]
  - Acceptance: `host.html` loads with no console errors; all phase sections present (hidden by default except lobby); landscape layout renders correctly at 1080p+; mobile shows "designed for large screen" warning
  - Files: `games/jeopardy/host.html`
  _Completed: Built `games/jeopardy/host.html` with all 8 phase sections: Lobby (room code, QR area, 3-column grid with join panel/config/player list, board selector dropdown, rule toggles for Double Jeopardy/Daily Doubles/Final Jeopardy/Buzz Window, Start Game button), Board (6-col grid with category headers, score chips bar, picking player display, round label), Clue Overlay (full-screen deep blue with value label, clue text, Open Buzzing/judging/answer reveal controls, buzz timer bar), Daily Double (title, player name, wager status/amount, clue text, judging), Round Transition (title, subtitle, Continue button), Final Jeopardy (category, wager status chips, clue text, timer bar, per-player reveal with judging), Game Over (standings list with winner highlight, Play Again button). Mobile warning at ≤768px shows "Designed for Large Screens" with link to play.html. Switched QR CDN from jsdelivr (blocked by ORB) to cdnjs. Created placeholder `host.js` stub to avoid 404. Zero console errors on load. Files changed: `games/jeopardy/host.html`, `games/jeopardy/host.js`._
