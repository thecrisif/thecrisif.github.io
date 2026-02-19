// ============================================================
// game.js — DAMAS ONLINE THE CRIS IF
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================================
// FIREBASE CONFIG (mismo que Ludo)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyACr8sCnegUV0aqO6Ubrol7KMoq1wcJ_Pg",
  authDomain: "ludo-thecrisif.firebaseapp.com",
  databaseURL: "https://ludo-thecrisif-default-rtdb.firebaseio.com",
  projectId: "ludo-thecrisif",
  storageBucket: "ludo-thecrisif.firebasestorage.app",
  messagingSenderId: "643959425506",
  appId: "1:643959425506:web:c0515d6e4d007ce611d1bb"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ============================================================
// CONSTANTES
// ============================================================
const ROWS = 8, COLS = 8;
const canvas = document.getElementById("board");
const ctx    = canvas.getContext("2d");

// ============================================================
// ESTADO LOCAL
// ============================================================
let myColor  = "white"; // "white" o "black"
let myName   = "Jugador";
let myRole   = null;    // "host" o "guest"
let roomId   = null;
let gameState = null;
let selected  = null;   // [row, col] pieza seleccionada
let myTurn    = false;
let forcedCaptures = []; // piezas que DEBEN capturar

// ============================================================
// LOBBY — seleccionar pieza
// ============================================================
window.selectPiece = function(el) {
  document.querySelectorAll(".piece-opt").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  myColor = el.dataset.color;
};

// ============================================================
// CREAR SALA
// ============================================================
window.createRoom = async function() {
  myName = document.getElementById("player-name").value.trim() || "Cris";
  roomId = Math.floor(1000 + Math.random() * 9000).toString();
  myRole = "host";

  const state = buildInitialState();
  state.host   = { name: myName, color: myColor };
  state.turn   = "white"; // blancas siempre empiezan
  state.status = "waiting";

  await set(ref(db, `damas/${roomId}`), state);
  document.getElementById("room-code-text").textContent = roomId;
  document.getElementById("room-display").style.display = "block";
  listenRoom();
};

// ============================================================
// UNIRSE A SALA
// ============================================================
window.joinRoom = async function() {
  myName = document.getElementById("player-name").value.trim() || "Amigo";
  roomId = document.getElementById("room-input").value.trim();
  if(roomId.length !== 4) { showToast("❌ Código inválido"); return; }

  const snap = await get(ref(db, `damas/${roomId}`));
  if(!snap.exists()) { showToast("❌ Sala no encontrada"); return; }
  const data = snap.val();
  if(data.guest) { showToast("❌ Sala llena"); return; }

  // El guest toma el color contrario al host
  myColor = data.host.color === "white" ? "black" : "white";
  myRole  = "guest";

  await update(ref(db, `damas/${roomId}`), {
    guest:  { name: myName, color: myColor },
    status: "playing"
  });
  listenRoom();
};

// ============================================================
// ESTADO INICIAL DEL TABLERO
// ============================================================
function buildInitialState() {
  // board[r][c] = null | { color:"white"|"black", king:false }
  const board = [];
  for(let r = 0; r < ROWS; r++) {
    board[r] = [];
    for(let c = 0; c < COLS; c++) {
      if((r + c) % 2 === 1) {
        if(r < 3)      board[r][c] = { color:"black", king:false };
        else if(r > 4) board[r][c] = { color:"white", king:false };
        else           board[r][c] = null;
      } else {
        board[r][c] = null;
      }
    }
  }
  return { board };
}

// ============================================================
// ESCUCHAR FIREBASE
// ============================================================
function listenRoom() {
  onValue(ref(db, `damas/${roomId}`), snap => {
    if(!snap.exists()) return;
    const data = snap.val();
    gameState = data;

    if(data.status === "playing" && document.getElementById("lobby").style.display !== "none") {
      startGame(data);
    }

    if(data.status === "playing" || data.status === "won") {
      myTurn = data.turn === myColor;
      selected = null;
      forcedCaptures = myTurn ? getCapturablePieces(data.board, myColor) : [];
      drawBoard(data.board);
      updateUI(data);
    }

    if(data.status === "won") showWin(data.winner === myColor);
  });
}

// ============================================================
// INICIAR JUEGO
// ============================================================
function startGame(data) {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").style.display  = "block";

  const host  = data.host  || {};
  const guest = data.guest || {};

  // Mi color y el del rival
  const myC   = myColor === "white" ? "#e8e0d0" : "#222222";
  const oppC  = myColor === "white" ? "#222222" : "#e8e0d0";
  const oppName = myRole === "host" ? (guest.name || "Rival") : (host.name || "Rival");

  document.getElementById("my-dot").style.background  = myC;
  document.getElementById("opp-dot").style.background = oppC;
  document.getElementById("my-dot").style.border      = "2px solid rgba(255,255,255,0.3)";
  document.getElementById("opp-dot").style.border     = "2px solid rgba(255,255,255,0.3)";
  document.getElementById("my-name-label").textContent  = myName;
  document.getElementById("opp-name-label").textContent = oppName;

  drawBoard(data.board);
  updateUI(data);
}

