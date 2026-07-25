# ADR-040: CTD3 Campaign Wave Re-imagining on the Monster Roster

**Date:** 2026-07-25
**Status:** Accepted
**Amends:** [ADR-038](038-ctd3-layout-generator-direction-and-cycle-3-sprint-plan.md) **D18** (campaign-balance freeze) — bounded, not lifted; see **D30**
**Explicitly does NOT amend:** [ADR-036](036-ctd3-benchmark-balance-direction-and-sprint-plan.md) **D2** (the attrition band) — see **D31**; [ADR-037](037-ctd3-endless-mode-direction-and-cycle-2-sprint-plan.md) **D8/D9** (endless) — see **D32**; [ADR-039](039-ctd3-cc0-asset-expansion-policy-and-monster-suite.md) **D22–D25** (CC0 policy, immutability, budget) which **govern** D29's import rather than being changed by it
**Relates to:** ADR-028 (CTD3 core), ADR-030 (§16 map roster), ADR-034 (palette), ADR-039 (the roster this design consumes)

This ADR is the design record for **Sprint 8 — the campaign wave re-imagining**, the second chunk of the operator's re-sequenced cycle 3. ADR-039 D26 named this dispatch as the one that amends D18, *"deliberately, with a sanctioned CSV re-baseline, using this sprint's roster as its input."* This is that amendment.

**The re-sequencing premise, restated because every decision below leans on it:** the roster landed first (Sprint 7) with **zero data changes**, so a wave that feels wrong after this sprint has exactly one candidate cause — the wave design — and not two.

---

## Context

### What the roster made possible, and what the waves still are

Sprint 7 replaced ten UFO discs with nine animated CC0 monsters: an orc, a yeti, a ninja, a dino, a bee, a mushroom king, a demon, a blob at two scales, and a ghost. Silhouettes are distinct from one another and the relative scale hierarchy reads correctly (Sprint-7 hand-back, `?test=roster`).

The **waves those creatures walk in** have not been designed since ADR-036 CH-3 (`b2c08cc`, 2026-07-23), whose brief was explicitly remedial rather than expressive: wire four dead enemy types into *some* official wave, extend Tidewater from a 3-wave stub, and retune rewards until the attrition ratio stopped declining. It succeeded at all three. It was never asked to make a wave *mean* something.

The result is a campaign where the curve is correct and the content is anonymous. Measured from the committed CSVs and `maps.js` at `e7d6d24`:

- **No enemy type is distinctive to any map.** Forest and Tidewater both lead on slime; Riverbend, Snowfall **and Mountain** all field juggernauts. Neither overlap was a decision — CH-3 placed each type "in ≥1 official map" and stopped.
- **Four of six maps open with a wave 1 that is no smaller than their wave 2** (Forest 224→210, Mountain 280→236, Snowfall 280→210 — and Riverbend 224→224, exactly equal). This is a straightforward authoring defect: the first wave should be the smallest.
- **37 of 48 waves fail the editor's own W2 rule** — "leave ≥3s of rebuild room" — because group delays were chosen to fill time, not to leave a breath. Only **10 waves** have a genuine mid-wave pause (Forest w4/w5, Mountain w6/w7/w8, Snowfall w6/w8, Riverbend w6/w7/w8); an eleventh, Plains w1, is a single spawn and cannot warn. (Measured: 66 wave-warns total across the six maps — 37 W2 and 29 W1.)
- **A wave cannot be named.** Ask what Plains wave 6 *is* and the honest answer is "three groups of things".

### The benchmark's reading of wave identity

`docs/td-comparison/README.md` §1 (read-only, Warcraft repo) records the two reference designs' opposite answers:

- **Cube Defense** — *"Fixed schedule: wave N is always creep N."* Wave identity is total and positional; you learn the schedule.
- **Element TD** — each level is a single creep type carrying an **element tag**, so every level has a readable one-word identity — but *which* level carries *which* creep is **shuffled per game** (Fisher–Yates over levels 6–59). Identity is per-level and legible; the schedule is not memorisable.

Both give a level a name. Neither leaves it as "three groups of things". CTD's campaign is fixed-order (ADR-036 D5) and 8 waves long, so the shuffle half of ETD's answer does not apply — but **the per-wave readable identity does, and is what this ADR imports.** (Shuffle remains where ADR-036 D5 and ADR-037 put it: endless.)

### The one thing the roster cannot currently express

Laying the **nine parent types** out by mobility (speed ≤2.0 = slow) against mitigation gives three empty cells, of which only one is worth filling. (`mini_slime` is omitted — it is not independently placeable; it exists only as a split child.)

| | no mitigation | armor | other mechanic |
|---|---|---|---|
| **ground, slow** (≤2.0) | heavy (1.3) | shielded 0.65 (1.7) · juggernaut 0.2 (1.2) · captain 0.4 (1.1) | slime (splits, 2.0) |
| **ground, fast** (>2.0) | footman (2.5) · runner (4.5) | *empty* | — |
| **air** | skirmisher 38 hp (3.2) · ghost 55 hp (3.0) | **empty** | ghost (2 negated hits) |

