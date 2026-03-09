# Chrome DevTools MCP Server Comprehensive Guide

> **Purpose**: A quick-reference guide for effectively using Chrome DevTools MCP tools with AI coding assistants.
>
> **Why This Exists**: AI coding agents face a fundamental problem—they cannot see what the code they generate actually does when it runs in the browser. Chrome DevTools MCP bridges this gap by giving agents direct access to browser debugging capabilities.
>
> **Sources**: This guide synthesizes information from:
> - [Chrome DevTools Blog](https://developer.chrome.com/blog/chrome-devtools-mcp)
> - [GitHub Repository](https://github.com/ChromeDevTools/chrome-devtools-mcp/)
> - [MCP Architecture](https://modelcontextprotocol.io/docs/concepts/architecture)
> - [Anthropic Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
> - [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
> - [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)

### Primary Use Cases (from Chrome DevTools team + extended)

1. **Real-time verification** — Validate generated solutions work as intended
2. **Error diagnosis** — Uncover CORS, console, and network problems
3. **User flow testing** — Reproduce bugs through simulated interactions
4. **Layout debugging** — Address rendering issues using live browser data
5. **Performance optimization** — Conduct audits (LCP, traces, etc.)
6. **Responsive/device testing** — Test different viewports and network conditions

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Tool Inventory](#tool-inventory)
3. [Tool Deep-Dives](#tool-deep-dives)
4. [Screenshot vs Snapshot Decision Guide](#screenshot-vs-snapshot-decision-guide)
5. [Use Case Priority Matrix](#use-case-priority-matrix)
6. [Best Practices & Tips](#best-practices--tips)
7. [Common Pitfalls](#common-pitfalls)
8. [Configuration & Settings](#configuration--settings)
9. [Quick Setup](#quick-setup)
10. [Getting Started Tutorial](#getting-started-tutorial)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before using Chrome DevTools MCP, ensure you have the following installed:

### Required Software

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| **Node.js** | v20.19+ | LTS version recommended |
| **npm/npx** | Included with Node.js | Used to run the MCP server |
| **Chrome** | Current stable | Or Chrome Canary/Beta/Dev channels |

### Verify Prerequisites

```bash
# Check Node.js version (must be 20.19+)
node --version

# Check npm is available
npm --version

# Check npx is available
npx --version
```

### Platform-Specific Chrome Paths

The MCP server auto-detects Chrome, but manual paths may be needed:

| Platform | Default Chrome Location |
|----------|------------------------|
| **Windows** | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| **macOS** | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| **Linux** | `/usr/bin/google-chrome` or `chromium-browser` |

### MCP Client Required

You need an MCP-compatible client to use Chrome DevTools MCP:

- **Claude Code** (CLI) — `npm install -g @anthropic-ai/claude-code`
- **Claude Desktop** — Configuration via `claude_desktop_config.json`
- **Gemini CLI** — Google's AI coding assistant
- **Other MCP clients** — Any client supporting the MCP protocol

### Security Considerations

> ⚠️ **Important**: Chrome DevTools MCP "exposes content of the browser instance to the MCP clients allowing them to inspect, debug, and modify any data in the browser."
>
> — *[GitHub README](https://github.com/ChromeDevTools/chrome-devtools-mcp/)*

**Best practices**:
- Don't browse sensitive sites (banking, email) in MCP-connected browser
- Use `--isolated` flag for temporary profiles when testing
- Close the MCP browser session when not actively debugging
- The remote debugging port allows **any application on your machine** to control the browser

---

## Tool Inventory

Chrome DevTools MCP provides **26 tools** across **6 categories**:

| Category | Tools | Count |
|----------|-------|-------|
| **Input Automation** | `click`, `drag`, `fill`, `fill_form`, `handle_dialog`, `hover`, `press_key`, `upload_file` | 8 |
| **Navigation** | `close_page`, `list_pages`, `navigate_page`, `new_page`, `select_page`, `wait_for` | 6 |
| **Emulation** | `emulate`, `resize_page` | 2 |
| **Performance** | `performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight` | 3 |
| **Network** | `list_network_requests`, `get_network_request` | 2 |
| **Debugging** | `take_snapshot`, `take_screenshot`, `list_console_messages`, `get_console_message`, `evaluate_script` | 5 |

### Quick Reference: When to Use Each Category

```
UI Inspection      → Debugging tools (snapshot/screenshot)
User Simulation    → Input Automation + Navigation
Performance Audit  → Performance tools
API Debugging      → Network tools
Error Investigation→ Debugging tools (console)
Device Testing     → Emulation tools
```

---

## Tool Deep-Dives

### Debugging Tools

#### `take_snapshot`
**What it does**: Captures the DOM structure as an accessibility tree with unique element identifiers (UIDs).

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | string | Optional path to save snapshot to file |
| `verbose` | boolean | Include full a11y tree information (default: false) |

**Example**:
```
"Take a snapshot of the page to see all interactive elements"
```

**Best suited for**:
- ✅ Identifying elements before clicking/filling
- ✅ Data extraction from structured content
- ✅ Accessibility audits
- ✅ Understanding page structure
- ✅ Getting UIDs for subsequent interactions

**Key insight**: Always take a snapshot BEFORE using click/fill tools—you need UIDs from the snapshot to target elements.

---

#### `take_screenshot`
**What it does**: Captures a visual image of the page or specific element.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | string | Path to save screenshot |
| `format` | enum | `png`, `jpeg`, `webp` (default: png) |
| `quality` | number | 0-100 for JPEG/WebP compression |
| `fullPage` | boolean | Capture entire scrollable page |
| `uid` | string | Screenshot specific element by UID |

**Example**:
```
"Take a screenshot to verify the UI looks correct after changes"
```

**Best suited for**:
- ✅ Visual verification of UI changes
- ✅ Design bug confirmation
- ✅ Layout issue documentation
- ✅ Comparing before/after states
- ❌ NOT for data extraction (use snapshot)

---

#### `list_console_messages`
**What it does**: Lists all console output since last navigation.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `types` | array | Filter by type: `log`, `error`, `warn`, `info`, `debug`, etc. |
| `pageIdx` | number | Pagination page (0-based) |
| `pageSize` | number | Messages per page |
| `includePreservedMessages` | boolean | Include messages from last 3 navigations |

**Example**:
```
"List console errors to see what's failing"
→ mcp__chrome-devtools__list_console_messages with types: ["error"]
```

**Best suited for**:
- ✅ Finding JavaScript errors
- ✅ Debugging application state
- ✅ Verifying expected log output

---

#### `get_console_message`
**What it does**: Retrieves detailed information about a specific console message.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `msgid` | number | Message ID from list_console_messages |

**Use after**: `list_console_messages` to identify which message needs detail.

---

#### `evaluate_script`
**What it does**: Executes JavaScript in the page context and returns JSON-serializable results.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `function` | string | JavaScript function to execute |
| `args` | array | Optional arguments with UIDs to pass elements |

**Example**:
```javascript
// Get page title
"() => document.title"

// Get element text by UID
"(el) => el.innerText"

// Async operation
"async () => await fetch('/api/status').then(r => r.json())"
```

**Best suited for**:
- ✅ Reading application state
- ✅ Triggering actions not available via UI
- ✅ Complex data extraction
- ⚠️ Use sparingly—prefer native tools when available

**Safety Considerations** (from Anthropic Engineering):
- Scripts execute in the **browser context** with full page access
- Filter large results before returning to reduce token consumption
- Avoid exposing sensitive data (tokens, credentials) in script output
- Use try/catch for robust error handling in complex scripts

**Token-Efficient Pattern**:
```javascript
// ❌ Returns all data, wastes tokens
"() => document.body.innerHTML"

// ✅ Filters to relevant data only
"() => Array.from(document.querySelectorAll('.error')).map(e => e.textContent)"
```

---

### Input Automation Tools

#### `click`
**What it does**: Clicks on an element identified by UID.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | string | **Required**. Element UID from snapshot |
| `dblClick` | boolean | Double-click instead of single |

**Prerequisite**: Must have UID from `take_snapshot`.

---

#### `fill`
**What it does**: Types text into an input field or selects an option from a `<select>`.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | string | **Required**. Element UID |
| `value` | string | **Required**. Text to enter or option to select |

---

#### `fill_form`
**What it does**: Fills multiple form fields at once.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `elements` | array | Array of `{uid, value}` objects |

**Example**:
```json
{
  "elements": [
    {"uid": "input-name", "value": "John Doe"},
    {"uid": "input-email", "value": "john@example.com"}
  ]
}
```

**Best for**: Login forms, search forms, multi-field data entry.

---

#### `hover`
**What it does**: Moves mouse over an element to trigger hover states.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | string | **Required**. Element UID |

**Best for**: Revealing dropdown menus, tooltips, hover-dependent UI.

---

#### `press_key`
**What it does**: Simulates keyboard input including shortcuts.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Key or combination (e.g., `Enter`, `Control+A`, `Control+Shift+R`) |

**Modifiers**: `Control`, `Shift`, `Alt`, `Meta`

---

#### `drag`
**What it does**: Drags one element onto another.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `from_uid` | string | Element to drag |
| `to_uid` | string | Drop target element |

---

#### `handle_dialog`
**What it does**: Responds to browser dialogs (alert, confirm, prompt).

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | enum | `accept` or `dismiss` |
| `promptText` | string | Optional text for prompt dialogs |

---

#### `upload_file`
**What it does**: Uploads a file through a file input element.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `uid` | string | File input element UID |
| `filePath` | string | Local path to file |

---

### Navigation Tools

#### `navigate_page`
**What it does**: Navigates the current page to a URL or through history.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | enum | `url`, `back`, `forward`, `reload` |
| `url` | string | Target URL (only for type=url) |
| `ignoreCache` | boolean | Bypass cache on reload |
| `timeout` | number | Max wait time in ms |

---

#### `new_page`
**What it does**: Opens a new browser tab.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | **Required**. URL to load |
| `timeout` | number | Max wait time in ms |

---

#### `list_pages`
**What it does**: Returns all open browser tabs.

**Parameters**: None

---

#### `select_page`
**What it does**: Switches context to a different tab.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `pageIdx` | number | **Required**. Tab index from list_pages |
| `bringToFront` | boolean | Focus the tab visually |

---

#### `close_page`
**What it does**: Closes a browser tab (cannot close the last tab).

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `pageIdx` | number | **Required**. Tab index |

---

#### `wait_for`
**What it does**: Pauses until specified text appears on the page.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | **Required**. Text to wait for |
| `timeout` | number | Max wait time in ms |

**Best for**: Waiting for loading states, async content, navigation completion.

---

### Network Tools

#### `list_network_requests`
**What it does**: Lists all network requests since last navigation.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `resourceTypes` | array | Filter: `document`, `xhr`, `fetch`, `stylesheet`, `script`, `image`, etc. |
| `pageIdx` | number | Pagination page |
| `pageSize` | number | Requests per page |
| `includePreservedRequests` | boolean | Include requests from last 3 navigations |

**Example**:
```
"List all API requests"
→ resourceTypes: ["xhr", "fetch"]
```

---

#### `get_network_request`
**What it does**: Gets detailed info about a specific request including headers, body, response.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `reqid` | number | Request ID from list_network_requests (omit for currently selected in DevTools) |

---

### Performance Tools

#### `performance_start_trace`
**What it does**: Begins recording performance metrics.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `reload` | boolean | **Required**. Reload page after starting trace |
| `autoStop` | boolean | **Required**. Auto-stop when page loads |

**Typical flow**:
```
1. performance_start_trace (reload: true, autoStop: true)
2. Wait for trace to complete
3. performance_analyze_insight for specific metrics
```

---

#### `performance_stop_trace`
**What it does**: Stops an active trace recording.

**Parameters**: None

---

#### `performance_analyze_insight`
**What it does**: Extracts specific performance insights from a trace.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `insightSetId` | string | **Required**. ID from available insight sets |
| `insightName` | string | **Required**. e.g., `DocumentLatency`, `LCPBreakdown` |

---

### Emulation Tools

#### `emulate`
**What it does**: Simulates device conditions.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `geolocation` | object/null | `{latitude, longitude}` or null to clear |
| `networkConditions` | enum | `No emulation`, `Offline`, `Slow 3G`, `Fast 3G`, `Slow 4G`, `Fast 4G` |
| `cpuThrottlingRate` | number | 1-20 (1 = no throttling) |

---

#### `resize_page`
**What it does**: Changes viewport dimensions.

**Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `width` | number | **Required**. Viewport width |
| `height` | number | **Required**. Viewport height |

---

## Screenshot vs Snapshot Decision Guide

### Quick Decision Matrix

| Need to... | Use | Why |
|------------|-----|-----|
| See what the page looks like | **Screenshot** | Visual representation |
| Find an element to click | **Snapshot** | Provides UIDs |
| Verify CSS/layout changes | **Screenshot** | Visual comparison |
| Extract text content | **Snapshot** | Structured data |
| Debug accessibility | **Snapshot** | A11y tree structure |
| Document a bug visually | **Screenshot** | Evidence for humans |
| Understand page structure | **Snapshot** | DOM hierarchy |
| Check responsive design | **Screenshot** | Visual rendering |

### Decision Flowchart

```
                    ┌─────────────────────┐
                    │ What's your goal?   │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │ Interact│     │ Verify  │     │ Extract │
        │ with UI │     │ visuals │     │  data   │
        └────┬────┘     └────┬────┘     └────┬────┘
             │               │               │
             ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │SNAPSHOT │     │SCREENSHOT│    │SNAPSHOT │
        │ (UIDs)  │     │ (visual) │    │ (text)  │
        └─────────┘     └─────────┘     └─────────┘
```

### Typical Workflows

**Workflow A: Fix a UI Bug**
```
1. take_snapshot     → Understand page structure
2. take_screenshot   → Document current (broken) state
3. [make code changes]
4. navigate_page     → Reload
5. take_screenshot   → Verify fix visually
```

**Workflow B: Automate Form Submission**
```
1. take_snapshot     → Get UIDs for form fields
2. fill_form         → Enter data using UIDs
3. click             → Submit button
4. wait_for          → Success message
5. take_screenshot   → Confirm result
```

**Workflow C: Debug API Issue**
```
1. take_snapshot     → Identify action trigger
2. click             → Trigger the action
3. list_network_requests (types: ["xhr", "fetch"])
4. get_network_request → Inspect failing request
```

---

## Use Case Priority Matrix

### Scenario: Debugging UI Issues

| Priority | Tool | Purpose |
|----------|------|---------|
| 1️⃣ | `take_snapshot` | Understand current DOM state |
| 2️⃣ | `take_screenshot` | Visual confirmation |
| 3️⃣ | `list_console_messages` | Check for JS errors |
| 4️⃣ | `evaluate_script` | Inspect specific state |

*Source: Chrome DevTools Blog emphasizes "real-time verification" and "styling debugging" as primary use cases.*

---

### Scenario: Performance Analysis

| Priority | Tool | Purpose |
|----------|------|---------|
| 1️⃣ | `performance_start_trace` | Begin recording (reload: true, autoStop: true) |
| 2️⃣ | `performance_analyze_insight` | Examine LCP, FCP, etc. |
| 3️⃣ | `list_network_requests` | Identify slow resources |
| 4️⃣ | `emulate` | Test under throttled conditions |

*Source: GitHub README and Chrome Blog both highlight LCP analysis as a key capability.*

---

### Scenario: Network/API Debugging

| Priority | Tool | Purpose |
|----------|------|---------|
| 1️⃣ | `take_snapshot` | Find action that triggers request |
| 2️⃣ | `click` / `fill` | Trigger the API call |
| 3️⃣ | `list_network_requests` | Find the request (filter: xhr, fetch) |
| 4️⃣ | `get_network_request` | Inspect headers, body, response |
| 5️⃣ | `list_console_messages` | Check for CORS or other errors |

*Source: Chrome DevTools Blog mentions "analyzing network requests for CORS issues" as a primary use case.*

---

### Scenario: User Behavior Simulation

| Priority | Tool | Purpose |
|----------|------|---------|
| 1️⃣ | `navigate_page` | Go to starting point |
| 2️⃣ | `take_snapshot` | Get element UIDs |
| 3️⃣ | `fill` / `fill_form` | Enter user data |
| 4️⃣ | `click` | Trigger actions |
| 5️⃣ | `wait_for` | Await async results |
| 6️⃣ | `take_screenshot` | Document final state |

*Source: Chrome DevTools Blog lists "navigating pages, filling out forms, reproducing bugs" as key capabilities.*

---

### Scenario: Accessibility Audits

| Priority | Tool | Purpose |
|----------|------|---------|
| 1️⃣ | `take_snapshot` (verbose: true) | Full accessibility tree |
| 2️⃣ | `evaluate_script` | Custom a11y checks |
| 3️⃣ | `resize_page` | Test at different sizes |

*Source: Snapshot documentation notes it provides "a11y tree" structure.*

---

### Scenario: Console Error Investigation

| Priority | Tool | Purpose |
|----------|------|---------|
| 1️⃣ | `list_console_messages` (types: ["error"]) | Find all errors |
| 2️⃣ | `get_console_message` | Get stack trace details |
| 3️⃣ | `take_snapshot` | Understand page state at error time |
| 4️⃣ | `evaluate_script` | Inspect variables/state |

---

### Scenario: React/Frontend Pattern Verification

For WebDJ-specific React patterns, MCP enables verification that code patterns work correctly at runtime.

| Pattern to Verify | MCP Approach |
|-------------------|--------------|
| Ref-sync callbacks | `evaluate_script` to check ref values match current state |
| High-frequency events | Performance trace + console check for render counts |
| Blob URL lifecycle | `evaluate_script` to inspect BlobURLRegistry state |
| Listener cleanup | Console check for memory warnings after navigation |
| Component re-renders | Performance trace to verify optimization |

**Quick verification workflow**:
```
take_snapshot → understand component state
evaluate_script → check internal React/hook state
list_console_messages → confirm no errors/warnings
```

**Testing modes**:
- `--isolated` for initial render verification (clean state)
- `--autoConnect` for stateful interaction testing (preserves app state)

**Example: Verify blob cleanup**:
```javascript
// evaluate_script to check BlobURLRegistry state
const registry = window.__BLOB_REGISTRY__ || 'not exposed';
const count = registry.size || 0;
return { blobCount: count, state: registry };
```
Expected: blobCount decreases after track transitions.

**Detailed frontend patterns**: See `frontend/CLAUDE.md` § "Frontend Verification with MCP" for React-specific guidance.

**Quick reference**: See root [`CLAUDE.md`](../CLAUDE.md) § "MCP Browser Testing" for tool inventory and common workflows.

---

## Best Practices & Tips

### 0. Be Specific in Prompts

**Specificity reduces back-and-forth and improves first-attempt accuracy.**

| ❌ Vague | ✅ Specific |
|----------|------------|
| "Check the page for errors" | "List console errors, then check if any API calls failed with 4xx/5xx status" |
| "Click the button" | "Take a snapshot, find the 'Submit' button, click it, then wait for 'Success' text" |
| "Test the form" | "Fill the login form with test@example.com/password123, submit, verify redirect to /dashboard" |
| "Make it look right" | "Take a screenshot, compare against this mock [paste image], identify CSS differences" |

**Exploration-First Pattern** (from Anthropic Engineering):
```
1. Ask Claude to explore (snapshot, list requests, check console)
2. Request a plan based on findings
3. Approve the plan before execution
4. Verify results with screenshot/snapshot
```

*Source: Anthropic Best Practices notes "skipping exploration/planning typically produces weaker results."*

---

### 1. Snapshot Before Action
> **Always take a snapshot before interacting with elements.**

Snapshots provide UIDs needed for `click`, `fill`, `hover`, etc. Without a snapshot, you can't target elements.

```
❌ Wrong: click → "I need the UID..."
✅ Right: take_snapshot → click(uid from snapshot)
```

*Source: GitHub tool documentation requires UIDs from snapshots for all interaction tools.*

---

### 2. Use Verbose Snapshots Selectively

The `verbose: true` option provides complete a11y tree info but generates more data. Use it for:
- Accessibility audits
- Complex page structures
- When standard snapshot lacks needed info

Default to `verbose: false` for routine element discovery.

---

### 3. Filter Network and Console Results

Both `list_network_requests` and `list_console_messages` support filtering:

```javascript
// Only API calls
list_network_requests({ resourceTypes: ["xhr", "fetch"] })

// Only errors
list_console_messages({ types: ["error"] })
```

*Source: GitHub documentation shows filtering parameters for both tools.*

---

### 4. Performance Traces Need Reload

For accurate performance metrics, always use `reload: true`:

```javascript
performance_start_trace({ reload: true, autoStop: true })
```

This ensures you capture the full page load, not just a partial snapshot.

*Source: Chrome DevTools Blog testing prompt: "Check the LCP of web.dev"*

---

### 5. Wait for Async Content

Use `wait_for` after actions that trigger async operations:

```
click(submit button) → wait_for("Success!") → take_screenshot
```

Don't immediately take screenshots after clicks—content may not have loaded.

---

### 6. Use fill_form for Multiple Fields

When filling multiple inputs, `fill_form` is more efficient than repeated `fill` calls:

```javascript
// One call instead of three
fill_form({
  elements: [
    { uid: "username", value: "user@example.com" },
    { uid: "password", value: "secret123" },
    { uid: "remember", value: "true" }
  ]
})
```

---

### 7. Handle Dialogs Promptly

Browser dialogs (alert, confirm, prompt) block execution. Use `handle_dialog` immediately when they appear:

```javascript
// If a confirmation appears after delete click
click(deleteButton)
handle_dialog({ action: "accept" })  // or "dismiss"
```

---

### 8. Combine with Visual Development

Following Anthropic's recommendation for **visual-guided development**, use screenshots to:
- Verify changes after code modifications
- Document bugs before fixing
- Confirm expected UI states

**Visual Development Workflow** (from Anthropic Engineering):
```
1. Provide screenshot of current/broken state
2. Share design mock or expected outcome
3. Request implementation matching the mock
4. Use MCP screenshot to verify → iterate 2-3 times
5. Commit when satisfied
```

*Source: Anthropic Best Practices emphasizes "providing screenshots, design mocks, or URLs alongside requests."*

---

### 9. Chain Tools Logically

Build workflows that flow naturally:

```
navigate → snapshot → interact → wait → verify
```

Not:
```
❌ click → navigate → snapshot (wrong order)
```

**Parallel When Possible** (from Anthropic Engineering):

Some tools can run concurrently when they don't depend on each other:

```
✅ Parallel (independent checks):
   list_network_requests + list_console_messages  → both at once

✅ Parallel (after snapshot):
   click(button_A) ... wait_for ... click(button_B)  → depends, must be sequential

❌ Sequential (dependent):
   take_snapshot → click(uid from snapshot)  → snapshot must complete first
```

*Source: Advanced Tool Use notes "concurrent operations through async patterns" eliminate sequential overhead.*

---

### 10. Optimize for Token Efficiency

Large tool outputs consume context tokens. Filter proactively:

```javascript
// Network: Only API calls, not images/scripts/styles
list_network_requests({ resourceTypes: ["xhr", "fetch"] })

// Console: Only errors, not all logs
list_console_messages({ types: ["error"] })

// Snapshot: Standard mode first, verbose only when needed
take_snapshot()  // not take_snapshot({ verbose: true })

// evaluate_script: Return filtered data, not entire DOM
"() => document.querySelector('#result').textContent"  // not document.body.innerHTML
```

*Source: Anthropic Engineering demonstrates 98% token savings by filtering data at the execution layer.*

---

### 11. Use Emulation for Edge Cases

Test under constrained conditions:

```javascript
// Test offline behavior
emulate({ networkConditions: "Offline" })

// Test slow networks
emulate({ networkConditions: "Slow 3G" })

// Test geolocation-dependent features
emulate({ geolocation: { latitude: 37.7749, longitude: -122.4194 } })
```

---

## Common Pitfalls

### ❌ Clicking Without Snapshot First

**Problem**: Attempting to click elements without UIDs.

```
❌ "Click the login button"
   → Error: Need UID from snapshot
```

**Solution**: Always snapshot first.

```
✅ take_snapshot → identify login button UID → click(uid)
```

---

### ❌ Ignoring Async Timing

**Problem**: Taking screenshots immediately after actions.

```
❌ click(submit) → take_screenshot
   → Screenshot shows loading spinner, not result
```

**Solution**: Wait for expected content.

```
✅ click(submit) → wait_for("Success") → take_screenshot
```

---

### ❌ Performance Trace Without Reload

**Problem**: Starting trace on already-loaded page.

```
❌ performance_start_trace({ reload: false, autoStop: true })
   → Misses initial page load metrics
```

**Solution**: Use reload for full metrics.

```
✅ performance_start_trace({ reload: true, autoStop: true })
```

---

### ❌ Unfiltered Request/Console Lists

**Problem**: Getting overwhelmed by all network/console output.

```
❌ list_network_requests()
   → Returns images, scripts, styles, ads, tracking...
```

**Solution**: Filter to relevant types.

```
✅ list_network_requests({ resourceTypes: ["xhr", "fetch"] })
✅ list_console_messages({ types: ["error", "warn"] })
```

---

### ❌ Assuming Page State Persists

**Problem**: Using UIDs from old snapshots after navigation.

```
❌ navigate_page → click(old UID)
   → Element may no longer exist or have different UID
```

**Solution**: Re-snapshot after any navigation.

```
✅ navigate_page → take_snapshot → click(new UID)
```

---

### ❌ Missing Dialog Handling

**Problem**: Workflows hang on unexpected dialogs.

```
❌ click(delete) → [alert blocks] → timeout
```

**Solution**: Anticipate and handle dialogs.

```
✅ click(delete) → handle_dialog({ action: "accept" })
```

---

### ❌ Sensitive Data Exposure

**Problem**: DevTools MCP exposes ALL browser content.

> "chrome-devtools-mcp exposes content of the browser instance to the MCP clients allowing them to inspect, debug, and modify any data in the browser."
> — *GitHub README*

**Solution**:
- Don't browse sensitive sites in MCP-connected browser
- Use `--isolated` flag for temporary profiles
- Avoid exposing credentials in automated workflows

---

### ❌ Using Screenshots for Data Extraction

**Problem**: Trying to extract text/data from screenshots.

```
❌ take_screenshot → "read the email addresses from this image"
   → Unreliable, requires OCR
```

**Solution**: Use snapshots for data.

```
✅ take_snapshot → extract text from structured a11y tree
```

---

## Configuration & Settings

### Chrome Window Configuration

Control browser window position and size for optimal multi-monitor workflows.

#### Window Position

Position the browser window using `x,y` coordinates:

| Setting | Default | Description |
|---------|---------|-------------|
| `--window-position` | `-1525,275` | Window position (negative X = left of primary monitor) |

**Common positions**:
```bash
# Left monitor (1920px wide monitor to the left)
--window-position=-1525,275

# Right monitor (starting at x=1920)
--window-position=1920,100

# Primary monitor, top-left
--window-position=0,0

# Primary monitor, centered (assuming 1920px screen, 1525px window)
--window-position=197,100
```

#### Window Size

Set the browser viewport dimensions:

| Setting | Default | Description |
|---------|---------|-------------|
| `--window-size` | `1525,800` | Window dimensions in `width,height` pixels |

**Common sizes**:
```bash
# Standard (fits nicely on secondary monitor)
--window-size=1525,800

# Full HD viewport
--window-size=1920,1080

# Tablet simulation
--window-size=768,1024

# Mobile simulation (use resize_page tool for responsive testing)
--window-size=375,812
```

#### Environment Variables

Set defaults via environment variables to avoid repeated CLI flags:

```bash
# In your shell profile (.bashrc, .zshrc, etc.)
export CHROME_WINDOW_POSITION="-1525,275"
export CHROME_WINDOW_SIZE="1525,800"
```

**Windows (PowerShell)**:
```powershell
$env:CHROME_WINDOW_POSITION = "-1525,275"
$env:CHROME_WINDOW_SIZE = "1525,800"
```

---

### MCP Server Settings

Configure MCP server behavior via environment variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_MCP_OUTPUT_TOKENS` | `25000` | Max tokens returned from MCP tools (increase for large pages) |
| `MCP_TIMEOUT` | `10000` | MCP server startup timeout in milliseconds |

**Recommended for comprehensive testing**:
```bash
export MAX_MCP_OUTPUT_TOKENS=50000
export MCP_TIMEOUT=15000
```

These settings help when:
- Working with large DOM structures (increase `MAX_MCP_OUTPUT_TOKENS`)
- MCP server takes longer to initialize (increase `MCP_TIMEOUT`)
- Running automated test suites that capture extensive data

---

### Browser Profile Settings

#### Standard Profile (Persistent)

By default, Chrome DevTools MCP uses a persistent profile for session continuity.

**Default user data directory by platform:**

| Platform | Default Path |
|----------|-------------|
| **Linux/macOS** | `$HOME/.cache/chrome-devtools-mcp/chrome-profile-$CHANNEL` |
| **Windows** | `%HOMEPATH%\.cache\chrome-devtools-mcp\chrome-profile-$CHANNEL` |

Where `$CHANNEL` is `stable`, `canary`, `beta`, or `dev` based on the `--channel` flag.

**Benefits**: Preserves cookies, localStorage, login sessions between runs. Directory persists and is shared across MCP instances.

#### Isolated Profile (Clean State)

Use `--isolated` for a fresh temporary profile each session:

```bash
# CLI flag for test script
./run-mcp-tests.sh --isolated
```

**Benefits**:
- Clean test state (no cached data interference)
- Reproducible test results
- Automatic cleanup after session ends

**When to use isolated mode**:
- Running automated tests that require clean state
- Debugging issues that might be cache-related
- Testing first-visit user experiences

---

### Debug Port Configuration

Chrome DevTools MCP communicates via Chrome's remote debugging protocol.

| Setting | Default | Description |
|---------|---------|-------------|
| Debug Port | `9222` | Chrome remote debugging port |

If port 9222 is in use, you may need to:

1. **Close other Chrome debugging sessions**:
   ```bash
   # Check what's using port 9222
   # Windows
   netstat -ano | findstr :9222

   # Linux/macOS
   lsof -i :9222
   ```

2. **Configure a different port** (in your MCP settings):
   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "npx",
         "args": [
           "-y",
           "chrome-devtools-mcp@latest",
           "--port=9223"
         ]
       }
     }
   }
   ```

---

### MCP Server Flags Reference

Complete flags for the MCP server (`npx chrome-devtools-mcp@latest`):

| Flag | Alias | Description |
|------|-------|-------------|
| **Browser Connection** | | |
| `--autoConnect` | | Auto-connect to running browser (Chrome 145+) |
| `--browserUrl` | `-u` | Connect to debuggable Chrome at URL |
| `--wsEndpoint` | `-w` | WebSocket endpoint for running instance |
| `--wsHeaders` | | Custom JSON headers for WebSocket |
| **Browser Launch** | | |
| `--headless` | | Run without UI (default: false) |
| `--executablePath` | `-e` | Custom Chrome executable path |
| `--channel` | | Chrome channel: `stable`, `canary`, `beta`, `dev` |
| `--isolated` | | Temporary profile, auto-cleaned on close |
| `--userDataDir` | | Custom profile directory |
| `--viewport` | | Initial size, e.g., `1280x720` (max 3840x2160 headless) |
| **Security & Network** | | |
| `--proxyServer` | | Proxy server configuration |
| `--acceptInsecureCerts` | | Ignore certificate errors |
| `--chromeArg` | | Additional Chrome args (can repeat) |
| **Tool Categories** | | |
| `--categoryEmulation` | | Enable emulation tools (default: true) |
| `--categoryPerformance` | | Enable performance tools (default: true) |
| `--categoryNetwork` | | Enable network tools (default: true) |
| **Debugging** | | |

### Reducing Tool Surface Area

If you don't need all 26 tools, disable categories to reduce context consumption:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--categoryPerformance=false",
        "--categoryNetwork=false"
      ]
    }
  }
}
```

This configuration disables Performance (3 tools) and Network (2 tools), leaving 21 tools available. Use this when:
- Performance audits are not needed
- Network debugging is handled by other tools (e.g., browser DevTools directly)
- You want to reduce token usage from tool definitions

**Available categories**:
| Category | Tools Disabled | When to Disable |
|----------|---------------|-----------------|
| `--categoryEmulation=false` | `emulate`, `resize_page` | Not testing responsive/device scenarios |
| `--categoryPerformance=false` | `performance_*` (3 tools) | Not running performance audits |
| `--categoryNetwork=false` | `*_network_*` (2 tools) | Debugging network separately |

---

### Chrome Launch Flags Reference

Common flags used when launching Chrome manually for MCP:

| Flag | Purpose |
|------|---------|
| `--remote-debugging-port=9222` | Enable DevTools protocol |
| `--user-data-dir=PATH` | Use specific profile directory |
| `--no-first-run` | Skip first-run experience |
| `--no-default-browser-check` | Skip default browser prompt |
| `--disable-session-crashed-bubble` | Suppress crash recovery UI |
| `--hide-crash-restore-bubble` | Hide restore pages prompt |
| `--window-position=X,Y` | Set initial window position |
| `--window-size=W,H` | Set initial window dimensions |

**Example: Complete launch command**:
```bash
chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.cache/chrome-mcp-profile" \
  --no-first-run \
  --no-default-browser-check \
  --window-position=-1525,275 \
  --window-size=1525,800 \
  "http://localhost:3000"
```

---

### Chrome Visibility vs. Claude Code Workflow

Understanding what controls browser visibility vs. Claude's async workflow is critical for operators who want to **watch tests on screen**.

#### What Controls Browser Visibility

| Factor | Controls | Effect |
|--------|----------|--------|
| `--headless` Chrome flag | **Browser visibility** | Present = invisible, Absent = **visible on screen** |
| `--window-position` | Window placement | Where the visible window appears |
| `--window-size` | Window dimensions | Size of the visible window |

**Key point**: If `--headless` is NOT used (default for MCP testing), Chrome opens as a **normal visible window** that operators can watch.

#### What `run_in_background` Does (Claude Code Bash Tool)

The `run_in_background` parameter is a **Bash tool option in Claude Code**, not a Chrome or MCP flag:

| `run_in_background` | Claude's Behavior | Chrome Visibility |
|---------------------|-------------------|-------------------|
| `false` (default) | Blocks until command exits | **Visible on screen** |
| `true` | Continues immediately | **Visible on screen** |

**Why use `run_in_background: true`?**
- Chrome stays running indefinitely (doesn't exit on its own)
- Without it, Claude would wait forever for Chrome to exit, blocking the conversation
- It does **NOT** hide the browser—tests remain fully visible to operators

**Example: Launching Chrome for MCP testing**
```bash
# In Claude Code, use run_in_background: true to avoid blocking
# Chrome still opens as a VISIBLE window on screen
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --window-position=-1525,275 \
  --window-size=1525,800 \
  "http://localhost:3002"
```

#### Summary for Operators

| Concern | Answer |
|---------|--------|
| "Can I watch tests run?" | **Yes** - Chrome opens visibly unless `--headless` is used |
| "What does `run_in_background` do?" | Lets Claude continue working while Chrome runs (doesn't affect visibility) |
| "How do I hide the browser?" | Add `--headless` flag (not recommended for debugging) |
| "How do I position the window?" | Use `--window-position` and `--window-size` flags |

---

### Multi-Monitor Workflow Tips

**Recommended setup for development**:

```
┌────────────────────────┬────────────────────────────────────┐
│   Left Monitor         │   Primary Monitor                  │
│   (MCP Browser)        │   (IDE + Claude Code)              │
│                        │                                    │
│   --window-position    │   Your development environment     │
│   =-1525,275           │                                    │
│   --window-size        │                                    │
│   =1525,800            │                                    │
│                        │                                    │
└────────────────────────┴────────────────────────────────────┘
```

**Position calculation for left monitor**:
```
X position = -(left monitor width - window width + margin)
Example: -(1920 - 1525 + 130) = -1525
```

**Position calculation for right monitor**:
```
X position = primary monitor width + margin
Example: 1920 + 50 = 1970
```

---

### Configuration Quick Reference

#### Test Runner CLI Options

For `run-mcp-tests.sh` (WebDJ-specific):

| Option | Description | Example |
|--------|-------------|---------|
| `--position X,Y` | Chrome window position | `--position -1525,275` |
| `--size WxH` | Chrome window size | `--size 1525,800` |
| `--isolated` | Use temporary profile | `--isolated` |
| `--max-turns N` | Override max conversation turns | `--max-turns 50` |
| `--verbose` | Stream JSON events in real-time | `--verbose` |
| `--quick` | Run quick test suite only | `--quick` |
| `--test NAME` | Run single test by name | `--test youtube-search` |

#### Complete MCP JSON Configuration

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--headless=false",
        "--isolated=false",
        "--viewport=1920x1080"
      ],
      "env": {
        "MAX_MCP_OUTPUT_TOKENS": "50000",
        "MCP_TIMEOUT": "15000"
      }
    }
  }
}
```

---

## Quick Setup

### Basic Configuration (Claude Code)

```bash
claude mcp add chrome-devtools npx chrome-devtools-mcp@latest
```

### MCP Settings JSON

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

### Advanced Configuration

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--headless=false",
        "--isolated=true",
        "--viewport=1920x1080"
      ]
    }
  }
}
```

### Verify Installation

Prompt your AI assistant:
> "Check the performance of https://example.com"

A working setup will:
1. Launch browser
2. Navigate to URL
3. Run performance trace
4. Return LCP and other metrics

### MCP Resources (@ Mentions)

Claude Code supports referencing MCP server resources directly in prompts using `@` mentions:

```bash
# Reference pattern
@server:protocol://resource/path

# Examples (if MCP servers expose resources)
@chrome-devtools:page://current
@github:issue://123
```

**Note**: Chrome DevTools MCP currently does not expose resources via the MCP Resources protocol—it provides tools only. This pattern is documented for future compatibility and for use with other MCP servers that do expose resources.

For MCP servers that support resources, you can:
- Reference specific resources inline in prompts
- Combine resources from multiple servers
- Use resources as context for tool calls

---

## Getting Started Tutorial

This section walks through your first interaction with Chrome DevTools MCP.

### Step 1: Verify Configuration

After adding the MCP configuration, restart your MCP client (Claude Code, etc.) to load the new server.

```bash
# For Claude Code, simply start a new session
claude
```

### Step 2: Your First Snapshot

Start with a simple page inspection:

```
Take a snapshot of https://example.com and describe what you see
```

**What happens**:
1. MCP server launches Chrome (if not running)
2. Navigates to the URL
3. Captures the accessibility tree
4. Returns structured page content with element UIDs

### Step 3: Interactive Elements

Now interact with a page:

```
Go to https://example.com and click on the "More information..." link
```

**The AI will**:
1. Take a snapshot to find the link's UID
2. Use the `click` tool with that UID
3. Wait for navigation
4. Optionally take another snapshot to confirm

### Step 4: Form Interaction

Try a search form:

```
Navigate to https://www.google.com, search for "MCP protocol", and show me the results
```

**The workflow**:
1. `navigate_page` → Google homepage
2. `take_snapshot` → Find search input UID
3. `fill` → Enter search query
4. `press_key` → Press Enter
5. `wait_for` → Results loaded
6. `take_snapshot` → Capture results

### Step 5: Debug Console Errors

Test error detection:

```
Go to my local app at http://localhost:3000 and check for any JavaScript errors
```

**Tools used**:
1. `navigate_page` → Your app
2. `list_console_messages` with `types: ["error"]`
3. `get_console_message` → Details on specific errors

### Practice Prompts

From the [Chrome DevTools Blog](https://developer.chrome.com/blog/chrome-devtools-mcp), try these scenarios:

| Scenario | Prompt |
|----------|--------|
| **Real-time verification** | "Verify in the browser that your change works as expected" |
| **Diagnosing errors** | "A few images on localhost:8080 are not loading. What's happening?" |
| **User behavior simulation** | "Why does submitting the form fail after entering an email address?" |
| **Styling issues** | "The page on localhost:8080 looks strange. Check what's happening there" |
| **Performance auditing** | "Please check the LCP of web.dev" |
| **Performance optimization** | "Localhost:8080 is loading slowly. Make it load faster" |

### Connecting to an Existing Browser

Instead of letting MCP launch Chrome, connect to your own instance:

#### Method 1: Auto-Connect (Chrome 145+)

1. Open Chrome and go to `chrome://inspect/#remote-debugging`
2. Enable "Allow remote debugging connections"
3. Configure MCP with `--autoConnect` (must match Chrome channel):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect"]
    }
  }
}
```

#### Method 2: Manual Debug Port

1. Launch Chrome with remote debugging:

**Windows (minimal)**:
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%TEMP%\chrome-mcp"
```

**Windows (recommended - matches run-mcp-tests.sh)**:
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%USERPROFILE%\.cache\chrome-mcp-profile" ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-session-crashed-bubble ^
  --hide-crash-restore-bubble ^
  --window-position=-1525,275 ^
  --window-size=1525,800 ^
  "http://localhost:3000"
```

**macOS (minimal)**:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-mcp
```

**macOS (recommended)**:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.cache/chrome-mcp-profile" \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --hide-crash-restore-bubble \
  --window-position=-1525,275 \
  --window-size=1525,800 \
  "http://localhost:3000"
```

**Linux (minimal)**:
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-mcp
```

**Linux (recommended)**:
```bash
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.cache/chrome-mcp-profile" \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --hide-crash-restore-bubble \
  --window-position=-1525,275 \
  --window-size=1525,800 \
  "http://localhost:3000"
```

> **Note**: The "recommended" commands include all flags from WebDJ's `run-mcp-tests.sh` for optimal developer experience. The "minimal" commands are sufficient for basic MCP functionality.

2. Configure MCP to connect:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"]
    }
  }
}
```

### Understanding the Workflow

**MCP Architecture Basics**: MCP uses a client-server architecture with JSON-RPC 2.0 protocol. The AI host (Claude Code) connects to MCP servers that expose **tools** (executable functions) and **resources** (data/context).

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome DevTools MCP Flow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   You (prompt)                                                  │
│       │                                                         │
│       ▼                                                         │
│   MCP Host (Claude Code)                                        │
│       │  ← Maintains 1:1 connection to MCP server               │
│       ▼                                                         │
│   Chrome DevTools MCP Server (npx chrome-devtools-mcp)          │
│       │  ← Exposes 26 tools via JSON-RPC 2.0                    │
│       ▼                                                         │
│   Chrome DevTools Protocol (CDP)                                │
│       │  ← Puppeteer automation under the hood                  │
│       ▼                                                         │
│   Chrome Browser (port 9222)                                    │
│       │                                                         │
│       ▼                                                         │
│   Web Page (your target)                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why UIDs Matter**: The MCP server maintains state about the current page. When you take a snapshot, the server assigns unique identifiers (UIDs) to elements. These UIDs are session-specific—they change after navigation or page updates. Always re-snapshot before interacting with elements.

---

## Troubleshooting

### Common Issues and Solutions

#### MCP Server Won't Start

**Symptoms**: Timeout errors, "server not found", or no response from tools.

**Solutions**:

1. **Check Node.js version**:
   ```bash
   node --version  # Must be v20.19+
   ```

2. **Increase startup timeout** (especially on Windows):
   ```bash
   export MCP_TIMEOUT=20000  # 20 seconds
   ```

3. **Verify npx works**:
   ```bash
   npx chrome-devtools-mcp@latest --help
   ```

4. **Check for conflicting processes**:
   ```bash
   # Windows
   tasklist | findstr chrome

   # macOS/Linux
   ps aux | grep chrome
   ```

---

#### Chrome Doesn't Launch

**Symptoms**: Tools timeout waiting for browser.

**Solutions**:

1. **Verify Chrome is installed** at expected path (see [Prerequisites](#prerequisites))

2. **Specify Chrome path explicitly**:
   ```json
   {
     "args": [
       "-y",
       "chrome-devtools-mcp@latest",
       "--executable-path=/path/to/chrome"
     ]
   }
   ```

3. **Check for existing Chrome debug sessions**:
   ```bash
   # Windows
   netstat -ano | findstr :9222

   # macOS/Linux
   lsof -i :9222
   ```

4. **Kill existing Chrome processes** and retry

---

#### Port 9222 Already in Use

**Symptoms**: "Address already in use" or connection refused.

**Solutions**:

1. **Find what's using the port**:
   ```bash
   # Windows
   netstat -ano | findstr :9222
   taskkill /PID <pid> /F

   # macOS/Linux
   lsof -i :9222
   kill -9 <pid>
   ```

2. **Use a different port**:
   ```json
   {
     "args": ["-y", "chrome-devtools-mcp@latest", "--port=9223"]
   }
   ```

---

#### Connection Timeout to Browser

**Symptoms**: "Failed to connect to browser" after Chrome launches.

**Solutions**:

1. **Wait longer** — first launch may take time:
   ```bash
   export MCP_TIMEOUT=30000
   ```

2. **Check firewall** isn't blocking localhost:9222

3. **Try manual connection** — launch Chrome yourself first, then use `--browser-url`

4. **Use isolated profile** to avoid profile lock issues:
   ```json
   {
     "args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
   }
   ```

---

#### Snapshots Return Empty or Incomplete Data

**Symptoms**: Missing elements, empty UIDs, truncated content.

**Solutions**:

1. **Increase output token limit**:
   ```bash
   export MAX_MCP_OUTPUT_TOKENS=100000
   ```

2. **Wait for page to fully load**:
   ```
   navigate_page → wait_for("expected text") → take_snapshot
   ```

3. **Try verbose mode** for more details:
   ```
   take_snapshot with verbose: true
   ```

---

#### Click/Fill Actions Fail

**Symptoms**: "Element not found" or "UID invalid".

**Solutions**:

1. **Always snapshot first** — UIDs are session-specific:
   ```
   ❌ click(uid from old snapshot)
   ✅ take_snapshot → click(fresh uid)
   ```

2. **Wait for dynamic content**:
   ```
   wait_for("Button text") → take_snapshot → click
   ```

3. **Element may be hidden** — check if page state changed

4. **Re-snapshot after navigation** — UIDs don't persist across pages

---

#### Performance Trace Issues

**Symptoms**: No metrics returned, trace hangs.

**Solutions**:

1. **Use reload for full metrics**:
   ```
   performance_start_trace with reload: true, autoStop: true
   ```

2. **Manually stop trace** if autoStop doesn't work:
   ```
   performance_start_trace → [wait] → performance_stop_trace
   ```

3. **Ensure page fully loads** before analyzing

---

### Platform-Specific Issues

#### Windows

| Issue | Solution |
|-------|----------|
| **Long startup times** | Set `MCP_TIMEOUT=20000` or higher |
| **Path spaces** | Use quoted paths: `"C:\Program Files\..."` |
| **PowerShell escaping** | Use backticks for special chars |
| **Antivirus blocking** | Add Chrome and Node.js to exceptions |

#### macOS

| Issue | Solution |
|-------|----------|
| **Gatekeeper blocks npx** | Run `xattr -d com.apple.quarantine $(which npx)` |
| **Profile permissions** | Check `~/.cache/chrome-devtools-mcp/` permissions |
| **M1/M2 compatibility** | Ensure Node.js is ARM-native |

#### Linux

| Issue | Solution |
|-------|----------|
| **Chrome not found** | Install `google-chrome-stable` or set `--executable-path` |
| **Headless server** | Use `--headless` flag |
| **Display issues** | Set `DISPLAY=:0` or use Xvfb |
| **Sandbox errors** | May need `--no-sandbox` (not recommended for production) |

---

### Debug Logging

**Claude Code Debug Flag**:

When troubleshooting MCP configuration issues in Claude Code, use:
```bash
claude --mcp-debug
```

This flag provides detailed MCP server connection and communication logs.

**Server-Side Logging**:

Enable detailed server logs with `--logFile`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--logFile=/tmp/mcp-debug.log"
      ]
    }
  }
}
```