// ============================================================
// ACTUALIZAR UI
// ============================================================
function updateUI(data) {
  const turnLbl  = document.getElementById("turn-label");
  const statusEl = document.getElementById("status-msg");

  // Contar piezas
  let myCount = 0, oppCount = 0;
  const oppColor = myColor === "white" ? "black" : "white";
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    const p = data.board[r]?.[c];
    if(!p) continue;
    if(p.color === myColor) myCount++;
    else oppCount++;
  }
  document.getElementById("my-count").textContent  = myCount;
  document.getElementById("opp-count").textContent = oppCount;

  if(myTurn) {
    turnLbl.textContent  = "⚔️ Tu turno";
    statusEl.textContent = forcedCaptures.length > 0
      ? "¡Captura obligatoria! Elige una pieza dorada"
      : "Selecciona una pieza para mover";
  } else {
    const oppData = myRole === "host" ? data.guest : data.host;
    const oppName = oppData ? oppData.name : "Rival";
    turnLbl.textContent  = `⏳ Turno de ${oppName}`;
    statusEl.textContent = `Esperando a ${oppName}...`;
  }
}

// ============================================================
// CLICK EN EL TABLERO
// ============================================================
window.handleClick = function(e) {
  if(!myTurn || !gameState) return;
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx     = (e.clientX - rect.left) * scaleX;
  const my2    = (e.clientY - rect.top)  * scaleY;
  const cs     = canvas.width / COLS;

  // Para las negras se invierte la perspectiva
  let clickR = Math.floor(my2 / cs);
  let clickC = Math.floor(mx / cs);
  if(myColor === "black") {
    clickR = ROWS - 1 - clickR;
    clickC = COLS - 1 - clickC;
  }

  const board  = gameState.board;
  const cell   = board[clickR]?.[clickC];
  const isMyPiece = cell && cell.color === myColor;

  // Si hay captura forzada, solo se puede elegir esas piezas
  if(selected === null) {
    if(!isMyPiece) return;
    if(forcedCaptures.length > 0 && !forcedCaptures.some(([r,c])=>r===clickR&&c===clickC)) {
      showToast("⚠️ ¡Debes capturar!"); return;
    }
    selected = [clickR, clickC];
    drawBoard(board);
    return;
  }

  const [sr, sc] = selected;

  // Click en otra pieza propia → cambiar selección
  if(isMyPiece) {
    if(forcedCaptures.length > 0 && !forcedCaptures.some(([r,c])=>r===clickR&&c===clickC)) {
      showToast("⚠️ ¡Debes capturar!"); return;
    }
    selected = [clickR, clickC];
    drawBoard(board);
    return;
  }

  // Intentar mover a la celda clickeada
  const piece = board[sr][sc];
  const caps  = getCaptures(sr, sc, piece, board);
  const moves = caps.length > 0 ? [] : getMoves(sr, sc, piece, board);

  const isCapture = caps.some(([tr,tc]) => tr===clickR && tc===clickC);
  const isMove    = moves.some(([tr,tc]) => tr===clickR && tc===clickC);

  if(isCapture) {
    executeCapture(sr, sc, clickR, clickC, board, piece);
  } else if(isMove && forcedCaptures.length === 0) {
    executeMove(sr, sc, clickR, clickC, board, piece);
  } else {
    selected = null;
    drawBoard(board);
  }
};

// ============================================================
// EJECUTAR MOVIMIENTO
// ============================================================
async function executeMove(sr, sc, tr, tc, board, piece) {
  const nb = deepCopy(board);
  nb[tr][tc] = nb[sr][sc];
  nb[sr][sc] = null;
  promoteIfNeeded(tr, tc, nb);

  const winner = checkWin(nb);
  const updates = {
    board: nb,
    turn:  myColor === "white" ? "black" : "white",
    lastMove: { from:[sr,sc], to:[tr,tc] }
  };
  if(winner) { updates.status = "won"; updates.winner = winner; }

  selected = null;
  await update(ref(db, `damas/${roomId}`), updates);
}

