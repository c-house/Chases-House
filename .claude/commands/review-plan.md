# Adversarial Plan Review

Run a critical code reviewer agent to evaluate the current plan against DRY, SOLID, YAGNI, KISS principles. The reviewer plays devil's advocate and looks for real problems.

## Instructions

You are orchestrating an adversarial code review. Follow these steps:

### Step 1: Identify the Plan

Determine what "the plan" is by checking these sources in order:

1. **User argument** — if the user passed a file path (e.g., `/review-plan docs/ADR/ADR-010.md`), read that file
2. **Active implementation plan** — check for any `IMPLEMENTATION_PLAN.md` in `ralph/` subdirectories (most recently modified)
3. **Recent ADRs** — check `docs/ADR/` for recently modified files
4. **Staged/unstaged git changes** — run `git diff --stat` and `git diff --cached --stat` to see what's being worked on
5. **Ask the user** — if none of the above yields a clear plan, ask what to review

### Step 2: Gather Context

Read the plan document and all source files it references. For each file mentioned or implicated by the plan:
- Read the relevant sections (use line ranges from the plan if specified)
- Note file sizes, existing patterns, and potential duplication targets

Also read:
- `CLAUDE.md` — for project engineering principles (DRY, SOLID, YAGNI, KISS definitions)
- Any shared utilities or components that overlap with the proposed changes

### Step 3: Build the Review Prompt

Construct a detailed adversarial review prompt with this structure, filled in from your research:

```
You are a critical, adversarial code reviewer. Your job is to find every violation of DRY, SOLID, YAGNI, KISS principles, and every source of spaghetti code in the proposed plan. Be ruthless — if something smells, call it out. Don't be polite. Find real problems.

## The Plan

[Summarize what's being added/changed and where, from Step 1]

[List each discrete change as ### Change N: title with description]

## What to Review

Evaluate against these principles strictly:

### DRY
[Identify specific duplication concerns — patterns repeated across files, inline logic that exists elsewhere, lookups that appear in multiple places. Ask pointed questions.]

### SOLID
[Identify SRP violations (large files getting larger, mixed concerns), OCP issues (modifications vs extensions), and interface problems. Ask pointed questions.]

### YAGNI
[Identify features, config options, CSS classes, or abstractions that may not be needed. Ask pointed questions.]

### KISS
[Identify unnecessarily complex patterns, deeply nested logic, or approaches where simpler alternatives exist. Ask pointed questions.]

### Spaghetti Code
[Identify coupling risks, tangled data flows, unclear ownership, circular dependencies. Ask pointed questions.]

## What to Read

[List specific files with line ranges the reviewer should examine to form their opinion]
```

### Step 4: Launch the Reviewer

Launch a `feature-dev:code-reviewer` agent with the constructed prompt. Use `description: "Adversarial plan review"`.

### Step 5: Report Results

Present the reviewer's findings to the user, organized by severity (critical → major → minor). Include the reviewer's specific suggestions for what should be done differently.

## Usage

```
/review-plan                          # Auto-detect current plan
/review-plan docs/ADR/ADR-010.md     # Review a specific plan document
/review-plan ralph/ralph-fog-of-war/IMPLEMENTATION_PLAN.md
```
