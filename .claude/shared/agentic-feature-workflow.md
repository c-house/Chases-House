# Agentic Feature Workflow: High-Quality, Unprecedented Work

A step-by-step protocol for developing features where quality is critical and the work has limited precedent in the codebase. Built around Claude Code with Opus, plan mode, `/review-plan`, and `feature-dev`.

## When to use this protocol

Use this protocol when **both** apply:

- **Hostile**: getting it wrong is expensive (security, data integrity, performance budgets, multi-team interfaces, anything that hits production)
- **Unprecedented**: limited precedent in the codebase or the wider ecosystem — you can't fall back on copying an existing pattern

For routine work (bug fixes, single-hook tweaks, well-established patterns), this is overkill — drop to plan-mode → direct-agent execution and skip most of the ceremony.

## Three meta-principles

The whole protocol applies these three ideas. Every step below is one of them in action.

**1. Different cognitive modes for different tasks.**
Building, reviewing, and debugging are different cognitive modes — even for the same model. Building defends decisions; reviewing attacks them; debugging reconstructs intent from behavior. Switch modes deliberately via prompt framing and (often) different sessions.

**2. Fresh context as a deliberate tool.**
A session that built X shares X's blind spots. The same model in a new session finds different (often better) problems. Fresh context is the single highest-ROI discipline for adversarial review and debugging.

**3. Force tacit knowledge into explicit artifacts.**
Constraints, design rationale, root causes — these are unreliable while tacit. The discipline of writing them down is half the value, because articulation exposes the assumptions hiding behind "obvious."

## Glossary

- **Plan mode** — Claude Code mode (Shift+Tab to toggle) where the agent produces an implementation plan that you approve before any action runs. Conversational.
- **`/feature-dev:feature-dev`** — plugin command that orchestrates explore → spec → plan → implement → verify as a pipeline, often spawning specialized subagents per phase.
- **`/review-plan`** — project-local command (`.claude/commands/review-plan.md`) that launches an adversarial code-reviewer subagent against a plan document.
- **Direct agent** — running a normal Claude Code session without plan mode or pipeline orchestration; the model executes tools immediately based on conversation.
- **Fresh context** — a new Claude Code session (or subagent invocation) that does not inherit your previous conversation. Critical for adversarial review and debugging.
- **Max thinking** — extended-thinking budget set to maximum. Used throughout this protocol; see "Max-thinking guardrails" for the prompt-level mitigations.

---

## The protocol

### Phase 0 — Reconnaissance & constraints

#### Step 1: Map the terrain

- **Tool**: Direct agent (no plan mode yet)
- **Model**: Opus, max thinking
- **Action**: Survey the code area the work will touch. List files, the abstractions in each, the patterns this work will sit next to.
- **Prompt shape**:
  > "Survey [area]. List files, the abstractions in each, the patterns I'd be building near. Cite line numbers. Observation-only task. Do NOT propose, suggest, infer intent, or recommend changes. If you find yourself wanting to suggest something, list it under 'Out of scope' and move on. Optimize for accuracy, not insight."
- **Failure mode prevented**: Planning against an imagined codebase.
- **Gate**: You can name the 5–10 files this work touches and the existing patterns it must coexist with, without checking the doc.

#### Step 2: Constraints inventory

