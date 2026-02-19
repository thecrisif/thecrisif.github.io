// ============================================================
// script.js - LUDO THE CRIS IF
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyACr8sCnegUV0aqO6Ubrol7KMoq1wcJ_Pg",
  authDomain: "ludo-thecrisif.firebaseapp.com",
  databaseURL: "https://ludo-thecrisif-default-rtdb.firebaseio.com",
  projectId: "ludo-thecrisif",
  storageBucket: "ludo-thecrisif.firebasestorage.app",
  messagingSenderId: "643959425506",
  appId: "1:643959425506:web:c0515d6e4d007ce611d1bb",
  measurementId: "G-1LZ8Y2ML4J"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ============================================================
// CONSTANTES
// ============================================================
const COLS = { red:"#e74c3c", blue:"#2980b9", green:"#27ae60", yellow:"#f1c40f" };
const DICE_FACES = ["⚀","⚁","⚂","⚃","⚄","⚅"];
const SIZE = 15;
const TURN_TIME = 30;

// ============================================================
// PATH CORREGIDO — 52 celdas exactas en sentido horario
// ============================================================
function buildPath() {
  const p = [];
  for(let c=1;c<=6;c++)  p.push([6,c]);   // idx 0-5   rojo sube por aquí
  for(let r=5;r>=0;r--)  p.push([r,6]);   // idx 6-11
  for(let c=7;c<=8;c++)  p.push([0,c]);   // idx 12-13
  for(let r=1;r<=6;r++)  p.push([r,8]);   // idx 14-19  azul sale aquí
  for(let c=9;c<=14;c++) p.push([6,c]);   // idx 20-25
  for(let r=7;r<=8;r++)  p.push([r,14]);  // idx 26-27  verde sale aquí
  for(let c=13;c>=8;c--) p.push([8,c]);   // idx 28-33
  for(let r=9;r<=14;r++) p.push([r,8]);   // idx 34-39  amarillo sale aquí
  for(let c=7;c>=6;c--)  p.push([14,c]); // idx 40-41
  for(let r=13;r>=8;r--) p.push([r,6]);   // idx 42-47
  for(let c=5;c>=1;c--)  p.push([8,c]);   // idx 48-51
  return p; // 52 celdas exactas
}
const PATH = buildPath();

// Posición de salida de cada color (idx en PATH donde aparece al sacar 6)
const START_IDX = { red:0, blue:13, green:26, yellow:39 };

// Casillas seguras (estrellas)
const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

// Posiciones en casa de cada color
const HOME_POS = {
  red:    [[2,2],[2,4],[4,2],[4,4]],
  blue:   [[2,10],[2,12],[4,10],[4,12]],
  green:  [[10,10],[10,12],[12,10],[12,12]],
  yellow: [[10,2],[10,4],[12,2],[12,4]]
};

// Cuántos pasos desde START_IDX hasta la meta para cada color
// Cada color recorre 51 pasos desde su salida hasta llegar al centro
const FINISH_STEPS = 51;

// ============================================================
// ESTADO
// ============================================================
let myColor   = "red";
let myName    = "Jugador";
let roomId    = null;
let myRole    = null;
let gameState = null;
let diceValue = 0;
let rolled    = false;
let myTurn    = false;
let turnTimer    = null;
let timerSeconds = TURN_TIME;

const canvas = document.getElementById("board");
const ctx    = canvas.getContext("2d");

// ============================================================
// POSICIÓN REAL EN EL PATH
// El pos de cada ficha es relativo a su START_IDX
// pos=-1 → en casa
// pos=0  → recién salió (START_IDX de su color)
// pos=51 → llegó a la meta
// ============================================================
function pathIndex(color, relPos) {
  return (START_IDX[color] + relPos) % PATH.length;
}

function getCellCoords(color, piece) {
  if(piece.pos === -1) return null; // en casa
  if(piece.pos >= FINISH_STEPS) return null; // en meta
  const idx = pathIndex(color, piece.pos);
  return PATH[idx];
}

// ============================================================
// JUGADORES ACTIVOS
// ============================================================
function getActivePlayers(data) {
  const players = [];
  if(data && data.host)   players.push(data.host.color);
  if(data && data.guest)  players.push(data.guest.color);
  if(data && data.guest2) players.push(data.guest2.color);
  if(data && data.guest3) players.push(data.guest3.color);
  return players;
}