Then check the log:
```bash
tail -f /tmp/mcp-debug.log
```

*Source: Anthropic Best Practices recommends using `--mcp-debug` when troubleshooting configuration issues.*

---

### Getting Help

If issues persist:

1. **Check GitHub Issues**: [ChromeDevTools/chrome-devtools-mcp/issues](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues)
2. **File a new issue** with:
   - Node.js version (`node --version`)
   - Chrome version (`chrome --version`)
   - Operating system
   - MCP client being used
   - Full error message
   - Steps to reproduce

---

## Summary: Tool Selection Cheat Sheet

| I want to... | First tool | Then... |
|--------------|------------|---------|
| See page structure | `take_snapshot` | - |
| Verify visual appearance | `take_screenshot` | - |
| Click a button | `take_snapshot` | `click` |
| Fill a form | `take_snapshot` | `fill_form` |
| Debug JS errors | `list_console_messages` | `get_console_message` |
| Debug API calls | `list_network_requests` | `get_network_request` |
| Check performance | `performance_start_trace` | `performance_analyze_insight` |
| Test mobile viewport | `resize_page` | `take_screenshot` |
| Test slow network | `emulate` | [run workflow] |
| Wait for loading | `wait_for` | - |

---

*Last updated: December 2025*
*Chrome DevTools MCP version: latest*
*Node.js requirement: v20.19+*
*Chrome requirement: v145+ for auto-connect*
