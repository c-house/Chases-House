/* ═══════════════════════════════════════════════════════════════
   Hearthguard — narrate.js
   Pure. Single source of truth for prose narration. Drives the
   visible aria-live margin notes AND the machine-readable surface
   exposed via Hearthguard.describeState().prose.
   No DOM, no side effects.
   Exposes window.HearthguardNarrate.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.HearthguardState;
  const U = window.HearthguardUnits;

  function unitLabel(state, id) {
    const u = S.unitById(state, id);
    if (!u) return 'Unit';
    return U.statsFor(u.type).label;
  }

  // Single resolve event → string | null.
  function describeEvent(ev, state) {
    switch (ev.kind) {
      case 'plan-action':    return `${unitLabel(state, ev.unitId)} readies ${ev.action}.`;
      case 'move':
        if (ev.cause === 'plan')  return `${unitLabel(state, ev.unitId)} moves to ${ev.to}.`;
        if (ev.cause === 'shove') return `${unitLabel(state, ev.unitId)} shoved to ${ev.to}.`;
        return null;
      case 'attack':         return `${unitLabel(state, ev.attackerId)} strikes ${ev.targetTile}.`;
      case 'attack-whiff':   return `${unitLabel(state, ev.attackerId)} strikes ${ev.targetTile} — empty.`;
      case 'damage':         return `${unitLabel(state, ev.unitId)} takes ${ev.dmg} damage.`;
      case 'death': {
        const name = ev.type ? U.statsFor(ev.type).label : unitLabel(state, ev.unitId);
        return `${name} falls.`;
      }
      case 'collision':      return `Collision at ${ev.at}.`;
      case 'collision-wall': return `${unitLabel(state, ev.unitId)} pushed into a wall.`;
      case 'swap':           return `Swapped ${ev.tileA} and ${ev.tileB}.`;
      case 'spawn':          return `${U.statsFor(ev.type).label} arrives at ${ev.at}.`;
      case 'forecast':       return `${U.statsFor(ev.type).label} will arrive at ${ev.at} next turn.`;
      case 'turn-end':       return `Turn ${ev.turn} ends.`;
      default:               return null;
    }
  }

  function describeEvents(events, state) {
    const out = [];
    for (const ev of (events || [])) {
      const line = describeEvent(ev, state);
      if (line) out.push(line);
    }
    return out;
  }

  // Player action queued (before resolve) → string | null.
  function describeAction(action, state) {
    if (!action) return null;
    const heroName = unitLabel(state, action.unitId);
    switch (action.kind) {
      case 'move': return `${heroName} moves to ${action.toTile}.`;
      case 'push': {
        const target = S.unitAt(state, action.targetTile);
        const tname = target ? U.statsFor(target.type).label : 'tile';
        return `${heroName} readies push on ${tname} at ${action.targetTile}.`;
      }
      case 'pull': {
        const target = S.unitAt(state, action.targetTile);
        const tname = target ? U.statsFor(target.type).label : 'tile';
        return `${heroName} readies pull on ${tname} at ${action.targetTile}.`;
      }
      case 'swap': return `${heroName} prepares to swap ${action.tileA} and ${action.tileB}.`;
      default: return null;
    }
  }

  function describeSelection(state) {
    const id = state && state.selectedUnitId;
    if (!id) return null;
    const u = S.unitById(state, id);
    if (!u) return null;
    return `${U.statsFor(u.type).label} selected at ${u.at}.`;
  }

  function describeThreats(state) {
    const lines = [];
    for (const u of state.units) {
      if (u.side !== 'enemy' || u.hp <= 0 || !u.intent || !u.intent.targetTile) continue;
      const target = S.unitAt(state, u.intent.targetTile);
      const tname = target ? U.statsFor(target.type).label : 'tile';
      const ename = U.statsFor(u.type).label;
      lines.push(`${ename} at ${u.at} will strike ${tname} at ${u.intent.targetTile} for ${u.intent.damage}.`);
    }
    return lines;
  }

  // Full state snapshot prose — used by describeState() machine surface.
  function describeForState(state) {
    if (!state) return [];
    const lines = [];
    if (state.missionDef) {
      lines.push(`${state.missionDef.name}, turn ${state.turn} of ${state.maxTurns}.`);
    }
    const sel = describeSelection(state);
    if (sel) lines.push(sel);
    lines.push(...describeThreats(state));
    return lines;
  }

  window.HearthguardNarrate = {
    unitLabel,
    describeEvent, describeEvents,
    describeAction,
    describeSelection, describeThreats,
    describeForState,
  };
})();
