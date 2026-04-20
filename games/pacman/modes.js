(function () {
  'use strict';

  const MODES = {
    solo: {
      id: 'solo',
      name: 'Solo vs AI',
      pacCount: 1,
      humanPacCount: 1,
      humanGhostCount: 0,
      win: 'clearDots',
      lives: 3,
      friendlyFire: false,
      description: 'Classic single-player Pac-Man. Clear the maze without being caught.',
    },
    pacVsGhost: {
      id: 'pacVsGhost',
      name: 'Pac vs Ghosts',
      pacCount: 1,
      humanPacCount: 1,
      humanGhostCount: 1,          // user can raise to 1..3 on bind screen
      win: 'clearDotsOrPacDies',
      lives: 3,
      friendlyFire: false,
      description: 'One human Pac-Man vs up to 3 human ghosts. AI fills the rest.',
      allowHumanGhostCountRange: [1, 2, 3],
    },
    coop: {
      id: 'coop',
      name: 'Co-op',
      pacCount: 2,
      humanPacCount: 2,            // user can raise to 3 or 4
      humanGhostCount: 0,
      win: 'clearDotsShared',
      lives: 'shared-5',
      friendlyFire: false,
      description: '2-4 Pac-Men clear the maze together. Shared lives and dot pool.',
      allowPacCountRange: [2, 3, 4],
    },
    battle: {
      id: 'battle',
      name: 'Battle Royale',
      pacCount: 2,
      humanPacCount: 2,
      humanGhostCount: 0,
      win: 'mostDotsWhenCleared',
      lives: 1,
      friendlyFire: 'pellet-only',
      description: '2-4 Pac-Men compete for dots. Power pellets let you eat rivals.',
      allowPacCountRange: [2, 3, 4],
    },
  };

  function humanSlotsForMode(config) {
    // pacs 0..pacCount-1, ghosts pacCount..(pacCount + humanGhostCount - 1)
    const slots = [];
    for (let i = 0; i < config.humanPacCount; i++) {
      slots.push({ slot: i, role: 'pac', index: i, label: `Pac ${i + 1}` });
    }
    const ghostNames = ['Blinky', 'Pinky', 'Inky', 'Clyde'];
    for (let i = 0; i < (config.humanGhostCount || 0); i++) {
      slots.push({
        slot: config.pacCount + i,
        role: 'ghost',
        index: i,
        label: ghostNames[i],
      });
    }
    return slots;
  }

  window.PacmanModes = {
    MODES,
    list: () => Object.values(MODES),
    humanSlotsForMode,
  };
})();
