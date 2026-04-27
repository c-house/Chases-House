// ── Yahtzee · Scoring rules (pure functions) ──────────────────────────
//
// This module owns ALL rule knowledge: legal-category enforcement,
// natural scoring, joker scoring, upper bonus, and Yahtzee bonus.
// No DOM, no state mutation. Consumers pass in a scorecard + dice array
// and get back deterministic results.
//
// Canonical rule references (must stay correct):
//  - 3oak / 4oak require ≥3 / ≥4 of one face (NOT exactly).
//  - Small Straight = 4 consecutive faces; Large Straight = 5 consecutive.
//  - Yahtzee bonus = +100 each subsequent Yahtzee, ONLY if the Yahtzee
//    box was scored as 50 (not 0, not still empty).
//  - Joker rule (subsequent Yahtzee, Yahtzee box already filled):
//      • Matching upper open  → MUST score there (face × 5).
//      • Matching upper full  → may use any open lower (FH=25, SS=30,
//        LS=40, 3oak/4oak/Chance = sum of all dice).
//      • Both filled          → must zero one open upper.
//  - You MUST score every turn — forced zero is legal when nothing fits.

(function () {
  'use strict';

  window.Yahtzee = window.Yahtzee || {};

  const UPPER = ['aces', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const LOWER = ['threeOfKind', 'fourOfKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'];
  const ALL = UPPER.concat(LOWER);

  const FACE_TO_UPPER = { 1: 'aces', 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes' };
  const UPPER_TO_FACE = { aces: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };

  const LABELS = {
    aces: 'Aces',  twos: 'Twos',  threes: 'Threes',  fours: 'Fours',  fives: 'Fives',  sixes: 'Sixes',
    threeOfKind: '3 of a Kind',  fourOfKind: '4 of a Kind',
    fullHouse: 'Full House',  smallStraight: 'Sm Straight',  largeStraight: 'Lg Straight',
    yahtzee: 'Yahtzee',  chance: 'Chance'
  };

  const FIXED_VALUES = { fullHouse: 25, smallStraight: 30, largeStraight: 40, yahtzee: 50 };

  // ── Helpers ──────────────────────────────────────────────────────────

  function counts(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < dice.length; i++) c[dice[i]]++;
    return c;
  }

  function sumDice(dice) {
    let s = 0;
    for (let i = 0; i < dice.length; i++) s += dice[i];
    return s;
  }

  function hasNOfKind(c, n) {
    for (let i = 1; i <= 6; i++) if (c[i] >= n) return true;
    return false;
  }

  function hasFullHouse(c) {
    // Natural Full House requires exactly a 3+2 split. A Yahtzee (5 of a
    // kind) does NOT score as a natural Full House — the +25 only applies
    // through the joker rule, which is handled in jokerScore() / previewScore().
    let three = false, two = false;
    for (let i = 1; i <= 6; i++) {
      if (c[i] === 3) three = true;
      else if (c[i] === 2) two = true;
    }
    return three && two;
  }

  function hasStraight(c, len) {
    let run = 0;
    for (let i = 1; i <= 6; i++) {
      if (c[i] >= 1) {
        run++;
        if (run >= len) return true;
      } else {
        run = 0;
      }
    }
    return false;
  }

  function isYahtzee(dice) {
    if (dice.length !== 5) return false;
    for (let i = 1; i < 5; i++) if (dice[i] !== dice[0]) return false;
    return true;
  }

  // ── Natural scoring (no joker logic) ─────────────────────────────────
  // Caller is responsible for joker overrides via previewScore.

  function naturalScore(category, dice) {
    const c = counts(dice);
    switch (category) {
      case 'aces':   return c[1] * 1;
      case 'twos':   return c[2] * 2;
      case 'threes': return c[3] * 3;
      case 'fours':  return c[4] * 4;
      case 'fives':  return c[5] * 5;
      case 'sixes':  return c[6] * 6;
      case 'threeOfKind':   return hasNOfKind(c, 3) ? sumDice(dice) : 0;
      case 'fourOfKind':    return hasNOfKind(c, 4) ? sumDice(dice) : 0;
      case 'fullHouse':     return hasFullHouse(c) ? 25 : 0;
      case 'smallStraight': return hasStraight(c, 4) ? 30 : 0;
      case 'largeStraight': return hasStraight(c, 5) ? 40 : 0;
      case 'yahtzee':       return isYahtzee(dice) ? 50 : 0;
      case 'chance':        return sumDice(dice);
      default: return 0;
    }
  }

  // ── Joker scoring (subsequent Yahtzee placed in lower section) ───────

  function jokerScore(category, dice) {
    if (category === 'fullHouse')     return 25;
    if (category === 'smallStraight') return 30;
    if (category === 'largeStraight') return 40;
    // 3oak, 4oak, Chance → sum of all dice (which is 5×face for a Yahtzee).
    return sumDice(dice);
  }

  // ── Legal categories given current state ─────────────────────────────
  // Returns the array of categories the player is allowed to commit to
  // this turn. Joker enforcement: matching upper takes priority.

  function legalCategories(scorecard, dice) {
    const open = ALL.filter(cat => scorecard[cat] == null);
    if (!isYahtzee(dice)) return open;

    // First Yahtzee — free choice (any open category).
    if (scorecard.yahtzee == null) return open;

    // Subsequent Yahtzee — joker rule.
    const matchingUpper = FACE_TO_UPPER[dice[0]];
    if (scorecard[matchingUpper] == null) return [matchingUpper];

    const openLower = LOWER.filter(cat => scorecard[cat] == null);
    if (openLower.length > 0) return openLower;

    return UPPER.filter(cat => scorecard[cat] == null);
  }

  // ── Preview the score the player would lock in ───────────────────────

  function previewScore(scorecard, dice, category) {
    if (!isYahtzee(dice)) return naturalScore(category, dice);

    // First Yahtzee — natural scoring everywhere.
    if (scorecard.yahtzee == null) return naturalScore(category, dice);

    // Subsequent Yahtzee — joker rules.
    const matchingUpper = FACE_TO_UPPER[dice[0]];
    if (category === matchingUpper) return naturalScore(category, dice);
    if (LOWER.indexOf(category) >= 0) return jokerScore(category, dice);
    return 0; // forced zero in non-matching upper
  }

  // ── Commit a category — returns next scorecard + bonus delta ─────────

  function commitCategory(scorecard, dice, category) {
    const score = previewScore(scorecard, dice, category);
    const next = Object.assign({}, scorecard);
    next[category] = score;

    let yahtzeeBonus = 0;
    if (isYahtzee(dice) && scorecard.yahtzee === 50) {
      // Subsequent Yahtzee while bonus-eligible → +100 chip.
      yahtzeeBonus = 100;
    }

    return { scorecard: next, yahtzeeBonus, score };
  }

  // ── Aggregate scoring ────────────────────────────────────────────────

  function upperSubtotal(scorecard) {
    let s = 0;
    for (let i = 0; i < UPPER.length; i++) s += (scorecard[UPPER[i]] || 0);
    return s;
  }

  function upperBonus(scorecard) {
    return upperSubtotal(scorecard) >= 63 ? 35 : 0;
  }

  function lowerSubtotal(scorecard) {
    let s = 0;
    for (let i = 0; i < LOWER.length; i++) s += (scorecard[LOWER[i]] || 0);
    return s;
  }

  function totalScore(scorecard, bonusYahtzees) {
    return upperSubtotal(scorecard)
      + upperBonus(scorecard)
      + lowerSubtotal(scorecard)
      + (bonusYahtzees || 0) * 100;
  }

  function isScorecardComplete(scorecard) {
    for (let i = 0; i < ALL.length; i++) {
      if (scorecard[ALL[i]] == null) return false;
    }
    return true;
  }

  function emptyScorecard() {
    const sc = {};
    for (let i = 0; i < ALL.length; i++) sc[ALL[i]] = null;
    return sc;
  }

  // ── Public surface ───────────────────────────────────────────────────

  window.Yahtzee.Score = {
    UPPER, LOWER, ALL,
    FACE_TO_UPPER, UPPER_TO_FACE, LABELS, FIXED_VALUES,
    counts, sumDice, isYahtzee,
    naturalScore, jokerScore, previewScore, commitCategory,
    legalCategories,
    upperSubtotal, upperBonus, lowerSubtotal, totalScore,
    isScorecardComplete, emptyScorecard
  };
})();
