# Files — User Guide

End-to-end encrypted file sharing via [chases.house/files/](https://chases.house/files/).

## Sender (one-time setup)

1. Install `age`: `winget install FiloSottile.age`
2. For Git Bash users: `winget` doesn't put `age` on PATH. Add an alias once:
   ```bash
   echo "alias age='/c/Users/chase/AppData/Local/Microsoft/WinGet/Packages/FiloSottile.age_Microsoft.Winget.Source_8wekyb3d8bbwe/age/age.exe'" >> ~/.bashrc && source ~/.bashrc
   ```
3. Make sure the tunnel + vault server are running (see [files-tunnel-setup.md](files-tunnel-setup.md)).

## Sender (each file)

1. Encrypt. PowerShell:
   ```powershell
   age -p -o C:\Users\chase\files-vault\example.txt.age C:\path\to\example.txt
   ```
   Git Bash (forward slashes):
   ```bash
   age -p -o C:/Users/chase/files-vault/example.txt.age C:/path/to/example.txt
   ```
   Type a strong passphrase when prompted (use a password manager).
2. Add the recipient's email to the Zero Trust allowlist (Cloudflare dashboard → Access → Applications → Files → Allowlist policy).
3. Send the recipient two things, **on different channels**:
   - **The link**: `https://files.chases.house/example.txt.age`
   - **The passphrase**: by phone call, Signal, or in person — **never the same channel as the link**.

## Recipient

1. Open the link. Sign in with the email you were told to expect (one-time PIN by email).
2. Save the downloaded `.age` file.
3. Go to [chases.house/files/](https://chases.house/files/).
4. Drop the `.age` file on the page.
5. Type the passphrase.
6. Click **Decrypt**. Choose where to save the result.

Requires Chrome, Edge, or Firefox 111+.

## Cleanup

Sender: delete the `.age` from `C:\Users\chase\files-vault\` once the recipient confirms they have it.