# Files tunnel setup (Windows 11)

Operational runbook for the `files.chases.house` download subdomain.

The architecture:

```
friend's browser
  → files.chases.house  (Cloudflare edge)
  → Zero Trust Access   (email allowlist)
  → Cloudflare Tunnel
  → cloudflared service on Chase's Windows 11 box
  → serve-vault.py on localhost:8765
  → *.age blobs on disk
```

All ciphertext lives on the local box. Nothing sensitive is ever committed to the repo. See [ADR-013](adr/013-files-page.md) for design rationale.

---

## One-time setup

### 1. Install cloudflared

```powershell
winget install Cloudflare.cloudflared
```

Verify: `cloudflared --version`.

### 2. Authenticate

```powershell
cloudflared tunnel login
```

Opens a browser to authorize `chases.house` on the Cloudflare account. Writes credentials to `%USERPROFILE%\.cloudflared\cert.pem`.

### 3. Create the tunnel

```powershell
cloudflared tunnel create files-vault
```

Writes tunnel credentials to `%USERPROFILE%\.cloudflared\<UUID>.json`. Note the UUID printed — you need it below.

### 4. Config file

This box also runs the `webdj` tunnel, which owns the default `config.yml`. To avoid stomping it, files-vault uses its own config file: `%USERPROFILE%\.cloudflared\files-vault.yml`.

```yaml
tunnel: files-vault
credentials-file: C:\Users\chase\.cloudflared\<UUID>.json

ingress:
  - hostname: files.chases.house
    service: http://localhost:8765
  - service: http_status:404
```

Start it with an explicit `--config` flag (see step 7).

### 5. Route DNS

`chases.house` DNS is hosted on Cloudflare, so the cloudflared CLI can add the CNAME directly:

```powershell
cloudflared tunnel route dns files-vault files.chases.house
```

Or add it manually in the Cloudflare dashboard:

| Type  | Name    | Target                             | Proxy   | TTL  |
|-------|---------|------------------------------------|---------|------|
| CNAME | `files` | `<UUID>.cfargotunnel.com`          | Proxied | Auto |

Apex `chases.house` A-records (GitHub Pages) stay untouched.

### 6. Zero Trust Access policy

In the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/):

1. Access → Applications → **Add an application** → **Self-hosted**
2. Application name: `Files`
3. Session duration: `24 hours`
4. Application domain: `files.chases.house`
5. Next → **Add a policy**
   - Policy name: `Allowlist`
   - Action: **Allow**
   - Configure rules → Include → **Emails** → list the approved addresses (at minimum `chasej.house@gmail.com`; add each recipient as needed)
6. Save and publish

No `/health` bypass is needed — the chases.house site no longer calls a health endpoint for the Files nav entry.

### 7. Run the tunnel

Because the default `cloudflared` Windows service is bound to `webdj`'s `config.yml`, files-vault runs foreground-only (or via Task Scheduler / NSSM if you want auto-start). From Git Bash use forward slashes:

```bash
cloudflared tunnel --config C:/Users/chase/.cloudflared/files-vault.yml run files-vault
```

Verify: `cloudflared tunnel info files-vault` shows active connections.

### 8. Install serve-vault.py

Copy `serve-vault.py` from the repo root to a permanent location outside the repo — e.g. `C:\Users\chase\tools\serve-vault.py`. The repo copy is a reference; the running copy lives alongside your vault directory.

Create the vault directory (PowerShell):

```powershell
mkdir C:\Users\chase\files-vault
```

Or Git Bash:

```bash
mkdir -p /c/Users/chase/files-vault
```

Start the server (leave this running, or wrap with NSSM / Task Scheduler to auto-start). PowerShell:

```powershell
python C:\Users\chase\tools\serve-vault.py C:\Users\chase\files-vault 8765
```

Git Bash (forward slashes — backslashes get eaten):

```bash
python C:/Users/chase/tools/serve-vault.py C:/Users/chase/files-vault 8765
```

Test locally: `curl http://localhost:8765/test.age` should 404 (file missing) if the path matches the `.age` pattern, or 403 for anything else.

---

## Day-to-day operation

Two processes need to be running for `files.chases.house` to work: `serve-vault.py` (origin) and `cloudflared` (tunnel). Each lives in its own foreground shell.

### Start

**Shell 1 — origin server** (use forward slashes in Git Bash; backslashes in PowerShell):
```bash
python C:/Users/chase/tools/serve-vault.py C:/Users/chase/files-vault 8765
```

**Shell 2 — tunnel** (same forward-slash caveat in Git Bash):
```bash
cloudflared tunnel --config C:/Users/chase/.cloudflared/files-vault.yml run files-vault
```

### Stop

Ctrl-C in each shell. To force-kill without access to the original shell (Git Bash):

```bash
# Kill whatever is listening on 8765 (serve-vault)
netstat -ano | grep LISTENING | grep ':8765 ' | awk '{print $5}' | xargs -r -I {} taskkill //F //PID {}

# Kill the files-vault tunnel (leaves webdj running)
wmic process where "name='cloudflared.exe' and commandline like '%%files-vault%%'" call terminate
```

### Verify

- `cloudflared tunnel info files-vault` → shows active edge connections
- `curl http://localhost:8765/test.age` → `HTTP 404` (origin alive, vault empty)
- Open `https://files.chases.house/` in an incognito window → Cloudflare Access login page

---

## Sharing a file

1. **Encrypt locally** with the native `age` CLI (faster than the browser for 1 GB, smaller trusted code base). PowerShell:
   ```powershell
   age -p -o C:\Users\chase\files-vault\example.txt.age C:\path\to\example.txt
   ```
   Or Git Bash (requires the `age` alias from [files-user-guide.md](files-user-guide.md) one-time setup):
   ```bash
   age -p -o C:/Users/chase/files-vault/example.txt.age C:/path/to/example.txt
   ```
   Enter a strong passphrase when prompted.

2. **Share the URL** with the recipient: `https://files.chases.house/example.txt.age`. They'll hit the Zero Trust login first, authenticate with their allowlisted email, then the browser downloads the `.age` blob.

3. **Share the passphrase** over a separate channel — phone call, Signal, in person. **Never alongside the file.** If both travel the same channel, the encryption bought you nothing.

4. **Recipient decrypts** at `https://chases.house/files/`: drop the `.age` file, enter passphrase, save the output.

5. **Clean up** when done: delete the file from `C:\Users\chase\files-vault\`. Zero Trust session cookies expire after 24 h but the file lingers until removed.

---

## Troubleshooting

**`cloudflared tunnel run` works but the service doesn't.** The service runs as `LocalSystem` and may not have the same `%USERPROFILE%`. Check `%WINDIR%\System32\config\systemprofile\.cloudflared\` for the config file or point the service explicitly at the config path.

**Recipient sees a Cloudflare Access page but never reaches the download.** Check the Access policy includes their exact email address. Cloudflare One will log the blocked attempt under Access → Logs.

**Download stalls or 502s.** Confirm `serve-vault.py` is running. Check cloudflared logs: `Get-Content $env:USERPROFILE\.cloudflared\cloudflared.log -Tail 50 -Wait` (path may differ under service mode — check `%ProgramData%\Cloudflare\cloudflared\`).

**Browser decrypt hangs at 0%.** Expected — scrypt key derivation takes 1–5 seconds with zero bytes of output. The UI shows "Deriving key…" during this window. If it stays there past ~10 seconds, the passphrase is probably wrong.
