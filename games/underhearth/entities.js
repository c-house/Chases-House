/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — entities.js
   Tile codes, monster/item/class definitions, display-name helper.
   PHASE-1 stub content. Real catalogues land in a follow-up content ADR.
   Adding a row = appending to the table; no logic change required.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TILE = Object.freeze({
    WALL: 0,
    FLOOR: 1,
    DOOR: 2,
    STAIRS_UP: 3,
    STAIRS_DOWN: 4,
  });

  const MONSTERS = {
    goblin: { glyph: 'g', threat: 'trivial', hp: 3,  dmg: 2, defense: 10, speed: 80,  awakeRadius: 6,  label: 'goblin' },
    troll:  { glyph: 'T', threat: 'threat',  hp: 12, dmg: 5, defense: 13, speed: 80,  awakeRadius: 8,  label: 'troll'  },
    dragon: { glyph: 'D', threat: 'lethal',  hp: 30, dmg: 9, defense: 16, speed: 100, awakeRadius: 10, label: 'dragon' },
  };

  // Per-class combat profile. dmgDie is the bump-attack damage roll;
  // attackBonus is added to the d20 attack roll; defense is the AC monsters roll against.
  const CLASSES = {
    knight: { hp: 22, mp: 4,  str: 8, label: 'Knight', dmgDie: 8, attackBonus: 4, defense: 13 },
    archer: { hp: 16, mp: 6,  str: 5, label: 'Archer', dmgDie: 6, attackBonus: 3, defense: 11 },
    mage:   { hp: 11, mp: 14, str: 3, label: 'Mage',   dmgDie: 4, attackBonus: 1, defense: 9  },
  };

  function monsterTable(depth) {
    if (depth <= 3)  return [{ kind: 'goblin', weight: 10 }];
    if (depth <= 8)  return [{ kind: 'goblin', weight: 6 }, { kind: 'troll', weight: 3 }];
    if (depth <= 14) return [{ kind: 'troll',  weight: 5 }];
    return [{ kind: 'dragon', weight: 1 }];
  }

  function itemTable(depth) {
    return [
      { kind: 'gold',   sub: null,           weight: 6 },
      { kind: 'potion', sub: 'blue',         weight: 2 },
      { kind: 'potion', sub: 'amber',        weight: 2 },
      { kind: 'potion', sub: 'green',        weight: 1 },
      { kind: 'potion', sub: 'crimson',      weight: 1 },
      { kind: 'scroll', sub: 'SNORK ULBO',   weight: 1 },
      { kind: 'scroll', sub: 'GRAEL VEX',    weight: 1 },
      { kind: 'scroll', sub: 'OOM BIRR',     weight: 1 },
      { kind: 'scroll', sub: 'WANDA STERN',  weight: 1 },
    ];
  }

  function monster(kind) { return MONSTERS[kind] || null; }

  function item(kind, sub) {
    if (kind === 'gold')   return { glyph: '$', kind: 'gold',   sub: null,         threat: 'item'  };
    if (kind === 'potion') return { glyph: '!', kind: 'potion', sub: sub || 'blue', threat: 'magic' };
    if (kind === 'scroll') return { glyph: '?', kind: 'scroll', sub: sub || 'SNORK ULBO', threat: 'magic' };
    return null;
  }

  function classBase(cls) { return CLASSES[cls] || CLASSES.archer; }

  function monsterLabel(kind) {
    const m = MONSTERS[kind];
    return m ? m.label : kind;
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ── Identification game ────────────────────────────────────────────────
  // Per-seed: each potion alias (color) randomly maps to one effect; same
  // for scrolls. The mapping is generated at run start by generateIdAliases.
  // The player's `discovered` map records which aliases have been identified.

  const POTION_ALIASES = ['blue', 'amber', 'green', 'crimson'];
  const POTION_EFFECTS = ['heal', 'paralysis', 'haste', 'might'];
  const SCROLL_ALIASES = ['SNORK ULBO', 'GRAEL VEX', 'OOM BIRR', 'WANDA STERN'];
  const SCROLL_EFFECTS = ['mapping', 'teleport', 'identify', 'confuse'];

  function generateIdAliases(rng) {
    function shuffled(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    }
    const pe = shuffled(POTION_EFFECTS);
    const se = shuffled(SCROLL_EFFECTS);
    const potions = {};
    POTION_ALIASES.forEach((alias, i) => { potions[alias] = pe[i]; });
    const scrolls = {};
    SCROLL_ALIASES.forEach((alias, i) => { scrolls[alias] = se[i]; });
    return {
      potions, scrolls, wands: {},
      discovered: { potions: {}, scrolls: {}, wands: {} },
    };
  }

  // Returns the FULL noun phrase including qty. Renderers must not append qty.
  function itemDisplayNameFull(state, invItem) {
    if (invItem.kind === 'gold') return `${invItem.qty || 1} gold`;
    const qtySuffix = (invItem.qty && invItem.qty > 1) ? ` ×${invItem.qty}` : '';
    if (invItem.kind === 'potion') {
      const alias = invItem.sub;
      const isDiscovered = state && state.ids && state.ids.discovered.potions[alias];
      if (isDiscovered) {
        const eff = state.ids.potions[alias];
        return `potion of ${eff} (${alias})${qtySuffix}`;
      }
      return `${alias} potion${qtySuffix}`;
    }
    if (invItem.kind === 'scroll') {
      const alias = invItem.sub;
      const isDiscovered = state && state.ids && state.ids.discovered.scrolls[alias];
      if (isDiscovered) {
        const eff = state.ids.scrolls[alias];
        return `scroll of ${eff}${qtySuffix}`;
      }
      return `scroll labeled "${alias}"${qtySuffix}`;
    }
    return invItem.kind + qtySuffix;
  }

  function isItemUnidentified(state, invItem) {
    if (invItem.kind === 'potion') return !(state && state.ids && state.ids.discovered.potions[invItem.sub]);
    if (invItem.kind === 'scroll') return !(state && state.ids && state.ids.discovered.scrolls[invItem.sub]);
    return false;
  }

  window.UnderhearthEntities = {
    TILE,
    monsterTable, itemTable,
    monster, item,
    classBase, itemDisplayName: itemDisplayNameFull, monsterLabel,
    ordinal,
    generateIdAliases, isItemUnidentified,
    POTION_ALIASES, POTION_EFFECTS, SCROLL_ALIASES, SCROLL_EFFECTS,
  };
})();
