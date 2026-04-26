/* ═══════════════════════════════════════════════════════════════
   Shared — firebase.js
   Single source of truth for Firebase init + anonymous auth across
   games. Loaded by Jeopardy and Snake; safe to load on both.
   Exposes window.SharedFirebase.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // The API key is a public client-side identifier (not a secret). Access
  // control comes from Firebase Realtime Database rules and the HTTP-referrer
  // restrictions configured on the API key in the Google Cloud Console.
  // See docs/adr/016-shared-gamepad.md for the security model.
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCOJulc54mCYkhR2WDRMaNPF40Peuo_XDg',
    authDomain: 'chases-house.firebaseapp.com',
    databaseURL: 'https://chases-house-default-rtdb.firebaseio.com',
    projectId: 'chases-house',
    storageBucket: 'chases-house.firebasestorage.app',
    messagingSenderId: '778317675916',
    appId: '1:778317675916:web:5c4e9d58e7ccf5e6832aa9'
  };

  let app = null;
  let db = null;
  let auth = null;
  let signInPromise = null;

  function init() {
    if (app) return;
    if (typeof firebase === 'undefined') {
      throw new Error('SharedFirebase: Firebase SDK not loaded. Include firebase-app-compat and firebase-database-compat via CDN before shared/firebase.js.');
    }
    app = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    auth = firebase.auth();
  }

  function ref(path) {
    init();
    if (!db) throw new Error('SharedFirebase: database unavailable.');
    return db.ref(path);
  }

  function signInAnonymously() {
    init();
    if (!auth) throw new Error('SharedFirebase: auth unavailable.');
    if (signInPromise) return signInPromise;
    signInPromise = auth.signInAnonymously().then(function (cred) { return cred.user; });
    return signInPromise;
  }

  function serverTimestamp() {
    if (typeof firebase === 'undefined') {
      throw new Error('SharedFirebase: Firebase SDK not loaded.');
    }
    return firebase.database.ServerValue.TIMESTAMP;
  }

  window.SharedFirebase = {
    init: init,
    ref: ref,
    signInAnonymously: signInAnonymously,
    serverTimestamp: serverTimestamp
  };
})();
