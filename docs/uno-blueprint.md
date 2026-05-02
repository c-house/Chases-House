# Uno — Implementation Blueprint

**Companion to** [ADR-017](adr/017-uno.md) · **Date:** 2026-04-25 · **Status:** Approved (ready for implementation)

This document is the comprehensive architecture for building Uno per ADR-017. It is the deliverable of the `/feature-dev:feature-dev` pass. Code snippets are illustrative; production code lands in a follow-up implementation phase that consumes this blueprint.

---

## 1. Overview

**Architecture: hybrid of Pac-Man and Chess precedents.** Six total files in [games/uno/](../games/uno/), all plain HTML/CSS/JS, no build step. Rules + state machine live in `game.js` and are exposed through `window.UnoGame` so `ai.js` can consume them as pure functions (Chess pattern). Render is a separate module because the DOM tree is large and animation-heavy (Pac-Man pattern). Input, audio, and AI are their own modules — same justification as Pac-Man.

**Key architectural decisions** (locked in Phase 3):

1. **No `modes.js`.** Solo and Couch are two values of a single `state.config.mode` enum; both share the same engine. A separate file would be 30 lines of static data.
2. **No `ui.js`.** Pac-Man's `ui.js` exists because its `game.js` is dominated by the 60Hz simulation loop. Uno is event-driven; bootstrap and DOM event wiring fit cleanly inside `game.js`.
3. **No `SharedGamepad` extension.** Verified: [games/shared/gamepad.js](../games/shared/gamepad.js) lines 11–28 already export all 16 standard mapping indices (A, B, X, Y, LB, RB, LT, RT, BACK, START, LS, RS, DPAD_*). The "extend SharedGamepad" task in ADR-017 §9 is a no-op — buttons B/X/Y are usable today. *(ADR-017 should be amended with a one-line note.)*
4. **Rules engine co-located with state machine.** Unlike Chess (which has `game.js` and `ai.js` and the rules live in `game.js`'s `window.ChessEngine`), Uno's rules belong with the state machine because the state machine *is* the rules — turn order, direction reversal, draw stacking, color matching are inseparable. `window.UnoGame` is the single export.
5. **Visual contract is [games/uno/design-preview.html](../games/uno/design-preview.html).** That file's CSS, card DOM structure, and class names are **the** spec. Implementation lifts the inline `<style>` block verbatim into `index.html` and renders cards with the exact same DOM shape.
6. **Mid-round persistence: save-on-pagehide.** One `visibilitychange`/`beforeunload` listener serializes `state` to localStorage. No write-on-every-action churn. Crash loses the round; that's acceptable for 3–7 minute rounds.
7. **Match scoring: ship both modes.** "First out wins" (default) and "Play to N points" (toggle, default 500). Adds ~30 LOC and a `scores[]` accumulator.

---

## 2. File Layout

```
games/uno/
├── index.html        ~600 lines  — HTML + inline CSS (lifted from design-preview)
├── game.js           ~700 lines  — window.UnoGame: state, rules, state machine, bootstrap
├── render.js         ~350 lines  — window.UnoRender: DOM rendering + animation orchestration
├── input.js          ~200 lines  — window.UnoInput: keyboard + mouse + gamepad routing
├── ai.js             ~250 lines  — window.UnoAI: bot strategies (3 difficulty tiers)
├── audio.js          ~200 lines  — window.UnoAudio: Web Audio bus + CC0 SFX
└── sounds/                       — CC0 audio files (TBD sourcing in implementation)
    ├── card-lift.ogg
    ├── card-thwip.ogg
    ├── card-thock.ogg
    ├── card-draw.ogg
    ├── chime-wild.ogg
    ├── scratch-reverse.ogg
    ├── thunk-skip.ogg
    ├── sting-draw2.ogg
    ├── sting-draw4.ogg
    ├── menu-hover.ogg
    ├── menu-confirm.ogg
    ├── menu-back.ogg
    ├── stinger-uno.ogg
    ├── fanfare-round.ogg
    ├── cheer-match.ogg
    └── drone-lose.ogg
```

**Line-count budgets** are upper bounds; if any file exceeds them by 30%, it's a signal to extract a sub-module before merging.

**Artifacts moved at first commit:**
- `games/uno/design-preview.html` → `docs/design/uno-preview.html` (per Q3 resolution — keeps the spec, removes from served routes).

---

## 3. Module APIs

### `window.UnoGame` (game.js)

```js
window.UnoGame = {
  // Bootstrap
  init: ({ root }) => void,         // mount under DOM root, wire DOM events
  start: (config) => void,          // begin round with config
  resume: () => boolean,            // restore saved state if present, true on success

  // State accessors (read-only — clones returned)
  getState: () => StateView,
  getPlayableCards: (playerId) => Card[],

  // Rules engine (pure — used by ai.js)
  isPlayable: (card, topCard, currentColor) => boolean,
  scoreHand: (cards) => number,     // for round-end tally

  // Action dispatchers (the only mutation entry points)
  playCard: ({ playerId, cardId, chosenColor? }) => Result,
  drawCard: ({ playerId }) => Result,
  callUno: ({ playerId, targetId }) => Result,
  catchMissedUno: ({ callerId, targetId }) => Result,
  passTurn: ({ playerId }) => Result,             // after forced draw

  // Lifecycle
  pause: () => void,
  quit: () => void,                 // discards saved state
  newRound: () => void,
  newMatch: (config) => void,

  // Constants (consumed by ai.js, render.js)
  PHASES, COLORS, VALUES,
};
```

`Result` is `{ ok: true, events: Event[] }` or `{ ok: false, reason: string }`. Action dispatchers always return synchronously; `events` is the per-action transient bus that audio + render consume.

### `window.UnoRender` (render.js)

```js
window.UnoRender = {
  init: ({ root }) => void,         // cache DOM mount points
  render: (state) => void,          // full re-render from state — idempotent
  applyEvents: (events) => void,    // animations: card-fly, color-burst, reverse, etc.
  showOverlay: (id, props) => void, // 'title' | 'setup' | 'roundEnd' | 'matchEnd' | 'pause' | 'colorPicker' | 'curtain' | 'howTo'
  hideOverlay: () => void,
  setReducedMotion: (enabled) => void,
};
```

`render(state)` is a full state-driven re-render. `applyEvents(events)` handles the *transitions between* states — the card flying, the color burst — animations that need before/after positions. The split mirrors React's reconciler vs CSS transitions: state describes the world; events animate the journey.

### `window.UnoInput` (input.js)

```js
window.UnoInput = {
  init: ({ onCardClick, onDrawClick, onCallUno, onMenu, onColorPick, onConfirm }) => void,
  poll: () => void,                 // gamepad poll — called on rAF only when gamepad bound
  bindSlot: (slot, source) => void, // source = { kind: 'keyboard', scheme } | { kind: 'gamepad', index }
  unbindSlot: (slot) => void,
  setFocus: (cardIndex) => void,    // arrow-key cursor
  teardown: () => void,
};
```

Input is callback-based, not event-bus-based, because there is exactly one consumer (`game.js`). Pac-Man's polling-from-game pattern doesn't apply: Uno fires actions on discrete user input, not on a tick.

The gamepad poll runs on rAF *only when at least one slot is bound to a gamepad*. Otherwise no rAF — pure event-driven.

### `window.UnoAI` (ai.js)

```js
window.UnoAI = {
  // Pure function — takes state by argument, returns a planned action
  chooseAction: (playerId, state, difficulty) => Action,
  // Action shape: { type: 'play', cardId, chosenColor? } | { type: 'draw' } | { type: 'callUno', targetId }
};
```

Pure-functional like `ChessAI.findBestMove`. No module-level state. `game.js`'s coordinator wraps each AI turn in `setTimeout(() => game.dispatch(ai.chooseAction(...)), thinkDelay)`.

### `window.UnoAudio` (audio.js)

```js
window.UnoAudio = {
  ensure: () => void,               // lazy AudioContext create + sample load
  play: (sampleName, opts?) => void, // one-shot SFX
  setMuted: (muted) => void,
  setSfxVolume: (v) => void,
  syncEvents: (events) => void,     // dispatch SFX from event bus
};
```

Direct copy of Pac-Man's audio architecture, minus the looping tracks (no music in v1) and minus the priority-tree complexity (Uno is one-shot only).

---

## 4. Data Model

### State shape (single object, owned by `game.js`)

```js
state = {
  // Configuration (immutable after createState)
  config: {
    mode: 'solo' | 'couch',
    matchType: 'first-out' | 'play-to-500',
    matchTarget: 500,
    rules: {
      stacking: true,           // default ON
      drawThenPlay: true,       // default ON
      jumpIn: false,
      sevenZero: false,
      forcePlay: false,
      challengeFour: false,
    },
    aiThinkMin: 600,
    aiThinkMax: 1200,
  },

  // Phase machine
  phase: 'TITLE' | 'SETUP' | 'DEALING' | 'PLAYER_TURN' | 'AWAITING_COLOR'
       | 'AWAITING_UNO_WINDOW' | 'RESOLVING_EFFECT' | 'ROUND_END' | 'MATCH_END',

  // Players
  players: [
    { id: 'p0', name: 'You',  kind: 'human', difficulty: null, slot: 0 },
    { id: 'p1', name: 'Mom',  kind: 'ai',    difficulty: 'normal' },
    // ...
  ],

  // Hands — parallel array indexed by player order
  hands: [Card[], Card[], Card[], Card[]],

  // Pile state
  drawPile: Card[],            // shuffled, hidden
  discard: Card[],             // top card visible
  currentColor: 'red'|'yellow'|'green'|'blue',  // de-couples Wilds from physical card

  // Turn state
  turnIndex: 0,                // index into players[]
  direction: 1 | -1,
  drawStack: 0,                // accumulated +2/+4 if stacking active
  unoCalls: { p0: false, ... }, // who has declared UNO this turn
  unoWindow: { closeAt: ts, target: 'p1' } | null,  // 400ms post-play catch window

  // Match-level
  scores: [0, 0, 0, 0],        // round-points-won totals
  roundsPlayed: 0,
  matchWinnerId: null,

  // Persistence-friendly
  seed: 0xCAFEBABE,             // for replay/seedable PRNG
  rngState: 0,                  // Mulberry32 state — advances as cards drawn

  // Transient — flushed each dispatch
  events: [],
};
```

### Card shape

```js
{
  id: 'r7-3',                  // unique within deck — '{color}{value}-{copy}'
  color: 'red' | 'yellow' | 'green' | 'blue' | 'wild',
  value: 0..9 | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4',
  points: number,              // 0–9 face value | 20 (action) | 50 (wild)
}
```

Cards are immutable. Hands are arrays of card *references* into a single deck array; "drawing" splices from `drawPile` to a hand.

### Deck composition (108 cards)

```
Per color (×4 colors):
  1× zero
  2× each 1–9
  2× skip, 2× reverse, 2× draw2
= 25 × 4 = 100

Wilds:
  4× wild
  4× wild draw four
= 8

Total: 108
```

### Event types (transient, populated by `game.js`, drained by render + audio)

```js
{ type: 'card-played',  playerId, card, fromIndex, randomTilt }
{ type: 'card-drawn',   playerId, count }
{ type: 'wild-color',   color }
{ type: 'reverse' }
{ type: 'skip',         skippedId }
{ type: 'stack-grow',   amount }
{ type: 'forced-draw',  playerId, count }
{ type: 'uno-called',   playerId }
{ type: 'uno-caught',   targetId, callerId }
{ type: 'round-end',    winnerId, points, hands }
{ type: 'match-end',    winnerId }
{ type: 'curtain-up',   nextPlayerId }    // couch hot-seat
```

---

## 5. State Machine

```
                ┌──── TITLE ────┐
                │      ↓        │
                │    SETUP ─────┘ (back)
                │      ↓
                │    DEALING (animated card-deal, ~1.2s)
                │      ↓
                │ ┌→ PLAYER_TURN ←───────────────────┐
                │ │      ↓ (play/draw/uno)            │
                │ │   action dispatched               │
                │ │      ↓                            │
                │ │   apply card effect               │
                │ │      ↓                            │
                │ │  AWAITING_COLOR ─→ wild only ─────┤
                │ │      ↓                            │
                │ │  AWAITING_UNO_WINDOW (400ms)      │
                │ │      ↓                            │
                │ │  RESOLVING_EFFECT (skip/+2/+4)    │
                │ │      ↓                            │
                │ │  advance turn, COUCH? curtain     │
                │ └──────┘                            │
                │      ↓ (hand empty)                 │
                │   ROUND_END                         │
                │      ↓ (next round || match end?)   │
                │      ├─→ DEALING ─────────────────→│
                │      └─→ MATCH_END
                │           ↓
                └─→ TITLE ←─┘
```

### Transition guards (single source of truth)

Each `dispatch(action)` call in `game.js` runs:
1. Phase guard — is this action legal in the current phase? Reject otherwise.
2. Player guard — is this action from the current player (or a valid catch from any opponent)?
3. Rule check — is the move legal under current rules (e.g., `isPlayable`)?
4. Mutate state, push events, emit notification to render+audio.
5. If transition exits phase, run any teardown for the exited phase.
6. Compute next phase; run any setup for the new phase (e.g., schedule AI turn).

```js
// Pseudocode — game.js
function dispatch(action) {
  const guard = guards[state.phase][action.type];
  if (!guard) return { ok: false, reason: 'illegal-phase' };
  const result = guard(action);
  if (!result.ok) return result;
  // mutation has happened during guard; events populated
  notify(state.events);
  state.events = [];
  return result;
}
```

### Modal interrupt: AWAITING_COLOR

After a Wild lands, phase becomes `AWAITING_COLOR`. All inputs except color-pick are rejected. A modal overlay covers the table; gamepad input is also gated. On color pick, phase advances. **This is the same pattern as Chess `pendingPromotion`.** It's the only modal interrupt in the design.

### UNO window: AWAITING_UNO_WINDOW

After any card is played, if the playing player now has 1 card and didn't declare UNO before/during the play, a 400ms window opens. During this window:
- Any opponent can dispatch `catchMissedUno({ targetId })` and the target draws 2.
- After 400ms, the window closes; if uncalled, no penalty.
- AI bots auto-fire `catchMissedUno` with ~80% probability, scheduled at a random ms in the window.

Implementation: `setTimeout` schedules a "window-closed" event; opponents can act before it fires.

---

## 6. Rules Engine (inside game.js)

Pure-function helpers, exposed on `window.UnoGame` for the AI:

```js
// The four canonical predicates
isPlayable(card, topCard, currentColor) {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value && topCard.color !== 'wild') return true;
  return false;
}

isStackable(card, topCard) {
  // stacking = ON: +2 onto +2; +4 onto +4. (No cross-stacking per default.)
  if (!state.config.rules.stacking) return false;
  if (card.value === 'draw2' && topCard.value === 'draw2') return true;
  if (card.value === 'wild4' && topCard.value === 'wild4') return true;
  return false;
}

scoreHand(cards) {
  return cards.reduce((sum, c) => sum + c.points, 0);
}

// Card effects
applyEffect(card, state) {
  switch (card.value) {
    case 'skip':    skipNext(state); break;
    case 'reverse': reverseDirection(state); break;
    case 'draw2':   if (!stackInto(state, 2)) forceDrawNext(state, 2); break;
    case 'wild4':   if (!stackInto(state, 4)) forceDrawNext(state, 4); break;
    // numbers + plain wild: no side effect on next player
  }
}
```

### The deck and the shuffle

```js
buildDeck() — emits 108 cards in canonical order
shuffle(deck, rng) — Fisher–Yates using the seeded PRNG
draw(state, n) — splice from drawPile; if drawPile empty,
                 reshuffle discard (excluding top card) using current rngState
```

The PRNG is **Mulberry32**. Seed flows: `state.seed → rngState (mutated as cards drawn)`. This makes the entire round deterministic given the seed — required for v2 daily-seed feature, costs nothing today.

### Reshuffle invariant

When `drawPile` empties and `discard.length > 1`:
- Remove top card; keep it as the new `discard`.
- Convert any Wilds in the rest back to color-less.
- Shuffle.
- Becomes the new `drawPile`.

---

## 7. AI Design

### Difficulty config (Chess pattern)

```js
const DIFFICULTY_CONFIG = {
  easy:   { lookahead: 0, useColorMemory: false, holdWilds: false, autoUnoCatch: 0.3 },
  normal: { lookahead: 0, useColorMemory: false, holdWilds: true,  autoUnoCatch: 0.7 },
  hard:   { lookahead: 1, useColorMemory: true,  holdWilds: true,  autoUnoCatch: 0.9 },
};
```

### AI decision — `chooseAction(playerId, state, difficulty)`

1. Compute `playable = hand.filter(c => isPlayable(c, top, color))`.
2. If `playable.empty` → return `{ type: 'draw' }`.
3. Score each playable card per heuristic (below); higher = better.
4. Return `{ type: 'play', cardId: best.id, chosenColor: pickColor() if wild }`.

### Heuristic scoring (single function, gated by difficulty flags)

| Factor | Easy | Normal | Hard |
|---|---|---|---|
| Base: `card.points` (dump high-value first) | +0 | +`points/2` | +`points/2` |
| Hold wild for emergencies (`holdWilds`) | — | −15 | −20 |
| Color-blocking: if next player has ≤2 cards, prefer color change | — | +8 | +12 |
| Color memory: prefer dumping less-played colors (`useColorMemory`) | — | — | +4 |
| Stack continuation (+2 on +2): always +12 if applicable | +12 | +12 | +12 |
| Going-out bonus: if play empties hand, +1000 | +1000 | +1000 | +1000 |

Wild-color choice: pick the color the bot has most of in hand (Easy random; Normal/Hard heuristic).

### Auto-UNO catch

After every human play that drops to 1 card and the human didn't pre-declare:
- For each AI bot, roll `Math.random() < autoUnoCatch` and schedule a `catchMissedUno` at a random offset in `[150ms, 350ms]`.
- If multiple bots roll true, the first one to fire wins; the rest are noops.

### Lookahead (Hard only)

For the Hard tier, before committing a play, simulate the next opponent's likely action (play their highest-scoring legal card or draw). Score the resulting position; prefer plays that leave the opponent without a follow-up. Depth 1 only — Uno's branching factor (~7) means depth 2 is 49× the work for marginal gain.

---

## 8. Render Layer

### DOM contract (matches design-preview.html exactly)

```html
<div class="uno-root">
  <header><!-- shared site header --></header>
  <main class="uno-table" data-phase="PLAYER_TURN">
    <div class="hud-bar"><!-- deck count, color, score, direction, menu --></div>
    <div class="hud-play">
      <div class="opponents"><!-- 1–3 .opponent --></div>
      <div class="pile-zone">
        <div class="draw-pile"><!-- card backs + count --></div>
        <div class="discard-pile"><!-- top card(s) --></div>
        <span class="color-burst"></span>
      </div>
    </div>
    <div class="hand"><!-- 1–N .card.{color} --></div>
    <button class="uno-call hidden">UNO</button>
  </main>

  <div class="overlay overlay-title hidden">...</div>
  <div class="overlay overlay-setup hidden">...</div>
  <div class="overlay overlay-color-picker hidden">...</div>
  <div class="overlay overlay-curtain hidden">...</div>
  <div class="overlay overlay-pause hidden">...</div>
  <div class="overlay overlay-round-end hidden">...</div>
  <div class="overlay overlay-match-end hidden">...</div>
  <div class="overlay overlay-howto hidden">...</div>
</div>
```

Overlay-div pattern from Pac-Man's `ui.js`. One overlay visible at a time. `showOverlay(id)` toggles `.hidden`.

### Card factory (single function)

```js
function renderCard(card, opts) {
  // Returns a <div class="card {color} {opts.classes}"> matching design-preview.html
  // opts.classes: 'playable', 'dimmed', 'selected', 'flying'
  // opts.tabIndex: 0 for in-hand, -1 for pile/opponent
  // For action cards, swaps numeral for inline <svg><use href="#g-{value}"/></svg>
}
```

### Animation orchestration — `applyEvents(events)`

Each event maps to a CSS class manipulation on the relevant DOM nodes:

| Event | DOM action | Cleanup |
|---|---|---|
| `card-played` | `.flying` class on source card; transitionend → remove from hand DOM, add to discard DOM | Auto via `transitionend` |
| `card-drawn` | `.flying` class on N synthesized card backs from draw pile to hand, staggered 80ms | Auto |
| `wild-color` | `.color-burst.fire` class on burst element; CSS var `--current-color` updates | 600ms timeout |
| `reverse` | `.reverse-sweep` class on table | 600ms timeout |
| `skip` | `.skip-jolt` class on skipped opponent | 240ms timeout |
| `uno-called` | `.uno-pip` element appended to player avatar, animated | Persists until next round |
| `curtain-up` | `.overlay-curtain` shown with player name; tap dismisses | User action |

Animations are non-blocking — `applyEvents` returns immediately. The state machine waits for animation completion via `setTimeout(advanceTurn, ANIM_DURATION)`.

### Reduced-motion variant

If `matchMedia('(prefers-reduced-motion: reduce)').matches`, animations skip:
- No `.flying`; cards teleport.
- No `.color-burst` flicker.
- Curtain wipe reduced to opacity fade only.

Still passes site-wide `styles.css` reduced-motion handling.

---

## 9. Input Layer

### Routing

| Source | Action |
|---|---|
| Click on `.card.playable` in hand | `onCardClick(cardIndex)` |
| Click on draw pile | `onDrawClick()` |
| Click on UNO button | `onCallUno()` |
| Click on color-picker quadrant | `onColorPick(color)` |
| Click on menu button / Esc | `onMenu()` |
| Keyboard arrow ←/→ | move hand cursor (input-internal state) |
| Keyboard Enter / Space | `onConfirm()` (= play focused card) |
| Keyboard D | `onDrawClick()` |
| Keyboard U | `onCallUno()` |
| Keyboard 1–9 | jump cursor to card index |
| Gamepad D-pad ←/→ | move cursor |
| Gamepad A | `onConfirm()` |
| Gamepad B | `onDrawClick()` |
| Gamepad X | `onCallUno()` |
| Gamepad Y | `onMenu()` |
| Touch tap | same as click |
| Touch long-press on card | peek-zoom (render-internal) |

### Slot binding (couch mode)

Couch mode reuses Pac-Man's binding model:
- `slots[0..N-1]` map to `{ kind: 'keyboard', scheme }` or `{ kind: 'gamepad', index }`.
- Setup screen has a "press a key / button to bind seat N" flow per Pac-Man precedent.
- Solo mode: slot 0 is auto-bound to "keyboard + mouse + touch + gamepad-0", others are AI.

### Gamepad poll lifecycle

- `init()` — registers `SharedGamepad.init({ onConnect, onDisconnect })`.
- `poll()` — called only when at least one gamepad is bound; runs `requestAnimationFrame` loop.
- `teardown()` — stops poll, `SharedGamepad.teardown()`.

**No global rAF.** This is a hard requirement to keep the game battery-friendly.

---

## 10. Audio Layer

Direct port of Pac-Man's audio architecture, simplified:

- `ensure()` lazily creates `AudioContext`, fires parallel `fetch` for all 16 samples into a `buffers{}` map.
- `play(name)` creates a fresh `AudioBufferSourceNode`, connects to `master → destination`.
- `setMuted(m)` flips `master.gain.value` between 0 and `volumeLevel`.
- `syncEvents(events)` — single switch on event type, maps to sample names:

```js
syncEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'card-played':
        play('card-thwip', { delay: 0 });
        play('card-thock', { delay: 220 });           // hit-pause
        if (ev.card.value === 'reverse')   play('scratch-reverse', { delay: 240 });
        if (ev.card.value === 'skip')      play('thunk-skip',     { delay: 240 });
        if (ev.card.value === 'draw2')     play('sting-draw2',    { delay: 240 });
        if (ev.card.value === 'wild4')     play('sting-draw4',    { delay: 240 });
        if (ev.card.color === 'wild')      play('chime-wild',     { delay: 240 });
        break;
      case 'card-drawn':   play('card-draw');     break;
      case 'uno-called':   play('stinger-uno');   break;
      case 'round-end':    play('fanfare-round'); break;
      case 'match-end':    play('cheer-match');   break;
      // ...
    }
  }
}
```

### Mute persistence

Single localStorage key: `uno_muted` ('0' | '1'). Read at boot, written by mute toggle in pause overlay. Same pattern as Pac-Man's `pacman.muted`.

### CC0 sourcing (deferred to implementation)

Sample list above is the contract. Implementation pulls from:
- Kenney UI Audio Pack (CC0) — menu sounds.
- OpenGameArt CC0 playing-card pack — card SFX.
- Web Audio synth — wild chime (1 oscillator, 600ms decay, sweep 440→880Hz).

If a sample isn't available, `play()` no-ops silently — Pac-Man pattern.

---

## 11. Persistence

### localStorage keys

| Key | Type | Purpose |
|---|---|---|
| `uno_muted` | `'0'` \| `'1'` | Audio mute state |
| `uno_save_v1` | JSON | Mid-round snapshot (full state) |
| `uno_high_v1` | JSON | High-score record |
| `uno_seen_tutorial_v1` | `'1'` | First-run tutorial dismissed |
| `uno_settings_v1` | JSON | Reduced-motion override, default rules toggles |

### Save protocol (save-on-pagehide)

```js
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.phase !== 'TITLE' && state.phase !== 'MATCH_END') {
    localStorage.setItem('uno_save_v1', JSON.stringify(state));
  }
});
window.addEventListener('beforeunload', sameHandler);
```

**Couch-mode caveat:** mid-round save is solo-only. Couch mode discards on tab close — exposing one player's hand to another via localStorage scrape is the reason. Keep it simple: solo saves, couch doesn't.

### Resume protocol

1. On page load, check `uno_save_v1`.
2. If present and `state.config.mode === 'solo'`, show "Continue" CTA on title screen with timestamp.
3. On Continue → `state = JSON.parse(...); render(state)`.
4. On New Game → `localStorage.removeItem('uno_save_v1')`.
5. Save older than 7 days → silently discarded.

### High score record

```js
{
  fastestRound: { ms: 187432, date: '2026-04-25', winnerName: 'You' },
  longestStreak: { count: 7, date: '2026-04-22' },
  biggestHaul: { points: 152, date: '2026-04-19', cardsLeft: 12 },
  totalRoundsWon: 47,
  totalRoundsPlayed: 89,
}
```

---

## 12. Build Order

The implementation phase walks this list top-to-bottom. Each step ends with a checkpoint runnable in the browser.

| # | Step | End-state checkpoint |
|---|---|---|
| 1 | Move `design-preview.html` → `docs/design/uno-preview.html`. | Preview survives at non-served path. |
| 2 | Create `games/uno/index.html` with the lifted CSS + empty `.uno-root` shell. Script tags for all 5 .js files in order: shared/gamepad → audio → input → ai → render → game. | Loads with no JS errors; shows nothing yet. |
| 3 | `audio.js` stub — exports `UnoAudio` with no-op functions. | Console clean. |
| 4 | `render.js` — title screen overlay + card factory. | Title renders; clicking PLAY does nothing. |
| 5 | `game.js` — state shape, deck builder, shuffle, deal. Wire title → setup → dealing. | Title → Setup → Dealing → first round renders with 7-card hand. |
| 6 | `game.js` — `isPlayable` + `playCard` for number cards. Click hand card → fly to discard. | Solo round playable for number cards (all bots no-op). |
| 7 | `ai.js` — easy bot that plays first legal card or draws. Wire AI turn timing. | Full solo round playable; bots cycle. |
| 8 | `game.js` — action cards (skip, reverse, draw2). | Round runs end to end. |
| 9 | Wild + color picker modal (`AWAITING_COLOR` phase). | Wild plays correctly. |
| 10 | UNO window + auto-catch from bots. | UNO call mechanic works. |
| 11 | `audio.js` real implementation — wire SFX to event types. | Card slap sounds right. |
| 12 | `input.js` — keyboard + gamepad. | Hand cursor + gamepad play work. |
| 13 | Round-end + match scoring + match-end overlays. | Full match playable. |
| 14 | `ai.js` — Normal + Hard difficulty heuristics. | Difficulty toggle works. |
| 15 | Couch mode — slot binding, hot-seat curtain. | 4-human round playable on one device. |
| 16 | Persistence — mute, save/resume, high scores, tutorial. | Refresh restores; mute persists. |
| 17 | Mobile portrait styling pass. | Plays at 375×812 viewport. |
| 18 | Reduced-motion verification. | Toggle in OS settings → animations skip. |
| 19 | Add to gallery: `games/index.html` card. | Linked from `/games/`. |
| 20 | Chrome DevTools MCP test sweep (per CLAUDE.md). | All checks green. |
| 21 | Commit + update [ADR-017](adr/017-uno.md) status to "Implemented". | Done. |

Each step in 1–10 is roughly a one-session unit of work. Step 11 onward is shorter.

---

## 13. Testing Checklist (Chrome DevTools MCP, per CLAUDE.md)

Per session, after any meaningful change:

- [ ] `navigate_page` → `http://localhost:3003/games/uno/`
- [ ] `wait_for` "PLAY" (title screen text)
- [ ] `take_snapshot` — confirm `.overlay-title` is the only visible overlay
- [ ] `take_screenshot` (fullPage) → save to `docs/screenshots/uno-{step}.png`
- [ ] `list_console_messages types:["error"]` — must be empty
- [ ] `list_network_requests` — confirm zero Firebase, zero 4xx/5xx
- [ ] Click PLAY → `wait_for` "Solo" or "Couch"
- [ ] Click Solo → `wait_for` opponent count
- [ ] Click Start → `wait_for` "DECK"
- [ ] Click first playable card → confirm hand size decremented + discard updated
- [ ] `resize_page` 375×812 (portrait) → re-screenshot
- [ ] Confirm hand fan reflows
- [ ] `emulate` reduced motion → verify animations skip

### Round-trip smoke test

A scripted sequence that plays a full round end-to-end:

1. Setup solo, 1 AI on Easy.
2. Play any legal card from hand.
3. Wait for AI turn (use `wait_for` on direction arrow flip).
4. Repeat until round ends.
5. Assert: round-end overlay appears; clicking "Next round" returns to dealing.

Implementation should add this as a smoke script in `docs/screenshots/uno-smoke.md` notes.

---

## 14. Edge Cases & Recommended Defaults

| # | Edge case | Default |
|---|---|---|
| 1 | First card flipped is a Wild | Reshuffle, redraw initial discard (Mattel rule) |
| 2 | First card flipped is action card | Apply effect to player 0 (Mattel rule) |
| 3 | Draw pile exhausted mid-game | Reshuffle discard sans top card; Wilds revert to colorless |
| 4 | Discard has only Wilds when reshuffle needed | Round ends in draw; no points awarded |
| 5 | Player goes out on action card | Effect applies to next player; round ends after; effect counts toward winner's score |
| 6 | Stacking +2 onto +4 (cross-stack) | NOT allowed in default rules |
| 7 | Drawing the card you can play (drawThenPlay ON) | UI shows "Play it?" inline button next to the just-drawn card; 4s window |
| 8 | UNO declared too early (3+ cards) | Allowed; declaration carries to when count actually drops |
| 9 | Multiple opponents fire `catchMissedUno` simultaneously | First-write-wins; subsequent ones rejected as `'already-caught'` |
| 10 | All 4 players are AI (degenerate setup) | Allowed; auto-plays as a demo, "Watch" mode |
| 11 | Player closes tab during AWAITING_COLOR | Save excludes pending modal; on resume, replay last play, color picker reappears |
| 12 | Reverse in 2-player game | Acts as Skip; same player goes again |
| 13 | Player has 1 card but it's not playable | UNO declaration still required; can be caught |
| 14 | Match-target reached mid-round | Round still completes; match-end overlay deferred until round-end |
| 15 | Couch mode with mismatched gamepad indices on reconnect | Per ADR-016: orphan map + manual re-claim button |

---

## 15. Open Questions / Deferrals

These do not block implementation; flag them in the implementation PR as items to revisit.

1. ~~**CC0 sample sourcing.** Sample list is locked; sourcing is not. First implementation step that touches `audio.js` should pick + license-document the actual files. If any required SFX has no good CC0 source, fall back to Web Audio synthesis.~~ **Resolved 2026-04-25:** Went all-in on Web Audio synthesis. All 15 sounds are procedural in [games/uno/audio.js](../games/uno/audio.js) — no external samples, no licensing risk, zero asset weight, fully tunable per-call. The graphic-poster aesthetic suits chunky synth better than recorded samples anyway. `UnoAudio.testAll()` plays every sound 1s apart for tuning.
2. **Tutorial overlay copy.** ADR §6 says "3-step coach overlay" — exact wording is implementation-time copy work, not an architecture decision.
3. **Bot names + avatars.** Need a small pool of friendly bot names + emoji avatars. Implementation should ship with ~8 names ("Mom", "Dad", "Sis", "Bro", "Gran", "Pop", "Aunt Jay", "Doc") and emoji-glyph avatars (no images per the cards-as-DOM principle).
4. **Help / how-to-play card legend.** Modal content is design + copy work. Architecture leaves the overlay slot empty.
5. **Speedrun timer (ADR §10 #7 — "ship").** Doesn't appear in this blueprint because it's a UI element + a `state.timerStartMs` field. Add in step 13 alongside match-end overlay.
6. **"Closest you got" failure-mode gift (ADR §10 #13 — "ship").** Compute from the would-have-played card after each loss; show on round-end overlay. Add in step 13.
7. **Idle attract title animation** (ADR §10 #14). Pure CSS in `index.html`; matches design-preview. Add in step 4.

---

## 16. Architecture Decision (final, per CLAUDE.md template)

```
Architectural Decision: Build Uno per this blueprint

DRY:   Reuses SharedGamepad (no extension needed — verified buttons exist).
       Reuses Pac-Man's audio architecture wholesale.
       Reuses Jeopardy's switch-on-state UI dispatcher.
       Reuses Chess's DIFFICULTY_CONFIG capability-flag pattern.
       Does NOT extract a localStorage helper (still only 4 games using it
       independently — DRY threshold not crossed).
YAGNI: No modes.js (one mode enum suffices).
       No ui.js (game.js owns bootstrap; event-driven not loop-driven).
       No SharedGamepad changes.
       No Firebase. No daily-seed UI. No replay system.
SOLID: game.js owns rules + state; ai.js consumes UnoGame as a pure interface;
       render.js mutates DOM only; input.js routes events only;
       audio.js owns Web Audio only.
KISS:  Six files. Visual contract = design-preview.html lifted verbatim.
       Save-on-pagehide. One canonical state object. Pure-function rules.
       No abstractions invented for hypothetical future requirements.

Decision: Proceed.
```

---

## 17. Handoff to Implementation

Implementation phase consumes this blueprint **and** [docs/design/uno-preview.html](design/uno-preview.html) (after the move in step 1).

The implementation engineer (or autonomous coding loop) should:

1. Read this blueprint.
2. Read [ADR-017](adr/017-uno.md).
3. Open the design preview in browser to internalize the visual contract.
4. Walk the build-order table (§12) one row at a time, checkpointing each.
5. Treat the line-count budgets as red flags — if a file blows them, stop and extract.
6. Update [ADR-017](adr/017-uno.md) status to "Implemented" only after the test sweep (§13) passes.

**Implementation is intentionally not started in this pass.** Per the user's brief: "Code snippets are illustrative; do NOT write the production game code yet — that's a follow-up implementation phase."

---

*Blueprint complete. Ready for implementation kickoff on user signal.*
