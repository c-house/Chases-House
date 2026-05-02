# ADR-017: Firebase project + security model

**Status**: Accepted
**Date**: 2026-04-25

## Context

Jeopardy (ADR-011) was built against Firebase Realtime Database via the v10 compat SDK with anonymous auth, but the actual Firebase project was never wired up — `games/shared/firebase.js` carried a placeholder API key (`AIzaSyDX...`) until now. The placeholder meant `signInAnonymously()` failed at runtime, blocking any actual multiplayer testing.

When connecting a real project, the obvious questions: is it safe to commit the API key? What stops someone from pointing their own client at our database and reading/writing whatever they want? The two Stack Overflow threads the user pointed at — [is-it-safe-to-expose-firebase-apikey-to-the-public](https://stackoverflow.com/questions/37482366/is-it-safe-to-expose-firebase-apikey-to-the-public) and [how-to-restrict-firebase-data-modification](https://stackoverflow.com/questions/35418143/how-to-restrict-firebase-data-modification) — give the canonical answers from Frank van Puffelen (Firebase team):

> Firebase-related APIs use API keys only to identify the Firebase project or app, not for authorization to call the API.

> The fact that someone knows your URL is not a security risk. […] To secure your data, your database should be protected with validation rules that ensure all data adheres to a structure that you want, [and] authorization rules to ensure that each bit of data can only be read and modified by the authorized users.

The API key is essentially a public ID like the database URL. Real security comes from Firebase Realtime Database rules (server-enforced) and, defense-in-depth, HTTP-referrer restrictions on the API key in Google Cloud Console.

## Decision

A `chases-house` Firebase project was created on the Spark (free) tier with three services configured:

1. **Realtime Database** at `https://chases-house-default-rtdb.firebaseio.com` (us-central1), started in **locked mode** then immediately upgraded to the rules below — there was no window where the database sat in test mode open to any authenticated user.
2. **Anonymous Authentication** enabled. No other sign-in methods.
3. **API key restrictions** (Cloud Console → Credentials → "Browser key (auto created by Firebase)"): HTTP referrers restricted to `https://chases.house/*`, `https://*.chases.house/*`, and `http://localhost:3003/*` only. Requests from other origins fail at the API gateway before they even reach the database.

The full `firebaseConfig` block (apiKey + appId + project identifiers) is committed verbatim in [games/shared/firebase.js](../../games/shared/firebase.js). It's not a secret. A header comment in that file points readers here for the security rationale.

### Realtime Database rules

The published rule set ([Firebase console → Realtime Database → Rules](https://console.firebase.google.com/project/chases-house/database/chases-house-default-rtdb/rules)):

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "$roomCode.matches(/^[A-Z]{4}$/)",

        "players": {
          "$playerId": {
            "name":      { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length < 40" },
            "score":     { ".validate": "newData.isNumber()" },
            "connected": { ".validate": "newData.isBoolean()" },
            "joinedAt":  { ".validate": "newData.isNumber()" },
            "_probe":    { ".validate": "newData.isBoolean()" },
            "$other":    { ".validate": false }
          }
        },

        "game": {
          "buzzer": {
            "buzzedPlayers": {
              "$playerId": { ".validate": "newData.isNumber()" }
            },
            "lockedOut": {
              "$playerId": { ".validate": "newData.isBoolean()" }
            }
          },
          "finalJeopardy": {
            "wagers": {
              "$playerId": { ".validate": "newData.isNumber() && newData.val() >= 0" }
            },
            "answers": {
              "$playerId": { ".validate": "newData.isString() && newData.val().length < 500" }
            }
          }
        }
      }
    }
  }
}
```

What this enforces:

- **Top level deny**: `.read: false, .write: false` at the root means anything not explicitly allowed is rejected. Verified: `curl https://chases-house-default-rtdb.firebaseio.com/.json` returns `Permission denied` with no auth.
- **`rooms/{code}` requires auth**: anonymous sign-in is the only way in, and the room code itself must match `/^[A-Z]{4}$/` — not a typo guard, but it stops anyone trying to inject extra path segments or non-room data under `rooms/`.
- **Schema validation on the leaves we care about**: player names are non-empty and under 40 characters; FJ answers under 500. Buzz timestamps must be numbers (the resolved server timestamp). Lockout flags must be booleans. Scores and wagers must be numeric.
- **`$other: false` on player records**: any field on a `players/{playerId}` record that isn't `name`, `score`, `connected`, `joinedAt`, or `_probe` is rejected. Stops field injection.
- **Permissive elsewhere inside a room**: `board`, `meta`, `currentClue`, `pickingPlayer`, `currentRound` etc. are allowed any auth'd write without further validation. Pragmatic — the shapes are big and the room code already gates access; over-validating the board structure would slow development without buying real safety.

What this does **not** enforce:

