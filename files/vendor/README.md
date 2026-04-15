# Vendored Dependencies

## age.js

**Library**: [typage](https://github.com/FiloSottile/typage) (`age-encryption` on npm)
**Version**: v0.3.0
**Released**: 2025-12-29
**License**: BSD-3-Clause
**Source**: https://github.com/FiloSottile/typage/releases/download/v0.3.0/age-0.3.0.js
**SHA-256**: `256abd4b64d1b4fc40ff42a797a7dd26a54d34be5284ce9cf6d073a9a80452d0`

Unminified IIFE bundle (208 KB). Exposes global `age` with `Encrypter`, `Decrypter`,
`scryptIdentity`, `scryptRecipient`, etc. Works in browsers and classic Web Workers
via `importScripts`.

### Verify integrity

```bash
# From repo root
sha256sum files/vendor/age.js
# expected: 256abd4b64d1b4fc40ff42a797a7dd26a54d34be5284ce9cf6d073a9a80452d0
```

Or re-download from the GitHub Release and diff — this file is byte-identical to upstream.

### Upgrading

1. Download the new `age-<version>.js` from the typage releases page.
2. Replace `files/vendor/age.js`.
3. Update this README with the new version, date, URL, and SHA-256.
4. Note the upgrade in `docs/adr/013-files-page.md` (or a successor ADR).
5. Run the round-trip verification from the ADR before committing.
