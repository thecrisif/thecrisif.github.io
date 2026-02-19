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

const HOME_POS = {
  red:    [[2,2],[2,4],[4,2],[4,4]],
  blue:   [[2,10],[2,12],[4,10],[4,12]],
  green:  [[10,10],[10,12],[12,10],[12,12]],
  yellow: [[10,2],[10,4],[12,2],[12,4]]
};
const START_IDX = { red:0, blue:13, green:26, yellow:39 };

function generatePath() {
  const p = [];
  for(let r=13;r>=9;r--)  p.push([r,6]);
  for(let c=6;c>=1;c--)   p.push([8,c]);
  for(let r=8;r>=6;r--)   p.push([r,0]);
  for(let c=0;c<=6;c++)   p.push([6,c]);
  for(let r=6;r>=1;r--)   p.push([r,6]);
  for(let c=6;c<=8;c++)   p.push([0,c]);
  for(let r=0;r<=6;r++)   p.push([r,8]);
  for(let c=8;c<=13;c++)  p.push([6,c]);
  for(let r=6;r<=8;r++)   p.push([r,14]);
  for(let c=14;c>=8;c--)  p.push([8,c]);
  for(let r=8;r<=13;r++)  p.push([r,8]);
  return p;
}
const PATH = generatePath();

// ============================================================
// ESTADO
// ============================================================
let myColor = "red";
let myName  = "Jugador";
let roomId  = null;
let myRole  = null;
let gameState = null;
let diceValue = 0;
let rolled = false;
let myTurn = false;

const canvas = document.getElementById("board");
const ctx    = canvas.getContext("2d");

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
  state.host = { name: myName, color: myColor };
  state.turn = myColor;
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
  myRole = "guest";
  const snap = await get(ref(db,`rooms/${roomId}`));
  if(!snap.exists()){ showToast("❌ Sala no encontrada"); return; }
  const data = snap.val();
  if(data.host && data.host.color === myColor) {
    const others = Object.keys(COLS).filter(c=>c!==myColor);
    myColor = others[0];
  }
  await update(ref(db,`rooms/${roomId}`), {
    guest: { name: myName, color: myColor },
    status: "playing"
  });
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
      myTurn = data.turn === myColor;
      updateUI(data);
      drawBoard(data);
    }
    if(data.status==="won") showWin(data.winner===myColor);
  });
}

// ============================================================
// START GAME
// ============================================================
function startGame(data) {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").style.display  = "block";
  const host  = data.host  || {};
  const guest = data.guest || {};
  document.getElementById("my-dot").style.background  = COLS[myColor];
  document.getElementById("opp-dot").style.background = COLS[myRole==="host"? guest.color||"blue" : host.color||"red"];
  document.getElementById("my-name-label").textContent  = myName;
  document.getElementById("opp-name-label").textContent = myRole==="host"? (guest.name||"Rival") : (host.name||"Rival");
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
    if(!rolled) {
      rollBtn.disabled = false;
      statusEl.textContent = "¡Tira el dado!";
    } else {
      rollBtn.disabled = true;
      statusEl.textContent = `Sacaste ${data.roll} — ¡elige una ficha!`;
    }
  } else {
    turnLbl.textContent = "⏳ Turno del rival";
    rollBtn.disabled = true;
    statusEl.textContent = "Esperando al rival...";
  }
}

// ============================================================
// DADO
// ============================================================
window.rollDice = async function() {
  if(!myTurn || rolled) return;
  const val = Math.floor(Math.random()*6)+1;
  diceValue = val;
  rolled = true;
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
  const rect  = canvas.getBoundingClientRect();
  const scaleX = canvas.width/rect.width;
  const scaleY = canvas.height/rect.height;
  const mx = (e.clientX-rect.left)*scaleX;
  const my = (e.clientY-rect.top)*scaleY;
  const cs = canvas.width/SIZE;
  const col2 = Math.floor(mx/cs);
  const row  = Math.floor(my/cs);
  const pieces = gameState.pieces[myColor];
  const movables = getMovablePieces(diceValue, pieces);
  for(let i=0;i<4;i++){
    if(!movables.includes(i)) continue;
    const p = pieces[i];
    let pr,pc;
    if(p.pos===-1) [pr,pc]=HOME_POS[myColor][i];
    else [pr,pc]=PATH[p.pos];
    if(row===pr && col2===pc){ movePiece(i); return; }
  }
};

