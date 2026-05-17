# Request for Legal Audit — chases.house/games/

**From**: Chase House &lt;chasej.house@gmail.com&gt;, owner/operator of chases.house
**To**: Outside Counsel (Internet / IP / Privacy practice)
**Date**: May 12, 2026
**Re**: Written legal audit of the Games section of chases.house
**Designation**: Privileged & Confidential — Attorney-Client Communication (upon engagement)

---

## 1. Purpose

We are requesting a written legal audit of the Games section of chases.house, a non-commercial personal website. The audit should cover privacy and data-protection compliance, accessibility, intellectual-property and trademark exposure across each individual game, and the public-facing legal artifacts the site currently lacks. We are looking for an honest risk classification per finding and concrete, minimum-footprint remediation we can implement ourselves once the audit is complete.

## 2. Background

chases.house is a static personal website hosted on GitHub Pages under a custom domain (`chases.house`). The site has no backend, no user accounts, no payments, no advertising, and no analytics scripts. The repository is public and contains no checked-in secrets.

The Games section at `chases.house/games/` currently publishes the following browser-only games. Each game is self-contained except Jeopardy, which uses Firebase Realtime Database for multiplayer state coordination (no email, no password, no PII intentionally collected — anonymous authentication only).

- Tic-Tac-Toe — solo vs. AI
- Checkers — solo vs. AI
- Connect Four — solo vs. AI
- Chess — solo vs. AI
- Snake — solo
- Sudoku — solo
- Crossword — solo
- Jeopardy — multiplayer over Firebase Realtime Database
- Pac-Man — solo, co-op, hunt, and 4-player royale modes
- Yahtzee — solo and pass-and-play hot-seat for 2–4
- Castle Tower Defense — solo, with CC0 third-party audio (Junkala, Michalski)

The site has no age gate. The games span a broad audience including likely minors. There is no Privacy Policy, no Terms of Use, no Cookie/local-storage notice, no DMCA designated-agent statement, and no Accessibility Statement currently published on the site.

## 3. Scope and Questions

Please address the following nine topics. The first column lists the topic; the second column states the specific question we want answered.

| # | Audit Topic | Question We Want Answered |
|---|---|---|
| 1 | Children — COPPA | The site has no age gate and the games (Tic-Tac-Toe, Sudoku, Pac-Man, etc.) are reasonably attractive to children under 13. Does the site's actual data handling — anonymous Firebase auth, free-form display names typed in by players, room codes, IPs logged by Firebase — fall within COPPA's "personal information" definition (16 CFR 312.2) such that verifiable parental consent is required? If yes, what is the minimum-footprint path to compliance — age gate, a children's-section carve-out, or a directed-to-children determination? |
| 2 | GDPR / UK-GDPR / CCPA | Given the site is globally reachable on the `.house` gTLD and the operator is in the United States, do GDPR Art. 3(2) (targeting EU data subjects) and UK-GDPR equivalents apply to Jeopardy's Firebase room data? Does CCPA/CPRA apply at this scale, and if not, at what point (revenue, household count, traffic) would it? What is the minimum-footprint privacy notice that satisfies all three? |
| 3 | ePrivacy & Cookie Consent | Firebase sets first-party authentication and database state in `localStorage` / IndexedDB; Google Fonts are loaded from `fonts.googleapis.com`. Are these subject to the ePrivacy Directive (Cookie Law) consent requirement, or do they fall within the "strictly necessary" exception for the multiplayer functionality the user requested? Is a cookie banner required, recommended, or optional given the site's purpose? |
| 4 | Accessibility (ADA / WCAG) | Under DOJ's April 2024 final rule (28 CFR Part 35) and the prevailing federal-court interpretation of ADA Title III for commercial websites, what is the exposure profile of a non-commercial personal site that publishes interactive games? Are the keyboard-driven games (Chess, Sudoku, Snake) and the gamepad-supported games (Pac-Man, Castle Tower Defense) likely WCAG 2.1 AA compliant out of the box, and where are the visible gaps — color contrast, focus indicators, ARIA labels, captions for the Jeopardy buzzer audio? |
| 5 | Game IP & Trademarks | Game-by-game trademark analysis is the centerpiece of this engagement. "Jeopardy!" is a registered trademark of Jeopardy Productions, Inc. (Sony). "Pac-Man" is a registered trademark of Bandai Namco. "Yahtzee" is a registered trademark of Hasbro. Chess, checkers, tic-tac-toe, connect four (although Hasbro markets "Connect 4"), sudoku, and crosswords are generally treated as games whose rules are not protectable but whose presentations may be. We need a per-game classification of trademark and copyright risk, including recommended renames or disclaimers where warranted. |
| 6 | Third-party assets | Audio: Castle Tower Defense bundles CC0 SFX from Juhani Junkala (OpenGameArt) and CC0 BGM from Phil Michalski; Jeopardy synthesizes all cues at runtime with a CC0 drop-in slot documented but unused. Crossword: per-puzzle clue and grid provenance needs verification. Chess: any opening-book or evaluation-table source (e.g., Stockfish-derived data) needs licensing review. Fonts: Google Fonts (Fraunces, Bricolage Grotesque, Press Start 2P, Cormorant Garamond, Lora, Caveat, IBM Plex Mono) loaded via `fonts.googleapis.com`. Are the current licenses sufficient, and are attribution placements adequate? |
| 7 | Firebase data flow | Jeopardy uses Firebase Realtime Database with anonymous authentication. We collect free-form player display names, room codes (4 letters), claim tokens (8 hex chars), per-player scores and wagers, and host-entered category/clue/answer text. Firebase will log client IPs on its side. The database has no documented retention policy and no DSAR workflow. We need a categorization of this data under each applicable regime (COPPA, GDPR Art. 4(1), CCPA §1798.140(v)) and a minimum-viable retention + deletion-on-request workflow. |
| 8 | Public artifacts | Currently none of the following exist on the site: Privacy Policy, Terms of Use, Cookie notice, DMCA designated-agent contact, accessibility statement, children's-information notice. Which are legally required at present, which are recommended, and which can wait? Please draft (or template) the required ones; we will fill in operator-specific details. |
| 9 | Jurisdictional reach | The `.house` TLD is a generic gTLD with no geographic restriction; the site is hosted on GitHub Pages (US infrastructure, primarily US-based CDN edges) and is globally accessible. Should we geofence to limit GDPR exposure, add a US-only notice in the Terms, or accept global jurisdiction and write the policies to the highest applicable standard? Trade-off analysis appreciated. |

