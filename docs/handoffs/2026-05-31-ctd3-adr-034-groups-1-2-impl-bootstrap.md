# Bootstrap — CTD3 ADR-034 Groups 1+2 implementation handoff

> **Type:** Pre-compaction self-bootstrap (AI-Hub `prompts/bootstrap/pre-compaction-self-bootstrap.md` decision-matrix row 1 — continuing the same session post-`/compact`).
>
> **How to use:** After `/compact`, paste the code block below back as the first message. It is self-contained — assumes nothing about what the compaction summary preserves.

---

```
You (Claude Code, this same session post-/compact) just compressed the chat at the end of a multi-hour ADR-synthesis turn. The next move is to IMPLEMENT ADR-034 Groups 1 + 2 — the minimum-shippable-subset that delivers the brand-cohesion win for Castle Tower Defense (CTD3) on chases.house. Read this entire brief before acting; everything you need is here, on disk, or one Read call away.

═══════════════════════════════════════════════════════════════════════
1. IDENTITY + ENVIRONMENT
═══════════════════════════════════════════════════════════════════════

- Workspace: c:\Users\chase\Projects\Chases House (static HTML/CSS/JS site, GitHub Pages, no build step).
- Target game: games/castle-tower-defense/ (3D Three.js tower defense, "CTD3").
- Git: branch main, last commit 071df5b ("docs: rename ADR-033 → ADR-034"). Clean tree expected when you resume. A concurrent session may be editing docs/adr/033-crawler-control-and-robots.md + CHANGELOG.md — DO NOT TOUCH those files; they belong to that session.
- Three.js: r170 (allows THREE.AgXToneMapping).
- Dev server pattern: `python -m http.server 3003` from repo root.

═══════════════════════════════════════════════════════════════════════
2. HARD CONSTRAINTS (durable, NEVER violate)
═══════════════════════════════════════════════════════════════════════

A. ASSET-IMMUTABLE (ADR-034 Decision C). DO NOT EDIT and DO NOT POST-LOAD-RETINT any of:
   - games/castle-tower-defense/assets/models/tower_*_t*.glb (Kenney / KayKit)
   - games/castle-tower-defense/assets/models/tile_*.glb, detail_*.glb (Kenney landscape)
   - games/castle-tower-defense/assets/models/enemy_*.glb (Kenney + Hyper3D Rodin)
   If you find yourself reaching for retintToBrand, HSL clamps, per-mesh color overrides on kit meshes, or Blender — STOP. The whole thesis of Groups 1+2 is "warm the world AROUND the kit, not the kit itself."

B. PUSH GATING. Never `git push` to main without an explicit operator "push" approval. Commit locally freely; do not push. Match the convention recently established (Phase 5 / Warden / Ranger flash / docs commits all waited for explicit push approval before going to remote).

C. BROWSER-VERIFY DISCIPLINE. Every UI-affecting change must be verified via chrome-devtools-mcp before pushing. For Group 2 specifically there is a concrete assertion list (§5 below). Don't claim "shipped" without running those.

D. MINIMUM-CHANGE DISCIPLINE. ADR-034 Groups 1 and 2 only. Do not bundle in "while I'm here" improvements for Groups 3-7 — those are sequenced for later and their values matter for the bisect log. Per CLAUDE.md: "A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper."

E. CABIN-IN-THE-WOODS PALETTE. Hard rule from .design-system/README.md: "No purple/violet, no neon, no cool blues. Everything should feel like fire, paper, wood, food, dusk, candlelight." The cyan Warden aura (post-Group-2 value 0x8fc6cf) is the SINGLE SANCTIONED EXCEPTION per ADR-034 Deliberate Decision A.

═══════════════════════════════════════════════════════════════════════
3. CANONICAL FILES (read these — they ARE the brief)
═══════════════════════════════════════════════════════════════════════

PRIMARY (read first):
- docs/adr/034-ctd3-ui-ux-remediation-v2.md           ← THE PLAN. 515 lines. Group 1, Group 2 (atmospheric), Decisions, Files Affected, Verification Plan. ~auth.
- docs/design/ctd3-atmospheric-grounding-three-js.md  ← THE Group 2 IMPLEMENTATION. 158 lines. AgX tone-map, prepWave/inWave preset tween, linear Fog(26,58), shader fireflies. Copy-paste each §A-§G code block where indicated. ~auth.

SECONDARY (consult as needed):
- .design-system/README.md                            ← Brand spec rationale + content tone. Especially the "Color" section + "No purple/violet" rule + cabin-window-as-finite-gold rule.
- .design-system/colors_and_type.css                  ← Canonical token VALUES. Group 1's whole job is making styles.css match this file byte-for-byte on names + values.
- .design-system/ui_kits/chases-house/                ← Reference component patterns if you need them.
- games/castle-tower-defense/styles.css               ← (does not yet exist as a separate file — most CTD3 styles are inline in index.html. Group 1 may touch index.html inline CSS rather than a separate styles.css. CHECK FIRST.)
- games/castle-tower-defense/scene.js                 ← Group 2 §C/D/F/G targets here.
- games/castle-tower-defense/lighting.js              ← Group 2 §B targets here (PRESETS.prepWave + PRESETS.inWave).
- games/castle-tower-defense/renderer.js              ← Group 2 §A targets here (tone mapping).
- games/castle-tower-defense/index.html               ← Group 2 §E targets here (#grounding + #vignette CSS overlays).
- docs/audits/2026-05-18-ctd3-ux-audit.md             ← TIER 2 + TIER 3 items. OUT OF SCOPE for this round (Groups 4-7 cover them). Skim for context only.

═══════════════════════════════════════════════════════════════════════
4. WHAT WAS DONE (so far, this session — preserved across compaction)
═══════════════════════════════════════════════════════════════════════

In-session commits already on main:
- bae9bac — ctd3: Phase 5 visuals (4 new enemy GLBs Juggernaut/Slime/MiniSlime/Ghost) + per-type animations in scene.js + Ghost translucency + latent armor bug fix in entities.js makeEnemy.
- 39cd0b3 — ctd3: Warden aura visibility (thicker ring + faint fill disc + cyan 0x6fd0e0). This value becomes 0x8fc6cf in Group 2 §G.
- d93925f — ctd3: Ranger muzzle-flash bleed fix (clonePerInstanceMaterials in scene.js syncTowers).
- 378f9ab — docs: add ADR-033 (since renamed to 034) + atmospheric spec + design-system snapshot (58 files, +3092/-2).
- 071df5b — docs: rename 033 → 034 + 4 cross-ref updates.

External state (operator manual tasks already done):
- Cloudflare cache for chases.house: PURGED (7 surgical URLs for the Phase 5 / Warden / Ranger commits).
- Firebase RTDB rules: PUBLISHED (ctd3-community block now live; Community map tab will work).

External state still pending the operator (do NOT drive these from here unless asked):
- chases.house deploy of any Group 1/2 commits will need a fresh Cloudflare purge (script: dashboard custom-purge with the touched URLs).
- After deploy + purge: browser-verify on the live origin.

═══════════════════════════════════════════════════════════════════════
5. WHAT TO DO NEXT — Groups 1+2 implementation
═══════════════════════════════════════════════════════════════════════

OVERALL ORDER:
  Group 1 (canon tokens + value corrections) → commit → push gate
  Group 2 (atmospheric reframe, applied in spec order B→C→D→E→A→F→G) → commit → push gate

──────────────────────── GROUP 1 ────────────────────────

Goal: align CTD3 CSS/JS token names + values with .design-system/colors_and_type.css.

Subtasks (see ADR-034 §Group 1 for the full table):
  i.   In styles.css (or whichever file holds the CTD3 dark-scope CSS — VERIFY where these CSS variables actually live; likely inline in games/castle-tower-defense/index.html):
       - Fix --text-muted: #9a8e7a → #9aa89a (lichen — current value is brown-on-pine, wrong).
       - Fix --text-faint: #5c5347 → #5a6a5e (deep moss — current value is brown-on-pine, wrong).
       - Set/fix --accent-glow → #f4cc6e.
       - Set/fix --sage → #7a9460.
       - Confirm --bg-deep / --bg-main / --bg-surface / --bg-elevated / --accent-gold / --accent-ember / --terracotta / --moss all match .design-system/colors_and_type.css byte-for-byte.
  ii.  Add a TOKENS block at the top of scene.js so per-effect colors elsewhere in scene.js reference TOKENS.X not raw hex literals (e.g., TOKENS.ACCENT_GOLD = 0xe8b75a, TOKENS.WARDEN_AURA = 0x8fc6cf, etc.). The full block list lives in ADR-034 §Group 1. Group 3 (future) will swap the per-effect call sites to TOKENS.X; Group 1 only ADDS the block — don't refactor call sites yet.
  iii. Pre-commit grep audit: ensure styles.css token VALUES match .design-system/colors_and_type.css for every shared name.

Acceptance:
  - grep finds no --text-muted: #9a8e7a or --text-faint: #5c5347 in the CTD3 stylesheet.
  - scene.js has a TOKENS const at the top.
  - No call sites refactored in Group 1 (those happen in Group 3, NOT this session).

Commit message convention (matches recent session pattern):
  ctd3: Group 1 — canon token block + styles.css value corrections (ADR-034)
  
  - Fix --text-muted #9a8e7a → #9aa89a (lichen) and --text-faint #5c5347 → #5a6a5e (deep moss) — wrong values vs .design-system canon.
  - Set/add --accent-glow #f4cc6e and --sage #7a9460.
  - Add TOKENS block at scene.js head so Group 3 can swap per-effect call sites to canonical names.
  
  No call-site refactor in this commit (Group 3 territory). No GLB changes (Decision C).
  
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

Then STOP. Ask operator for explicit "push" approval before pushing.

──────────────────────── GROUP 2 ────────────────────────

Goal: atmospheric reframe — warm the world around the kit-immutable towers/landscape. Drives the brand-cohesion fix that addresses Claude Design's headline "two games wearing different skins" finding.

CANONICAL IMPLEMENTATION: docs/design/ctd3-atmospheric-grounding-three-js.md is the drop-in spec. Read it in full before acting. Apply order (NON-TRIVIAL — tone mapping is dialed LAST after lights look right):

  B → lighting.js PRESETS (warm sun + sage-grey hemi; revives the dead prepWave→inWave tween)
  C → scene.js scene.background 0x1a2a20 + scene.fog = new THREE.Fog(0x1a2a20, 26, 58)
  D → scene.js ground plane material 0x3c5a38 + radial AO disc
  E → index.html #grounding behind-canvas + #vignette above-canvas CSS overlays
  A → renderer.js renderer.toneMapping = THREE.AgXToneMapping, exposure 1.06, outputColorSpace SRGBColorSpace
  F → scene.js shader-based fireflies module (initFireflies + tickFireflies), count 14, low-power cap 6, reduced-motion early return
  G → scene.js WARDEN_AURA_COLOR 0x6fd0e0 → 0x8fc6cf

Each step is a ~10-30 line edit. The spec doc contains the EXACT code for each — DO NOT improvise values. If the operator changes a value, log a v2.1 addendum.

Browser-verification recipe (run AFTER all 7 steps + reload):
  navigate to https://chases.house/games/castle-tower-defense/ (or http://localhost:3003/... if testing local)
  click BEGIN THE WATCH → click QUIET on plains
  evaluate_script() these assertions:
    - scene.background.getHex() === 0x1a2a20
    - scene.fog instanceof THREE.Fog (NOT FogExp2)
    - scene.fog.color.getHex() === 0x1a2a20
    - scene.fog.near === 26 && scene.fog.far === 58
    - renderer.toneMapping === THREE.AgXToneMapping
    - renderer.toneMappingExposure === 1.06
    - Visible Points in scene.children with 8-14 inclusive (6 if isLowPower())
    - Toggle prefers-reduced-motion: zero Points
  9-point HSL grid pixel sample (excluding tower-pixel zones):
    - ≥6 of 9 samples shift warmward vs baseline (H toward [15°, 50°])
  Manual visual check (matching docs/design/ctd3-atmospheric-grounding-three-js.md QA checklist):
    - Purple Mage/Warden cone tops read as dim plum, not neon
    - No hard black seam at the field edge (fog.color === bg.color)
    - Gold mage-tip / window-highlight still punches
    - Fireflies hover above the grass, never below
  Console: no errors. Network: GLB requests still 200.

Commit message convention:
  ctd3: Group 2 — atmospheric reframe (ADR-034; implements docs/design/ctd3-atmospheric-grounding-three-js.md §A-G)
  
  Apply order B→C→D→E→A→F→G:
  - B lighting.js PRESETS — revives the dead prepWave→inWave tween; warm sun + sage-grey hemi.
  - C scene.js — scene.background = 0x1a2a20; linear THREE.Fog(0x1a2a20, 26, 58) — fog.color === bg.color, no seam.
  - D scene.js — ground plane 0x3c5a38 (was 0x6a8447 kelly); radial AO disc grounds the playfield.
  - E index.html — #grounding behind canvas (3-radial-gradient + #11180f base); #vignette above canvas under HUD.
  - A renderer.js — AgX tone mapping at exposure 1.06; SRGBColorSpace pinned. AgX over ACES because ACES oversaturates the kit's neon purple before clipping; AgX neutrally desaturates.
  - F scene.js — shader-based firefly module (count 14, low-power cap 6, reduced-motion early-return).
  - G scene.js — WARDEN_AURA_COLOR 0x6fd0e0 → 0x8fc6cf (mistier frost; sanctioned cool-blue exception per Deliberate Decision A).
  
  Tower / landscape / enemy GLBs remain kit-default per Decision C.
  
  Browser-verified via chrome-devtools-mcp: scene.background=0x1a2a20, scene.fog instanceof THREE.Fog with correct color/near/far, AgX tone mapping live, fireflies count N, reduced-motion zero Points, 9-point HSL grid shifts warmward.
  
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

Then STOP. Ask operator for explicit "push" approval.

═══════════════════════════════════════════════════════════════════════
6. WHAT NOT TO DO (anti-drift guards)
═══════════════════════════════════════════════════════════════════════

- If grep finds `FogExp2` or `0.018` anywhere in scene.js after Group 2 — that's a drift from spec. Spec mandates linear Fog. Fix.
- If grep finds `0x6fd0e0` anywhere in scene.js after Group 2 — that's an old-value remnant. Should be `0x8fc6cf`. Fix.
- If grep finds `0x6a8447` outside `paintTileDebug` after Group 2 — drift. Group 2 ground plane is `0x3c5a38`.
- If you find yourself opening tower_*_t*.glb / tile_*.glb / detail_*.glb / enemy_*.glb in Blender — STOP. Decision C: immutable.
- If you find yourself proposing a retintToBrand(...) / HSL clamp / per-mesh color override on kit meshes — STOP. Decision C: explicitly rejected as Option B.
- If you find yourself touching docs/adr/033-crawler-control-and-robots.md or CHANGELOG.md without operator request — STOP. Concurrent session owns those.
- If you find yourself implementing Groups 3-7 in this round — STOP. Minimum-shippable-subset is 1+2.
- If you find yourself swapping per-effect call sites in scene.js to TOKENS.X during Group 1 — STOP. That's Group 3 territory.
- If browser-verify finds towers look LESS off-brand than before but still purple-tinted — that's EXPECTED. Decision C: the surround warms; the towers stay kit-default. The purple goes from "neon glow-stick" to "dim plum" — that's success.

═══════════════════════════════════════════════════════════════════════
7. AI-HUB RESOURCES YOU CAN REACH FOR
═══════════════════════════════════════════════════════════════════════

(Available at C:\Users\chase\Projects\AI-Hub — not required, but useful if friction emerges.)

- prompts/adversarial-diff-review.md — adversarial subagent panel reviewing the diff before commit. Useful: dispatch 3 agents (correctness, brand-fidelity, regression) before each Group commit. Per ultracode, this is the kind of step that should be a workflow.
- prompts/subagent-fan-out.md — generic in-session fan-out template for parallel verification.
- prompts/find-adjacencies.md — only if scope creep emerges and you want to stress-test "am I missing anything?"
- prompts/bootstrap/pre-compaction-self-bootstrap.md — the template THIS handoff was authored from. If context gets long again post-Group-1, re-emit this kind of bootstrap.
- skills/iterative-deepening-audit/ — multi-pass verification methodology, useful if browser-verify fails ambiguously.
- skills/browser-test-mcp/ — single-session browser-test discipline (project also has chrome-devtools-mcp:* skills already loaded).
- skills/webapp-testing/ — backup for browser-test.
- .claude/shared/agentic-feature-workflow.md (in THIS repo) — project's own hostile+unprecedented workflow protocol. Groups 1+2 aren't hostile+unprecedented (atmospheric grounding is well-precedented), so the protocol's full ceremony is overkill; the ADR + spec are your design phase.

Per project CLAUDE.md "Ultracode" guidance (if active): use Workflow for substantive tasks. For Groups 1+2 implementation specifically, a workflow is overkill (the work is sequential and small). A workflow IS appropriate for the adversarial-diff-review pass before each commit.

═══════════════════════════════════════════════════════════════════════
8. CHROME TABS THAT MAY STILL BE OPEN
═══════════════════════════════════════════════════════════════════════

- Tab "Castle Tower Defense" (claude.ai/design) — Claude Design conversation, round 3 reply state. CD offered round 4 (HUD production HTML + map-select build-out) but we DEFERRED to JIT before Groups 4+6+7. Do NOT re-engage CD this round.
- Tab Cloudflare dashboard (caching/configuration on chases.house) — available for post-deploy cache purge of any Group 1/2 commit URLs. The purge URL list is in the commit message; replicate the "Custom Purge → URL → paste 7 URLs" workflow from earlier this session.
- Tab Firebase console (chases-house RTDB) — published rules are live. Don't touch unless operator asks.
- Tab https://chases.house/games/castle-tower-defense/ — the live production game. Use for post-purge verification.
- Tab https://chases.house/games/castle-tower-defense/tools/map-editor.html — the editor. Group 2 doesn't change the editor's atmospheric look (editor 3D preview is a separate render). Editor is Group 7 territory.

═══════════════════════════════════════════════════════════════════════
9. STOP CONDITIONS / WHEN TO ASK THE OPERATOR
═══════════════════════════════════════════════════════════════════════

STOP and ask if:
- styles.css doesn't exist OR its CSS variables aren't where you expect (the CTD3 site has lots of inline CSS in index.html — verify which file holds the dark-scope tokens BEFORE editing).
- The atmospheric spec doc references a code path (e.g., scene.fog) that doesn't appear in current scene.js — investigate, then ask.
- An acceptance assertion fails ambiguously (e.g., visible fireflies but reduced-motion still shows 1-2 Points — possibly a stale module-instance issue).
- The operator's preferences appear to conflict with the spec (e.g., they suggest pulling Warden cyan all the way warm — that contradicts Deliberate Decision A; surface the conflict, don't silently choose).
- Concurrent-session edits to docs/adr/033-crawler-control-and-robots.md or CHANGELOG.md collide with anything you'd otherwise touch (which shouldn't happen — but if so, stop).

DO NOT ASK (just do):
- Whether to add TOKENS block to scene.js (Group 1 mandates it).
- Whether to use AgX or ACES tone mapping (spec §A mandates AgX with rationale; ACES @ 0.92 is the noted fallback).
- Whether to keep Warden cyan or warm it (Decision A: keep cool cue, value 0x8fc6cf).
- Whether to commit Group 1 and Group 2 separately (yes — per Phasing & Commit Strategy).

═══════════════════════════════════════════════════════════════════════
10. SUCCESS LOOKS LIKE
═══════════════════════════════════════════════════════════════════════

After Group 1 + Group 2 ship to main (+ operator-driven Cloudflare purge):
- chases.house/games/castle-tower-defense/ shows the gameplay board grounded in a warm dusk-pine atmosphere (scene.background 0x1a2a20, fog blending into it at the edges, no hard black seam).
- Fireflies drift slowly above the grass; they stop when prefers-reduced-motion is on.
- Mage and Warden cone tops read as dim plum (not neon).
- Warden aura ring reads as mistier frost (not neon cyan).
- HUD chrome is unchanged (Group 4 territory). Editor is unchanged (Group 7 territory). Map-select is unchanged (Group 6 T15 territory).
- ADR-034 line "Group 1+2 minimum-shippable-subset" is satisfied; status changes from "Proposed" to "Group 1+2 Accepted" in a follow-up ADR addendum (optional, low priority).
- Claude Design can be re-engaged for round 4 (Groups 4/6/7 markup) against the new live build.

End of bootstrap. You are now caught up. Read docs/adr/034-ctd3-ui-ux-remediation-v2.md and docs/design/ctd3-atmospheric-grounding-three-js.md, then start with Group 1 by locating where the CTD3 dark-scope CSS variables actually live.
```

