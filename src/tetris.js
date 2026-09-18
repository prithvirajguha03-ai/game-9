(function () {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const LINE_SCORES = [0, 100, 300, 500, 800];
  const BASE_SPEED = 800;
  const SPEED_STEP = 70;
  const MIN_SPEED = 100;

  const PIECE_ORDER = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  const BASE_MATRICES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };

  function rotateCW(matrix) {
    const n = matrix.length;
    const result = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        row.push(matrix[n - 1 - c][r]);
      }
      result.push(row);
    }
    return result;
  }

  const ROTATIONS = {};
  PIECE_ORDER.forEach(function (type) {
    const list = [];
    let matrix = BASE_MATRICES[type];
    for (let i = 0; i < 4; i++) {
      list.push(matrix);
      matrix = rotateCW(matrix);
    }
    ROTATIONS[type] = list;
  });

  const boardEl = document.getElementById('board');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlay-title');
  const overlayRestartBtn = document.getElementById('overlay-restart');
  const nextPreviewEl = document.getElementById('next-preview');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const pauseBtn = document.getElementById('pause-btn');
  const restartBtn = document.getElementById('restart-btn');

  const boardCells = [];
  for (let i = 0; i < ROWS * COLS; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    boardEl.appendChild(cell);
    boardCells.push(cell);
  }

  const nextCells = [];
  for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.className = 'ncell';
    nextPreviewEl.appendChild(cell);
    nextCells.push(cell);
  }

  const state = {
    board: null,
    current: null,
    nextType: PIECE_ORDER[0],
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    status: 'ready',
    timer: null,
    clearing: false,
    clearTimer: null,
    session: 0
  };

  let prevClasses = null;

  function createBoard() {
    const board = [];
    for (let r = 0; r < ROWS; r++) {
      board.push(new Array(COLS).fill(null));
    }
    return board;
  }

  function refillBag() {
    const bag = PIECE_ORDER.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = bag[i];
      bag[i] = bag[j];
      bag[j] = temp;
    }
    return bag;
  }

  function nextFromBag() {
    if (state.bag.length === 0) {
      state.bag = refillBag();
    }
    return state.bag.pop();
  }

  function collides(matrix, row, col) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const rr = row + r;
        const cc = col + c;
        if (cc < 0 || cc >= COLS || rr >= ROWS) return true;
        if (rr >= 0 && state.board[rr][cc]) return true;
      }
    }
    return false;
  }

  function spawnPiece() {
    const type = state.nextType;
    state.nextType = nextFromBag();
    const matrix = ROTATIONS[type][0];
    const col = Math.floor((COLS - matrix[0].length) / 2);
    state.current = { type: type, matrix: matrix, rot: 0, row: 0, col: col };
    if (collides(matrix, 0, col)) {
      gameOver();
    }
  }

  function lockPiece(session) {
    if (session !== state.session) return;
    mergeCurrent();
    const fullRows = [];
    for (let r = 0; r < ROWS; r++) {
      if (state.board[r].every(function (cell) { return cell !== null; })) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      state.clearing = true;
      stopLoop();
      fullRows.forEach(function (row) {
        for (let c = 0; c < COLS; c++) {
          boardCells[row * COLS + c].classList.add('clearing');
        }
      });
      const capturedSession = state.session;
      state.clearTimer = setTimeout(function () {
        state.clearTimer = null;
        if (capturedSession !== state.session) return;
        const rowSet = {};
        fullRows.forEach(function (row) { rowSet[row] = true; });
        state.board = state.board.filter(function (_, row) { return !rowSet[row]; });
        while (state.board.length < ROWS) {
          state.board.unshift(new Array(COLS).fill(null));
        }
        const count = fullRows.length;
        state.score += LINE_SCORES[count] * state.level;
        state.lines += count;
        const newLevel = Math.floor(state.lines / 10) + 1;
        if (newLevel !== state.level) {
          state.level = newLevel;
        }
        updateHud();
        state.clearing = false;
        render();
        spawnPiece();
        render();
        if (state.status === 'playing') {
          startLoop();
        }
      }, 250);
      return;
    }

    spawnPiece();
    render();
  }

  function mergeCurrent() {
    const m = state.current.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const rr = state.current.row + r;
        const cc = state.current.col + c;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
          state.board[rr][cc] = state.current.type;
        }
      }
    }
  }

  function moveHorizontal(dir) {
    if (state.status !== 'playing' || state.clearing) return false;
    const nextCol = state.current.col + dir;
    if (!collides(state.current.matrix, state.current.row, nextCol)) {
      state.current.col = nextCol;
      render();
      return true;
    }
    return false;
  }

  function moveDown() {
    if (state.status !== 'playing' || state.clearing) return false;
    if (!collides(state.current.matrix, state.current.row + 1, state.current.col)) {
      state.current.row++;
      render();
      return true;
    }
    return false;
  }

  function softDrop() {
    if (state.status !== 'playing' || state.clearing) return;
    if (moveDown()) {
      state.score += 1;
      updateHud();
    } else {
      lockPiece(state.session);
    }
  }

  function hardDrop() {
    if (state.status !== 'playing' || state.clearing) return;
    let drop = state.current.row;
    const matrix = state.current.matrix;
    while (!collides(matrix, drop + 1, state.current.col)) {
      drop++;
    }
    state.score += (drop - state.current.row) * 2;
    state.current.row = drop;
    updateHud();
    lockPiece(state.session);
  }

  function rotate() {
    if (state.status !== 'playing' || state.clearing) return false;
    const nextRot = (state.current.rot + 1) % 4;
    const nextMatrix = ROTATIONS[state.current.type][nextRot];
    const kicks = [0, -1, 1, -2, 2];
    for (let i = 0; i < kicks.length; i++) {
      const dx = kicks[i];
      if (!collides(nextMatrix, state.current.row, state.current.col + dx)) {
        state.current.rot = nextRot;
        state.current.matrix = nextMatrix;
        state.current.col += dx;
        render();
        return true;
      }
    }
    return false;
  }

  function getDropRow() {
    let row = state.current.row;
    const matrix = state.current.matrix;
    while (!collides(matrix, row + 1, state.current.col)) {
      row++;
    }
    return row;
  }

  function render() {
    const desired = new Array(boardCells.length).fill('cell');

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const value = state.board[r][c];
        if (value) {
          desired[r * COLS + c] = 'cell piece-' + value;
        }
      }
    }

    if (state.current && state.status !== 'over') {
      const matrix = state.current.matrix;
      const dropRow = getDropRow();
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (!matrix[r][c]) continue;
          const rr = dropRow + r;
          const cc = state.current.col + c;
          if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && desired[rr * COLS + cc] === 'cell') {
            desired[rr * COLS + cc] = 'cell ghost-' + state.current.type;
          }
        }
      }
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (!matrix[r][c]) continue;
          const rr = state.current.row + r;
          const cc = state.current.col + c;
          if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
            desired[rr * COLS + cc] = 'cell piece-' + state.current.type;
          }
        }
      }
    }

    if (prevClasses === null || prevClasses.length !== desired.length) {
      for (let i = 0; i < desired.length; i++) {
        boardCells[i].className = desired[i];
      }
    } else {
      for (let i = 0; i < desired.length; i++) {
        if (boardCells[i].className !== desired[i]) {
          boardCells[i].className = desired[i];
        }
      }
    }
    prevClasses = desired.slice();

    renderNext();
  }

  function renderNext() {
    const type = state.nextType;
    const matrix = ROTATIONS[type][0];
    for (let i = 0; i < 16; i++) {
      nextCells[i].className = 'ncell';
    }
    const rowOffset = Math.floor((4 - matrix.length) / 2);
    const colOffset = Math.floor((4 - matrix[0].length) / 2);
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const index = (rowOffset + r) * 4 + (colOffset + c);
        nextCells[index].className = 'ncell cell-' + type;
      }
    }
  }

  function updateHud() {
    scoreEl.textContent = String(state.score);
    linesEl.textContent = String(state.lines);
    levelEl.textContent = String(state.level);
  }

  function speedForLevel() {
    return Math.max(MIN_SPEED, BASE_SPEED - (state.level - 1) * SPEED_STEP);
  }

  function startLoop() {
    if (state.timer !== null) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.status !== 'playing' || state.clearing) return;
    state.timer = setInterval(tick, speedForLevel());
  }

  function stopLoop() {
    if (state.timer !== null) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function tick() {
    if (state.status !== 'playing' || state.clearing) return;
    if (!moveDown()) {
      lockPiece(state.session);
    }
  }

  function gameOver() {
    state.status = 'over';
    stopLoop();
    overlayEl.style.display = 'flex';
    overlayEl.classList.remove('hidden');
    overlayEl.classList.remove('paused');
    overlayTitleEl.textContent = 'GAME OVER';
    overlayRestartBtn.classList.remove('hidden');
    render();
  }

  function showPaused() {
    overlayEl.style.display = 'flex';
    overlayEl.classList.remove('hidden');
    overlayEl.classList.add('paused');
    overlayTitleEl.textContent = 'PAUSED';
    overlayRestartBtn.classList.add('hidden');
  }

  function togglePause() {
    if (state.status === 'playing') {
      state.status = 'paused';
      stopLoop();
      showPaused();
    } else if (state.status === 'paused') {
      state.status = 'playing';
      overlayEl.style.display = 'none';
      overlayEl.classList.add('hidden');
      startLoop();
    }
  }

  function restart() {
    stopLoop();
    if (state.clearTimer !== null) {
      clearTimeout(state.clearTimer);
      state.clearTimer = null;
    }
    state.session++;
    state.board = createBoard();
    state.bag = [];
    state.score = 0;
    state.lines = 0;
    state.level = 1;
    state.status = 'playing';
    state.clearing = false;
    state.nextType = PIECE_ORDER[0];
    prevClasses = null;
    overlayEl.style.display = 'none';
    overlayEl.classList.add('hidden');
    overlayEl.classList.remove('paused');
    updateHud();
    spawnPiece();
    render();
    startLoop();
  }

  function onKeydown(e) {
    const code = e.code;
    if (code === 'Space' || code.indexOf('Arrow') === 0) {
      e.preventDefault();
    }
    if (code === 'KeyP') {
      togglePause();
      return;
    }
    if (code === 'KeyR') {
      restart();
      return;
    }
    if (state.status === 'over' && (code === 'Space' || code === 'Enter')) {
      restart();
      return;
    }
    if (state.status !== 'playing' || state.clearing) return;

    if (code === 'ArrowLeft') {
      moveHorizontal(-1);
    } else if (code === 'ArrowRight') {
      moveHorizontal(1);
    } else if (code === 'ArrowDown') {
      softDrop();
    } else if (code === 'ArrowUp') {
      if (!e.repeat) rotate();
    } else if (code === 'Space') {
      if (!e.repeat) hardDrop();
    }
  }

  function blurButton(btn) {
    if (btn && typeof btn.blur === 'function') {
      btn.blur();
    }
  }

  pauseBtn.addEventListener('click', function () {
    blurButton(pauseBtn);
    togglePause();
    pauseBtn.textContent = state.status === 'paused' ? 'Resume' : 'Pause';
  });

  restartBtn.addEventListener('click', function () {
    blurButton(restartBtn);
    restart();
    pauseBtn.textContent = 'Pause';
  });

  overlayRestartBtn.addEventListener('click', function () {
    blurButton(overlayRestartBtn);
    restart();
    pauseBtn.textContent = 'Pause';
  });

  document.addEventListener('keydown', onKeydown);

  const touchActions = {
    'move-left': function () { moveHorizontal(-1); },
    'move-right': function () { moveHorizontal(1); },
    'move-down': function () { softDrop(); },
    'rotate': function () { rotate(); },
    'hard-drop': function () { hardDrop(); }
  };

  function bindHoldButton(btn) {
    const action = touchActions[btn.getAttribute('data-action')];
    if (!action) return;
    let holdTimer = null;
    const start = function (e) {
      e.preventDefault();
      if (state.status !== 'playing' || state.clearing) return;
      action();
      if (btn.getAttribute('data-action') === 'move-left' ||
          btn.getAttribute('data-action') === 'move-right' ||
          btn.getAttribute('data-action') === 'move-down') {
        holdTimer = setInterval(action, 120);
      }
    };
    const stop = function () {
      if (holdTimer !== null) {
        clearInterval(holdTimer);
        holdTimer = null;
      }
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  }

  document.querySelectorAll('.touch-btn').forEach(bindHoldButton);

  window.__tetrisTest = {
    getState: function () {
      return {
        score: state.score,
        lines: state.lines,
        level: state.level,
        status: state.status,
        clearing: state.clearing,
        board: state.board,
        current: state.current,
        nextType: state.nextType
      };
    },
    restart: restart,
    tick: tick,
    moveLeft: function () { return moveHorizontal(-1); },
    moveRight: function () { return moveHorizontal(1); },
    moveDown: moveDown,
    softDrop: softDrop,
    hardDrop: hardDrop,
    rotate: rotate,
    togglePause: togglePause,
    gameOver: gameOver,
    stopLoop: stopLoop,
    setBoardCell: function (r, c, type) {
      state.board[r][c] = type;
    },
    setCurrent: function (type, row, col) {
      state.current = {
        type: type,
        matrix: ROTATIONS[type][0],
        rot: 0,
        row: row,
        col: col
      };
    }
  };

  restart();
})();