// ============================================================
// EJECUTAR CAPTURA
// ============================================================
async function executeCapture(sr, sc, tr, tc, board, piece) {
  const nb = deepCopy(board);
  const mr = (sr + tr) / 2;
  const mc = (sc + tc) / 2;
  nb[tr][tc] = nb[sr][sc];
  nb[sr][sc] = null;
  nb[mr][mc] = null;
  promoteIfNeeded(tr, tc, nb);

  // Verificar si puede seguir capturando (captura múltiple)
  const moreCaps = getCaptures(tr, tc, nb[tr][tc], nb);
  if(moreCaps.length > 0) {
    // Puede seguir — actualizar tablero y mantener turno
    gameState.board = nb;
    forcedCaptures  = [[tr, tc]];
    selected        = [tr, tc];
    drawBoard(nb);
    await update(ref(db, `damas/${roomId}`), { board: nb, lastMove:{ from:[sr,sc], to:[tr,tc] } });
    showToast("💥 ¡Sigue capturando!");
    return;
  }

  const winner = checkWin(nb);
  const updates = {
    board: nb,
    turn:  myColor === "white" ? "black" : "white",
    lastMove: { from:[sr,sc], to:[tr,tc] }
  };
  if(winner) { updates.status = "won"; updates.winner = winner; }

  selected = null;
  await update(ref(db, `damas/${roomId}`), updates);
}

// ============================================================
// REGLAS DE MOVIMIENTO
// ============================================================
function getMoves(r, c, piece, board) {
  const dirs = piece.king
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === "white"
      ? [[-1,-1],[-1,1]]
      : [[1,-1],[1,1]];
  const moves = [];
  for(const [dr,dc] of dirs) {
    const tr = r+dr, tc = c+dc;
    if(inBounds(tr,tc) && !board[tr][tc]) moves.push([tr,tc]);
  }
  return moves;
}

function getCaptures(r, c, piece, board) {
  const dirs = piece.king
    ? [[-2,-2],[-2,2],[2,-2],[2,2]]
    : piece.color === "white"
      ? [[-2,-2],[-2,2]]
      : [[2,-2],[2,2]];
  const caps = [];
  for(const [dr,dc] of dirs) {
    const mr = r+dr/2, mc = c+dc/2;
    const tr = r+dr,   tc = c+dc;
    if(inBounds(tr,tc)) {
      const mid = board[mr]?.[mc];
      if(mid && mid.color !== piece.color && !board[tr][tc]) {
        caps.push([tr,tc]);
      }
    }
  }
  return caps;
}

// Todas las piezas de un color que pueden capturar
function getCapturablePieces(board, color) {
  const list = [];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    const p = board[r]?.[c];
    if(p && p.color === color && getCaptures(r,c,p,board).length > 0) list.push([r,c]);
  }
  return list;
}

// ============================================================
// PROMOCIÓN A DAMA
// ============================================================
function promoteIfNeeded(r, c, board) {
  const p = board[r][c];
  if(!p) return;
  if(p.color === "white" && r === 0) p.king = true;
  if(p.color === "black" && r === 7) p.king = true;
}

// ============================================================
// VERIFICAR VICTORIA
// ============================================================
function checkWin(board) {
  let whites = 0, blacks = 0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    const p = board[r]?.[c];
    if(!p) continue;
    if(p.color==="white") whites++;
    else blacks++;
  }
  if(whites === 0) return "black";
  if(blacks === 0) return "white";

  // Sin movimientos
  const whiteCanMove = canAnyMove(board, "white");
  const blackCanMove = canAnyMove(board, "black");
  if(!whiteCanMove) return "black";
  if(!blackCanMove) return "white";
  return null;
}

function canAnyMove(board, color) {
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
    const p = board[r]?.[c];
    if(p && p.color === color) {
      if(getCaptures(r,c,p,board).length > 0) return true;
      if(getMoves(r,c,p,board).length > 0) return true;
    }
  }
  return false;
}