## 4. Per-Game Inventory

A per-game classification of trademark and copyright risk is the most important single deliverable of this engagement. The current inventory is below; the "top question" column is our best guess at the headline issue per game and is intended to scope your analysis, not to constrain it.

| Game | Path | Why it's here | Top question |
|---|---|---|---|
| Tic-Tac-Toe | `games/tic-tac-toe/` | Classic public-domain game; minimax AI; no branded assets. | Confirm no IP exposure. |
| Checkers | `games/checkers/` | Classic public-domain game; alpha-beta AI. | Confirm no IP exposure. |
| Connect Four | `games/connect-four/` | Mechanic is unprotectable; "Connect 4" is a Hasbro trademark. | Is "Connect Four" safe vs. "Connect 4"? Should we rename? |
| Chess | `games/chess/` | Public-domain game; AI uses alpha-beta + transposition tables. Need to check any opening-book or evaluation-table provenance. | Confirm AI code is original; review any third-party tables. |
| Snake | `games/snake/` | Classic arcade; no Nokia / Gremlin branding used. | Confirm no IP exposure. |
| Sudoku | `games/sudoku/` | Puzzles generated programmatically; mechanic is unprotectable. "Sudoku" itself is not a registered US trademark (Nikoli abandoned). | Confirm no IP exposure. |
| Crossword | `games/crossword/` | Per-puzzle clue and grid provenance needs verification. If any clues are sourced from NYT, USA Today, or other publishers, those clues are copyrighted as expression. | Audit `puzzles.js` for clue origin and licensing. |
| Jeopardy | `games/jeopardy/` | "Jeopardy!" is a registered trademark of Jeopardy Productions, Inc. The category-grid format is iconic and arguably trade dress; the "think music" is licensed. Multiplayer uses Firebase. | Rename required? Disclaimer sufficient? Trade-dress risk of the blue grid? |
| Pac-Man | `games/pacman/` | "PAC-MAN" is a registered trademark of Bandai Namco; the character design, maze layout, and ghost characters (Blinky, Pinky, Inky, Clyde) are copyrighted. Bandai Namco actively enforces. The page title currently reads "Pac-Man - Chase's House" and uses the yellow PAC-MAN color scheme. | **This is the single highest-risk asset on the site. Rename, redesign, or pull?** |
| Yahtzee | `games/yahtzee/` | "YAHTZEE" is a registered trademark of Hasbro. The scoring categories (Yahtzee, Full House, Large Straight, etc.) form the gameplay expression and are arguably copyrightable as a compilation. | Rename to "Five Dice" / "Roll & Score"? Disclaimer sufficient? |
| Castle Tower Defense | `games/castle-tower-defense/` | Original gameplay; CC0 audio (Junkala + Michalski) with attribution. | Confirm attribution placement is adequate. |

## 5. Data Flows — What Firebase Stores

Only the Jeopardy game uses Firebase. The data flow is:

