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

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: files-vault
credentials-file: C:\Users\chase\.cloudflared\<UUID>.json

ingress:
  - hostname: files.chases.house
    service: http://localhost:8765
  - service: http_status:404
```

### 5. Route DNS

```powershell
cloudflared tunnel route dns files-vault files.chases.house
```

This attempts to add a CNAME `files → <UUID>.cfargotunnel.com` in Cloudflare's DNS. **Our DNS is at GoDaddy, not Cloudflare**, so this step will fail — that's expected. Note the target hostname from the output and add the CNAME manually in GoDaddy:

| Type  | Name    | Value                              | TTL  |
|-------|---------|------------------------------------|------|
| CNAME | `files` | `<UUID>.cfargotunnel.com`          | 1 hr |

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

### 7. Install cloudflared as a Windows service

**Run from an Administrator PowerShell**:

```powershell
cloudflared service install
```

Without elevation this fails silently or with access-denied. Once installed, the tunnel auto-starts on reboot.

Verify: `Get-Service cloudflared` shows `Running`.

### 8. Install serve-vault.py

Copy `serve-vault.py` from the repo root to a permanent location outside the repo — e.g. `C:\Users\chase\tools\serve-vault.py`. The repo copy is a reference; the running copy lives alongside your vault directory.

Create the vault directory:

```powershell
mkdir C:\Users\chase\files-vault
```

Start the server (leave this running, or wrap with NSSM / Task Scheduler to auto-start):

```powershell
python C:\Users\chase\tools\serve-vault.py C:\Users\chase\files-vault 8765
```

Test locally: `curl http://localhost:8765/test.age` should 404 (file missing) if the path matches the `.age` pattern, or 403 for anything else.

---

## Sharing a file

1. **Encrypt locally** with the native `age` CLI (faster than the browser for 1 GB, smaller trusted code base):
   ```powershell
   age -p -o C:\Users\chase\files-vault\secret.age C:\path\to\secret.bin
   ```
   Enter a strong passphrase when prompted.

2. **Share the URL** with the recipient: `https://files.chases.house/secret.age`. They'll hit the Zero Trust login first, authenticate with their allowlisted email, then the browser downloads the `.age` blob.

3. **Share the passphrase** over a separate channel — phone call, Signal, in person. **Never alongside the file.** If both travel the same channel, the encryption bought you nothing.

4. **Recipient decrypts** at `https://chases.house/files/`: drop the `.age` file, enter passphrase, save the output.

5. **Clean up** when done: delete the file from `C:\Users\chase\files-vault\`. Zero Trust session cookies expire after 24 h but the file lingers until removed.

---

## Troubleshooting

**`cloudflared tunnel run` works but the service doesn't.** The service runs as `LocalSystem` and may not have the same `%USERPROFILE%`. Check `%WINDIR%\System32\config\systemprofile\.cloudflared\` for the config file or point the service explicitly at the config path.

**Recipient sees a Cloudflare Access page but never reaches the download.** Check the Access policy includes their exact email address. Cloudflare One will log the blocked attempt under Access → Logs.

**Download stalls or 502s.** Confirm `serve-vault.py` is running. Check cloudflared logs: `Get-Content $env:USERPROFILE\.cloudflared\cloudflared.log -Tail 50 -Wait` (path may differ under service mode — check `%ProgramData%\Cloudflare\cloudflared\`).

**Browser decrypt hangs at 0%.** Expected — scrypt key derivation takes 1–5 seconds with zero bytes of output. The UI shows "Deriving key…" during this window. If it stays there past ~10 seconds, the passphrase is probably wrong.
