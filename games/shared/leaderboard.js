/* ===============================================================
   Shared - leaderboard.js
   Persistent global high-score boards backed by Firebase RTDB.
   Snake-only first consumer; per-game per-difficulty boards.
   Higher scores ranked first via orderByChild('score').limitToLast.
   Exposes window.SharedLeaderboard.
   =============================================================== */
(function () {
  'use strict';

  var DEFAULT_LIMIT = 10;
  var FIREBASE_TIMEOUT_MS = 5000;

  function path(game, difficulty) {
    return 'leaderboards/' + game + '/' + difficulty;
  }

  // Firebase RTDB calls hang on unreachable URLs instead of rejecting.
  // Wrap in a race so callers see a bounded failure within FIREBASE_TIMEOUT_MS.
  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('timeout: ' + label)); }, FIREBASE_TIMEOUT_MS);
      })
    ]);
  }

  // Sort an array of {score,...} entries best-first (descending for Snake's points-based scoring).
  function sortBest(entries) {
    return entries.slice().sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (a.ts || 0) - (b.ts || 0);
    });
  }

  // Collapse multiple rows for the same uid down to the best one.
  function dedupByUid(entries) {
    var byUid = {};
    entries.forEach(function (e) {
      if (!e || !e.uid) return;
      var prev = byUid[e.uid];
      if (!prev || e.score > prev.score) byUid[e.uid] = e;
    });
    return Object.keys(byUid).map(function (k) { return byUid[k]; });
  }

  function snapToEntries(snap) {
    var rows = [];
    snap.forEach(function (child) {
      var v = child.val();
      if (v && typeof v.score === 'number' && typeof v.name === 'string') {
        rows.push({ key: child.key, name: v.name, score: v.score, ts: v.ts || 0, uid: v.uid });
      }
    });
    return rows;
  }

  function fetchTop(opts) {
    var game = opts.game;
    var difficulty = opts.difficulty;
    var limit = opts.limit || DEFAULT_LIMIT;
    try {
      var ref = window.SharedFirebase.ref(path(game, difficulty));
      var read = ref.orderByChild('score').limitToLast(limit * 4).once('value').then(function (snap) {
        var rows = snapToEntries(snap);
        var deduped = dedupByUid(rows);
        return sortBest(deduped).slice(0, limit);
      });
      return withTimeout(read, 'fetchTop').catch(function () {
        return [];
      });
    } catch (err) {
      return Promise.resolve([]);
    }
  }

  // Per-user collapse: keep at most one entry per uid per board.
  // Returns the entry that should remain after the write.
  function collapseAndWrite(boardRef, user, score, name) {
    return boardRef.orderByChild('uid').equalTo(user.uid).once('value').then(function (snap) {
      var existing = [];
      snap.forEach(function (child) {
        existing.push({ key: child.key, val: child.val() });
      });

      var ts = window.SharedFirebase.serverTimestamp();
      var newEntry = { name: name, score: score, ts: ts, uid: user.uid };

      if (existing.length === 0) {
        return boardRef.push(newEntry).then(function () { return newEntry; });
      }

      // Find the best existing entry; remove the rest.
      existing.sort(function (a, b) { return (b.val.score || 0) - (a.val.score || 0); });
      var best = existing[0];
      var stragglers = existing.slice(1);

      var removals = stragglers.map(function (s) { return boardRef.child(s.key).remove(); });

      if (score > (best.val.score || 0)) {
        // New score beats stored best - update in place.
        return Promise.all(removals)
          .then(function () { return boardRef.child(best.key).update(newEntry); })
          .then(function () { return newEntry; });
      }
      // Stored best is equal or higher - keep it, just clear stragglers.
      return Promise.all(removals).then(function () { return best.val; });
    });
  }

  function rankOf(top, uid, score) {
    for (var i = 0; i < top.length; i++) {
      if (top[i].uid === uid && top[i].score === score) return i + 1;
    }
    return null;
  }

  function submit(opts) {
    var game = opts.game;
    var difficulty = opts.difficulty;
    var score = opts.score;
    var name = opts.name;
    if (!game || !difficulty || typeof score !== 'number' || !name) {
      return Promise.resolve({ rank: null, error: 'invalid-args' });
    }
    if (!window.SharedFirebase) {
      return Promise.resolve({ rank: null, error: 'firebase-unavailable' });
    }
    return withTimeout(window.SharedFirebase.signInAnonymously(), 'signIn').then(function (user) {
      var boardRef = window.SharedFirebase.ref(path(game, difficulty));
      return withTimeout(collapseAndWrite(boardRef, user, score, name), 'collapse').then(function () {
        return fetchTop({ game: game, difficulty: difficulty, limit: DEFAULT_LIMIT }).then(function (top) {
          return { rank: rankOf(top, user.uid, score), error: null };
        });
      });
    }).catch(function () {
      return { rank: null, error: 'submit-failed' };
    });
  }

  window.SharedLeaderboard = {
    submit: submit,
    fetchTop: fetchTop
  };
})();
