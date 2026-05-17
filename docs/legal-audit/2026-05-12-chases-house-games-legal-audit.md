**PRIVILEGED & CONFIDENTIAL**

*Attorney-Client Communication / Attorney Work Product*

**LEGAL AUDIT MEMORANDUM**

*chases.house / games — IP, Privacy, Accessibility & Public-Facing Disclosures*

|                |                                                     |
| -------------- | --------------------------------------------------- |
| **To**         | Chase House, Owner/Operator, chases.house           |
| **From**       | Outside Counsel — Internet, IP & Privacy Practice   |
| **Date**       | May 12, 2026                                        |
| **Re**         | Written audit of chases.house/games/                |
| **Engagement** | Limited-scope: audit memo + public-facing templates |
| **Status**     | Audit deliverable — final                           |

*This memorandum is prepared at the request of the recipient under conditions of expected legal engagement. It is intended to be privileged and confidential and to constitute attorney work product. It is not to be circulated outside the recipient's organization (such as it is) without counsel's consent. Privilege attaches upon execution of a written engagement letter.*

**I. Executive Summary**

We have completed a written legal audit of the Games section of chases.house, focused on the nine scope areas set out in the request. The site is a non-commercial static personal website; the Games section publishes eleven browser-only games, one of which (Jeopardy) uses Firebase Realtime Database for multiplayer state. There is no backend, no user account system, no payments, and no analytics scripts. The site is hosted on GitHub Pages with a custom domain.

Below is the headline risk summary. Detail and remediation by scope area follow in Sections II–IV; per-game IP analysis is in Appendix A; drafts of public-facing legal pages are delivered as separate HTML files under /legal/ for deployment to the site.

**Headline Findings**

|        |                                                                                                                                                                                                                                                                     |              |                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| **\#** | **Finding**                                                                                                                                                                                                                                                         | **Severity** | **Headline action**                                                      |
| 1      | Pac-Man (games/pacman/): direct use of registered mark + protected character + named ghost characters (Blinky/Pinky/Inky/Clyde) + maze evocative of Bandai Namco protected work. Bandai Namco actively enforces; this is the single highest-risk asset on the site. | **CRITICAL** | Take offline within 48 hours; rename + redesign or do not republish.     |
| 2      | Jeopardy (games/jeopardy/): direct use of registered mark, iconic blue grid + dollar-cell layout (arguable trade dress). Jeopardy Productions / Sony enforces.                                                                                                      | **HIGH**     | Rename and redesign within 30 days; keep mechanics.                      |
| 3      | Yahtzee (games/yahtzee/): direct use of registered mark; "Yahtzee" scoring row uses the mark in product naming.                                                                                                                                                     | **HIGH**     | Rename within 30 days; rename "Yahtzee" row to "Five of a Kind."         |
| 4      | No Privacy Policy, Terms of Use, Accessibility Statement, or DMCA agent published.                                                                                                                                                                                  | **MEDIUM**   | Publish drafts (Appendix B / HTML files) within 7 days.                  |
| 5      | Google Fonts loaded from fonts.googleapis.com (visitor IP transferred to Google without consent). Known privacy-claim vector under EU case law.                                                                                                                     | **MEDIUM**   | Self-host all fonts within 30 days.                                      |
| 6      | Firebase room data retained indefinitely; no documented retention policy.                                                                                                                                                                                           | **MEDIUM**   | Auto-delete rooms after 24h via scheduled Cloud Function within 30 days. |
| 7      | Crossword (games/crossword/): clue provenance not yet verified. If any clues sourced from NYT/USA Today/other publishers, those are copyrighted expression.                                                                                                         | **UNKNOWN**  | Audit puzzles.js within 14 days; replace any copied clues.               |
| 8      | Connect Four naming vs. Hasbro "CONNECT 4®" mark (descriptive use; modest risk).                                                                                                                                                                                    | **LOW**      | Rename to "Four in a Row" or add disclaimer within 30 days.              |
| 9      | Chess engine provenance not attested. If any Stockfish-derived data is included, GPL-3.0 copyleft attaches.                                                                                                                                                         | **LOW**      | Add provenance comment in code within 30 days.                           |
| 10     | Accessibility gaps (color contrast on muted text, canvas-game ARIA, Jeopardy buzzer audio visual alternative).                                                                                                                                                      | **LOW**      | Address visible gaps within 60 days.                                     |
| 11     | COPPA: site is not "directed to children" under FTC multi-factor test; some games may attract minors. "Actual knowledge" branch dormant.                                                                                                                            | **LOW**      | Add "Children Under 13" clause to Privacy Policy.                        |
| 12     | GDPR/UK-GDPR Art. 3(2) targeting: likely not triggered (no EU-targeting indicators). CCPA: well below all three thresholds.                                                                                                                                         | **LOW**      | Defensive Privacy Policy at GDPR-equivalent standard.                    |