1. A host on a laptop or TV creates a room at `games/jeopardy/host.html`. A 4-letter room code is generated client-side. The host writes the initial room document to Firebase Realtime Database under `/rooms/<roomCode>/`.
2. Players join from their phones at `games/jeopardy/player.html?room=<code>`. Each player enters a free-form display name (no email, no phone). The player is signed in to Firebase anonymously (`signInAnonymously`) and writes their name + an 8-hex claim token to `/rooms/<roomCode>/players/`.
3. During play, the host writes board state, current clue, buzzer state, and scores; players write buzz events and answer text. All writes are gated by Realtime Database security rules.
4. Game ends. The room is currently retained indefinitely — no retention policy is enforced.

Notes on what Firebase observes server-side: client IP addresses are logged by Firebase as part of normal request handling and may be retained by Google under its own privacy terms. We do not surface or use these logs; they are accessible to us only via the Firebase / GCP console.

The Firebase project configuration is checked into the public repo at `games/shared/firebase.js`. This is consistent with Firebase's documented security model — the `apiKey` is a public client identifier, not a secret — but please confirm this assumption and the adequacy of HTTP-referrer restrictions + database rules as the access-control surface.

## 6. Public-Facing Artifacts — Current State

Please assess which of the following are required, recommended, or optional for this site, and draft (or template) the required ones:

- Privacy Policy — currently missing
- Terms of Use — currently missing
- Cookie / local-storage notice — currently missing
- DMCA designated-agent contact — currently missing
- Accessibility statement — currently missing
- Children's-information notice (COPPA) — currently missing

## 7. Materials We Will Provide

Upon engagement, we will share the following under a privileged communication:

| Item | Description |
|---|---|
| Site URL | `https://chases.house/games/` (live, no auth required) |
| Repository | Public GitHub repository containing the complete source for the site, including `games/` and per-game subdirectories. Access link to follow under separate cover. |
| Firebase project metadata | Project ID, current database rules, and a sanitized export of the room schema and a recent room document. No production user data will be shared. |
| Asset attribution files | `games/castle-tower-defense/audio/LICENSE.txt` and `games/jeopardy/audio/ATTRIBUTION.md` document current third-party audio provenance. |
| Architecture decision records | `docs/adr/` for context on how the games were built, including the Firebase security model (ADR-016). |
| Traffic snapshot | We do not currently run analytics. We can estimate traffic from GitHub Pages bandwidth reports if useful to the GDPR / CCPA thresholding analysis. |

## 8. Requested Deliverables

| Deliverable | Form |
|---|---|
| Privileged audit memo | Written memo, marked privileged and confidential, covering each of the nine scope items above with risk classification (Low / Medium / High / Critical) and a recommended remediation per finding. |
| Per-game IP classification | Game-by-game table covering trademark and copyright risk, recommended action (keep / rename / disclaim / redesign / pull), and rationale for each. |
| Public-facing documents | Drafts (or vetted templates) of: Privacy Policy, Terms of Use, Cookie/local-storage notice if required, DMCA designated-agent contact statement, Accessibility Statement. |
| Data retention recommendation | A concrete retention policy for Firebase Realtime Database room data (proposed window: hours-to-days post-game), with deletion procedure and DSAR / opt-out workflow scoped to the site's actual data set. |
| 30-minute review call | Brief read-out of the memo with opportunity for follow-up questions. |

## 9. Engagement Terms

| Term | Proposed |
|---|---|
| Engagement scope | Limited to the audit deliverables above. Litigation, regulatory response, and ongoing privacy program work are out of scope and will be re-engaged separately if needed. |
| Privilege | All work product to be designated attorney-client privileged and attorney work product. Mark each deliverable accordingly. |
| Fee arrangement | Open to either a fixed fee for the audit memo + templates or hourly with a not-to-exceed cap. Please propose both in your response. |
| Conflicts | Please confirm no conflict of interest. We do not anticipate adversity to Bandai Namco, Hasbro, Sony / Jeopardy Productions, or any clue-publisher, but please flag any prior representation that would limit your ability to advise on game-IP-rename strategies. |
| Communication | Email is fine. Please mark substantive emails "Privileged & Confidential – Attorney-Client Communication." |
| Requested turnaround | Initial scoping call within one week of engagement. Draft memo + templates within four weeks. Final deliverables within six weeks. Open to a longer timeline if the per-game IP analysis warrants it. |

## 10. Next Step

Please confirm interest, conflict-clearance, and a fee proposal by reply email. We can have the scoping call any time in the next two weeks.

Sincerely,

Chase House
Owner / Operator, chases.house
chasej.house@gmail.com

---

*This document is an audit request prepared by the site operator using internal tooling. It does not constitute legal advice and does not establish an attorney-client relationship. Privilege attaches upon formal engagement.*