---

## File-write provenance + AI-Hub artifacts consulted

This bootstrap was drafted by following the operator-side flow documented at [`C:\Users\chase\Projects\AI-Hub\prompts\bootstrap\README.md`](C:\Users\chase\Projects\AI-Hub\prompts\bootstrap\README.md) — decision-matrix row 1 (continuing same session post-`/compact`) → use [`pre-compaction-self-bootstrap.md`](C:\Users\chase\Projects\AI-Hub\prompts\bootstrap\pre-compaction-self-bootstrap.md) template shape (free-form code-block output).

Other AI-Hub artifacts surveyed (not embedded — the bootstrap points the post-compact self at them if needed):

| Resource | Path | Why mentioned |
|---|---|---|
| Adversarial diff review | `AI-Hub/prompts/adversarial-diff-review.md` | Workflow-shaped pre-commit review for each Group |
| Subagent fan-out template | `AI-Hub/prompts/subagent-fan-out.md` | If parallel verification needed |
| Find adjacencies | `AI-Hub/prompts/find-adjacencies.md` | If scope creep emerges |
| Iterative deepening audit | `AI-Hub/skills/iterative-deepening-audit/` | If browser-verify fails ambiguously |
| Browser-test MCP | `AI-Hub/skills/browser-test-mcp/`, project's `chrome-devtools-mcp:*` skills | Group 2 verification |
| Webapp testing | `AI-Hub/skills/webapp-testing/` | Backup for browser-test |
| Agentic feature workflow | This repo's `.claude/shared/agentic-feature-workflow.md` | Noted but skipped — Groups 1+2 aren't hostile+unprecedented |
