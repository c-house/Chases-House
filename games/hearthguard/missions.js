/* ═══════════════════════════════════════════════════════════════
   Hearthguard — missions.js
   Pure data + small helpers. Three hand-authored missions.
   Spawn schedule keyed by ARRIVAL turn; forecasts shown 1 turn earlier.
   Exposes window.HearthguardMissions.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.HearthguardState;
  const U = window.HearthguardUnits;

  const FOREST_EDGE = {
    id: 'forest-edge',
    index: 0,
    name: 'The Forest Edge',
    flavor: 'Goblins have crossed the border at last light. The villagers have nowhere to run. Hold the line for five turns.',
    decoration: 'forest',
    cols: 8, rows: 8,
    maxTurns: 5,
    initialUnits: [
      { type: 'knight',   at: 'C5' },
      { type: 'archer',   at: 'D5' },
      { type: 'mage',     at: 'E5' },
      { type: 'villager', at: 'C8' },
      { type: 'villager', at: 'D8' },
      { type: 'villager', at: 'E8' },
      { type: 'goblin',   at: 'B1' },
      { type: 'troll',    at: 'D1' },
      { type: 'goblin',   at: 'F1' },
    ],
    spawnSchedule: {},
    tutorial: {
      triggers: [
        { id: 'select-hero',   on: 'turn-start',          text: 'Click a hero to see their range.' },
        { id: 'see-threat',    on: 'enemy-intent-shown',  text: 'Red hatching shows where enemies will attack next.' },
        { id: 'redirect',      on: 'first-action-queued', text: 'Push or pull to redirect attacks. Body-block by standing on a threatened tile.' },
        { id: 'confirm-turn',  on: 'all-heroes-acted',    text: 'Press Confirm Turn when ready. You can undo any action before then.' },
      ],
    },
  };

  const CROSSROADS = {
    id: 'crossroads',
    index: 1,
    name: 'The Crossroads',
    flavor: 'Three paths meet, and three more goblins than yesterday.',
    decoration: 'crossroads',
    cols: 8, rows: 8,
    maxTurns: 5,
    initialUnits: [
      { type: 'knight',   at: 'B5' },
      { type: 'archer',   at: 'D5' },
      { type: 'mage',     at: 'F5' },
      { type: 'villager', at: 'C8' },
      { type: 'villager', at: 'E8' },
      { type: 'villager', at: 'G8' },
      { type: 'goblin',   at: 'A1' },
      { type: 'troll',    at: 'D1' },
      { type: 'goblin',   at: 'H1' },
    ],
    spawnSchedule: {
      3: [
        { type: 'goblin-archer', at: 'A4' },
        { type: 'goblin',        at: 'H4' },
      ],
    },
    tutorial: null,
  };

  const CASTLE_GATE = {
    id: 'castle-gate',
    index: 2,
    name: 'The Castle Gate',
    flavor: 'The last gate before the keep. Hold.',
    decoration: 'castle',
    cols: 8, rows: 8,
    maxTurns: 5,
    initialUnits: [
      { type: 'knight',        at: 'C6' },
      { type: 'archer',        at: 'D6' },
      { type: 'mage',          at: 'E6' },
      { type: 'villager',      at: 'C8' },
      { type: 'villager',      at: 'D8' },
      { type: 'villager',      at: 'E8' },
      { type: 'goblin',        at: 'B1' },
      { type: 'goblin',        at: 'G1' },
      { type: 'troll',         at: 'D1' },
      { type: 'goblin-archer', at: 'A3' },
      { type: 'goblin-archer', at: 'H3' },
    ],
    spawnSchedule: {
      2: [{ type: 'goblin', at: 'random-edge' }],
      4: [
        { type: 'goblin',        at: 'random-edge' },
        { type: 'goblin-archer', at: 'random-edge' },
        { type: 'troll',         at: 'random-edge' },
      ],
    },
    tutorial: null,
  };

  const ALL = [FOREST_EDGE, CROSSROADS, CASTLE_GATE];

  function byIndex(i) {
    return ALL[i] || null;
  }

  function spawnsForTurn(missionDef, turn) {
    if (!missionDef || !missionDef.spawnSchedule) return [];
    return missionDef.spawnSchedule[turn] || [];
  }

  function forecastsForNextTurn(missionDef, currentTurn) {
    return spawnsForTurn(missionDef, currentTurn + 1).map(spawn => ({
      type: spawn.type,
      at: spawn.at,
      forTurn: currentTurn + 1,
    }));
  }

  // Build the initial unit list for a mission. Assigns unique IDs.
  function buildInitialUnits(missionDef) {
    const counters = {};
    return missionDef.initialUnits.map(u => {
      counters[u.type] = (counters[u.type] || 0) + 1;
      return U.makeUnit(u.type, u.at, { n: counters[u.type] });
    });
  }

  // Find a random unoccupied edge tile using a seed; returns { tile, seed }.
  function pickRandomEdgeTile(state, seed) {
    const edges = [];
    const cols = state.cols, rows = state.rows;
    for (let c = 0; c < cols; c++) {
      const top = S.coordsToTile(c, 0);
      const bot = S.coordsToTile(c, rows - 1);
      if (!S.unitAt(state, top))    edges.push(top);
      if (!S.unitAt(state, bot))    edges.push(bot);
    }
    for (let r = 1; r < rows - 1; r++) {
      const lf = S.coordsToTile(0, r);
      const rt = S.coordsToTile(cols - 1, r);
      if (!S.unitAt(state, lf))     edges.push(lf);
      if (!S.unitAt(state, rt))     edges.push(rt);
    }
    if (edges.length === 0) return { tile: null, seed };
    const pick = S.rngPick(seed, edges);
    return { tile: pick.value, seed: pick.seed };
  }

  window.HearthguardMissions = {
    ALL, byIndex,
    spawnsForTurn, forecastsForNextTurn,
    buildInitialUnits, pickRandomEdgeTile,
  };
})();