**Why only the air-armor cell is worth filling.** *Ground fast + armor* would present the same puzzle as `shielded` — magic beats armor regardless of how fast the carrier runs — so it adds a creature, not a question. *Ground fast + other mechanic* fares no better: a fast carrier of a split or spectral mechanic reads as a runner variant, because the player answers **the mechanic, not the speed**. **Air + armor is different in kind**, because `applyDamage` reduces **physical only** by armor and Catapult cannot *acquire* air at all (`targets: 'ground'` fails `canTarget`; its splash can still incidentally clip a flyer standing near a ground primary, since `handleHit`'s splash loop has no flying test). An armored flyer is therefore the one addition that changes which tower is correct rather than which creature is on screen. Today every air wave is answered by any `targets: 'all'` tower, so "air raid" is a costume, not a puzzle. D29 fills that cell, and only that cell.

---

## Decision

Give all 48 campaign waves a **named archetype**; give each of the six maps a **signature it owns**; add **exactly one** new enemy type, justified by the roster's one interesting gap rather than by variety; amend ADR-038 D18 narrowly enough that the re-baseline it authorises is attributable to composition alone; and keep ADR-036 D2's attrition band **unchanged**.

---

## D28 — Every campaign wave has a named archetype, and every map owns one.

### The archetype vocabulary

An archetype is defined by **the shape of pressure it applies** — what the wave looks like and what it does to your board. It is *not* defined by "the tower that answers it", and the difference matters enough to state plainly: there are **four towers, three of which deal damage**, so ten archetypes cannot possibly map to ten distinct tower answers. Any framing that claims they do is false on its face.

| Archetype | Composition signature | Pressure it applies | Tower that answers best |
|---|---|---|---|
| **Rabble** | footman mass, one or two ranks | none — the tutorial shape | any |
| **Swarm** | many fast low-HP (runner-led), tight spacing | body count and speed outrun single-target rate | Catapult (splash); Warden (slow) |
| **Tank line** | few slow high-HP (heavy-led), wide spacing | per-target HP; nothing dies to one shot | Ranger T3 (highest raw DPS/gold) |
| **Shield wall** | armored ground (shielded-led) | physical mitigation 0.65 | **Mage** — magic ignores armor |
| **Air raid** | flyers (skirmisher/drake-led) | denies Catapult by acquisition | Ranger/Mage; with drakes, Mage |
| **Split mass** | slime-led; bodies double on death | overkill waste, then a second body wave | Catapult (splash catches children) |
| **Spectral** | ghost-led; first two projectile hits negated | punishes few-big-hits, rewards many-cheap | Ranger (volley = 2 hits/shot) |
| **Siege** | juggernaut anchor + escort | one 600-HP armored target while escort presses | Ranger focus; Mage vs the 0.2 armor |
| **Mixed arms** | three or more of the above, layered | breadth — no single tower covers it | composition |
| **Boss** | captain, 1800 HP behind 0.4 armor | everything at once | composition |

**Three honesty notes on that table, because the overlaps are real and a future reader will find them anyway:**

1. **The answers overlap and cannot not.** Swarm and Split mass both reward Catapult. Shield wall and drake-led Air raid both reward Mage. What distinguishes those pairs is not the counter — it is that one arrives as a running crowd and the other as an armored line, which is what a player actually *names*. The archetype is the noun; the counter is a consequence.
2. **Warden is the best answer to no archetype's headline** — it appears only as a secondary on Swarm. That is a **finding about the tower roster, not a gap in this design**: the campaign contains no wave shape for which a slow aura is the primary answer. Recorded here deliberately as evidence for the **cycle-4 tower-depth adjudication (ADR-038 D20)**, which is the decision that owns it.
3. **Plains's "signature" is a teaching arc, not an archetype**, so the wave-7/wave-8 rules below degenerate on Plains — both are Mixed arms. That is intended: the first map's identity is *the order it introduces things in*, and its climax is the first wave that uses all of them at once.

### Signature ownership

Each map owns one signature, grounded in the flavour text it already ships with:

| Map | ★ | Signature | The map's own words |
|---|---|---|---|
| **Plains** | 0 | **the teaching arc** | *"Gentle hills and an unbroken road… archers will see far"* |
| **The Whispering Wood** | 0 | **Swarm** | *"the wolves run fast"* — tight path, short sight lines |
| **Tidewater Bend** | 0 | **Split mass** | *"Mind the hidden trails"* — what you kill reveals more |
| **The Stone Gate** | 5 | **Siege** → Boss | *"a Captain walks here when the moon is full"* |
| **Riverbend** | 13 | **Air raid** | *"A footbridge keeps the keep dry"* — fliers do not need the bridge |
| **Snowfall Pass** | 14 | **Spectral** | *"The crystals remember every step"* |

Three rules make ownership mean something:

1. **Wave 7 is the map's signature at full strength, undiluted.** It is the wave that most needs the map's name on it.
2. **Wave 8 is that signature leading a mixed-arms climax** — everything the map has taught, with its own accent. Mountain is the deliberate exception: its wave 8 is the campaign's only **Boss**, and it keeps the Captain.
3. **A signature type appears at full strength only on its owner.** Juggernaut therefore becomes **Mountain-exclusive** (it currently appears on three maps), and the drake belongs to Riverbend — appearing on Snowfall in **two** waves (w6 and w8), where per the anchor rule it is the finale's HP lead until the surround work lands. That is more than a guest appearance and is named as an acknowledged exception to this rule, not as compliance with it. The Forest/Tidewater slime and Riverbend/Snowfall juggernaut duplications are resolved.

**What "ownership" does and does not mean, because the archetypes are deliberately shared.** Air raid appears on four maps and Shield wall on five — they are **common vocabulary**, the way most maps contain a tank wave. What a map owns is narrower and checkable: **its wave-7 and wave-8 slots, plus any type exclusive to it.** Riverbend does not own the idea of a flying wave; it owns *being the map whose late game is flying*, and it owns the drake. Snowfall does not own ghosts appearing; it owns *ghosts at wave 7*. Stated this way the earlier principle — "a signature that appears everywhere is not a signature" — is about the **late-wave slots and the exclusive types**, and both of those are genuinely unique per map.

### The figure-ground anchor rule — a real constraint, recorded as one

The Sprint-7 hand-back carries an open caveat: the **ghost is near-black** and **both slimes are olive-green**, sitting close in value to the dark-green decorated field, and the sanctioned fix is the **surround** (ADR-034 Decision C as extended by ADR-039 D23 forbids retinting the models), which is a later sprint.

**The collision is not confined to two waves, and it would be self-serving to say so.** "Anchor" is this ADR's own construction; the hand-back's caveat is about readability against dark-green decoration *generally*. This design in fact **intensifies** the general problem — Snowfall w7 fields **17 ghosts** where no current wave exceeds 8, and Tidewater w7 fields 7 slimes = 21 bodies. That is stated up front rather than buried, because the honest position is: the general readability risk grows, and only the anchors are protected.

**The rule, written as a ratio so it is measurable rather than a matter of taste.** In a **wave 1 or a wave 8**, the low-contrast types (`ghost`, `slime`, `mini_slime` — split children counted):

1. must be **≤30% of the wave's bodies**, and
2. must **not** be the wave's largest HP contributor.

All twelve anchors were measured and all twelve pass — but the strength of that statement should not be overstated: **six are wave 1s that are footman-only and therefore 0% by construction**, and three of the six wave 8s carry no low-contrast type at all. **Only two waves actually exercise the rule** (Tidewater 24%, Snowfall 25%) against a 30% threshold, and the threshold was chosen after the compositions were drafted rather than before.

Nor is the rule *enforced*: this sprint adds one harness check (D33's) and it is not this one. The ratio is hand-measured prose, and a later composition edit that pushes Tidewater w8 to 32% would fail nothing. Promoting it to a harness check is cheap and is named in the carry-forward.

| | w1 low-contrast | w8 low-contrast | w8 HP lead |
|---|---|---|---|
| Plains | 0/1 | 0/23 | heavy |
| Forest | 0/5 | 0/30 | heavy |
| Mountain | 0/5 | 0/8 | captain |
| Tidewater | 0/5 | **6/25 = 24%** | heavy |
| Snowfall | 0/5 | **5/20 = 25%** | drake |
| Riverbend | 0/5 | **6/26 = 23%** | drake |

An earlier cut of this design failed its own rule — Snowfall w8 ran 14 ghosts, the largest group by **both** HP and body count — which is exactly why the rule is a measured ratio now and not a prose intention.

**Named unblock, held to the same standard as D32's.** Once the roster-polish surround work ships (rim light / contact shadow / ground-palette shift), a later sprint **may propose** relaxing the ratio and re-leading Tidewater w8 and Snowfall w8 with their signature types. That needs **its own decision and its own measured threshold** — this ADR does not pre-authorise it. (An earlier draft granted the relaxation outright, which would have let a future session loosen a constraint this ADR had just created, with no fresh decision.)

### The 48 waves

Compositions are stated as type totals; the shipped `maps.js` splits some into two ranks to satisfy the rebuild-gap rule below. `attr` is the quiet attrition ratio (wave HP ÷ cumulative quiet gold).

**Plains — the teaching field.** One new idea per wave: mass → speed → bulk → flight → armor → combination. Carries **no** slime, ghost, juggernaut or drake: the first map teaches the base five.

| w | Name | Archetype | Composition | attr |
|---|---|---|---|---|
| 1 | **First Light** | Rabble | footman ×1 | 0.109 |
| 2 | **The Marching Line** | Rabble | footman ×6 | 0.600 |
| 3 | **Outriders** | Swarm | runner ×4, footman ×3 | 0.740 |
| 4 | **The Iron Few** | Tank line | heavy ×3, footman ×1 | 0.797 |
| 5 | **First Wings** | Air raid | skirmisher ×7, heavy ×1, footman ×3 | 0.852 |
| 6 | **The Shield Wall** | Shield wall | shielded ×5, footman ×3, heavy ×2 | 0.938 |
| 7 | **Open-Field Muster** | Mixed arms | skirmisher ×6, shielded ×5, heavy ×3, runner ×2 | 1.102 |
| 8 | **The Long Muster** | Mixed arms | shielded ×7, runner ×6, heavy ×7, skirmisher ×3 | 1.310 |

**The Whispering Wood — swarm.**

| w | Name | Archetype | Composition | attr |
|---|---|---|---|---|
| 1 | **Under the Boughs** | Rabble | footman ×5 | 0.545 |
| 2 | **Wolves at the Trail** | Swarm | runner ×4, footman ×1 | 0.636 |
| 3 | **The Ooze** | Split mass | slime ×2, footman ×3 | 0.731 |
| 4 | **Fleet of Foot** | Swarm | runner ×6, slime ×1, footman ×1 | 0.802 |
| 5 | **Thicket Guard** | Shield wall | shielded ×5, skirmisher ×3, footman ×1 | 0.858 |
| 6 | **Cold Lanterns** | Spectral | ghost ×9, runner ×4, heavy ×1 | 0.934 |
| 7 | **The Running Tide** | Swarm | runner ×18, shielded ×4, slime ×2 | 1.096 |
| 8 | **The Wood Wakes** | Mixed arms | runner ×10, heavy ×9, shielded ×7, skirmisher ×4 | 1.308 |

**Tidewater Bend — split mass.**

| w | Name | Archetype | Composition | attr |
|---|---|---|---|---|
| 1 | **Slack Water** | Rabble | footman ×5 | 0.545 |
| 2 | **The First Bloom** | Split mass | slime ×1, footman ×3 | 0.610 |
| 3 | **Driftwood** | Tank line | heavy ×2, footman ×2 | 0.752 |
| 4 | **The Second Bloom** | Split mass | slime ×2, runner ×3, footman ×1 | 0.824 |
| 5 | **Bank and Bar** | Shield wall | shielded ×4, heavy ×1, footman ×2 | 0.870 |
| 6 | **Reedwing** | Air raid | skirmisher ×10, slime ×2, runner ×2 | 0.953 |
| 7 | **The Tide Comes In** | Split mass | slime ×7, skirmisher ×4, shielded ×3 | 1.108 |
| 8 | **The Tide Divides** | Mixed arms | heavy ×8, shielded ×5, runner ×4, slime ×2, footman ×2 | 1.298 |

**The Stone Gate — siege, then the campaign's only boss.** Juggernaut is exclusive to this map.

| w | Name | Archetype | Composition | attr |
|---|---|---|---|---|
| 1 | **At the Gate** | Rabble | footman ×5 | 0.545 |
| 2 | **Stone and Bone** | Tank line | heavy ×1, footman ×3 | 0.619 |
| 3 | **The Narrow Watch** | Shield wall | shielded ×2, skirmisher ×2, footman ×1 | 0.687 |
| 4 | **Hammerfall** | Tank line | heavy ×3, shielded ×1 | 0.806 |
| 5 | **The Warband** | Mixed arms | runner ×6, skirmisher ×4, heavy ×1, footman ×1 | 0.859 |
| 6 | **First Siege** | Siege | juggernaut ×1, footman ×5, heavy ×1 | 0.948 |
| 7 | **Second Siege** | Siege | juggernaut ×2, skirmisher ×3, footman ×1 | 1.188 |
| 8 | **The Captain Walks** | **Boss** | captain ×1, shielded ×2, runner ×2, footman ×4, heavy ×1 | 1.573 |

Mountain is also the one map with a bespoke reward ladder — **18 / 24 / 30 / 38 / 48 / 60**, then **26**, then a **250** boss purse. Its wave 7 is two juggernauts (1,200 HP of indivisible ballast) and its wave 8 an 1,800-HP captain, so the curve needs more cumulative gold beneath both to keep them inside the band. The dip to 26 before the boss is deliberate and not an oversight: it is what holds the finale spike at 1.57 rather than letting it slide toward the other maps' 1.30.

**Riverbend — air raid.** Home of the drake.

| w | Name | Archetype | Composition | attr |
|---|---|---|---|---|
| 1 | **Low Water** | Rabble | footman ×5 | 0.545 |
| 2 | **The Ford** | Swarm | runner ×4, footman ×1 | 0.636 |
| 3 | **Wings over the Bend** | Air raid | skirmisher ×7, footman ×1 | 0.725 |
| 4 | **Bridgework** | Tank line | heavy ×3, runner ×3 | 0.793 |
| 5 | **The Second Flight** | Air raid | skirmisher ×9, ghost ×5 | 0.869 |
| 6 | **Ironwing** | Air raid | **drake ×3**, skirmisher ×5, runner ×2 | 0.942 |
| 7 | **Nothing Uses the Bridge** | Air raid | **drake ×4**, skirmisher ×6, ghost ×6 | 1.086 |
| 8 | **The Sky Falls** | Mixed arms | **drake ×6**, skirmisher ×8, shielded ×6, ghost ×6 | 1.312 |

**Snowfall Pass — spectral.**

| w | Name | Archetype | Composition | attr |
|---|---|---|---|---|
| 1 | **First Snow** | Rabble | footman ×5 | 0.545 |
| 2 | **The Cold Road** | Swarm | runner ×4, footman ×1 | 0.636 |
| 3 | **Pale Company** | Spectral | ghost ×4, footman ×2 | 0.690 |
| 4 | **Frostbacks** | Shield wall | shielded ×4, footman ×4 | 0.800 |
| 5 | **The Long Cold** | Mixed arms | runner ×4, skirmisher ×3, footman ×3, heavy ×2 | 0.868 |
| 6 | **Rimeguard** | Air raid | **drake ×2**, shielded ×4, footman ×2 | 0.960 |
| 7 | **What the Crystals Keep** | Spectral | ghost ×17, skirmisher ×6, shielded ×1 | 1.096 |
| 8 | **The Pass Remembers** | Mixed arms | **drake ×5**, ghost ×5, shielded ×4, heavy ×4, footman ×2 | 1.308 |

### One rule that is not about identity: the rebuild gap

Every wave's group delays are laid out so **each group boundary leaves ≥3.5s** with no spawns. This clears the editor's W2 warn on all 48 waves (currently failed by 37 of 48) and gives the player a breath to rebuild mid-wave — a playability gain that costs nothing, and the reason wave 2 on most maps is authored as *two ranks of the same creature* rather than one long file.

---

## D29 — Exactly one new enemy type joins the roster: the **Drake**. The justification is arithmetic, not variety.

**The type.** `drake` — `hp 240, speed 1.6, armor 0.45, isFlying true, bounty 50, sizeWorld 0.75`. An armored flyer: slow for a flyer (skirmisher 3.2, ghost 3.0), heavy for one, and the only air unit that punishes a pure-physical answer.

**Why it is needed, stated carefully — because the obvious version of this argument is wrong.** Riverbend's signature is Air raid, so its wave 8 must be air-led, against a wave-8 budget of ~2,500 base HP and D33's budget of **35 total spawns** (*not* 35 concurrent — those are different quantities and this ADR does not conflate them; see D33).

- A **pure**-air finale is genuinely out of reach: all-ghost needs ⌈2504/55⌉ = **46 bodies**, all-skirmisher **66**. Both exceed 35.
- An **air-led** finale *is* constructible without the drake — e.g. `ghost ×26 + shielded ×4 + heavy ×5` = 2,300 HP in exactly 35 spawns, 62% of HP airborne. So "impossible" would be false, and is not claimed.

**The real objection to that counterexample is an identity objection, which is what this ADR is about.** It spends 26 of 35 spawn slots on 55-HP ghosts — which is a *spectral swarm*, i.e. **Snowfall's signature**, and would make Riverbend's finale read as a louder copy of Snowfall w7 rather than as its own thing. It also burns the entire spawn budget on the map that most needs headroom. The drake buys the same 2,500 HP in **26 effective spawns** with 6 large silhouettes instead of 26 small ones, which is the difference between "an air raid" and "a lot of ghosts".

**How much it actually shifts, stated precisely rather than rhetorically.** Raw single-target DPS, from `TOWERS`: Ranger T3 = 16 × 1.8 × 2 volley = **57.6** physical; Mage T3 = 65 × 1.3 = **84.5** magic. Per cumulative gold invested (Ranger 215g, Mage 570g) that is 0.268 vs 0.148 against an unarmored target — Ranger **1.8× better**. Against the drake's 0.45 armor Ranger's effective DPS falls to 31.7, giving 0.147 vs 0.148: **parity, before chains**. So the honest claim is not "Mage becomes mandatory" but "the drake erases Ranger's per-gold single-target advantage, and Mage's 2 chains break the resulting tie on a wave that arrives in a group." That is a real change in the correct build and a modest one, which is the right size for one new type.

**The second reason, which the tuning surfaced and which is the stronger of the two.** Ranked by **raw HP per bounty gold** (all eleven types, split children folded into the parent, boss included): captain 7.2, heavy 6.9, juggernaut 6.7, slime 6.5, mini_slime 5.5, **drake 4.8**, footman 4.7, shielded 4.4, runner 3.0, ghost 2.5, **skirmisher 2.1**.

Flyers pay far more gold per point of HP they contribute than anything on the ground — so a skirmisher-carried late wave *funds the player past its own threat*, and the attrition curve flattens exactly where D2 wants it to steepen. At 4.8 the drake is **2.3× more HP-dense than a skirmisher**, which is what lets an air map hold the band at all. This, not the spawn budget, is the argument that actually does the work.

Its bounty of 50 is set on the **effective-HP-vs-physical** yardstick, with the full table given rather than one flattering neighbour: shielded 12.7, captain 12.0, **drake 8.7**, juggernaut 8.3, heavy 6.9, slime 6.5, mini_slime 5.5, footman 4.7, runner 3.0, ghost 2.5, skirmisher 2.1. The drake sits **mid-table, not top** — shielded is 46% denser — which is the intended placement: it should pay like a hard single target, not like a boss and not like a cheap flyer. Two caveats on the yardstick itself, since it is imperfect: armor is worth nothing against Mage, so the figure is answer-dependent; and it ignores `spectralCharges`, which at low per-hit damage is a far larger effective-HP multiplier than any armor value on the table.

**Why no others.** Two further candidates were considered and refused:

- **A fast-swarm micro unit.** Refused: runner (42 hp @ 4.5) and mini_slime (22 hp @ 2.6) already cover it, and the swarm archetype is spawn-ceiling-bound rather than roster-bound — Forest w7 already fields 18 runners.
- **A healer/support.** Refused **on scope, not on merit**: it needs a new engine behaviour handler, which is outside both the existing `ENEMIES` data idiom and D30's amendment. It is a genuinely interesting mechanic and belongs to a sprint that can amend `engine.js`.

**The asset, verified before this ADR committed to the type.** Quaternius *Ultimate Monsters* → **"Dragon"** (publicID `3rUm1cN3yp`, ResourceID `ae5b8510-1fa5-4d53-b943-a4f3b88fb629`), CC0 1.0 read off the model's own page per ADR-039 D22, obtained via the sanctioned **poly.pizza CC0 mirror** — the same fallback route Sprint 7 recorded, the Quaternius Drive folder still being quota-blocked. **251,540 B source → 119,812 B after the Sprint-7 optimization pipeline** (clip prune to Walk-equivalents → resample → dedup → weld → prune → quantize at the ledger's recorded bit depths), i.e. **40% of D25's ~300 KB per-model budget, measured on the correct side of the transform** — Sprint 7's footman went 513 KB → 313 KB, so the source figure alone would not have been evidence. **glTF-Validator: 0 errors** (2 warnings, byte-identical in kind to those the shipped skirmisher and ghost already carry). 5 draw calls, 4,562 triangles, zero embedded textures, clips `Fast_Flying / Flying_Idle / Death` — the same three the shipped flyers ship. Fingerprinted to the **Flying** sub-pack (20 nodes, 8 clips including `Fast_Flying`, armature `CharacterArmature`, zero embedded textures) exactly as D24's method requires, so it is the same rig family as the shipped skirmisher and ghost. Windows Defender clean before and after optimization, signature age 0.

**None of this is auditable from the repo until the import lands.** At the time this ADR is committed there is no `enemy_drake2.glb` under `assets/models/`, no `MANIFEST.json` entry, and no D24 ledger entry — the figures above come from a scratchpad staging area, exactly as ADR-039 D25's "scan before repo entry" procedure requires. The ledger entry is part of the import commit, not of this one.

**A figure-ground note, in its favour.** The Dragon's base material is a warm rust-red (linear `0.243, 0.067, 0.012` ≈ sRGB 134/75/34) — chromatically opposite the dark-green field, and mid-value against it. It is the one new type that **helps** the open readability problem rather than adding to it, which is why the anchor rule (D28) is willing to let it lead Snowfall's finale. Its secondary material is a dark plum; recorded honestly against ADR-034's purple exclusion as a small, wing-level presence, and immutable either way under D23.

**What this type is NOT permitted to do.** It does not change any existing type's `hp`, `speed`, `armor` or `bounty` (D30), it does not enter endless (D32), and its per-type presentation scale is config, never a simulated quantity (ADR-039 D27).

---

## D30 — AMENDS ADR-038 D18. The freeze is narrowed, not lifted, and it authorises exactly one CSV re-baseline.

D18, quoted exactly so this restatement cannot drift from it: *"No edits to `maps.js` wave compositions or rewards, no `ENEMIES` hp/bounty, no `TOWERS` tier stats, no star thresholds, no `unlockRequirement`. The six campaign CSVs must show **no content change** at every chunk boundary."*

**UNFROZEN, for this sprint only:**

- `maps.js` **wave compositions** and **per-wave rewards** on the six campaign maps.
- **Additions** to the `ENEMIES` table — new type entries only, and **exactly one of them**: the `drake` specified in D29. This clause is not a standing licence to add types; a second addition needs a new decision.
- **One** regeneration of the six campaign CSVs (`tools/curves/{plains,forest,mountain,tidewater,snowfall_pass,riverbend}.csv`), landing in the wave commit and **nowhere else**.

**STILL FROZEN BY D18:**

- **Existing `ENEMIES` entries' `hp`, `speed`, `armor`, `bounty`** — every incumbent type keeps its exact values. This is the load-bearing half of the amendment: it is what keeps the re-baseline attributable to *composition* rather than to a global stat change, and it is the same "one candidate cause" logic that produced the operator's re-sequencing. (D18's own enumeration names hp/bounty; speed and armor are held frozen too, deliberately, rather than exploiting the gap.)
- `TOWERS` tier stats, star thresholds, `unlockRequirement`, and the `DIFFICULTY` scalars (`hpMult`, `startGold`, `startLives`, `bountyMult`, `earlyCallRate`).

**HELD FROZEN BY THIS SPRINT'S OWN SCOPE — not by D18, which says the opposite:**

- **`endless.js`.** D18's full text reads *"Endless constants in `endless.js` are explicitly **outside** this freeze and are T-1's subject."* So endless is not D18's to protect, and this ADR is not extending D18 by leaving it alone — it is making a **sprint-scope choice** to touch nothing there (D32). Recorded this way because quoting D18 selectively in the other direction would misstate the decision being amended.
- The layout / `buildSlots` of every map, and `tools/map-rules-test.cjs`'s six-map baseline. Untouched this sprint; no amendment needed because no decision put them in play.

**On D12, which D18 extends — checked rather than assumed.** D18's title clause is *"Campaign balance stays frozen through cycle 3 — **extending D12**."* ADR-037 **D12** reads *"**Cycle 2** does not touch campaign balance… the six `attrition-monotone` checks must be byte-stable **across the entire cycle**."* D12 is scoped to cycle 2 by its own terms and expired when cycle 2 closed; D18 is the instrument that carried the freeze into cycle 3, which is why **amending D18 is sufficient** and no separate D12 amendment is required. Recorded because "extending D12" could otherwise be read as leaving a live parent freeze unamended.

**The re-baseline is a deliberate act with a stated shape.** ADR-038 D18 required the CSVs to show *no content change*; this sprint changes them once, on purpose, and the commit body states the before/after per-map deltas (HP growth, income growth, w7 attrition, finale spike). After this sprint the freeze **resumes in its original form** for the remainder of cycle 3 — this amendment is spent on landing, not standing.

---

## D31 — ADR-036 D2's attrition band is KEPT, unchanged. The re-imagining is compositional, not magnitudinal.

D2's band — *~0.6–0.8 through waves 2–5, rising **monotonically** to ~1.0–1.2 by wave 7, the wave-8 spike (~1.3–1.6 **on boss maps**) preserved, no mid-run decline* — is retained exactly, along with ADR-037 §2.2's two sanctioned deviations (the w5 overshoot at 0.853–0.893, and the ungoverned wave-1 shoulder).

**A third excursion, named here because §2.2 records only two and this design inherits a pre-existing one.** D2's 0.6–0.8 nominally governs waves 2–**5**, but wave 4 already exceeds 0.8 on three shipped maps (Plains 0.841, Riverbend 0.817, Tidewater 0.811) and does so again here (Tidewater 0.824, Forest 0.802). This is the same construction artifact as the w5 overshoot — a monotone rise from ~0.62 to ~1.10 cannot hold 0.8 as late as wave 5 — and it is recorded so that a future reader does not mistake an inherited property for something this sprint introduced.

Three reasons, in order of weight:

1. **It is measured and it is holding.** ADR-037 §2.1 recorded all six maps landing w7 at 1.07–1.16 with finale spikes 1.27–1.58. Nothing in this sprint's evidence argues the band is wrong.
2. **Evolving the band's *form* would mean editing the harness check in the same commit that changes the data it guards.** The `attrition-monotone` check is data-derived and self-adapting — it recomputes from live `maps.js` each run, with no expectations table — so keeping the band costs **zero harness edits**, while changing its shape would require rewriting the guard and the guarded thing together. That is precisely the move ADR-038's T-1 brief forbids in as many words: *"never weaken a threshold in the same commit that first fails it."*
3. **It is benchmark-grounded.** Both reference designs tighten toward the end (`td-comparison` §2: Cube ~7.5× over 30 waves; ETD compounding ~7%/level after a grace window).

**The design constraint this implies, stated because it is the one that actually bit.** Archetype variety pushes toward uneven wave HP — a swarm wave is many small bodies, a siege wave is one enormous one — while D2 forbids a mid-run decline in *attrition*. The resolution is that **archetype governs how a wave's HP is distributed, never how much of it there is**: each wave's total HP still rises monotonically, and the archetype decides which creatures carry it. That is what makes this a *re-imagining* rather than a re-balancing, and it is why the sanctioned re-baseline is modest — the difficulty envelope is preserved by construction.

**Verified before this ADR was accepted**, on the design as tabled in D28, with the drake injected: all six maps monotone non-declining w2→w7 at the harness's own 0.02 tolerance; w7 at **1.086–1.188**; finales at **1.298–1.573** (Mountain's boss spike intact at 1.573, the other five at 1.298–1.312); w5 at **0.852–0.870**, inside ADR-037 §2.2's sanctioned overshoot rather than above it. Harness edits required: **none** to the attrition check. Every one of the 48 tabled `attr` values was recomputed from its composition through `sim-core`'s exact arithmetic and matches to three decimals.

Per-map before → after, to show the size of what the D30 re-baseline actually is:

| Map | HP growth | Income growth | w7 attrition | Finale spike |
|---|---|---|---|---|
| Plains | ×1.445 → ×1.469 | ×1.396 → ×1.425 | 1.085 → 1.102 | 1.268 → 1.310 |
| Forest | ×1.453 → ×1.486 | ×1.392 → ×1.386 | 1.069 → 1.096 | 1.367 → 1.308 |
| Mountain | ×1.476 → ×1.505 | ×1.449 → ×1.478 | 1.159 → 1.188 | 1.577 → 1.573 |
| Tidewater | ×1.408 → ×1.444 | ×1.320 → ×1.401 | 1.107 → 1.108 | 1.267 → 1.298 |
| Snowfall | ×1.481 → ×1.505 | ×1.404 → ×1.416 | 1.105 → 1.096 | 1.337 → 1.308 |
| Riverbend | ×1.465 → ×1.532 | ×1.414 → ×1.472 | 1.119 → 1.086 | 1.282 → 1.312 |

Every wave on all six maps is rewritten, and the largest movement in any of the four tracked statistics is: **HP growth +0.067** (Riverbend), **income growth +0.081** (Tidewater), **w7 attrition −0.033** (Riverbend), **finale spike −0.059** (Forest). The two *attrition* statistics — the ones D2 actually governs — stay inside ±0.06 on every map. That is the evidence for "compositional, not magnitudinal", and it is why an amendment to a freeze is a proportionate instrument here rather than an excessive one.

(All figures on both sides of that table are **quiet HP** — `hpMult 0.85`, per-enemy `Math.round`, split children walked — which is what `sim-core.computeCurves` emits and what the committed CSVs record. ADR-037 §2.1 printed the same six maps on a *base*-HP basis; on the quiet basis its figures are ×1.408–1.481, differing from its printed ×1.409–1.482 by 0.001. Stated because a doc quoting to three decimals invites re-derivation.)

**One deviation the table makes visible and this ADR does not hide:** HP growth *steepens* on every map, most on Riverbend (×1.465 → ×1.532). The cause is structural — holding a monotone attrition band while late waves carry HP-dense types requires a steeper HP ramp — and the visible cost is +2 W1 wave-warns (see Consequences).

---

## D32 — Endless is untouched. New types stay out of it, and that is the zero-work default rather than an oversight.

`endless.js` names its enemy types **literally** in `OPENING`, `TEMPLATES` and `bossGroups`, so a new `ENEMIES` entry is invisible to the endless generator with no action taken. That default is adopted:

- **The drake does not enter the endless pool this sprint.** D30's unfreeze does **not** extend to `endless.js`.
- Consequently `tools/curves/endless-plains-quiet.csv` regenerates **byte-identical**. This was verified rather than assumed: the endless CSV was regenerated with and without `drake` present in `ENEMIES`, the two outputs compared equal, and both compared equal to the committed file on disk. The mechanism is that `waveFor` reads only the **nine** types its opening, templates and boss anchors name literally (`footman, ghost, heavy, juggernaut, runner, shielded, skirmisher, slime`, plus `captain` in `bossGroups`), reaching `mini_slime` only transitively through the split walk; and both `effectiveSpawnCount` and `waveStats` walk only the types a wave actually contains — so an unreferenced `ENEMIES` key is unreachable from every endless code path.
- All twelve `endless-*` harness checks stay green.

**Why exclusion rather than inclusion.** Endless calibration is **ADR-038 T-1**, still queued. Adding a type to the endless templates would move endless balance inside the same commit that re-baselines the campaign — muddying attribution in exactly the way this cycle is organised to avoid — and would do it with none of the measured wave-index data T-1 exists to produce.

**Named unblock:** T-1 may add the drake to the endless templates once it has measured run depth in hand. Doing so is an `endless.js` template edit plus an endless-CSV re-baseline, and needs its own decision — this one does not pre-authorise it.

---

## D33 — Every wave respects the 35 total-effective-spawn ceiling (30/35 worst case); peak concurrency is measured separately at 16; and the campaign gets the harness guard it never had.

ADR-038 D13 records `SPAWN_CEILING = 35` with a measured endless peak of 22, and skinned meshes cost **3–11 draw calls each** (measured per file in `assets/LICENSE.txt`'s ledger; ADR-039 names the cost but not the number), so the ceiling is a genuine budget rather than a formality. **Do not design toward it.**

**Two different quantities are in play and this ADR keeps them apart.** `endless-spawn-bound` and the check proposed below measure **total effective spawns per wave** (split children walked). The editor's W8 rule measures **estimated peak concurrency**. On this content the ratio is roughly 1.9:1, so they are not interchangeable and neither substitutes for the other.

Measured on the D28 design:

- **Largest total effective spawns in any one wave: 30** (Forest w8). Next are Forest w7 and Tidewater w7 at 28; Tidewater w8 is 25. Against 35 that is a **14% margin** — the tightest of the two measures, and the one the proposed check guards.
- **Peak concurrency: 16**, worst case across all six maps. Method, stated so it is reproducible: each wave is replayed on its own through `CTD3Engine.step` at a fixed 16.67 ms tick with the wave's real spawn queue and **no towers placed**, and the maximum of `state.enemies.length` is taken; the replay ends when the spawn queue drains, so leaks reduce the live count but never terminate the measurement. That is a spawn-schedule-and-traversal bound, not a gameplay figure. 16/35 is a 54% margin.

**The two margins are not the same and the smaller one governs.** An earlier draft headlined the concurrency figure, which flatters: 30/35 is five spawns from the ceiling, 16/35 is nineteen. No comparison against the current campaign's concurrency is offered, because no in-repo method reproduces a single agreed figure for it — the editor's own estimator gives 16 for shipped content and a no-death traversal walk gives 25. The claim here is only that **both measures sit under the ceiling on the new content, and the total-spawn measure does so for the first time.**

**The finding that changes the character of this decision.** The current campaign's largest wave is **Forest w8 at 38 effective spawns** — `shielded ×6 + runner ×10 + skirmisher ×6 + heavy ×4 + slime ×4`, where the 4 slimes walk to **12** bodies. That is **above the 35 ceiling ADR-038 D13 sets**, and it has been shipped since ADR-036 CH-3. An earlier draft of this ADR reported the current maximum as 31 (Riverbend w8) by failing to walk the slime split — the exact arithmetic the proposed check performs.

So, said plainly rather than flatteringly: **the campaign breaches its own spawn ceiling today, and this design is the first time it does not** (38 → 30).

**The consequence for sequencing, which must not be glossed.** A `campaign-spawn-bound:<map>` check added to `tools/sim-harness.cjs` **fails on shipped content**. It is therefore not a free "added guard" that could land at any time — it is only satisfiable once the wave rewrite lands, and it must be introduced **in or after** that commit, never before. It uses the same split-walking measure `endless-spawn-bound` uses, with the ceiling hard-coded in the harness rather than imported from the module under test, for the reason the endless check already states: *a threshold imported from the module under test can be raised by the same edit that breaks it.*

**What it does and does not close.** It gives the harness a campaign-side spawn bound it has never had. It does **not** replace the editor's W8 concurrency estimator, which remains browser-only; the concurrency figure above is measured by hand and reported, not guarded. Closing that properly is a separate piece of work and is not claimed here.

This is the only change to harness *source* this sprint makes. Four existing checks nevertheless gain a new subject the moment `drake` enters `ENEMIES`, because they enumerate the table rather than a fixed list: `content-reachable:drake`, `spawn-and-kill:drake`, and both `enemy-vis-covers-roster` / `enemy-vis-clips-resolve`. The last two **fail immediately** unless the GLB, its `MANIFEST.json` entry, and an `ENEMY_VIS` row with a resolving `moveClip` all land in the same commit as the `entities.js` line — which is a constraint on how the type is landed, and is recorded here so it is designed for rather than discovered.

---

## Consequences

**Good:** every wave can be named, and the name tells the player what to build. Each map is different from every other map in kind rather than only in difficulty. The campaign gains a mid-wave breath on all 48 waves, where today only 10 have one. Wave 1 is finally the smallest wave on every map. Air raids become a real puzzle instead of a costume. The largest wave drops from 38 effective spawns to 30, putting the campaign under its own D13 ceiling for the first time. The `ENEMIES` table's HP-per-gold distortion is now written down where the next tuner will find it, and the exercise surfaced that **Warden answers no wave shape** — a fact the cycle-4 tower decision needs.

**Costs and risks, named:**

- **The feel is unverified.** Every number here is harness-measured; none of it has been played. The campaign is being re-imagined on the strength of a curve and a design argument, and the operator playtest is the only thing that can settle whether "The Running Tide" is thrilling or exhausting. This is the same risk ADR-038 D16 accepted knowingly for endless, taken again with open eyes.
- **Scripted builds do not feel the drake.** All three win every map on both difficulties with gold to spare, so the completability gate passes — but that means the sim **cannot** confirm the drake actually forces Mage. It confirms only that it does not make anything unwinnable. The anti-physical check is a claim about human play, and it is untested.
- **Juggernaut exclusivity narrows exposure.** A player who never reaches 5★ never meets one. Judged correct — a signature that appears everywhere is not a signature — but it is a real reduction in variety on two maps.
- **Two finales are led by types they do not thematically own**, pending the surround work (D28's anchor rule). Tidewater's and Snowfall's identities are slightly muted at their loudest moment, on purpose, until figure-ground lands.
- **W1 wave-ramp warns remain, and rise.** The editor's W1 rule wants 1.10–1.40× wave-to-wave HP. ADR-037 §2.1 measured and ratified the *current* campaign at ×1.409–1.482 geometric mean; this design steepens to **×1.444–1.532**, which takes W1 warns from **29 → 31**. Satisfying W1 would mean cutting late HP ~25% and late income with it, trading a **hard** gate (completability) against an **advisory** one. Refused for the same reason §2.1 refused, and recorded as a further step away from the advisory band rather than as compliance with it.
  The wave-warn arithmetic, stated exactly so the improvement is not overstated: **66 → 31** is 37 W2 warns cleared and 2 W1 warns added (37 − 2 = 35 net). It is *not* "entirely by clearing W2".
- **One target is missed.** Tidewater w3 lands 0.752 against a 0.72 target — heavy's 110-HP granularity leaves no composition between it and 0.60. Monotonicity holds; recorded rather than forced.

**Rejected alternatives:**

- **Shuffle the campaign's wave order (ETD's other half).** Rejected: ADR-036 D5 assigns shuffle to endless and keeps the campaign authored and fixed-order; an 8-wave run has no room for a shuffled middle, and star thresholds assume a fixed difficulty.
- **Import several new types to widen the palette.** Rejected under ADR-039 D25's scope rule — import only what a wave references. Three cells of the mobility × mitigation matrix are empty; only **air + armor** changes which tower is correct rather than which creature is on screen, so one type fills it and the other two stay empty.
- **Unfreeze existing `ENEMIES` hp/bounty to fix the HP-per-gold distortion.** Tempting and refused: it is a cross-map global (ADR-036 D2's own note), it would make the re-baseline un-attributable, and the distortion is now documented for whoever takes it on deliberately.
- **Re-shape D2's band to accommodate archetype variety.** Rejected — see D31; the band and the variety turned out not to conflict once composition and magnitude were separated.
- **Give every map a boss finale.** Rejected: Mountain's captain is the campaign's single climax and cheapens if repeated. ADR-030's Snowfall task list already ruled the same way — *"Final wave does NOT include `captain` (Captain is Mountain's signature; keep maps distinct)"* — and `maps.js`'s Snowfall comment repeats it. (The narrower ADR-030 wording governs its final wave specifically; extending it to "no captain anywhere but Mountain" is this ADR's step, taken deliberately.)

---

## Out of scope

- **The roster-polish cluster** — figure-ground surround, flyer ground discs, death animations, the low-power degradation curve, enemy icons, footstep audio. A later sprint; D28's anchor rule names the first of these as its unblock.
- **ADR-038 T-1..T-10** — endless calibration (which owns the drake-in-endless question per D32), leaderboard, layout generator, editor items.
- **Tower changes of any kind**, including tower-roster depth (ADR-038 §3(e)/D20, cycle 4).
- **Endless calibration or any `endless.js` edit** (D32).
- **A HUD wave-identity label.** The waves now have names; whether the player is *shown* them is a UI question this ADR deliberately does not settle. Assessed as an adjacency during the wave chunk and recorded there.
- **Promoting D28's anchor ratio to a harness check.** Cheap and worth doing, but it is a second harness-source change and this sprint declares exactly one (D33). Carried forward.
- **Any Unity or WC3-extracted asset** — excluded by ADR-039 D22, permanently. The `docs/td-comparison` benchmark is read-only design reference, as it has been since ADR-036.