// ============================================================
// MOVER
// ============================================================
async function movePiece(idx) {
  const pieces = JSON.parse(JSON.stringify(gameState.pieces));
  const p = pieces[myColor][idx];
  if(p.pos===-1 && diceValue===6) p.pos = START_IDX[myColor];
  else if(p.pos>=0) {
    p.pos += diceValue;
    if(p.pos>=52){ p.pos=52; p.finished=true; }
  }
  // Comer rival
  if(p.pos>=0 && p.pos<52){
    const [rr,rc] = PATH[p.pos];
    Object.keys(COLS).forEach(col=>{
      if(col===myColor) return;
      pieces[col].forEach(rp=>{
        if(rp.pos>=0&&rp.pos<52){
          const [r2,c2]=PATH[rp.pos];
          if(r2===rr&&c2===rc){ rp.pos=-1; showToast("💀 ¡Comiste una ficha!"); }
        }
      });
    });
  }
  const allDone = pieces[myColor].every(p=>p.finished);
  const updates = { pieces, movedPiece:idx };
  if(allDone){ updates.status="won"; updates.winner=myColor; }
  else { updates.turn = diceValue===6 ? myColor : nextTurn(myColor); }
  await update(ref(db,`rooms/${roomId}`), updates);
  rolled=false; diceValue=0;
  document.getElementById("dice").textContent="⚀";
}

async function passTurn() {
  await update(ref(db,`rooms/${roomId}`),{ turn:nextTurn(myColor) });
  rolled=false; diceValue=0;
  document.getElementById("dice").textContent="⚀";
}

function nextTurn(cur) {
  const order=["red","blue","green","yellow"];
  return order[(order.indexOf(cur)+1)%4];
}

function getMovablePieces(val, pieces) {
  const m=[];
  pieces.forEach((p,i)=>{
    if(p.finished) return;
    if(p.pos===-1&&val===6) m.push(i);
    if(p.pos>=0&&p.pos+val<=52) m.push(i);
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
  drawHomeZones(cs);
  drawCenter(cs);
  if(data&&data.pieces) drawPieces(data.pieces,cs);
  if(myTurn&&rolled&&data) highlightMovable(data.pieces[myColor],cs);
}

function drawPathCells(cs) {
  const safe=[0,8,13,21,26,34,39,47];
  PATH.forEach(([row,col],idx)=>{
    const x=col*cs,y=row*cs;
    ctx.fillStyle= safe.includes(idx)?"#a0d8a0":"#fff";
    ctx.strokeStyle="#ccc"; ctx.lineWidth=0.5;
    ctx.fillRect(x,y,cs,cs); ctx.strokeRect(x,y,cs,cs);
    if(safe.includes(idx)){
      ctx.font=`${cs*0.5}px serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="#555";
      ctx.fillText("⭐",x+cs/2,y+cs/2);
    }
  });
}

function drawHomeZones(cs) {
  const zones={
    red:{r:0,c:0},blue:{r:0,c:9},
    green:{r:9,c:9},yellow:{r:9,c:0}
  };
  Object.entries(zones).forEach(([col,z])=>{
    const x=z.c*cs,y=z.r*cs;
    ctx.fillStyle=COLS[col]+"33";
    ctx.fillRect(x,y,cs*6,cs*6);
    ctx.strokeStyle=COLS[col]; ctx.lineWidth=2;
    ctx.strokeRect(x+1,y+1,cs*6-2,cs*6-2);
    const cx2=x+cs*3,cy2=y+cs*3;
    ctx.beginPath(); ctx.arc(cx2,cy2,cs*2,0,Math.PI*2);
    ctx.fillStyle=COLS[col]+"55"; ctx.fill();
    ctx.strokeStyle=COLS[col]; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=COLS[col];
    ctx.font=`bold ${cs*0.5}px Fredoka One,cursive`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(col.toUpperCase(),cx2,cy2);
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

function drawPieces(allPieces,cs) {
  Object.entries(allPieces).forEach(([col,pieces])=>{
    pieces.forEach((p,i)=>{
      if(p.finished) return;
      let row,col2;
      if(p.pos===-1) [row,col2]=HOME_POS[col][i];
      else if(p.pos<52) [row,col2]=PATH[p.pos];
      else return;
      const x=col2*cs+cs/2, y=row*cs+cs/2, r=cs*0.35;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle=COLS[col]; ctx.fill();
      ctx.strokeStyle="white"; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle="white";
      ctx.font=`bold ${cs*0.28}px Nunito`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(i+1,x,y);
    });
  });
}

function highlightMovable(pieces,cs) {
  const movable=getMovablePieces(diceValue,pieces);
  movable.forEach(i=>{
    const p=pieces[i];
    let row,col2;
    if(p.pos===-1) [row,col2]=HOME_POS[myColor][i];
    else [row,col2]=PATH[p.pos];
    const x=col2*cs+cs/2, y=row*cs+cs/2;
    ctx.beginPath(); ctx.arc(x,y,cs*0.42,0,Math.PI*2);
    ctx.strokeStyle="#FFD700"; ctx.lineWidth=3;
    ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
  });
}

// ============================================================
// WIN
// ============================================================
function showWin(iWon) {
  const ws=document.getElementById("win-screen");
  ws.style.display="flex";
  document.getElementById("win-text").textContent  = iWon?"¡GANASTE! 🏆":"Perdiste 😢";
  document.getElementById("win-sub").textContent   = iWon?"¡Eres el mejor, THE CRIS IF!":"¡Sigue intentándolo!";
  ws.querySelector(".win-emoji").textContent = iWon?"🏆":"😢";
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2500);
}
window.showToast=showToast;

// Dibujo inicial
drawBoard(null);