// ============================================================
// DIBUJAR TABLERO — alta calidad
// ============================================================
function drawBoard(board) {
  const W  = canvas.width;
  const cs = W / COLS;
  ctx.clearRect(0, 0, W, W);

  // Casillas
  for(let r=0;r<ROWS;r++) {
    for(let c=0;c<COLS;c++) {
      const dr = myColor === "black" ? ROWS-1-r : r;
      const dc = myColor === "black" ? COLS-1-c : c;
      const x  = c * cs, y = r * cs;
      const isDark = (dr + dc) % 2 === 1;

      if(isDark) {
        // Casilla oscura con gradiente
        const grad = ctx.createLinearGradient(x,y,x+cs,y+cs);
        grad.addColorStop(0, "#2a1600");
        grad.addColorStop(1, "#1a0c00");
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createLinearGradient(x,y,x+cs,y+cs);
        grad.addColorStop(0, "#f5e6c8");
        grad.addColorStop(1, "#e8d4a8");
        ctx.fillStyle = grad;
      }
      ctx.fillRect(x, y, cs, cs);

      // Borde sutil
      ctx.strokeStyle = isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, cs, cs);
    }
  }

  // Resaltar seleccionada y movimientos posibles
  if(selected && myTurn) {
    const [sr, sc] = selected;
    const dr = myColor === "black" ? ROWS-1-sr : sr;
    const dc = myColor === "black" ? COLS-1-sc : sc;
    const x  = dc*cs, y = dr*cs;

    // Celda seleccionada
    ctx.fillStyle = "rgba(240,192,64,0.4)";
    ctx.fillRect(x, y, cs, cs);
    ctx.strokeStyle = "#f0c040";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x+1, y+1, cs-2, cs-2);

    const piece = board[sr][sc];
    if(piece) {
      const caps  = getCaptures(sr, sc, piece, board);
      const moves = caps.length > 0 ? [] : getMoves(sr, sc, piece, board);
      const hints = [...caps, ...moves];
      hints.forEach(([hr,hc]) => {
        const hdr = myColor === "black" ? ROWS-1-hr : hr;
        const hdc = myColor === "black" ? COLS-1-hc : hc;
        const hx  = hdc*cs + cs/2, hy = hdr*cs + cs/2;
        ctx.beginPath();
        ctx.arc(hx, hy, cs*0.2, 0, Math.PI*2);
        ctx.fillStyle = caps.length>0 ? "rgba(255,80,80,0.6)" : "rgba(240,192,64,0.5)";
        ctx.fill();
      });
    }
  }

  // Resaltar piezas con captura obligatoria
  if(myTurn && forcedCaptures.length > 0) {
    forcedCaptures.forEach(([fr,fc]) => {
      if(selected && selected[0]===fr && selected[1]===fc) return;
      const dr = myColor === "black" ? ROWS-1-fr : fr;
      const dc = myColor === "black" ? COLS-1-fc : fc;
      const x  = dc*cs, y = dr*cs;
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([4,3]);
      ctx.strokeRect(x+1, y+1, cs-2, cs-2);
      ctx.setLineDash([]);
    });
  }

  // Dibujar piezas
  for(let r=0;r<ROWS;r++) {
    for(let c=0;c<COLS;c++) {
      const piece = board[r]?.[c];
      if(!piece) continue;
      const dr = myColor === "black" ? ROWS-1-r : r;
      const dc = myColor === "black" ? COLS-1-c : c;
      const x  = dc*cs + cs/2;
      const y  = dr*cs + cs/2;
      drawPiece(x, y, cs*0.42, piece);
    }
  }
}

// ============================================================
// DIBUJAR PIEZA EN ALTA CALIDAD
// ============================================================
function drawPiece(x, y, r, piece) {
  const isWhite = piece.color === "white";

  // Sombra
  ctx.beginPath();
  ctx.arc(x+2, y+3, r, 0, Math.PI*2);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();

  // Cuerpo con gradiente radial 3D
  const grad = ctx.createRadialGradient(x-r*0.3, y-r*0.3, r*0.05, x, y, r);
  if(isWhite) {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, "#ede5d5");
    grad.addColorStop(0.8, "#c8bfb0");
    grad.addColorStop(1, "#9e9286");
  } else {
    grad.addColorStop(0, "#888888");
    grad.addColorStop(0.4, "#333333");
    grad.addColorStop(0.8, "#111111");
    grad.addColorStop(1, "#000000");
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Borde
  ctx.strokeStyle = isWhite ? "rgba(120,100,80,0.5)" : "rgba(0,0,0,0.8)";
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Brillo superior
  const shine = ctx.createRadialGradient(x-r*0.3, y-r*0.35, 0, x-r*0.2, y-r*0.2, r*0.6);
  shine.addColorStop(0, isWhite ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = shine;
  ctx.fill();

  // Anillo interno
  ctx.beginPath();
  ctx.arc(x, y, r*0.72, 0, Math.PI*2);
  ctx.strokeStyle = isWhite ? "rgba(160,140,120,0.4)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Corona de dama
  if(piece.king) {
    ctx.font = `bold ${r*0.85}px serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle    = isWhite ? "rgba(180,130,20,0.9)" : "rgba(255,210,60,0.9)";
    ctx.fillText("♛", x, y+1);
  }
}

// ============================================================
// VICTORIA
// ============================================================
function showWin(iWon) {
  const ws = document.getElementById("win-screen");
  ws.style.display = "flex";
  document.getElementById("win-emoji").textContent = iWon ? "🏆" : "😢";
  document.getElementById("win-text").textContent  = iWon ? "¡GANASTE!" : "PERDISTE";
  document.getElementById("win-sub").textContent   = iWon
    ? "¡Eres el mejor, THE CRIS IF!"
    : "¡Sigue intentándolo!";
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
window.showToast = showToast;

// ============================================================
// UTILIDADES
// ============================================================
function inBounds(r, c) { return r>=0 && r<ROWS && c>=0 && c<COLS; }
function deepCopy(obj)  { return JSON.parse(JSON.stringify(obj)); }

// Dibujo inicial vacío
drawBoard(buildInitialState().board);
