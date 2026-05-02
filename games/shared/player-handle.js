/* ===============================================================
   Shared - player-handle.js
   Persistent display name across games. Lazy modal prompt; resolves
   to the cached handle, a fresh entry, or null on cancel.
   Exposes window.PlayerHandle.
   =============================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'player-handle';
  var MAX_LEN = 20;
  var CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

  function clean(raw) {
    if (typeof raw !== 'string') return '';
    var stripped = raw.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
    return stripped.slice(0, MAX_LEN);
  }

  function get() {
    try { return localStorage.getItem(STORAGE_KEY) || null; }
    catch (_) { return null; }
  }

  function set(name) {
    var cleaned = clean(name);
    if (!cleaned) return null;
    try { localStorage.setItem(STORAGE_KEY, cleaned); }
    catch (_) { /* private mode / quota - proceed in-memory only */ }
    return cleaned;
  }

  function buildModal(reason) {
    var overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(10,10,11,0.75)',
      'font-family:system-ui,-apple-system,sans-serif'
    ].join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'background:#1e1e21', 'border:1px solid #a06828', 'border-radius:6px',
      'padding:1.5rem', 'min-width:280px', 'max-width:90vw',
      'display:flex', 'flex-direction:column', 'gap:0.8rem',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)'
    ].join(';');

    var title = document.createElement('div');
    title.textContent = reason || 'Enter a name for the leaderboard';
    title.style.cssText = 'color:#f0e6d3;font-size:1rem;font-weight:600;';

    var input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_LEN;
    input.placeholder = 'Your name';
    input.style.cssText = [
      'background:#0a0a0b', 'color:#f0e6d3',
      'border:1px solid #a06828', 'border-radius:3px',
      'padding:0.5rem 0.75rem', 'font-size:0.95rem',
      'font-family:inherit', 'outline:none'
    ].join(';');

    var buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Skip';
    cancelBtn.style.cssText = [
      'background:transparent', 'color:#9b8870',
      'border:1px solid #4a3a2a', 'border-radius:3px',
      'padding:0.45rem 1rem', 'font-size:0.85rem',
      'font-family:inherit', 'text-transform:uppercase', 'letter-spacing:0.06em',
      'cursor:pointer'
    ].join(';');

    var okBtn = document.createElement('button');
    okBtn.textContent = 'Save';
    okBtn.style.cssText = [
      'background:transparent', 'color:#c8943e',
      'border:1px solid #c8943e', 'border-radius:3px',
      'padding:0.45rem 1rem', 'font-size:0.85rem',
      'font-family:inherit', 'text-transform:uppercase', 'letter-spacing:0.06em',
      'cursor:pointer'
    ].join(';');

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(okBtn);
    card.appendChild(title);
    card.appendChild(input);
    card.appendChild(buttonRow);
    overlay.appendChild(card);

    return { overlay: overlay, input: input, cancelBtn: cancelBtn, okBtn: okBtn };
  }

  function ensure(opts) {
    var cached = get();
    if (cached) return Promise.resolve(cached);

    return new Promise(function (resolve) {
      var modal = buildModal(opts && opts.reason);
      document.body.appendChild(modal.overlay);
      setTimeout(function () { modal.input.focus(); }, 0);

      function close(value) {
        if (modal.overlay.parentNode) modal.overlay.parentNode.removeChild(modal.overlay);
        resolve(value);
      }

      modal.okBtn.addEventListener('click', function () {
        var saved = set(modal.input.value);
        close(saved);
      });

      modal.cancelBtn.addEventListener('click', function () { close(null); });

      modal.input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); modal.okBtn.click(); }
        else if (e.key === 'Escape') { e.preventDefault(); modal.cancelBtn.click(); }
      });
    });
  }

  window.PlayerHandle = {
    get: get,
    set: set,
    ensure: ensure
  };
})();