- **Ownership of writes**: the rules don't require `auth.uid === $playerId`. This is intentional because **hot-seat mode** (ADR-016) writes player records and buzzes on behalf of synthetic player IDs from the host's auth.uid. If we required ownership, hot-seat would break. The trade is that any auth'd user with a room code could in principle buzz on behalf of another player. Not a real risk for a couch party game.
- **Room enumeration**: the 24-letter, 4-character room code namespace (24⁴ = 331,776 combinations) plus authenticated reads are enough to make casual enumeration impractical, but a determined attacker with a script could brute-force codes. Acceptable for the use case; if abuse appears, App Check is the next step.

### Defense-in-depth: API key referrer restrictions

Firebase docs recommend referrer restrictions as a complement to rules. Configured in Cloud Console:

| Allowed referrer        | Why                                              |
| ----------------------- | ------------------------------------------------ |
| `https://chases.house/*` | Production origin                               |
| `https://*.chases.house/*` | Future subdomains                              |
| `http://localhost:3003/*` | `python -m http.server 3003` for local dev      |

What this actually protects: requests that carry the API key in the URL — primarily Identity Toolkit (the call `signInAnonymously()` makes under the hood) — fail with `requests-from-referer-<x>-are-blocked` from any other origin. Realtime Database REST requests (`https://chases-house-default-rtdb.firebaseio.com/…`) carry an auth token rather than the API key, so the referrer restriction does **not** gate them — RTDB rules are the only thing protecting the database itself.

The combined effect: an attacker can't easily mint anonymous auth tokens against our project from another origin, which means they can't trivially obtain the auth credentials needed to invoke the DB. They can spoof the `Referer` header from a non-browser client, so this isn't airtight; it raises the cost of casual scraping and matches the Stack Overflow answer's recommendation. Auth tokens are valid for ~1 hour once minted, so this is a slow throttle, not a hard barrier.

## Verification

End-to-end smoke test passed in browser via Chrome DevTools MCP:

1. **Unauthenticated REST read denied**: `curl https://chases-house-default-rtdb.firebaseio.com/.json` and `…/rooms/ABCD.json` both return `{"error": "Permission denied"}`.
2. **Authenticated host create**: `host.html` loads, `signInAnonymously` succeeds, a room (`NHLN`) is generated and written to `rooms/NHLN`. Lobby renders with the room code.
3. **Authenticated player join**: `play.html?room=NHLN` joins as `TestPlayer`, the player record is written to `rooms/NHLN/players/{auth.uid}`, the host's `playerList` listener picks it up and renders "1 JOINED — TestPlayer". Zero console errors on either page.
4. **Hot-seat probe**: `Jeopardy.probeWritePermission` (added in ADR-016) writes a `_probe: true` flag at the moment a couch player is added; the rules permit this since `_probe` is in the player schema's allowlist. If the rules ever tighten beyond what hot-seat needs, the probe surfaces a toast at add-time rather than letting buzzes silently fail.

## Files

| File                                | Change                                                                |
| ----------------------------------- | --------------------------------------------------------------------- |
| `games/shared/firebase.js`          | Real `firebaseConfig` block + header comment pointing to this ADR     |
| Firebase console (out of repo)      | Realtime Database created, rules published, Anonymous auth enabled    |
| Cloud Console → API keys (out of repo) | HTTP-referrer restrictions on the Browser key                       |
| `docs/adr/017-firebase-security.md` | This document                                                         |

## Updating the rules

The rules in this document are the canonical source. The Firebase console is the executing copy — keep them in sync. To update:

1. Edit the rules block above in this ADR (so the diff lands in PR review).
2. Open [Firebase console → Realtime Database → Rules](https://console.firebase.google.com/project/chases-house/database/chases-house-default-rtdb/rules), paste the new JSON, click Publish. There is no CLI deploy in this repo (no `firebase.json` / no `firebase deploy` workflow on purpose — keeps the static-site stack flat).
3. Smoke-test with the verification steps below before merging.

If you add a new write path in code (e.g. `rooms/{code}/game/somethingNew`), it inherits `auth != null` write permission automatically because of the `$roomCode` parent. If you want to validate its shape, add a `.validate` block under `rooms/{code}/game/` mirroring the `buzzer` / `finalJeopardy` pattern.

If you tighten the player-record schema (the `$other: false` block), make sure both `joinRoom` and `joinRoomDirect` in [games/jeopardy/shared.js](../../games/jeopardy/shared.js) write only allowlisted keys, or the writes will fail with `permission_denied` — the `probeWritePermission` helper surfaces that case as a toast on first couch-player add.

## Open follow-ups (not blocking)

- **App Check**: Firebase's recommended next layer. Attests that requests come from a registered web app. Worth adding once we observe any abuse signal; not needed on day one.
- **Room-code hardening**: if guess-the-code abuse appears, switch to 6 characters or rate-limit room creation per UID via Cloud Functions.
- **Rule tightening on the `game/` subtree**: validate `currentClue` shape, `pickingPlayer` matches a known player ID, etc. Skipped for now to avoid breaking the live game during further development.
