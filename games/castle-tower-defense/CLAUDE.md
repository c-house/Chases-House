# CTD3 (Castle Tower Defense) — dev/testing notes

Scoped notes for `games/castle-tower-defense/`. Site-wide dev port (`3030`), Firebase, deploy/cache, and reserved-ports guidance live in the repo-root `CLAUDE.md`.

## Star-gated maps in testing

Map cards render **display names, not ids** — and three maps are unlock-gated by total ★:

| id | display name | unlock (total ★) |
|---|---|---|
| `plains` | The Plains | 0 |
| `forest` | The Whispering Wood | 0 |
| `tidewater` | Tidewater Bend | 0 |
| `mountain` | **The Stone Gate** | 5 |
| `riverbend` | Riverbend | 13 |
| `snowfall_pass` | Snowfall Pass | 14 |

Two difficulties per map: **Quiet** and **★ Spirited** (each worth up to 3★).

A fresh browser profile has 0★, so mountain/riverbend/snowfall are hidden (e.g. G-1 wants Mountain = "The Stone Gate" / Spirited). Unlock for testing by seeding localStorage in the game console, then reload:

```js
localStorage.setItem('ctd3:scores', JSON.stringify({
  plains:    { quiet:{stars:3}, spirited:{stars:3} },
  forest:    { quiet:{stars:3}, spirited:{stars:3} },
  tidewater: { quiet:{stars:3}, spirited:{stars:3} }
}));                       // 18★ → unlocks every map
location.reload();
// undo: localStorage.removeItem('ctd3:scores'); location.reload();
```

`ctd3:scores` is a **localStorage** key (per-origin, per-profile), *not* an RTDB path. `totalStars()` sums `stars` across every difficulty under each non-`user:` map and gates unlocks — so **endless runs must never write it** (endless records live under `ctd3:endless`). When seeding to reach a gated map for a one-off check, capture the original value first and restore it after (sprint-4 discipline).