The remediation sequence in Section IV breaks the above into a 48-hour / 7-day / 14-day / 30-day / 60-day / 90-day plan that any single operator can execute without further counsel involvement, subject to the audit items flagged.

**II. Scope-by-Scope Analysis**

**(1) Children — COPPA**

**Applicable law.** Children's Online Privacy Protection Act (COPPA), 15 U.S.C. §§ 6501–6506; FTC implementing rule, 16 C.F.R. Part 312. The rule was significantly amended in 2013 to expand the definition of "personal information" to include persistent identifiers and geolocation.

**Threshold.** COPPA reaches an operator that (a) runs a website or online service "directed to children" under 13, or (b) has "actual knowledge" it is collecting personal information from a child under 13. "Personal information" under 16 C.F.R. § 312.2 expressly includes name, online contact information, screen names that function as online contact information, persistent identifiers (cookies and IP addresses), photo/video/audio of the child, and geolocation.

**Whether the site is "directed to children."** The FTC applies a multi-factor test (16 C.F.R. § 312.2; 78 Fed. Reg. 3972, 3987 (Jan. 17, 2013)): subject matter, visual content, audio content, language, child-oriented activities and incentives, animated characters, age of models, child-celebrity use, child-directed advertising, and competent reliable empirical evidence regarding the actual audience.

Applying the test to chases.house/games/:

  - Subject matter: classic puzzle, strategy, and arcade games. Some (Tic-Tac-Toe, Pac-Man-style) appeal to children but are not exclusively child-directed. Chess, Sudoku, Jeopardy-format trivia, and Yahtzee skew older/general-audience.

  - Visual content: dark, design-tokened aesthetic (gold/ember on near-black) using a serif display face (Fraunces). Not styled or colored for young children.

  - Language: literate-adult English; no infantile vocabulary, mascots, or animated friendly-character branding.

  - Audio: minimal, mostly synthesized cues; Castle Tower Defense uses orchestral/ambient BGM.

  - No advertising, no incentives directed at children, no animated brand characters.

**Conclusion on "directed to children."** On balance, the site is best classified as *general audience,* not directed to children. This conclusion is supportable under the FTC's multi-factor test and is consistent with how analogous personal-hobby game pages are typically classified.

**"Actual knowledge" branch.** Even if the site is general-audience, COPPA still attaches if you have actual knowledge of collecting personal information from a specific child under 13. The mitigations below close this branch without triggering it.

***Data-point analysis***

  - **Display names (free text).** Not "screen name" under COPPA unless the name functions as online contact information (e.g., a chat handle that routes inbound messages to the user). Jeopardy display names are session-scoped, displayed only inside one ephemeral room, and cannot be used to contact the user. Not COPPA personal information standing alone.

  - **Room codes (4 letters).** Random; not personal information.

  - **Claim tokens (8 hex chars).** Generated client-side; persistent within the room session only; do not persist across rooms. Not COPPA personal information.

  - **Firebase server-side IP logs.** Persistent identifier under 16 C.F.R. § 312.2(7). Would be COPPA personal information if the user is under 13. But the operator does not access or process these logs; Google does, and the operator's relationship with Firebase is governed by Google Cloud / Firebase data processing terms. Operator-side COPPA exposure is correspondingly limited.

***Posture and minimum-footprint mitigation***

1.  Publish a Privacy Policy stating: the site is not directed to children under 13; the operator does not knowingly collect personal information from children under 13; if a parent learns that their under-13 child has provided personal information, they can email chasej.house@gmail.com to request deletion. (Drafted in Appendix B.)

2.  **Do not implement a hard age gate.** Age gates create "actual knowledge" exposure for users who lie, and the FTC has indicated that obviously child-attractive content cannot be "rescued" from COPPA by a gate. See generally U.S. v. Kurbo, Inc. & WW Int'l, Inc., No. 1:22-cv-01287 (N.D. Cal.) (consent decree, 2022).

3.  Implement the Firebase 24-hour auto-delete (see Section II(7)). This both shortens any COPPA "collection" window and forecloses lingering data retention.

**Risk classification:** *LOW with the mitigations above.*

**(2) GDPR / UK-GDPR / CCPA**

***GDPR — extraterritorial reach (Art. 3(2))***

Article 3(2) of the GDPR reaches a controller outside the Union if processing relates to (a) the offering of goods or services to data subjects in the Union, or (b) the monitoring of their behaviour within the Union.

EDPB Guidelines 3/2018 on the territorial scope (final version, November 2019) interpret Art. 3(2)(a) as requiring that the controller *envisage* the offering of services to data subjects in the Union. Mere accessibility of a website from the EU is *not* sufficient. Indicators of targeting include: language, currency, EU-specific delivery options, mention of EU customers, country-specific top-level domain, and the like.