- **Tool**: Direct conversation, append to terrain doc
- **Model**: Opus, max thinking
- **Action**: List hard constraints (must not violate), soft constraints (should not violate without reason), and **unknowns** (things you'd need to learn before designing).
- **Prompt shape**:
  > "Given this terrain, list hard constraints, soft constraints, and unknowns. For each unknown, note what I'd need to find out. Don't propose solutions. Observation-only."
- **Failure mode prevented**: Discovering constraints mid-implementation, which always punishes harder than declared constraints.
- **Gate**: Constraints are concrete enough that a violation is unambiguous. "Should be fast" is not a constraint. "P99 < 200ms under 100 RPS" is.

---

### Phase 1 — Design

#### Step 3: Plan-mode draft

- **Tool**: **Plan mode**
- **Model**: Opus, max thinking
- **Action**: Draft an architecture given the terrain and constraints.
- **Prompt shape**:
  > "Given [terrain] and [constraints], draft an architecture. Cover: file layout, key interfaces with type signatures, data flow, lifecycle (startup/shutdown/error), observability hooks, security surface, failure modes. Identify the 3 hardest decisions and your reasoning for each, including alternatives you considered and rejected. Scope is fixed: [exact scope]. Do not expand scope or propose adjacent improvements."
- **Failure mode prevented**: Settling on the first architecture that "seems fine."
- **Gate**: You have something concrete enough to attack.

#### Step 4: Conversational pushback

- **Tool**: Continue plan-mode session
- **Model**: Same (Opus, max thinking)
- **Action**: Argue with the plan. Bring domain knowledge, stakeholder context, and hostile-environment awareness the model lacks.
- **Prompts** (examples, not a template):
  - "Why not X instead?"
  - "What breaks under concurrent Y?"
  - "Where's the seam if requirement Z changes?"
  - "What's the worst-case latency when [bottleneck] backs up?"
- **How many rounds**: Until you run out of *objections*, not patience. If you're impatient with yourself rather than the model, you're not done — take a walk, come back.
- **Failure mode prevented**: Anchoring. Once a plan is written, both you and the model start defending it.
- **Gate**: Every concern was either addressed in the design or consciously accepted with reasoning.

#### Step 5: First adversarial review

- **Tool**: **`/review-plan`** (spawns a subagent with fresh context)
- **Model**: Opus, max thinking, **fresh context**
- **Action**: Run an adversarial review against the plan. Brief the reviewer on the plan, **not on the justifications** — biasing it with rationale defeats the point.
- **Prompt shape** (the `/review-plan` skill handles this):
  > "Critically evaluate this plan against DRY/SOLID/YAGNI/KISS and spaghetti-code risks. For each concern: quote the exact text or line that's problematic, state the failure scenario, estimate likelihood (low/medium/high). Concerns without concrete evidence are noise — do not include them."
- **Failure mode prevented**: Author's blind spots persisting into implementation.
- **Gate**: Every critical and major flag is resolved (changes made) or consciously accepted (you can articulate why this concern doesn't matter here).

#### Step 6: Refine + second adversarial pass

- **Tool**: Plan mode again, then `/review-plan` again with **fresh context**
- **Model**: Opus, max thinking
- **Action**: Incorporate Round 1 feedback. Re-run adversarial review if changes were structural. Two rounds is right for hostile/unprecedented work; three has diminishing returns.
- **Failure mode prevented**: Fix-induced bugs in the design phase — changes made to address Round 1 silently introduced new flaws.
- **Gate**: Second review surfaces only minor items or things already considered and rejected with rationale.

#### Step 7: Serialize the plan to a spec doc

- **Tool**: Direct agent
- **Model**: Opus, max thinking
- **Action**: Convert the hardened plan into an exhaustive spec document. This is the contract feature-dev will execute against.
- **Prompt shape**:
  > "Convert this plan into a spec document with: file manifest (path + purpose), all interfaces with full type signatures, schemas with every field (types/constraints/defaults), task list with dependencies, test strategy per component, observability hooks, rollback procedure. Spec is a contract, not an explanation — every section must be in one of those categories. Rationale belongs in the ADR (separate doc), not the spec. If you find yourself writing 'we chose X because Y', stop — that belongs in the ADR."
- **Failure mode prevented**: Underspecification. Symptom: during implementation, the agent asks clarifying questions or invents answers.
- **Gate**: A stranger could implement from this without asking you anything. Test it: ask Opus in a *fresh session* to read just the spec and tell you what's ambiguous. If it finds nothing, the spec is done.

---

### Phase 2 — Implementation

#### Step 8: Kick off feature-dev

- **Tool**: **`/feature-dev:feature-dev`** pointed at the spec doc
- **Model**: Opus orchestrator + Opus workers, max thinking
- **Action**: Begin pipeline execution against the spec.
- **Critical instructions to include**:
  > "Treat `[path-to-spec]` as authoritative. Do NOT re-plan. Implement task-by-task. Pause at each task boundary for review before proceeding to the next. Implement exactly what the spec specifies. Do not add: extra error handling beyond spec, abstractions or helper functions not in the spec, configuration options not in the spec, defensive patterns for failures the spec doesn't enumerate. If you believe something is missing from the spec, STOP and report it — do not implement around the gap."
- **Failure mode prevented**: Pipeline silently re-deriving the plan and drifting from your spec.
- **Gate**: If feature-dev runs a spec phase, verify its output matches your serialized spec. If it diverges, stop and reconcile before any code is written.

#### Step 9: Implement with checkpoints

- **Tool**: feature-dev continues
- **Model**: Same
- **Action**: Stay engaged at every task boundary. Read every diff. Don't approve mass batches.
- **Discipline**: Set a diff-complexity budget per task (e.g., ~200 lines or ~3 files). If a task's diff exceeds it, that's a signal of either spec issue (task too big) or over-engineering. Push back.
- **Failure mode prevented**: Big-bang merge syndrome — feature appears to work, but subtle drift accumulated across tasks. Bisecting later is expensive.
- **Gate**: Each task's diff matches the spec for that task; tests for the task pass; no scope creep.

#### Step 10: Verify phase

- **Tool**: feature-dev's verify, then manual end-to-end
- **Model**: Opus, max thinking
- **Action**: Run tests, drive the feature end-to-end, exercise the failure modes identified in Step 2 (constraints inventory).
- **For unprecedented work**: spend disproportionate verify time on the unprecedented bits. Existing test patterns don't cover that space; your intuition about edge cases is least reliable there.
- **Failure mode prevented**: "Looks done but isn't." Tests pass; deploys; breaks in production on the failure mode you knew about but didn't exercise.
- **Gate**: All green AND you've personally driven the feature through its hostile scenarios.

---

### Interlude — Debug protocol

Triggers whenever something surprises you (verify fails, behavior diverges from spec, edge case bites mid-implementation). **Suspend** the current phase and run this protocol — don't try to debug-and-build simultaneously.

#### D1: Isolate

- **Tool**: Direct agent, **fresh context window** — non-negotiable
- **Model**: Opus, max thinking
- **Action**: Reduce the failure to a minimal reproducible trigger.
- **Prompt shape**:
  > "Symptom: X. Expected: Y. Relevant code: [paths with line numbers]. Reproduce the failure. Identify the smallest input that triggers it. Do NOT propose a fix yet — only the repro."
- **Why fresh context**: The session that built the bug shares the bug's blind spots. Same Opus, new session, different findings. This is the single highest-ROI move in the protocol.
- **Failure mode prevented**: Debugging the wrong thing. Without a minimal repro, you're chasing symptoms that may have multiple causes.
- **Gate**: The failure is deterministic and you can describe it in one sentence.

#### D2: Diagnose

- **Tool**: Same fresh session
- **Model**: Opus, max thinking
- **Action**: Identify root cause via ranked hypotheses with evidence. **No fix yet.**
- **Prompt shape**:
  > "Given this repro, identify root cause. List the 2–3 most plausible causes ranked by likelihood, with evidence for each from the code or repro behavior. Distinguish symptom from cause. Do NOT propose a fix."
- **Failure mode prevented**: Symptom-fixing. Patch makes the symptom go away; underlying cause hits again next month in a different form.
- **Gate**: Top hypothesis has concrete evidence (not just plausibility), or you have a discriminating test.

#### D3: Test the hypothesis

- **Tool**: Direct agent
- **Model**: Opus, max thinking
- **Action**: Confirm hypothesis before fixing. Logging, a debug test, or direct inspection.
- **Prompt shape**:
  > "Confirm hypothesis #1 by [specific evidence-gathering action]. Do NOT fix yet — only confirm."
- **Failure mode prevented**: Fixing the wrong cause. You skip confirmation; symptom disappears for unrelated reasons; real bug returns later.
- **Gate**: Root cause is proven, not assumed.

#### D4: Propose the minimal fix

- **Tool**: Direct agent
- **Model**: Opus, max thinking
- **Action**: Smallest possible diff that addresses root cause.
- **Prompt shape**:
  > "Minimum-change fix only. No refactoring, no defensive additions, no 'while I'm here' cleanups, no comment additions. The change must be the smallest diff that addresses root cause and passes the regression test. Explain why this addresses root cause and not symptom. List what else this fix touches (callers, related state, error paths) and why those impacts are safe. If you see other improvements worth making, list them separately as follow-ups — do not include them in this fix."
- **Failure mode prevented**: Over-fix introducing new regressions. Every line of fix is a new regression surface.
- **Gate**: Fix is minimal, root-cause-addressing, with ripple analysis you find convincing.

#### D5: Regression net

- **Tool**: Direct agent
- **Model**: Opus, max thinking
- **Action**: Write a test that fails on the buggy version and passes after the fix.
- **Prompt shape**:
  > "Write a regression test that fails on the buggy version and passes after the fix. This bug should never recur silently."
- **Failure mode prevented**: Bug reintroduction during future refactors.
- **Gate**: Test exists, runs in CI, has a clear name that says what it's preventing.

#### D6: Post-mortem note

- **Tool**: Append to spec doc or ADR
- **Model**: Opus, max thinking
- **Action**: One paragraph: what failed, why (root cause, not symptom), what the fix was, what the design should change to prevent this class of bug. Maximum 1 paragraph.
- **Failure mode prevented**: Lost lessons. Six months from now, someone (you) will be tempted to "improve" the code in a way that reintroduces the bug. The note is the guardrail.
- **Gate**: Note exists in a durable place. Then **resume** the phase you suspended.

---

### Phase 3 — Post-implementation hardening

#### Step 11: Adversarial diff review (fresh context)

- **Tool**: Direct agent, **fresh session**
- **Model**: Opus, max thinking
- **Action**: Adversarial review of the full diff. Brief the reviewer on the spec, **not on what was hard about the implementation**.
- **Prompt shape**:
  > "Review this diff [PR or branch] adversarially. Feature: [one paragraph]. Constraints: [from Step 2]. Spec: [path]. Find: security issues, race conditions, error paths that swallow failures, spec violations, missing tests, over-engineering, scope creep. For each concern: quote the exact text/line, state the failure scenario, estimate likelihood. Concerns without concrete evidence are noise — do not include them."
- **Failure mode prevented**: Shipping with subtle issues the implementation session was blind to.
- **Gate**: All critical/major addressed; minors triaged with decisions.

#### Step 12: Stress the unprecedented bits

- **Tool**: Manual exercise with agent assistance
- **Model**: Opus, max thinking
- **Action**: Deliberately break the unprecedented parts. Concurrency, malformed input, resource exhaustion, network partition, restart mid-operation.
- **Scope discipline**: Generate scenarios from the constraints inventory and the spec's failure modes — nothing else. Rank by likelihood × impact. Test top 5. Document the rest as known-untested for the ADR.
- **Failure mode prevented**: Production discovers the failure modes you should have discovered in testing.
- **Gate**: Either fixed, or known limitations documented in the ADR.

#### Step 13: ADR

- **Tool**: Direct agent
- **Model**: Opus, max thinking
- **Action**: Document context, options considered, decision, consequences. Reference the spec, constraints, and any debug post-mortem notes.
- **Discipline**: Maximum ~1 page (~400 words). Use bulleted lists. Every sentence must convey information a future maintainer needs.
- **Failure mode prevented**: Future "improvements" that destroy load-bearing design decisions because nobody knew they were load-bearing. Bus factor of 1 forever.
- **Gate**: Future-you reading this in 6 months can reconstruct *why*, not just *what*.

#### Step 14: Human final read — the 3am test

- **Tool**: Your eyes (and ideally a teammate's)
- **Action**: Read the diff with one question: *"If I get paged at 3am because this broke, will I be able to debug it? Will the logs tell me what I need? Will the rollback work? Will the error messages help me find the cause?"*
- **Failure mode prevented**: Shipping code that's correct but un-operatable.
- **Gate**: Honest answer is yes. If no, fix the gap (better logging, clearer errors, simpler rollback) before merging.

---

## Summary card

| Phase | Step | Tool | Fresh context? |
|---|---|---|---|
| 0 | 1. Recon | Direct agent | — |
| 0 | 2. Constraints | Conversation | — |
| 1 | 3. Plan draft | Plan mode | — |
| 1 | 4. Pushback | Plan mode (same) | — |
| 1 | 5. Adversarial #1 | `/review-plan` | **yes** |
| 1 | 6. Refine + #2 | Plan mode + `/review-plan` | **yes** for #2 |
| 1 | 7. Serialize | Direct agent | — |
| 2 | 8. Kickoff | feature-dev | — |
| 2 | 9. Checkpoints | feature-dev | — |
| 2 | 10. Verify | feature-dev / manual | — |
| Debug | D1. Isolate | Fresh agent | **yes** |
| Debug | D2. Diagnose | Fresh agent (same as D1) | **yes** |
| Debug | D3. Test hypothesis | Direct agent | — |
| Debug | D4. Minimal fix | Direct agent | — |
| Debug | D5. Regression test | Direct agent | — |
| Debug | D6. Post-mortem | Direct agent | — |
| 3 | 11. Diff review | Fresh agent | **yes** |
| 3 | 12. Stress | Manual + agent | — |
| 3 | 13. ADR | Direct agent | — |
| 3 | 14. 3am test | You | — |

Model is **Opus, max thinking** at every step. Guardrails for that choice live in the prompts (see next section).

---

## Max-thinking guardrails

Max thinking will use its budget. Your job is to direct it at the right things and prevent it from over-engineering steps that should be lean. Each guardrail is a phrase to include in the prompt for the relevant step.

### Risk 1: Over-elaboration in perception-mode steps (Steps 1, 2)
**Failure mode**: Recon turns into proposals; constraints list grows speculative items.
**Guardrail**:
> "Observation-only task. Do NOT propose, suggest, infer intent, identify opportunities, or recommend changes. Report only what you can cite by file:line. If you find yourself wanting to suggest something, list it under 'Out of scope — for later consideration' and move on. Optimize for accuracy, not insight."

### Risk 2: Plan-mode bloat (Steps 3, 4)
**Failure mode**: Plan grows tangential options, hypothetical features, "while we're here" expansions.
**Guardrail**:
> "Scope is fixed: [exact scope]. Do not expand scope, propose adjacent improvements, or introduce abstractions for features not in scope. For every design element, justify why it's necessary for *this* scope, not future possibilities. YAGNI is a hard constraint, not a preference."

### Risk 3: Adversarial-pass invention (Steps 5, 6, 11)
**Failure mode**: Reviewer manufactures concerns to seem useful.
**Guardrail**:
> "Only flag concerns where you can cite specific evidence in the plan/diff. For each concern: quote the exact text or line that's problematic, state the failure scenario, estimate likelihood (low/medium/high). Concerns without concrete evidence or a plausible failure scenario are noise — do not include them. Quality over volume."

### Risk 4: Spec-doc bloat (Step 7)
**Failure mode**: Serialization becomes elaboration. Spec grows from "the contract" into "the explanation of why the contract is good."
**Guardrail**:
> "Spec is a contract, not an explanation. Every section must be in one of: [interfaces, schemas, file manifest, task list, test strategy, rollback]. Rationale goes in the ADR (separate doc), not the spec. If you find yourself writing 'we chose X because Y', stop — that belongs in the ADR. The spec answers 'what', not 'why'."

### Risk 5: Worker over-engineering (Steps 8, 9)
**Failure mode**: Workers add abstractions, sophisticated error handling, extensibility hooks the spec didn't ask for.
**Guardrail (most important — put this in feature-dev's worker prompt template)**:
> "Implement exactly what the spec specifies. Do not add: extra error handling beyond spec, abstractions or helper functions not in the spec, configuration options not in the spec, comments explaining why code is good, defensive patterns for failures the spec doesn't enumerate. If you believe something is missing from the spec, STOP and report it — do not implement around the gap. The spec is authoritative; your job is faithful execution."

### Risk 6: Checkpoint review fatigue (Step 9)
**Failure mode**: Longer diffs per task require more review; you skim; you miss things.
**Guardrail (process, not prompt)**:
> Set a diff-complexity budget per task (~200 lines or 3 files). If exceeded, push back: "This is larger than the spec implied — explain what's necessary vs added." Recurring over-runs mean Risk 5 guardrail isn't tight enough.

### Risk 7: Over-fix during debug (D4)
**Failure mode**: "Minimal fix" becomes thorough fix — refactoring nearby code, adding defensive checks. Each addition is a regression surface.
**Guardrail**:
> "Minimum-change fix only. No refactoring, no defensive additions, no 'while I'm here' cleanups, no comment additions. The change must be the smallest diff that addresses root cause and passes the regression test. If you see other improvements worth making, list them separately as follow-ups — do not include them in this fix."

### Risk 8: ADR / post-mortem essayification (D6, Step 13)
**Failure mode**: Documentation becomes essays; future readers skim past walls of text.
**Guardrail**:
> "Maximum 1 page (~400 words) for ADR. Maximum 1 paragraph for post-mortem. Use bulleted lists. Every sentence must convey information a future maintainer needs — if it's tutorial, background, or restated obvious, cut it."

### Risk 9: Stress-phase scope creep (Step 12)
**Failure mode**: 30 scenarios to test, half unrelated to actual failure modes.
**Guardrail**:
> "Generate stress scenarios from the constraints inventory and the spec's failure modes — nothing else. Rank by likelihood × impact. Test top 5. Document the rest as known-untested for the ADR."

---

## Signals to watch for during execution

These indicate max-thinking is being spent on the wrong things. Tighten the guardrail and re-prompt.

| Signal | Likely cause | Tighten |
|---|---|---|
| Recon mentions things "we could improve" | Risk 1 too loose | Repeat "observation-only" |
| Plan has bullets starting "We could also..." | Risk 2 violation | Re-emphasize scope is fixed |
| Review lists "consider that..." without evidence | Risk 3 violation | Demand quoted evidence per concern |
| Spec contains sentences explaining *why* | Risk 4 violation | Move rationale to ADR; cut from spec |
| Task diff is 3x what spec implied | Risk 5 violation | Re-prompt: "spec is exhaustive — do not add" |
| Fix diff is bigger than the buggy code | Risk 7 violation | Re-prompt for minimum-change fix only |
| ADR exceeds 1 page | Risk 8 violation | Compress; cut tutorial content |
| Stress phase generates >10 scenarios | Risk 9 violation | Constrain to constraints + spec failure modes |

---

## When to deviate

Every step earns its place by preventing a failure mode you can name. If you can't name what a step prevents in your specific context, skip it.

- **Less hostile than expected**: drop the second adversarial pass (Step 6); drop the stress phase (Step 12).
- **Less unprecedented than expected**: workers can drop to Sonnet in Phase 2; pattern-matching becomes reliable again.
- **Smaller scope**: collapse Steps 1–2 into one; collapse Steps 8–10 into direct agent execution without feature-dev.
- **Catastrophic-if-wrong** (security boundaries, data loss potential, payments): *add* a third adversarial review; *add* a separate security-focused review; *add* a chaos-engineering session beyond Step 12.

---

## Variable-thinking variant (cost-constrained)

If running max-Opus-everywhere isn't an option, this is the same protocol with thinking levels tuned to each step's cognitive demand:

| Phase | Step | Model | Thinking |
|---|---|---|---|
| 0 | 1. Recon | Opus | low |
| 0 | 2. Constraints | Opus | low |
| 1 | 3. Plan draft | Opus | high |
| 1 | 4. Pushback | Opus | high |
| 1 | 5. Adversarial #1 | Opus (fresh) | high |
| 1 | 6. Refine + #2 | Opus | medium / high |
| 1 | 7. Serialize | Opus | medium |
| 2 | 8. Kickoff | Opus / Opus | medium |
| 2 | 9. Checkpoints | Opus / Opus | medium |
| 2 | 10. Verify | Opus | medium |
| Debug | D1. Isolate | Opus (fresh) | high |
| Debug | D2. Diagnose | Opus (fresh) | high |
| Debug | D3. Test hypothesis | Opus | medium |
| Debug | D4. Minimal fix | Opus | medium |
| Debug | D5. Regression test | Opus | medium |
| Debug | D6. Post-mortem | Opus | medium |
| 3 | 11. Diff review | Opus (fresh) | high |
| 3 | 12. Stress | Opus | medium |
| 3 | 13. ADR | Opus | medium |
| 3 | 14. 3am test | You | — |

**Where capability is least substitutable**: Steps 3 (architecture), 5/6/11 (adversarial review), D1/D2 (diagnosis). Keep Opus + high thinking there even when you cut elsewhere.

**Where execution is mostly substitutable**: Steps 8–10 (implementation) can drop to Sonnet workers when the spec is genuinely concrete and the work is precedent-rich. Don't drop to Sonnet for *unprecedented* implementation — Sonnet's pattern-matching strengths break down where there's no pattern.

---

## The two key takeaways

1. **Spend reasoning where the model is the bottleneck. Spend speed where the spec is the bottleneck.** Max-think is most valuable on architectural reasoning, adversarial review, and diagnosis — exactly the steps where the spec can't carry the load. On execution against a sharp spec, the guardrails matter more than the thinking budget.

2. **Fresh context is a tool, not a courtesy.** The single most-skipped discipline in real workflows is bringing a fresh session for adversarial review and debugging. It costs almost nothing and prevents the most expensive class of bugs — the ones the building session was structurally unable to see.