function nextTurn(cur, data) {
  const active = getActivePlayers(data || gameState);
  if(active.length === 0) return cur;
  const idx = active.indexOf(cur);
  return active[(idx + 1) % active.length];
}

// ============================================================
// TIMER
// ============================================================
function startTimer() {
  clearTimer();
  timerSeconds = TURN_TIME;
  updateTimerUI(timerSeconds);
  turnTimer = setInterval(() => {
    timerSeconds--;
    updateTimerUI(timerSeconds);
    if(timerSeconds <= 0) {
      clearTimer();
      if(myTurn) { showToast("⏰ ¡Tiempo agotado!"); passTurn(); }
    }
  }, 1000);
}

function clearTimer() {
  if(turnTimer) { clearInterval(turnTimer); turnTimer = null; }
  updateTimerUI(TURN_TIME);
}

function updateTimerUI(secs) {
  const el = document.getElementById("turn-timer");
  if(!el) return;
  el.textContent = secs + "s";
  el.style.color     = secs <= 10 ? "#e74c3c" : "#FFD700";
  el.style.transform = secs <= 10 ? "scale(1.2)" : "scale(1)";
}

// ============================================================
// LOBBY
// ============================================================
window.selectColor = function(el) {
  document.querySelectorAll(".color-btn").forEach(b=>b.classList.remove("selected"));
  el.classList.add("selected");
  myColor = el.dataset.color;
};

window.createRoom = async function() {
  myName = document.getElementById("player-name").value.trim() || "Cris";
  roomId = Math.floor(1000+Math.random()*9000).toString();
  myRole = "host";
  const state = buildInitialState();
  state.host   = { name: myName, color: myColor };
  state.turn   = myColor;
  state.status = "waiting";
  await set(ref(db,`rooms/${roomId}`), state);
  document.getElementById("room-code-text").textContent = roomId;
  document.getElementById("room-display").style.display = "block";
  listenRoom();
};

window.joinRoom = async function() {
  myName = document.getElementById("player-name").value.trim() || "Amigo";
  roomId = document.getElementById("room-input").value.trim();
  if(roomId.length !== 4){ showToast("❌ Código inválido"); return; }
  const snap = await get(ref(db,`rooms/${roomId}`));
  if(!snap.exists()){ showToast("❌ Sala no encontrada"); return; }
  const data = snap.val();
  const active = getActivePlayers(data);
  if(active.length >= 4){ showToast("❌ Sala llena"); return; }
  if(active.includes(myColor)) {
    const avail = Object.keys(COLS).filter(c=>!active.includes(c));
    if(!avail.length){ showToast("❌ Sin colores disponibles"); return; }
    myColor = avail[0];
    showToast(`🎨 Color cambiado a ${myColor}`);
  }
  let slot = ["guest","guest2","guest3"][active.length-1];
  myRole = slot;
  const updates = { status:"playing" };
  updates[slot] = { name:myName, color:myColor };
  await update(ref(db,`rooms/${roomId}`), updates);
  listenRoom();
};

function buildInitialState() {
  const pieces = {};
  Object.keys(COLS).forEach(col=>{
    pieces[col] = [
      {pos:-1,finished:false},{pos:-1,finished:false},
      {pos:-1,finished:false},{pos:-1,finished:false}
    ];
  });
  return { pieces, roll:0, movedPiece:-1 };
}

// ============================================================
// LISTEN ROOM
// ============================================================
function listenRoom() {
  onValue(ref(db,`rooms/${roomId}`), snap=>{
    if(!snap.exists()) return;
    const data = snap.val();
    gameState = data;

    if(data.status==="playing" && document.getElementById("lobby").style.display!=="none") {
      startGame(data);
    }

    if(data.status==="playing" || data.status==="won") {
      const wasMine = myTurn;
      myTurn = data.turn === myColor;

      // Saltar turno si el color no tiene jugador
      const active = getActivePlayers(data);
      if(data.status==="playing" && !active.includes(data.turn)) {
        update(ref(db,`rooms/${roomId}`),{ turn: nextTurn(data.turn, data) });
        return;
      }

      if(!myTurn) {
        rolled=false; diceValue=0;
        document.getElementById("dice").textContent="⚀";
        clearTimer();
      }
      if(myTurn && !wasMine) {
        rolled=false;
        startTimer();
      }

      updateUI(data);
      drawBoard(data);
    }
    if(data.status==="won") { clearTimer(); showWin(data.winner===myColor); }
  });
}

