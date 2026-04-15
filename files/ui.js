/* Files page UI — drag-drop, Worker lifecycle, progress, errors.
 *
 * Hard contract with showSaveFilePicker: it MUST be the first await in the
 * Decrypt button's click handler, or the transient user activation is
 * consumed and the save dialog silently throws SecurityError.
 *
 * Writable cleanup contract: on any error, cancel, or worker crash, the
 * FileSystemWritableFileStream must be .abort()ed so a partial file is not
 * left open at the save location.
 */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var chromeBanner   = $('chrome-banner');
  var dropzone       = $('dropzone');
  var fileInput      = $('file-input');
  var fileMeta       = $('file-meta');
  var fileName       = $('file-name');
  var fileSize       = $('file-size');
  var passphrase     = $('passphrase');
  var passToggle     = $('passphrase-toggle');
  var decryptBtn     = $('decrypt-btn');
  var statusRow      = $('status-row');
  var progress       = $('progress');
  var statusText     = $('status-text');
  var cancelBtn      = $('cancel-btn');
  var errorBox       = $('error');
  var successBox     = $('success');

  var state = {
    file: null,
    worker: null,
    writable: null,
    cancelled: false,
    running: false
  };

  // ── Feature detection ────────────────────────────
  var hasFSA = typeof window.showSaveFilePicker === 'function';
  if (!hasFSA) {
    chromeBanner.hidden = false;
    decryptBtn.disabled = true;
  }

  // ── File selection (click + drag-drop) ───────────
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) setFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });
  dropzone.addEventListener('drop', function (e) {
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) setFile(dt.files[0]);
  });

  function setFile(f) {
    state.file = f;
    fileName.textContent = f.name;
    fileSize.textContent = formatBytes(f.size);
    fileMeta.hidden = false;
    dropzone.classList.add('has-file');
    clearMessages();
    updateButton();
  }

  // ── Passphrase ───────────────────────────────────
  passphrase.addEventListener('input', updateButton);
  passToggle.addEventListener('click', function () {
    var showing = passphrase.type === 'text';
    passphrase.type = showing ? 'password' : 'text';
    passToggle.setAttribute('aria-label', showing ? 'Show passphrase' : 'Hide passphrase');
  });

  function updateButton() {
    decryptBtn.disabled = !hasFSA || state.running || !state.file || !passphrase.value;
  }

  // ── Decrypt click handler ────────────────────────
  // CRITICAL: showSaveFilePicker MUST be the first await. Any async work
  // before it consumes the transient user activation.
  decryptBtn.addEventListener('click', function () { startDecrypt(); });

  async function startDecrypt() {
    if (state.running) return;
    if (!state.file || !passphrase.value) return;

    clearMessages();

    var suggestedName = state.file.name.replace(/\.age$/i, '') || 'decrypted';

    var fileHandle;
    try {
      // FIRST await — transient user activation.
      fileHandle = await window.showSaveFilePicker({
        suggestedName: suggestedName,
        startIn: 'downloads'
      });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user cancelled save dialog
      showError('Save dialog failed: ' + (err && err.message ? err.message : 'unknown'));
      return;
    }

    var writable;
    try {
      writable = await fileHandle.createWritable();
    } catch (err) {
      showError('Could not open output file for writing.');
      return;
    }

    state.writable = writable;
    state.cancelled = false;
    setRunning(true);
    showStatus('Preparing\u2026', true);

    var worker = new Worker('/files/crypto-worker.js');
    state.worker = worker;

    worker.onerror = function () {
      abortWritable();
      showError('Decryption failed (worker crashed).');
      cleanupWorker();
      setRunning(false);
    };

    worker.onmessage = async function (e) {
      var msg = e.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'status') {
        showStatus(msg.text, true);
      } else if (msg.type === 'chunk') {
        try {
          await state.writable.write(msg.data);
        } catch (err) {
          state.cancelled = true;
          worker.postMessage({ type: 'cancel' });
          abortWritable();
          showError('Write failed: ' + (err && err.message ? err.message : 'disk error'));
          cleanupWorker();
          setRunning(false);
        }
      } else if (msg.type === 'progress') {
        updateProgress(msg.bytes);
      } else if (msg.type === 'done') {
        try {
          await state.writable.close();
          state.writable = null;
          showSuccess('Saved as ' + suggestedName + '.');
        } catch (err) {
          showError('Could not finalize output file.');
        }
        cleanupWorker();
        setRunning(false);
      } else if (msg.type === 'error') {
        abortWritable();
        if (msg.kind === 'passphrase') {
          showError('Incorrect passphrase.');
        } else if (msg.kind === 'format') {
          showError('This doesn\u2019t look like a valid .age file.');
        } else {
          showError('Decryption failed: ' + msg.message);
        }
        cleanupWorker();
        setRunning(false);
      }
    };

    worker.postMessage({ type: 'decrypt', file: state.file, passphrase: passphrase.value });
  }

  // ── Cancel ───────────────────────────────────────
  cancelBtn.addEventListener('click', function () {
    if (!state.running) return;
    state.cancelled = true;
    if (state.worker) state.worker.postMessage({ type: 'cancel' });
    abortWritable();
    cleanupWorker();
    showStatus('Cancelled.', false);
    progress.value = 0;
    setRunning(false);
  });

  // ── Helpers ──────────────────────────────────────
  function abortWritable() {
    if (state.writable) {
      try { state.writable.abort(); } catch (_) {}
      state.writable = null;
    }
  }

  function cleanupWorker() {
    if (state.worker) {
      try { state.worker.terminate(); } catch (_) {}
      state.worker = null;
    }
  }

  function setRunning(running) {
    state.running = running;
    statusRow.hidden = !running;
    cancelBtn.hidden = !running;
    updateButton();
    if (!running) progress.classList.remove('indeterminate');
  }

  function showStatus(text, indeterminate) {
    statusText.textContent = text;
    statusRow.hidden = false;
    if (indeterminate) {
      progress.classList.add('indeterminate');
      progress.removeAttribute('value');
    } else {
      progress.classList.remove('indeterminate');
    }
  }

  function updateProgress(bytes) {
    progress.classList.remove('indeterminate');
    // We don't know plaintext size up front; use ciphertext size as a close proxy.
    var total = state.file ? state.file.size : 0;
    if (total > 0) {
      progress.max = total;
      progress.value = Math.min(bytes, total);
    }
    statusText.textContent = formatBytes(bytes) + (total ? ' / ~' + formatBytes(total) : '');
  }

  function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = false;
    successBox.hidden = true;
  }

  function showSuccess(text) {
    successBox.textContent = text;
    successBox.hidden = false;
    errorBox.hidden = true;
  }

  function clearMessages() {
    errorBox.hidden = true;
    successBox.hidden = true;
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    var units = ['KB', 'MB', 'GB', 'TB'];
    var i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
    return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + ' ' + units[i];
  }
})();