Applied to chases.house:

  - .house gTLD with no geographic association.

  - English-language content; no EU-language localization; no EU references.

  - No payments, currency selector, advertising, or EU-targeted features.

  - No analytics, no marketing, no inbound traffic acquisition aimed at the EU.

**Conclusion on Art. 3(2)(a).** The site does not envisage offering services to EU data subjects. Targeting is not established.

**Conclusion on Art. 3(2)(b) (monitoring).** Firebase server-side IP logging during multiplayer play is incidental and not directed at EU users. "Monitoring of behaviour" within the meaning of Art. 3(2)(b) requires tracking activity that is *intended* to follow EU individuals. The threshold is not met.

***Defensive position***

Although Art. 3(2) likely does not bite, the marginal cost of drafting the Privacy Policy to a GDPR-equivalent standard is low and yields several benefits: (i) defensive posture if regulatory positions shift; (ii) clarity for any EU visitors who do play; (iii) consistency with reasonable best practice for any web operator collecting any user data. The draft policy in Appendix B is GDPR-grade.

***UK-GDPR***

Post-Brexit UK GDPR materially mirrors the EU GDPR for these purposes. ICO has not signaled an aggressive posture toward non-targeting personal sites. Same conclusion.

***CCPA / CPRA***

California Consumer Privacy Act (Cal. Civ. Code § 1798.140 et seq.), as amended by the CPRA, applies to a business that satisfies at least one of three thresholds: (i) annual gross revenue exceeding $25 million; (ii) annually buys, sells, or shares the personal information of 100,000 or more California consumers, households, or devices; or (iii) derives 50% or more of its annual revenue from selling or sharing personal information.

A non-commercial personal site falls well below all three thresholds. CCPA does not apply at current scale.

**Scale threshold to watch:** if the site ever begins commercial activity (advertising, sponsorship, paid features), and if California-resident visitors materially contribute to the 100,000-record threshold, CCPA could attach. The threshold for hobby traffic is unrealistic, but the operator should re-evaluate if the site is monetized.

**Risk classification:** *LOW. Recommendation: Privacy Policy drafted to GDPR-equivalent standard.*

**(3) ePrivacy / Cookie Consent**

Article 5(3) of the ePrivacy Directive *(Directive 2002/58/EC, as amended by 2009/136/EC)* requires consent for the storage of, or access to, information already stored in a user's terminal equipment, unless the storage or access is **strictly necessary** for the provision of an information society service explicitly requested by the user. The UK PECR implementation is materially identical.

***Storage in scope***

  - **Firebase authentication and database state (localStorage / IndexedDB).** This data exists only because the user joined a multiplayer room, which is the service they explicitly requested. It is strictly necessary for that service. The strict-necessity carve-out applies. No consent required.

  - **Google Fonts loaded from fonts.googleapis.com.** Not strictly necessary. The same typefaces can be served from the site itself via @font-face. Loading from Google's CDN transfers each visitor's IP address to Google. See LG München I, decision of 20 January 2022, Az. 3 O 17493/20, awarding damages against a site operator for unconsented Google Fonts loading; the decision is widely cited and has fueled demand-letter campaigns.

***Recommendation***

4.  **Self-host all fonts.** The site uses Fraunces, Bricolage Grotesque, Press Start 2P, Cormorant Garamond, Lora, Caveat, and IBM Plex Mono — all distributed under SIL Open Font License 1.1 (or Apache 2.0 for IBM Plex), which permits redistribution. Download via google-webfonts-helper.herokuapp.com, place under /fonts/, and serve via @font-face in styles.css.

5.  **No banner required** once fonts are self-hosted. All remaining first-party storage falls within the strict-necessity carve-out. Disclose in Privacy Policy / Storage Notice (Appendix B).

**Risk classification:** *LOW–MEDIUM. Remediation: 30 days.*

**(4) Accessibility — ADA / WCAG**

***Regulatory framing — clarification***

**The audit request cites 28 C.F.R. Part 35 (DOJ April 2024 final rule).** That rule implements ADA Title II and applies to state and local government services. It does *not* govern private operators. The relevant statute for private-sector websites is ADA Title III, 42 U.S.C. § 12182. There is, as of this writing, no DOJ Title III final rule for web accessibility; the matter remains a patchwork of circuit court interpretations.

**Splits among circuits:** The First, Second, and Seventh Circuits have applied Title III to websites without a physical-place nexus. The Third, Sixth, Ninth, and Eleventh have required some connection to a physical place of public accommodation. See, e.g., *Robles v. Domino's Pizza, LLC*, 913 F.3d 898 (9th Cir. 2019).