// ============================================================
// START GAME
// ============================================================
function startGame(data) {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").style.display  = "block";

  if(!document.getElementById("turn-timer")) {
    const el = document.createElement("div");
    el.id = "turn-timer";
    el.style.cssText = "font-family:'Fredoka One',cursive;font-size:24px;color:#FFD700;text-align:center;transition:color 0.3s,transform 0.2s;font-weight:bold;";
    el.textContent = TURN_TIME+"s";
    const ctrl = document.querySelector(".controls");
    if(ctrl) ctrl.insertBefore(el, ctrl.firstChild);
  }

  const active = getActivePlayers(data);
  const oppColor = active.find(c=>c!==myColor) || "blue";
  const allP = [data.host,data.guest,data.guest2,data.guest3].filter(Boolean);
  const oppData = allP.find(p=>p.color===oppColor);

  document.getElementById("my-dot").style.background  = COLS[myColor];
  document.getElementById("opp-dot").style.background = COLS[oppColor];
  document.getElementById("my-name-label").textContent  = myName;
  document.getElementById("opp-name-label").textContent = oppData?oppData.name:"Rival";

  if(data.turn===myColor) startTimer();
  drawBoard(data);
}

// ============================================================
// UI
// ============================================================
function updateUI(data) {
  const rollBtn  = document.getElementById("roll-btn");
  const statusEl = document.getElementById("status-msg");
  const turnLbl  = document.getElementById("turn-label");
  if(myTurn) {
    turnLbl.textContent = "🎲 ¡Tu turno!";
    rollBtn.disabled    = rolled;
    statusEl.textContent = rolled
      ? `Sacaste ${data.roll} — ¡elige una ficha!`
      : "¡Tira el dado!";
  } else {
    const allP = [data.host,data.guest,data.guest2,data.guest3].filter(Boolean);
    const tp   = allP.find(p=>p.color===data.turn);
    const tn   = tp ? tp.name : "Rival";
    turnLbl.textContent  = `⏳ Turno de ${tn}`;
    rollBtn.disabled     = true;
    statusEl.textContent = `Esperando a ${tn}...`;
  }
}

// ============================================================
// DADO
// ============================================================
window.rollDice = async function() {
  if(!myTurn||rolled) return;
  clearTimer();
  const val = Math.floor(Math.random()*6)+1;
  diceValue = val; rolled = true;
  const diceEl = document.getElementById("dice");
  diceEl.classList.add("rolling");
  setTimeout(()=>{ diceEl.classList.remove("rolling"); diceEl.textContent=DICE_FACES[val-1]; },500);
  await update(ref(db,`rooms/${roomId}`),{ roll:val, rolledBy:myColor });
  setTimeout(()=>{
    if(!gameState) return;
    const movables = getMovablePieces(val, gameState.pieces[myColor]);
    if(movables.length===0){ showToast("😔 Sin movimientos"); setTimeout(()=>passTurn(),1200); }
  },650);
};

// ============================================================
// CLICK TABLERO
// ============================================================
window.handleBoardClick = function(e) {
  if(!myTurn||!rolled||!gameState) return;
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width/rect.width;
  const scaleY = canvas.height/rect.height;
  const mx     = (e.clientX-rect.left)*scaleX;
  const my     = (e.clientY-rect.top)*scaleY;
  const cs     = canvas.width/SIZE;
  const clickC = Math.floor(mx/cs);
  const clickR = Math.floor(my/cs);
  const pieces   = gameState.pieces[myColor];
  const movables = getMovablePieces(diceValue, pieces);

  for(let i=0;i<4;i++){
    if(!movables.includes(i)) continue;
    const p = pieces[i];
    let pr, pc;
    if(p.pos===-1){
      [pr,pc] = HOME_POS[myColor][i];
    } else {
      const coords = getCellCoords(myColor, p);
      if(!coords) continue;
      [pr,pc] = coords;
    }
    if(clickR===pr && clickC===pc){ movePiece(i); return; }
  }
};

