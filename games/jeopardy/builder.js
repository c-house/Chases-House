/* Builder logic — Board creation, validation, persistence */
(function() {
  'use strict';

  var J = window.Jeopardy;
  var ROUND_VALUES = J.ROUND_VALUES;

  /* ── DOM Cache ──────────────────────────────── */
  var boardTitle = document.getElementById('board-title');
  var boardAuthor = document.getElementById('board-author');
  var finalCategory = document.getElementById('final-category');
  var finalClue = document.getElementById('final-clue');
  var finalAnswer = document.getElementById('final-answer');
  var validationBar = document.getElementById('validation-bar');
  var validationIcon = document.getElementById('validation-icon');
  var validationText = document.getElementById('validation-text');
  var saveBtn = document.getElementById('save-btn');
  var loadBtn = document.getElementById('load-btn');
  var exportBtn = document.getElementById('export-btn');
  var importBtn = document.getElementById('import-btn');
  var importFile = document.getElementById('import-file');
  var clearBtn = document.getElementById('clear-btn');
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabPanels = document.querySelectorAll('.tab-panel');

  /* ── Tab Switching ──────────────────────────── */
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = btn.getAttribute('data-tab');
      tabBtns.forEach(function(b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabPanels.forEach(function(p) { p.classList.remove('active'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      var panel = target === 'final'
        ? document.getElementById('panel-final')
        : document.getElementById('panel-' + target);
      if (panel) panel.classList.add('active');
    });
  });

  /* ── Form → JSON ────────────────────────────── */
  function collectFormData() {
    var board = {
      title: boardTitle.value.trim(),
      author: boardAuthor.value.trim(),
      rounds: [],
      final: {
        category: finalCategory.value.trim(),
        clue: finalClue.value.trim(),
        answer: finalAnswer.value.trim()
      }
    };

    [1, 2].forEach(function(roundNum) {
      var panel = document.getElementById('panel-round' + roundNum);
      var blocks = panel.querySelectorAll('.category-block');
      var categories = [];

      blocks.forEach(function(block) {
        var catName = block.querySelector('.category-name-input').value.trim();
        var clueInputs = block.querySelectorAll('.clue-input[data-field="clue"]');
        var answerInputs = block.querySelectorAll('.clue-input[data-field="answer"]');
        var clues = [];

        for (var i = 0; i < clueInputs.length; i++) {
          clues.push({
            value: ROUND_VALUES[roundNum][i],
            clue: clueInputs[i].value.trim(),
            answer: answerInputs[i].value.trim()
          });
        }

        categories.push({ name: catName, clues: clues });
      });

      board.rounds.push({
        categories: categories,
        dailyDoubles: roundNum === 1 ? 1 : 2
      });
    });

    return board;
  }

  /* ── JSON → Form ────────────────────────────── */
  function populateForm(board) {
    clearFormFields();

    boardTitle.value = board.title || '';
    boardAuthor.value = board.author || '';

    if (board.rounds) {
      board.rounds.forEach(function(round, ri) {
        if (ri > 1) return;
        var panel = document.getElementById('panel-round' + (ri + 1));
        var blocks = panel.querySelectorAll('.category-block');

        round.categories.forEach(function(cat, ci) {
          if (ci >= blocks.length) return;
          blocks[ci].querySelector('.category-name-input').value = cat.name || '';

          var clueInputs = blocks[ci].querySelectorAll('.clue-input[data-field="clue"]');
          var answerInputs = blocks[ci].querySelectorAll('.clue-input[data-field="answer"]');

          cat.clues.forEach(function(clue, ki) {
            if (ki >= clueInputs.length) return;
            clueInputs[ki].value = clue.clue || '';
            answerInputs[ki].value = clue.answer || '';
          });
        });
      });
    }

    if (board.final) {
      finalCategory.value = board.final.category || '';
      finalClue.value = board.final.clue || '';
      finalAnswer.value = board.final.answer || '';
    }
  }

  /* ── Validation ─────────────────────────────── */
  function validate() {
    clearInvalidMarkers();
    var board = collectFormData();
    var result = J.validateBoard(board);

    if (!result.valid) {
      highlightInvalidFields(board);
    }

    return result;
  }

  function highlightInvalidFields(board) {
    if (!board.title) boardTitle.classList.add('invalid');

    board.rounds.forEach(function(round, ri) {
      var panel = document.getElementById('panel-round' + (ri + 1));
      var blocks = panel.querySelectorAll('.category-block');

      round.categories.forEach(function(cat, ci) {
        if (ci >= blocks.length) return;
        if (!cat.name) blocks[ci].querySelector('.category-name-input').classList.add('invalid');

        var clueInputs = blocks[ci].querySelectorAll('.clue-input[data-field="clue"]');
        var answerInputs = blocks[ci].querySelectorAll('.clue-input[data-field="answer"]');

        cat.clues.forEach(function(clue, ki) {
          if (ki >= clueInputs.length) return;
          if (!clue.clue) clueInputs[ki].classList.add('invalid');
          if (!clue.answer) answerInputs[ki].classList.add('invalid');
        });
      });
    });

    if (!board.final.category) finalCategory.classList.add('invalid');
    if (!board.final.clue) finalClue.classList.add('invalid');
    if (!board.final.answer) finalAnswer.classList.add('invalid');
  }

  function showValidation(type, icon, text) {
    validationBar.className = 'validation-bar visible ' + type;
    validationIcon.textContent = icon;
    validationText.textContent = text;
  }

  function hideValidation() {
    validationBar.className = 'validation-bar';
  }

  function clearInvalidMarkers() {
    document.querySelectorAll('.invalid').forEach(function(el) {
      el.classList.remove('invalid');
    });
  }

  /* ── Save to localStorage ───────────────────── */
  function saveBoard() {
    var result = validate();
    if (!result.valid) {
      var n = result.errors.length;
      var msg = n + ' issue' + (n > 1 ? 's' : '') + ': ' + result.errors[0];
      if (n > 1) msg += ' (+' + (n - 1) + ' more)';
      showValidation('error', '\u2715', msg);
      return;
    }

    var board = collectFormData();
    var key = 'jeopardy-board-' + board.title;
    localStorage.setItem(key, JSON.stringify(board));
    showValidation('success', '\u2713', 'Saved "' + board.title + '" to local storage.');
  }

  /* ── Load from localStorage ─────────────────── */
  function getSavedBoardKeys() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('jeopardy-board-') === 0) {
        keys.push(key);
      }
    }
    return keys.sort();
  }

  function loadBoard() {
    var keys = getSavedBoardKeys();
    if (keys.length === 0) {
      showValidation('error', '\u2715', 'No saved boards found in local storage.');
      return;
    }

    var titles = keys.map(function(k) { return k.replace('jeopardy-board-', ''); });
    var msg = 'Select a board to load:\n\n';
    titles.forEach(function(t, i) { msg += (i + 1) + '. ' + t + '\n'; });
    msg += '\nEnter number (1\u2013' + titles.length + '):';

    var choice = window.prompt(msg);
    if (!choice) return;

    var idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= keys.length) {
      showValidation('error', '\u2715', 'Invalid selection.');
      return;
    }

    try {
      var data = JSON.parse(localStorage.getItem(keys[idx]));
      populateForm(data);
      showValidation('success', '\u2713', 'Loaded "' + titles[idx] + '".');
    } catch (e) {
      showValidation('error', '\u2715', 'Failed to parse saved board data.');
    }
  }

  /* ── Export as .json file ───────────────────── */
  function exportBoard() {
    var result = validate();
    if (!result.valid) {
      var n = result.errors.length;
      var msg = n + ' issue' + (n > 1 ? 's' : '') + ': ' + result.errors[0];
      if (n > 1) msg += ' (+' + (n - 1) + ' more)';
      showValidation('error', '\u2715', msg);
      return;
    }

    var board = collectFormData();
    var json = JSON.stringify(board, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (board.title || 'jeopardy-board').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showValidation('success', '\u2713', 'Exported "' + board.title + '".');
  }

  /* ── Import from .json file ─────────────────── */
  function importBoard(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var board = JSON.parse(e.target.result);
        var result = J.validateBoard(board);
        if (!result.valid) {
          showValidation('error', '\u2715', 'Invalid board file: ' + result.errors[0]);
          return;
        }
        populateForm(board);
        showValidation('success', '\u2713', 'Imported "' + (board.title || 'Untitled') + '".');
      } catch (err) {
        showValidation('error', '\u2715', 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  }

  /* ── Clear ──────────────────────────────────── */
  function clearFormFields() {
    boardTitle.value = '';
    boardAuthor.value = '';
    finalCategory.value = '';
    finalClue.value = '';
    finalAnswer.value = '';

    [1, 2].forEach(function(roundNum) {
      var panel = document.getElementById('panel-round' + roundNum);
      panel.querySelectorAll('.category-name-input').forEach(function(el) { el.value = ''; });
      panel.querySelectorAll('.clue-input').forEach(function(el) { el.value = ''; });
    });

    clearInvalidMarkers();
    hideValidation();
  }

  function clearForm() {
    if (!window.confirm('Clear all fields? This cannot be undone.')) return;
    clearFormFields();
  }

  /* ── Clear invalid on input ─────────────────── */
  document.querySelectorAll('.form-input, .category-name-input, .clue-input, .final-clue-input').forEach(function(el) {
    el.addEventListener('input', function() {
      el.classList.remove('invalid');
    });
  });

  /* ── Wire Action Buttons ────────────────────── */
  saveBtn.addEventListener('click', saveBoard);
  loadBtn.addEventListener('click', loadBoard);
  exportBtn.addEventListener('click', exportBoard);
  importBtn.addEventListener('click', function() { importFile.click(); });
  importFile.addEventListener('change', function() {
    if (importFile.files.length > 0) {
      importBoard(importFile.files[0]);
      importFile.value = '';
    }
  });
  clearBtn.addEventListener('click', clearForm);
})();
