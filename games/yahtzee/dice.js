// ── Yahtzee · Dice rendering & tumble animation ───────────────────────
//
// Owns the dice DOM/SVG visual layer. Receives state (read-only) from
// game.js and writes pip layout + held visuals to the existing .die
// elements. Tumble animations are CSS keyframes; this module only
// schedules them and resolves a Promise when complete.

(function () {
  'use strict';

  window.Yahtzee = window.Yahtzee || {};

  // Pip positions per face — 9-cell grid (top/middle/bottom × left/center/right).
  const FACES = {
    1: ['mc'],
    2: ['tl', 'br'],
    3: ['tl', 'mc', 'br'],
    4: ['tl', 'tr', 'bl', 'br'],
    5: ['tl', 'tr', 'mc', 'bl', 'br'],
    6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br']
  };

  let reducedMotion = false;

  function setFace(dieEl, value) {
    // Strip existing pips (preserve any non-pip children like the lock icon).
    const pips = dieEl.querySelectorAll('.pip');
    for (let i = 0; i < pips.length; i++) pips[i].remove();
    if (value == null) return;
    const positions = FACES[value];
    for (let i = 0; i < positions.length; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip ' + positions[i];
      dieEl.appendChild(pip);
    }
  }

  // Sync the rail to state. dieSlotEls is a NodeList/Array of .die-slot elements.
  function render(diceState, dieSlotEls) {
    for (let i = 0; i < dieSlotEls.length; i++) {
      const slotEl = dieSlotEls[i];
      const dieEl = slotEl.querySelector('.die');
      const die = diceState[i];

      if (die.value == null) {
        slotEl.classList.add('blank');
        slotEl.classList.remove('held');
        dieEl.classList.remove('held');
        setFace(dieEl, null);
      } else {
        slotEl.classList.remove('blank');
        slotEl.classList.toggle('held', !!die.held);
        dieEl.classList.toggle('held', !!die.held);
        if (!dieEl.classList.contains('tumbling')) {
          setFace(dieEl, die.value);
        }
      }
    }
  }

  // Tumble a single die. Resolves when the animation finishes and the
  // final pip layout is committed.
  function tumble(dieEl, finalValue) {
    return new Promise(function (resolve) {
      if (reducedMotion) {
        setFace(dieEl, finalValue);
        resolve();
        return;
      }
      const duration = 600 + Math.random() * 180;
      dieEl.style.setProperty('--tumble-dur', duration + 'ms');
      dieEl.style.setProperty('--tumble-rot-x', (540 + Math.random() * 360) + 'deg');
      dieEl.style.setProperty('--tumble-rot-y', (360 + Math.random() * 360) + 'deg');
      dieEl.style.setProperty('--tumble-rot-z', (Math.random() * 90 - 45) + 'deg');
      dieEl.classList.add('tumbling');
      // Swap the face partway through so the player sees it land.
      setTimeout(function () { setFace(dieEl, finalValue); }, duration * 0.7);
      setTimeout(function () {
        dieEl.classList.remove('tumbling');
        dieEl.style.removeProperty('--tumble-dur');
        dieEl.style.removeProperty('--tumble-rot-x');
        dieEl.style.removeProperty('--tumble-rot-y');
        dieEl.style.removeProperty('--tumble-rot-z');
        resolve();
      }, duration);
    });
  }

  // Tumble multiple dice in parallel. finalValues entries that are null
  // mean "skip — this die is held". Returns a Promise that resolves when
  // ALL non-skipped dice have settled.
  function tumbleAll(dieEls, finalValues) {
    const promises = [];
    for (let i = 0; i < dieEls.length; i++) {
      if (finalValues[i] == null) continue;
      promises.push(tumble(dieEls[i], finalValues[i]));
    }
    return Promise.all(promises);
  }

  function setReducedMotion(b) { reducedMotion = !!b; }

  window.Yahtzee.Dice = {
    FACES,
    setFace, render, tumble, tumbleAll, setReducedMotion
  };
})();