// ============================================================
// MOVER FICHA — lógica correcta con posición relativa
// ============================================================
async function movePiece(idx) {
  const pieces = JSON.parse(JSON.stringify(gameState.pieces));
  const p = pieces[myColor][idx];

  if(p.pos===-1 && diceValue===6) {
    // Sacar de casa → va a la celda de salida
    p.pos = 0;
  } else if(p.pos >= 0) {
    p.pos += diceValue;
    if(p.pos >= FINISH_STEPS) {
      p.pos = FINISH_STEPS;
      p.finished = true;
    }
  }

  // Comer rival solo si no está en casilla segura ni en meta
  if(p.pos > 0 && p.pos < FINISH_STEPS) {
    const myCoords = getCellCoords(myColor, p);
    const myAbsIdx = pathIndex(myColor, p.pos);
    // No comer en casillas seguras
    const isSafe = SAFE.some(s => PATH[s][0]===myCoords[0] && PATH[s][1]===myCoords[1]);
    if(!isSafe && myCoords) {
      Object.keys(COLS).forEach(col=>{
        if(col===myColor) return;
        pieces[col].forEach(rp=>{
          if(rp.pos<=0||rp.pos>=FINISH_STEPS||rp.finished) return;
          const rpCoords = getCellCoords(col, rp);
          if(rpCoords && rpCoords[0]===myCoords[0] && rpCoords[1]===myCoords[1]) {
            rp.pos = -1;
            showToast("💀 ¡Comiste una ficha!");
          }
        });
      });
    }
  }

  const allDone = pieces[myColor].every(p=>p.finished);
  const updates = { pieces, movedPiece:idx };

  if(allDone) {
    updates.status = "won";
    updates.winner = myColor;
  } else {
    // Si sacó 6 repite turno, sino pasa al siguiente
    updates.turn = diceValue===6 ? myColor : nextTurn(myColor, gameState);
  }

  await update(ref(db,`rooms/${roomId}`), updates);
  rolled=false; diceValue=0;
  document.getElementById("dice").textContent="⚀";
}

async function passTurn() {
  await update(ref(db,`rooms/${roomId}`),{ turn: nextTurn(myColor, gameState) });
  rolled=false; diceValue=0;
  document.getElementById("dice").textContent="⚀";
  clearTimer();
}

// ============================================================
// PIEZAS MOVIBLES
// ============================================================
function getMovablePieces(val, pieces) {
  const m = [];
  pieces.forEach((p,i)=>{
    if(p.finished) return;
    // En casa solo puede salir con 6
    if(p.pos===-1 && val===6) { m.push(i); return; }
    // En tablero puede moverse si no se pasa de la meta
    if(p.pos>=0 && p.pos+val <= FINISH_STEPS) m.push(i);
  });
  return m;
}

// ============================================================
// DIBUJAR TABLERO
// ============================================================
function drawBoard(data) {
  const W=canvas.width, cs=W/SIZE;
  ctx.clearRect(0,0,W,W);
  ctx.fillStyle="#f9f3e3"; ctx.fillRect(0,0,W,W);
  drawPathCells(cs);
  drawHomeZones(cs, data);
  drawCenter(cs);
  if(data&&data.pieces) drawPieces(data.pieces,cs);
  if(myTurn&&rolled&&data) highlightMovable(data.pieces[myColor],cs);
}