**Personal non-commercial site exposure.** Title III applies only to "places of public accommodation," which require operation as a commercial enterprise. A non-commercial personal site is not a public accommodation under any circuit's test. Substantive ADA exposure is *very low*. "Drive-by" demand letters do nonetheless target small operators; an accessibility statement and visible good-faith effort substantially dilute that nuisance risk.

***WCAG 2.1 AA spot-check***

Based on the site's design tokens and game architecture:

  - **Color contrast (SC 1.4.3).** Primary text \#f0e6d3 on background \#0a0a0b is \~14:1 (passes AAA). Muted text \#9a8e7a on \#0a0a0b is \~6.8:1 (passes AA). Faint text \#5c5347 on \#0a0a0b is \~3.4:1 — *fails AA for normal text*; passes AA only for large text (18pt+ or 14pt+ bold). Audit each use of var(--text-faint) and either enlarge or replace with --text-muted.

  - **Focus visible (SC 2.4.7).** Add explicit :focus-visible styling to interactive elements (game cells, buttons, nav). The site CSS does not currently appear to define focus rings.

  - **Keyboard operable (SC 2.1.1).** Chess, Sudoku, and Snake should be fully keyboard-traversable. Confirm. Pac-Man and Castle Tower Defense with gamepad/keyboard support likely meet this; verify Tab order and arrow-key handling.

  - **Programmatic state (SC 4.1.2).** Canvas-rendered games (Snake, Pac-Man, Castle Tower Defense) typically lack screen-reader-friendly state. Provide an aria-live region announcing turn/score updates for at least the turn-based games (Chess, Sudoku, Yahtzee, Connect Four).

  - **Audio alternatives (SC 1.2.2/1.2.3).** Jeopardy buzzer audio cues must have a visual alternative (a flash or pulse on the buzzer button when audio plays). Castle Tower Defense BGM must have a mute control.

  - **Reduced motion (SC 2.3.3).** The site already respects prefers-reduced-motion in styles.css. Good.

**Risk classification:** *LOW. Remediation: 60 days; publish Accessibility Statement (Appendix B) now.*

**(5) Game IP & Trademarks**

This is the centerpiece of the engagement. The full per-game classification is in Appendix A. Summary of the four headline assets:

  - **Pac-Man** — **CRITICAL.** Direct trademark use plus copyrighted character/maze/ghost-character work. Bandai Namco enforces. Pull within 48 hours; rename + redesign before republishing.

  - **Jeopardy** — **HIGH.** Direct trademark use plus blue-grid trade dress. Jeopardy Productions / Sony enforces. Rename and redesign within 30 days. Game mechanics are not protectable and may be retained.

  - **Yahtzee** — **HIGH.** Direct trademark use; "Yahtzee" used both as game title and as a scoring category. Hasbro enforces. Rename game ("Five Dice") and rename the scoring row ("Five of a Kind") within 30 days. The category names *Full House*, *Large/Small Straight*, *Chance*, and the like are descriptive of poker/dice gameplay and may be retained.

  - **Connect Four** — **LOW.** Hasbro markets "CONNECT 4®." "Connect Four" spelled out is arguably descriptive of the gameplay (connect four in a row). Risk is modest but non-zero. Recommend a rename to "Four in a Row" (cleanest), or retain the name with a footer disclaimer ("Not affiliated with Hasbro Inc.; Connect 4® is a registered trademark of Hasbro"). Either is defensible.

All other games (Tic-Tac-Toe, Checkers, Chess, Snake, Sudoku, Crossword pending clue-audit, Castle Tower Defense) present **LOW** IP risk. See Appendix A.

**(6) Third-Party Assets**

***Audio***

  - **Castle Tower Defense (Junkala SFX + Michalski BGM).** Both released CC0 (public domain dedication). No attribution legally required. Current attribution in games/castle-tower-defense/audio/LICENSE.txt is appropriate courtesy practice. No change.

  - **Jeopardy.** Synthesized cues at runtime; documented but unused CC0 drop-in slot. No exposure.

***Crossword clue and grid provenance — audit required***

The single open variable is the source of games/crossword/puzzles.js. Crossword clues are short text, but *compilations of clues paired with answers and grid placements* (i.e., a finished puzzle) are protected as creative compilations. NYT, USA Today, LA Times, Universal, and other major outlets aggressively pursue scrapers. If even one clue in puzzles.js is verbatim or paraphrased from a copyrighted puzzle, that creates copyright infringement exposure.

