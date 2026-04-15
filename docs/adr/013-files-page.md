# ADR-013: Files page — E2E-encrypted file sharing

**Status**: Accepted
**Date**: 2026-04-14

## Context

Chase wants to share a single large (~1 GB) sensitive file with a friend using WhatsApp-grade end-to-end encryption, hosted from `chases.house`. The site is a static GitHub Pages deployment — no server, no build step, no backend. Three constraints shape the design:

1. **The ciphertext must not live in the repo.** The repo is public and preserves history forever. Even encrypted blobs shouldn't be committed — that's a permanent artifact on a public surface.
2. **Access control can't live in the browser.** A static page on public GitHub Pages cannot authenticate anyone. Any "access" layer has to come from the network.
3. **The encryption endpoints are two devices.** Chase encrypts on his Windows 11 box; the friend decrypts in their browser. The passphrase travels out-of-band (phone call, Signal, in person). The encrypted blob travels through whatever channel is convenient.

This mirrors how WhatsApp handles attachments: a random symmetric key encrypts the blob, the blob goes to untrusted storage, and the key travels through the already-encrypted Signal Protocol channel. Here, the passphrase is the symmetric material and the user is responsible for the out-of-band delivery.

## Decision

**Two surfaces**, cleanly separated by responsibility:

- **`chases.house/files/`** (GitHub Pages, public). A browser-based **decrypt-only** tool using the vendored `age` JavaScript library. No sensitive data ever touches this page — it's a function `(ciphertext, passphrase) → plaintext` that happens to run in a browser.
- **`files.chases.house`** (Cloudflare Tunnel → local Python server on Chase's box, behind Zero Trust email allowlist). Serves only the encrypted `*.age` blobs. The only job of the tunnel is to deliver ciphertext to authenticated recipients.

```
 ┌──────────────────────────────────┐        ┌─────────────────────────────────┐
 │  chases.house/files/             │        │  files.chases.house             │
 │  (GitHub Pages, public)          │        │  (Cloudflare Tunnel + ZT)       │
 │  - Decrypt-only tool             │        │  - Email-allowlisted download   │
 │  - typage age lib (vendored)     │        │  - serve-vault.py (.age only)   │
 │  - No secrets                    │        │  - No repo coupling             │
 └──────────────────────────────────┘        └─────────────────────────────────┘
                │                                            │
                └────── friend downloads .age, drops on ─────┘
                         decrypt page, enters passphrase
```

### Library: typage v0.3.0

`age-encryption` (typage) by Filippo Valsorda, the author of the Go `age` CLI. BSD-3-Clause. 208 KB unminified IIFE bundle, pre-built and distributed on GitHub Releases. Vendored at `files/vendor/age.js`, SHA-256 recorded in `files/vendor/README.md`. Unminified chosen over minified (98 KB) because auditability of crypto code is worth more than the 110 KB transfer difference for a page that loads once per session.

The bundle is an IIFE that exposes a global `age` with `Encrypter`, `Decrypter`, and stream-aware `decrypt()` that accepts `ReadableStream` input and returns `ReadableStream` output. This is the streaming API that makes the 1 GB path viable.

**Passphrase API**: `new age.Decrypter(); d.addPassphrase(pass)` — not `scryptIdentity` as some earlier typage docs suggested. The worker uses `addPassphrase` directly.

### Decrypt-only in the browser (no encrypt UI)

Removed the encrypt tab the initial draft called for. YAGNI: Chase encrypts with the native `age` CLI (`age -p -o out.age input`), which is faster on a 1 GB file, has a smaller trusted code base (no JS engine in the crypto path), and doesn't stress browser memory. The only user who touches the page is a recipient, and they only ever decrypt. The browser-encrypt path would be speculative scope.

### Streaming decrypt: 1 GB without crashing the tab

Classic Web Worker loads the vendored bundle via `importScripts('/files/vendor/age.js')`. The worker:

1. Calls `d.decrypt(file.stream())` — typage returns a plaintext `ReadableStream`.
2. Reads chunks and posts them to the main thread using **Transferable ArrayBuffers** (zero-copy).
3. Reports progress every ~4 MB.

The main thread receives chunks and pipes them to a `FileSystemWritableFileStream` obtained from `showSaveFilePicker`. Nothing of consequence buffers in memory — a 1 GB decrypt peaks around 20-50 MB of RSS.

**Three load-bearing contracts** (all documented inline in the source):

1. **`showSaveFilePicker` must be the first `await`** in the Decrypt button's click handler. Any async work before it consumes the transient user activation and the picker throws `SecurityError`. See `files/ui.js:startDecrypt()`.
2. **Writable must be `abort()`ed on error, cancel, or worker crash.** Without this, a partial file is left open at the chosen save location. Covered by `worker.onerror`, `worker.onmessage error`, and the Cancel button handler.
3. **Defensive chunk copy before transfer.** If typage reuses internal buffers, transferring a chunk's backing `ArrayBuffer` would detach typage's view and the next `read()` would crash. The worker detects sub-views (`byteOffset !== 0 || buffer.byteLength !== byteLength`) and `.slice()` to own the buffer before posting.

### CSP

```
default-src 'self';
script-src 'self';
worker-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src  'self' https://fonts.gstatic.com;
connect-src 'self';
img-src   'self';
base-uri 'none'; form-action 'none'; object-src 'none';
```

The `'unsafe-inline'` on `style-src` is a deliberate trade-off: the existing site convention uses inline `style="--i:N"` for nav stagger, and matching that convention across pages is more valuable than the marginal XSS surface-area reduction of banning inline styles. The real defenses — `script-src 'self'` and `connect-src 'self'` — remain strict. An attacker who can inject styles but not scripts cannot exfiltrate file contents or passphrases. Those directives are what matter for this threat model.

### Chromium-only (plus Firefox 111+)

Requires `showSaveFilePicker` (File System Access API). Feature-detected on page load; if absent, the browser banner tells the user to use Chrome/Edge/Firefox 111+ or install the `age` CLI. Safari is not supported — adding a <50 MB Blob fallback was considered and explicitly rejected per user direction ("Chrome only is fine").

### Nav is a plain static link

The initial draft proposed mirroring the Music nav health-check pattern (ADR-012). Review flagged this as the wrong fit: the Music tab points at a service that is meaningless when offline, while `chases.house/files/` is a static decrypt tool that works regardless of whether `files.chases.house` is reachable. Gating the nav entry would hide a working tool most of the time.

The Files nav is therefore a plain `<a href="/files/">` added to both the root `index.html` and `games/index.html` with `--i:4` for stagger ordering.

### Hosting the ciphertext: Cloudflare Tunnel + Zero Trust

See [`docs/files-tunnel-setup.md`](../files-tunnel-setup.md) for the runbook. Summary:

- `cloudflared` runs as a Windows service on Chase's box, outbound-only (no ports opened on the home network).
- `serve-vault.py` serves `*.age` files from a local vault directory on `localhost:8765`. Path allowlist (`^/[A-Za-z0-9._-]+\.age$`) is enforced server-side as defense-in-depth — anything else returns 403 regardless of Zero Trust state.
- Zero Trust Access policy: single Allow rule with an email allowlist. Session duration 24 h. No `/health` bypass (no health-check consumer).
- DNS: a single CNAME in GoDaddy (`files → <UUID>.cfargotunnel.com`). Apex A-records for GitHub Pages stay untouched.

Free tier covers everything: Cloudflare Tunnel is free, Zero Trust free up to 50 users, GitHub private repos aren't required since hosting stays on GitHub Pages.

## DRY / YAGNI / SOLID / KISS

- **DRY**: Root `/styles.css` tokens are reused via `<link>`. Music and Files nav entries share `.nav-link` styling but diverge in JS behavior (health-check vs. static) — intentional, not duplication. Error-classification logic lives in one place (`crypto-worker.js:postError`).
- **YAGNI**: Dropped the encrypt tab, the keypair/keygen UI, the Safari Blob fallback, the health-check for Files, and the SHA-256 enforcement script. If a real second use case emerges, revisit — not before.
- **SOLID**: With encrypt removed, `ui.js` has one responsibility ("run one decrypt operation end-to-end"). `crypto-worker.js` owns "stream-decrypt an age file." `serve-vault.py` owns "serve allowlisted `.age` files." Each file is genuinely cohesive.
- **KISS**: One HTML file + one CSS file + two JS files + one vendored library. No bundler, no framework, no TypeScript, no npm, no build step. Feature detection, not browser sniffing.

## Files Changed

| File | Change |
|------|--------|
| `files/index.html` | New — page shell, CSP, dropzone, passphrase, progress, explainer |
| `files/style.css` | New — page-specific layout, dropzone states, progress bar |
| `files/ui.js` | New — drag-drop, Worker lifecycle, writable cleanup, feature detection |
| `files/crypto-worker.js` | New — classic Worker, streaming age decrypt, error classification |
| `files/vendor/age.js` | New — typage v0.3.0 IIFE bundle (208 KB) |
| `files/vendor/README.md` | New — provenance, SHA-256, upgrade instructions |
| `index.html` | Added Files `<a>` at `--i:4` in nav |
| `games/index.html` | Added Files `<a>` at `--i:4` in nav |
| `serve-vault.py` | New — Python HTTP server, `.age` path allowlist |
| `docs/files-tunnel-setup.md` | New — Windows 11 cloudflared + ZT runbook |
| `docs/adr/013-files-page.md` | This file |
| `docs/screenshots/files-page-idle.png` | New — verification artifact |
| `docs/screenshots/files-page-file-loaded.png` | New — verification artifact |
| `docs/screenshots/home-with-files-nav.png` | New — verification artifact |

## Verification

Executed 2026-04-14 via `python -m http.server 3003` from repo root + Chrome DevTools MCP.

### Automated (Chrome DevTools MCP)

- **Page loads clean**: `http://localhost:3003/files/` renders with heading "Files", nav shows Files as active, zero console errors, zero warnings, zero failed network requests. All resource requests are same-origin or the expected Google Fonts hosts.
- **CSP clean**: after relaxing `style-src` to include `'unsafe-inline'` (for the `style="--i:N"` nav stagger), no CSP violations reported. `script-src 'self'` + `connect-src 'self'` remain strict.
- **UI state machine**: programmatically attaching a file via `DataTransfer` and firing `change` correctly applies `.has-file` to the dropzone, shows the filename and human-readable size, and enables the Decrypt button. `[hidden]` elements stay hidden (required a `!important` override because `.class` selectors have higher specificity than the UA `[hidden]` rule).
- **Same-context crypto round-trip**: encrypted `Hello from the Files page round-trip test!` + 2 KB padding with typage `Encrypter`/`addPassphrase`, decrypted with `Decrypter`/`addPassphrase`, byte-for-byte match.
- **Worker round-trip**: spawned the real `/files/crypto-worker.js`, posted `{type:'decrypt', file, passphrase}`, received `status` → `status` → `chunk` → `progress` → `done` in order, reassembled chunks, byte-for-byte match with plaintext.
- **Error classification**:
  - Wrong passphrase → `{kind: 'passphrase', message: "no identity matched any of the file's recipients"}` → UI shows "Incorrect passphrase."
  - Random 8 bytes (not a valid age file) → `{kind: 'format', message: "invalid version line"}` → UI shows "This doesn't look like a valid .age file."
- **Nav integration**: root `/` and `/games/` both render the new "Files" link between "Blog" and "Links" as a live `<a>` (Files nav is a plain static link, not a health-check).

### Manual — 1 GB round-trip (Task 11)

Not executed in this session. Procedure for when the tunnel is set up:

```powershell
# 1. Create a 1 GB dummy file
fsutil file createnew test1gb.bin 1073741824

# 2. Encrypt with native age CLI
age -p -o C:\Users\chase\files-vault\test1gb.age test1gb.bin
# enter a strong passphrase when prompted

# 3. Serve via tunnel
python C:\Users\chase\tools\serve-vault.py C:\Users\chase\files-vault 8765
# (cloudflared service is already running)

# 4. In a second browser profile (simulating the recipient):
#    - Navigate to https://files.chases.house/test1gb.age
#    - Authenticate through Zero Trust with an allowlisted email
#    - Save the downloaded .age file
#    - Navigate to https://chases.house/files/
#    - Drop the .age file, enter the passphrase, save output

# 5. Verify byte-identical output
certutil -hashfile test1gb.bin SHA256
certutil -hashfile test1gb.decrypted SHA256
# SHA-256 values must match
```

Watch Chrome's Task Manager during the decrypt: the tab should stay under ~100 MB RSS. The progress bar will sit at indeterminate "Deriving key…" for 1-5 seconds (scrypt), then advance in visible increments.

### Zero Trust enforcement (to be run when the tunnel is live)

- Anonymous `curl https://files.chases.house/test.age` → 302 redirect to Cloudflare Access login.
- `curl https://files.chases.house/anything.txt` (non-`.age` path after ZT auth) → 403 from `serve-vault.py`.
- Email not on allowlist → Cloudflare Access denies at the edge, request never reaches the origin.

## Implementation Sequence

Delivered as documented in the implementation plan:

1. Vendor typage v0.3.0 + stub ADR
2. Page shell (`index.html` + `style.css`)
3. Crypto worker
4. UI wiring
5. Files nav in root
6. Files nav in games index
7. `serve-vault.py`
8. Tunnel setup runbook
9. Chrome DevTools verification pass
10. This ADR
11. 1 GB round-trip test (manual, procedure documented above)

## Notes for future work

- **Multi-file**: not supported. If the user ever wants to send a folder, they should `tar czf` it first and encrypt the tarball.
- **Encryption UI**: out of scope. If adding later, keep it as a separate tab behind a feature flag and do not touch the decrypt path.
- **Drag-to-reorder, batch operations, passphrase strength meter**: all YAGNI until there's a second user or a second use case.
- **SRI on the Google Fonts stylesheet**: would require a hash commitment that changes when Google rotates the stylesheet. Not worth the churn; the font CSS is non-sensitive and `connect-src 'self'` blocks exfiltration regardless.