function drawPathCells(cs) {
  PATH.forEach(([row,col],idx)=>{
    const x=col*cs, y=row*cs;
    ctx.fillStyle = SAFE.includes(idx) ? "#a0d8a0" : "#fff";
    ctx.strokeStyle="#ccc"; ctx.lineWidth=0.5;
    ctx.fillRect(x,y,cs,cs); ctx.strokeRect(x,y,cs,cs);
    if(SAFE.includes(idx)){
      ctx.font=`${cs*0.5}px serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="#555";
      ctx.fillText("⭐",x+cs/2,y+cs/2);
    }
  });
}

function drawHomeZones(cs, data) {
  const active = data ? getActivePlayers(data) : [];
  const zones = {
    red:{r:0,c:0}, blue:{r:0,c:9},
    green:{r:9,c:9}, yellow:{r:9,c:0}
  };
  Object.entries(zones).forEach(([col,z])=>{
    const has = active.length===0 || active.includes(col);
    const base = has ? COLS[col] : "#888888";
    const x=z.c*cs, y=z.r*cs;
    ctx.fillStyle = has ? base+"33" : "#88888822";
    ctx.fillRect(x,y,cs*6,cs*6);
    ctx.strokeStyle=base; ctx.lineWidth=2;
    ctx.strokeRect(x+1,y+1,cs*6-2,cs*6-2);
    const cx2=x+cs*3, cy2=y+cs*3;
    ctx.beginPath(); ctx.arc(cx2,cy2,cs*2,0,Math.PI*2);
    ctx.fillStyle = has ? base+"55" : "#88888833"; ctx.fill();
    ctx.strokeStyle=base; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle = has ? base : "#aaaaaa";
    ctx.font=`bold ${cs*0.5}px Fredoka One,cursive`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(has ? col.toUpperCase() : "🔒", cx2, cy2);
  });
}

function drawCenter(cs) {
  const tris=[
    {col:"#e74c3c",pts:[[6,6],[9,6],[7.5,7.5]]},
    {col:"#2980b9",pts:[[9,6],[9,9],[7.5,7.5]]},
    {col:"#27ae60",pts:[[9,9],[6,9],[7.5,7.5]]},
    {col:"#f1c40f",pts:[[6,9],[6,6],[7.5,7.5]]}
  ];
  tris.forEach(({col,pts})=>{
    ctx.beginPath();
    ctx.moveTo(pts[0][0]*cs,pts[0][1]*cs);
    ctx.lineTo(pts[1][0]*cs,pts[1][1]*cs);
    ctx.lineTo(pts[2][0]*cs,pts[2][1]*cs);
    ctx.closePath(); ctx.fillStyle=col; ctx.fill();
  });
  ctx.font=`${cs*1.2}px serif`;
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText("👑",7.5*cs,7.5*cs);
}

function drawPieces(allPieces, cs) {
  // Agrupar fichas por celda para dibujarlas con offset
  const cellMap = {};
  Object.entries(allPieces).forEach(([col,pieces])=>{
    pieces.forEach((p,i)=>{
      if(p.finished) return;
      let row, col2;
      if(p.pos===-1) {
        [row,col2] = HOME_POS[col][i];
      } else {
        const coords = getCellCoords(col, p);
        if(!coords) return;
        [row,col2] = coords;
      }
      const key = `${row},${col2}`;
      if(!cellMap[key]) cellMap[key]=[];
      cellMap[key].push({col,i,row,col2});
    });
  });

  Object.values(cellMap).forEach(group=>{
    const n = group.length;
    group.forEach((item,gi)=>{
      const {col,i,row,col2} = item;
      const x = col2*cs+cs/2;
      const y = row*cs+cs/2;
      // Offset si hay varias fichas en la misma celda
      let ox=0, oy=0;
      if(n>1){
        const offsets=[[-1,-1],[1,-1],[-1,1],[1,1]];
        ox = offsets[gi%4][0] * cs*0.18;
        oy = offsets[gi%4][1] * cs*0.18;
      }
      const r = cs*(n>1?0.25:0.35);
      ctx.beginPath(); ctx.arc(x+ox,y+oy,r,0,Math.PI*2);
      ctx.fillStyle=COLS[col]; ctx.fill();
      ctx.strokeStyle="white"; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle="white";
      ctx.font=`bold ${cs*0.22}px Nunito`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(i+1,x+ox,y+oy);
    });
  });
}

function highlightMovable(pieces, cs) {
  const movable = getMovablePieces(diceValue, pieces);
  movable.forEach(i=>{
    const p = pieces[i];
    let row, col2;
    if(p.pos===-1) {
      [row,col2] = HOME_POS[myColor][i];
    } else {
      const coords = getCellCoords(myColor, p);
      if(!coords) return;
      [row,col2] = coords;
    }
    const x=col2*cs+cs/2, y=row*cs+cs/2;
    ctx.beginPath(); ctx.arc(x,y,cs*0.42,0,Math.PI*2);
    ctx.strokeStyle="#FFD700"; ctx.lineWidth=3;
    ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
  });
}

// ============================================================
// WIN & TOAST
// ============================================================
function showWin(iWon) {
  const ws=document.getElementById("win-screen");
  ws.style.display="flex";
  document.getElementById("win-text").textContent = iWon?"¡GANASTE! 🏆":"Perdiste 😢";
  document.getElementBy