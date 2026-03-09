Think about how to create an ornate or visually appealing personal webpage called Chase's House (URL is literally chases.house).  create a header with different options (all are coming soon, except for the Games page).

---

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic with a cozy, homey atmosphere — the site is literally called "Chase's House," so lean into that. Think warm lighting, inviting textures, and comfortable spaces. Use CSS variables for consistency. Warm dominant colors with complementary accents outperform cold, clinical palettes. Draw from cozy interior design, cabin aesthetics, and warm cultural motifs for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!

---

## Implementation Requirements

### CRITICAL: Development Principles

Implementation MUST adhere to these principles **in priority order**:

#### 1. DRY (Don't Repeat Yourself) - HIGHEST PRIORITY
- Extract common logic into reusable functions
- No copy-paste code between similar handlers
- Centralize validation, parsing, and formatting logic
- If you write similar code twice, refactor immediately

#### 2. YAGNI (You Aren't Gonna Need It)
- Implement ONLY what is specified in this ADR
- No "future-proofing" or speculative features
- No extra configuration options "just in case"
- If it's not in the requirements, don't build it

#### 3. SOLID Principles
- **S**ingle Responsibility: Each function/class does one thing
- **O**pen/Closed: Extend via new code, don't modify working code
- **L**iskov Substitution: Subtypes must be substitutable
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: Depend on abstractions, not concretions

#### 4. KISS (Keep It Simple, Stupid) - LOWEST PRIORITY (but still important)
- Prefer simple solutions over clever ones
- Readable code over compact code
- Obvious implementations over elegant abstractions

### CRITICAL: Tooling

Use `/feature-dev` for architecture planning and `/frontend-design` for any new UI components.

/feature-dev
/frontend-design

### CRITICAL: Implementation Process

Each implementation step MUST follow this process:

```
For EACH code change:

1. STATE the specific change you're about to make
2. THINK through the implications:
   - Does this duplicate existing code? (DRY check)
   - Is this actually needed right now? (YAGNI check)
   - Does this class/function do only one thing? (SOLID check)
   - Is there a simpler way? (KISS check)
3. SHARE your internal reasoning explicitly
4. IMPLEMENT only after reasoning is complete
5. VERIFY the change against all four principles
6. REFACTOR if any principle is violated
```

Example reasoning format:
```
## Step N: [Description]

**Change**: Adding X to Y

**DRY Analysis**:
- Is this logic duplicated elsewhere? [Yes/No]
- If yes, should I extract to shared function? [Decision]

**YAGNI Analysis**:
- Is this required by the ADR? [Yes/No]
- Am I adding anything speculative? [Yes/No]

**SOLID Analysis**:
- Single Responsibility: Does this function do one thing? [Yes/No]
- Other relevant principles: [Analysis]

**KISS Analysis**:
- Is there a simpler approach? [Yes/No]
- Is this readable to someone unfamiliar? [Yes/No]

**Decision**: [Proceed / Refactor / Skip]

**Implementation**: [Code]
```
