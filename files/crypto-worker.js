/* Classic Web Worker — decrypt only.
 *
 * Loads the typage IIFE bundle via importScripts (sets global `age`).
 * Streams plaintext chunks back to the main thread via Transferable
 * ArrayBuffers so the 1 GB decrypt path avoids copies.
 *
 * Protocol (main <-> worker):
 *   main -> worker: { type: 'decrypt', file: File, passphrase: string }
 *   main -> worker: { type: 'cancel' }
 *
 *   worker -> main: { type: 'status', text }             // before first chunk (scrypt latency)
 *   worker -> main: { type: 'chunk',  data: Uint8Array } // transferred
 *   worker -> main: { type: 'progress', bytes, total? }
 *   worker -> main: { type: 'done' }
 *   worker -> main: { type: 'error', message, kind }     // kind: 'passphrase' | 'format' | 'unknown'
 */

importScripts('/files/vendor/age.js');

'use strict';

var cancelled = false;
var activeReader = null;

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'cancel') {
    cancelled = true;
    if (activeReader) {
      try { activeReader.cancel(); } catch (_) {}
    }
    return;
  }

  if (msg.type === 'decrypt') {
    decrypt(msg.file, msg.passphrase).catch(function (err) {
      postError(err);
    });
  }
};

function decrypt(file, passphrase) {
  cancelled = false;
  activeReader = null;

  postMessage({ type: 'status', text: 'Deriving key\u2026' });

  var d = new age.Decrypter();
  d.addPassphrase(passphrase);

  // typage accepts a ReadableStream; File.stream() gives us one.
  return d.decrypt(file.stream()).then(function (plainStream) {
    if (cancelled) {
      try { plainStream.cancel(); } catch (_) {}
      return;
    }

    postMessage({ type: 'status', text: 'Decrypting\u2026' });

    activeReader = plainStream.getReader();
    var bytesRead = 0;
    var bytesSinceLastProgress = 0;
    var PROGRESS_INTERVAL = 4 * 1024 * 1024; // 4 MB

    function pump() {
      if (cancelled) {
        try { activeReader.cancel(); } catch (_) {}
        return;
      }
      return activeReader.read().then(function (res) {
        if (res.done) {
          postMessage({ type: 'progress', bytes: bytesRead });
          postMessage({ type: 'done' });
          activeReader = null;
          return;
        }

        var chunk = res.value;
        // Defensive own-the-buffer copy: if typage reuses an internal buffer,
        // transferring its ArrayBuffer would detach typage's view and crash
        // the next read(). Detect sub-view and copy.
        if (chunk.byteOffset !== 0 || chunk.buffer.byteLength !== chunk.byteLength) {
          chunk = chunk.slice();
        }

        bytesRead += chunk.byteLength;
        bytesSinceLastProgress += chunk.byteLength;

        postMessage({ type: 'chunk', data: chunk }, [chunk.buffer]);

        if (bytesSinceLastProgress >= PROGRESS_INTERVAL) {
          postMessage({ type: 'progress', bytes: bytesRead });
          bytesSinceLastProgress = 0;
        }

        return pump();
      });
    }

    return pump();
  });
}

function postError(err) {
  var message = (err && err.message) ? String(err.message) : 'Decryption failed';
  var lower = message.toLowerCase();
  var kind = 'unknown';
  if (lower.indexOf('passphrase') !== -1 || lower.indexOf('no identity matched') !== -1 || lower.indexOf('authentication') !== -1 || lower.indexOf('scrypt') !== -1) {
    kind = 'passphrase';
  } else if (lower.indexOf('header') !== -1 || lower.indexOf('parse') !== -1 || lower.indexOf('magic') !== -1 || lower.indexOf('invalid') !== -1 || lower.indexOf('malformed') !== -1) {
    kind = 'format';
  }
  postMessage({ type: 'error', message: message, kind: kind });
  activeReader = null;
}