**Audit procedure (within 14 days):** For each puzzle in puzzles.js, confirm origin in a comment block — (a) generated programmatically from a word list, (b) written by the operator, or (c) sourced from a permissively-licensed dataset (e.g., XWordInfo's pre-1924 public-domain puzzles, or a Creative Commons crossword corpus). Strike any puzzle that cannot be sourced.

***Chess engine provenance***

Stockfish is GPL-3.0. Komodo and many other strong engines are proprietary. If your chess engine is an original alpha-beta + transposition-table implementation, no exposure. If you have included *any* Stockfish source, ported eval functions, NNUE network weights, or opening books from a GPL-licensed engine, the entire *games/chess/* subtree becomes a derivative work and the site must be distributed under GPL-3.0 terms (or removed). Recommended action: add a top-of-file comment in games/chess/engine.js: "Original implementation. Not derived from Stockfish, Komodo, or other GPL/AGPL chess engines." If that statement is not accurate, contact counsel before the next deploy.

***Fonts***

All site fonts are under SIL Open Font License 1.1 (Fraunces, Bricolage Grotesque, Press Start 2P, Cormorant Garamond, Lora, Caveat) or Apache 2.0 (IBM Plex Mono). Self-hosting is permitted under both licenses. No attribution required in user-facing pages; include the font license text under */fonts/LICENSE-OFL.txt* and */fonts/LICENSE-APACHE.txt*.

**Risk classification:** *LOW (audio); HIGH (potential) (crossword pending audit); LOW (chess pending attestation).*

**(7) Firebase Data Flow**

***Data categorization***

|                             |               |                            |                        |                                        |
| --------------------------- | ------------- | -------------------------- | ---------------------- | -------------------------------------- |
| **Data point**              | **Source**    | **GDPR Art. 4(1)**         | **CCPA § 1798.140(v)** | **COPPA 16 CFR § 312.2**               |
| Display name (free text)    | Player input  | Possibly PII (pseudonym)   | "Identifier"           | Not "screen name" — session-only       |
| Room code (4 letters)       | Generated     | Not personal data          | Not PII                | Not PI                                 |
| Claim token (8 hex)         | Generated     | Not personal data          | Not PII                | Not persistent identifier              |
| Scores / wagers             | Game state    | Linked to display name     | Linked to identifier   | Not PI                                 |
| Clue / category text        | Host input    | Not PII unless PII typed   | Not PII                | Not PI                                 |
| Buzz timestamps             | Game state    | Linked to display name     | Linked to identifier   | Not PI                                 |
| Client IP (Firebase server) | Firebase logs | Personal data (identifier) | "Identifier"           | Persistent identifier; PI if user \<13 |

***Retention policy — proposed***

Rooms auto-delete 24 hours after creation, or 1 hour after the host ends the game, whichever is later. Implementation via Firebase scheduled Cloud Function (runs hourly):

exports.cleanupRooms = functions.pubsub.schedule('every 1 hours').onRun(async () =\> { const now = Date.now(); const cutoff = now - 24 \* 60 \* 60 \* 1000; const snap = await admin.database().ref('rooms').once('value'); const updates = {}; snap.forEach(roomSnap =\> { const room = roomSnap.val(); if ((room.createdAt || 0) \< cutoff) updates\[roomSnap.key\] = null; }); if (Object.keys(updates).length) await admin.database().ref('rooms').update(updates); });

***DSAR / deletion workflow***

Because data is room-coded rather than account-coded, there is no persistent user record across sessions. A deletion request is meaningful only during the 24-hour retention window. The Privacy Policy (Appendix B) discloses this; the in-window deletion procedure is a single email to chasej.house@gmail.com with the room code, resulting in manual deletion within 7 days (in practice, the next-hour cleanup will handle it).

***Firebase project configuration in the public repo***

Confirmed: the apiKey published at games/shared/firebase.js is a public client identifier, not a credential. See Firebase's own documentation, *Best Practices for Using and Managing API Keys* (firebase.google.com/docs/projects/api-keys). The actual access-control boundary is Realtime Database security rules + HTTP-referrer restrictions configured in the GCP console.

**Verify the following:**

6.  Database security rules deny writes to /rooms/\* except by authenticated users (anonymous auth is acceptable). Rules should require the authenticated user's claim token to match the player's record for writes to that player's branch.

7.  GCP API restrictions for the web API key are set to HTTP referrer = `https://chases.house/*` (and any dev origin you use).

8.  Firebase Realtime Database access logs in GCP are reviewed periodically (this is for the operator's awareness only, not user disclosure).

**Risk classification:** *MEDIUM without retention policy; LOW with it.*

**(8) Public-Facing Artifacts**

|                               |             |                                                                                                                                                                       |
| ----------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Artifact**                  | **Status**  | **Reasoning**                                                                                                                                                         |
| Privacy Policy                | Required    | Reasonable expectation given Firebase data flow; required if GDPR/CCPA ever apply; defensive even if they do not. Draft delivered.                                    |
| Terms of Use                  | Recommended | Limitation of liability for user-entered content in Jeopardy (host categories, clues, display names); governing law clause; acceptable-use language. Draft delivered. |
| Accessibility Statement       | Recommended | Good-faith showing dilutes drive-by demand-letter risk; sets expectations for users with disabilities. Draft delivered.                                               |
| Storage / Cookies Notice      | Recommended | Folded into Privacy Policy as a "Storage" section; no separate banner needed once fonts are self-hosted.                                                              |
| DMCA Designated Agent         | Optional    | Register only if you want 17 U.S.C. § 512 safe harbor for host-entered Jeopardy content. Filing fee $6 / 3 years. Recommended if you intend to keep Jeopardy live.    |
| Children's Information Notice | Folded in   | Incorporated into Privacy Policy as a "Children Under 13" section per COPPA safe-harbor practice.                                                                     |

Drafts of the required and recommended artifacts are provided as deployable HTML files under /legal/ in the site repository. They use the site's design tokens (Fraunces / Bricolage Grotesque / dark theme) and read as written by the operator, not by counsel.

**(9) Jurisdictional Reach**

Three options:

|                                      |                                                                                                          |                                                                                                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Option**                           | **What it does**                                                                                         | **Trade-offs**                                                                                                                                                                                                             |
| A — Geofence US-only                 | Block non-US IPs at the edge (Cloudflare Workers or similar) with a polite "available in the U.S." page. | Removes GDPR exposure entirely. Highest implementation cost. Signals a deliberate targeting decision (you affirmatively chose to exclude the EU), which is mildly evidence-of-targeting if you later reverse the decision. |
| B — US-focused Terms, global access  | Don't block; in Terms, state US operation, US governing law, US-only forum-selection.                    | Low implementation cost. Mostly cosmetic — does not displace GDPR Art. 3(2) if the targeting test is independently met. We have concluded it is not, so the cosmetic effect aligns with substance.                         |
| C — High-standard policies, no fence | Write policies to GDPR-equivalent best practice; explicitly state US operation; serve everyone.          | Zero implementation cost beyond doc drafting. Defensive. Demonstrates good faith. Acknowledges global reach without conceding regulatory exposure.                                                                         |

**Recommendation: Option C.** Geofencing is disproportionate for a hobby site. The drafted Privacy Policy and Terms of Use (Appendix B) state US operation, US governing law (default to your state — Wisconsin if applicable), and US forum selection.

**Risk classification:** *LOW.*

**III. Remediation Plan (Sequenced)**

The findings above translate into a six-window remediation sequence. Each window is independently actionable; nothing depends on outside counsel sign-off beyond what is delivered with this memo.

|              |              |                                                                                                                                                                                                                                                                                                                         |
| ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Window**   | **Severity** | **Action**                                                                                                                                                                                                                                                                                                              |
| **48 hours** | **CRITICAL** | Take games/pacman/ offline. Replace with a 404 or a "Removed for redesign" placeholder. Remove any pacman link from games/index.html and the site nav.                                                                                                                                                                  |
| **7 days**   | **MEDIUM**   | Publish /legal/privacy.html, /legal/terms.html, /legal/accessibility.html (delivered drafts). Add a footer link from index.html and games/index.html to /legal/.                                                                                                                                                        |
| **14 days**  | **UNKNOWN**  | Complete crossword clue-provenance audit. Replace any sourced clues with original or public-domain content. Document the audit in docs/adr/.                                                                                                                                                                            |
| **30 days**  | **HIGH**     | (a) Rename + redesign Jeopardy; rename or fully replace the blue-grid trade dress. (b) Rename Yahtzee + rename "Yahtzee" scoring row to "Five of a Kind." (c) Self-host Google Fonts. (d) Implement Firebase room cleanup Cloud Function. (e) Rename or disclaim Connect Four. (f) Add Chess engine provenance comment. |
| **60 days**  | **LOW**      | Address WCAG 2.1 AA gaps: replace var(--text-faint) on dark with --text-muted (or enlarge); add :focus-visible styling; add aria-live regions to turn-based games; visual buzzer indicator in Jeopardy.                                                                                                                 |
| **90 days**  | **LOW**      | If retaining Jeopardy multiplayer with host-entered content, register DMCA designated agent with the U.S. Copyright Office (https://dmca.copyright.gov; $6 / 3 years). Add agent contact to Terms of Use.                                                                                                               |

**Appendix A — Per-Game IP Risk Classification**

Per-asset analysis. Trademark column covers registered marks and identifying source-marks; copyright/trade-dress column covers protected expression (audiovisual works, character design, distinctive look-and-feel). Risk column is calibrated to (a) the protectability of the asset under U.S. law, and (b) the rights-holder's known enforcement posture.

<table>
<tbody>
<tr class="odd">
<td><strong>Game</strong></td>
<td><strong>Trademark analysis</strong></td>
<td><strong>Copyright / trade-dress analysis</strong></td>
<td><strong>Risk</strong></td>
<td><strong>Recommended action</strong></td>
</tr>
<tr class="even">
<td><p><strong>Tic-Tac-Toe</strong></p>
<p><strong>games/tic-tac-toe/</strong></p></td>
<td>Generic / no registered mark.</td>
<td>Public-domain mechanic; no protectable expression in the standard 3×3 grid.</td>
<td><strong>LOW</strong></td>
<td>Keep as-is.</td>
</tr>
<tr class="odd">
<td><p><strong>Checkers</strong></p>
<p><strong>games/checkers/</strong></p></td>
<td>"Checkers" is generic in English. Hasbro markets a branded edition but does not own the name.</td>
<td>Public-domain mechanic; standard 8×8 board not protectable.</td>
<td><strong>LOW</strong></td>
<td>Keep as-is.</td>
</tr>
<tr class="even">
<td><p><strong>Connect Four</strong></p>
<p><strong>games/connect-four/</strong></p></td>
<td>Hasbro registered "CONNECT 4®." "Connect Four" spelled out is arguably descriptive of the gameplay; risk is modest but non-zero.</td>
<td>Mechanic unprotectable. Visual presentation (red + yellow checkers in a blue grid) is associated with Hasbro and should not be imitated verbatim.</td>
<td><strong>LOW</strong></td>
<td>Preferred: rename to "Four in a Row." Acceptable: keep "Connect Four" with footer disclaimer ("Not affiliated with Hasbro; Connect 4® is a registered trademark of Hasbro") and avoid the blue+red+yellow color scheme. Use the site's gold/ember palette.</td>
</tr>
<tr class="odd">
<td><p><strong>Chess</strong></p>
<p><strong>games/chess/</strong></p></td>
<td>Generic; no registered mark applicable.</td>
<td>Game public-domain. Engine implementation is original if attested. Stockfish-derived code or NNUE weights would create GPL-3.0 copyleft obligations; confirm provenance.</td>
<td><strong>LOW</strong></td>
<td>Add top-of-file provenance comment to engine module: "Original alpha-beta + transposition-table implementation. Not derived from Stockfish, Komodo, or other GPL/AGPL chess engines." If the statement is not accurate, recontact counsel.</td>
</tr>
<tr class="even">
<td><p><strong>Snake</strong></p>
<p><strong>games/snake/</strong></p></td>
<td>Generic; no registered mark on the name itself in the relevant arcade/games class. Nokia's branded "Snake" carries trade-dress associations only.</td>
<td>Public-domain mechanic; standard pixel-snake presentation not protectable.</td>
<td><strong>LOW</strong></td>
<td>Keep as-is. Avoid Nokia-style green-monochrome + segment count if you want to clearly distinguish.</td>
</tr>
<tr class="odd">
<td><p><strong>Sudoku</strong></p>
<p><strong>games/sudoku/</strong></p></td>
<td>"Sudoku" is generic in the U.S.; Nikoli holds a Japanese mark; no enforceable U.S. mark on the name.</td>
<td>Programmatically generated puzzles are non-infringing. The mechanic and 9×9 grid are not protectable.</td>
<td><strong>LOW</strong></td>
<td>Keep as-is.</td>
</tr>
<tr class="even">
<td><p><strong>Crossword</strong></p>
<p><strong>games/crossword/</strong></p></td>
<td>"Crossword" is generic.</td>
<td>Individual puzzles (clue/answer/grid compilations) are copyrighted by the creator. If puzzles.js contains any clues lifted from NYT/USA Today/LAT/Universal or similar, that is direct infringement.</td>
<td><strong>UNKNOWN</strong></td>
<td>Audit puzzles.js within 14 days. Each puzzle must be (a) generated programmatically, (b) written by the operator, or (c) sourced from a permissively-licensed corpus (pre-1924 PD puzzles, CC-licensed sets). Document audit in docs/adr/.</td>
</tr>
<tr class="odd">
<td><p><strong>Jeopardy</strong></p>
<p><strong>games/jeopardy/</strong></p></td>
<td>"JEOPARDY!" is registered (Jeopardy Productions, Inc., a Sony subsidiary) in multiple classes including games and interactive software. Direct trademark use.</td>
<td>Trade dress: the iconic blue grid with dollar-value cells is famous and arguably protected. The "answer in the form of a question" gameplay rule is not protectable; the visual presentation is.</td>
<td><strong>HIGH</strong></td>
<td>Rename within 30 days. Candidates: "Trivia Board," "$ Stakes," "Categories," "Answer &amp; Question." Redesign the grid to avoid the blue color scheme — use the site's gold/ember tokens. Keep mechanics (round structure, double-down, final). Add a disclaimer: "This game is inspired by classic American TV trivia formats; it is not affiliated with, endorsed by, or sponsored by Jeopardy Productions, Inc. or Sony Pictures Entertainment."</td>
</tr>
<tr class="even">
<td><p><strong>Pac-Man</strong></p>
<p><strong>games/pacman/</strong></p></td>
<td>"PAC-MAN®" is registered (Bandai Namco) in multiple classes worldwide. Bandai Namco operates an active enforcement program (cease-and-desist letters and DMCA takedowns documented on personal sites and itch.io projects).</td>
<td>The yellow-circle character with sector mouth, the maze layout, and the four named ghosts (Blinky, Pinky, Inky, Clyde) are protected as audiovisual works (Atari Games Corp. v. Oman, 888 F.2d 878 (D.C. Cir. 1989); and many subsequent cases recognizing the game's audiovisual copyright). Maze design is sufficiently original to be protected.</td>
<td><strong>CRITICAL</strong></td>
<td>TAKE OFFLINE WITHIN 48 HOURS. To republish: (i) rename (e.g., "Chomper," "Munchy Maze," "Dot Hunter"); (ii) redesign the character (different color, different shape — a square, triangle, or animal); (iii) rename the ghosts to non-evocative names; (iv) redesign the maze (different topology). Do NOT republish under any name with the yellow-circle character or the four named ghosts.</td>
</tr>
<tr class="odd">
<td><p><strong>Yahtzee</strong></p>
<p><strong>games/yahtzee/</strong></p></td>
<td>"YAHTZEE®" is registered (Hasbro, Inc.) in classes for games and software. Hasbro actively enforces.</td>
<td>Five-dice mechanic is not protectable. The compilation of scoring categories as a whole has been argued by Hasbro to be protectable expression; this is contestable but the cleanest path is to rename the game and rename the title-named scoring row.</td>
<td><strong>HIGH</strong></td>
<td>Rename game within 30 days ("Five Dice," "Roll &amp; Score," "Quintet"). Rename the "Yahtzee" scoring row to "Five of a Kind" (descriptive). Retain other category names (Full House, Large/Small Straight, Chance) — these are descriptive of the underlying dice-poker mechanic.</td>
</tr>
<tr class="even">
<td><p><strong>Castle Tower Defense</strong></p>
<p><strong>games/castle-tower-defense/</strong></p></td>
<td>"Tower defense" is a generic genre name; "Castle" is descriptive. No registered mark conflict.</td>
<td>Original gameplay and presentation. Third-party audio is CC0 with attribution maintained.</td>
<td><strong>LOW</strong></td>
<td>Keep as-is. Confirm /audio/LICENSE.txt remains in repo. No legal change required.</td>
</tr>
</tbody>
</table>

**Appendix B — Public-Facing Document Drafts**

The following drafts are delivered as deployable HTML files matching the site's existing design tokens (Fraunces / Bricolage Grotesque; dark theme; gold/ember accents). They live under /legal/ in the site repository. Each file is self-contained, has no external dependencies, and links back to the site header/footer.

  - **/legal/privacy.html** — Privacy Policy. Covers the Firebase data flow, 24-hour retention, storage/cookies, children-under-13, and operator contact.

  - **/legal/terms.html** — Terms of Use. Acceptable-use clause for Jeopardy host content; warranty disclaimers; limitation of liability; governing law (Wisconsin — update if your state differs); change-control clause.

  - **/legal/accessibility.html** — Accessibility Statement. Commitment to WCAG 2.1 AA, known gaps, contact for accessibility reports.

Each draft is presented in the operator's voice — as text the operator publishes about their own site — and is not styled as a counsel-drafted instrument. Replace operator-specific details (state of operation, contact email) where bracketed.

**DMCA designated agent:** if you elect to register, file at https://dmca.copyright.gov ($6 / 3 years). Use the following as the agent record (update with your physical address):

Designated Agent: Chase House Mailing address: \[your street, city, state, ZIP\] Email: chasej.house@gmail.com Telephone: \[your phone\] Service Provider: Chase House, operator of chases.house

Once registered, add the agent block to /legal/terms.html and notify counsel.

**IV. Closing**

This memorandum and the accompanying HTML drafts are the deliverables for the limited-scope engagement described in the audit request. They are intended as a single round of work — audit memo, per-game IP classification, and public-facing templates — and do not commit counsel to ongoing monitoring.

Litigation, regulatory response, and ongoing privacy program work are out of scope and will be re-engaged separately if needed. If a rights-holder demand letter is received with respect to any asset addressed in this audit, the appropriate next step is a short engagement extension to respond on the operator's behalf.

A 30-minute read-out call is available within the next two weeks at the operator's convenience.

*End of memorandum.*
