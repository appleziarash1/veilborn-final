// Headless simulation harness: loads the real game <script> out of index.html
// in a vm sandbox and exercises the gameplay logic against it.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let src = html.split("<script>")[1].split("</script>")[0];
src += "\n;globalThis.__x = {Game, LEVELS, TS, keys, update, loadLevel, advanceCutscene, solidAtPx, playerAttack, takedown, updateObjectives, inShadow, makeEnemy, makePlayer, draw, resize, get mouse(){return mouse;}};\n";

function makeEl(){
  const el = {
    style:{}, textContent:"", innerHTML:"", className:"", id:"",
    classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
      contains(c){return this._s.has(c);} },
    addEventListener(){}, appendChild(){}, querySelector(){ return makeEl(); },
    querySelectorAll(){ return []; }, getBoundingClientRect(){ return {left:0,top:0,width:1100,height:700}; },
    getAttribute(){ return "j"; }, setAttribute(){}, onclick:null, ontouchstart:null,
    getContext:null
  };
  return el;
}
const grad = { addColorStop(){} };
const ctxStub = new Proxy({}, {
  get(t,p){
    if(p==="createRadialGradient"||p==="createLinearGradient") return ()=>grad;
    if(p==="measureText") return ()=>({width:10});
    if(p in t) return t[p];
    return ()=>{};
  },
  set(t,p,v){ t[p]=v; return true; }
});

const els = {};
const canvas = makeEl();
canvas.getContext = ()=>ctxStub;
canvas.width=1100; canvas.height=700;
els.game = canvas;

const sandbox = {
  console,
  Math, Date, JSON, Set, Map, Array, Object, Number, String, Boolean, Error, isNaN, parseInt, parseFloat,
  performance:{ now:()=>Date.now() },
  requestAnimationFrame:()=>0,
  clearInterval:()=>{}, setInterval:()=>0, setTimeout:(f)=>{ try{f();}catch(e){} },
  navigator:{ maxTouchPoints:0, getGamepads:()=>[] },
  devicePixelRatio:1,
  AudioContext:undefined, webkitAudioContext:undefined,
  addEventListener:()=>{},
  window:{},
  document:{
    getElementById:(id)=>{ if(!els[id]) els[id]=makeEl(); return els[id]; },
    createElement:()=>makeEl(),
    head:{ appendChild(){} },
    body:{ appendChild(){} }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(src, sandbox, {filename:"game.js"});

const X = sandbox.__x;
const G = X.Game;
const L = X.LEVELS;
const TS = X.TS;
sandbox.keys = X.keys;
sandbox.update = X.update;
sandbox.loadLevel = X.loadLevel;
sandbox.advanceCutscene = X.advanceCutscene;
sandbox.solidAtPx = X.solidAtPx;
sandbox.playerAttack = X.playerAttack;
sandbox.takedown = X.takedown;
sandbox.updateObjectives = X.updateObjectives;
sandbox.draw = X.draw;
sandbox.resize = X.resize;

let pass=0, fail=0;
function check(name, cond, extra){
  if(cond){ pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra?("  -> "+extra):"")); }
}
function step(n, dt){
  dt = dt || 1/60;
  for(let i=0;i<n;i++){ sandbox.update(dt); }
}

console.log("\n=== 1. Level loading ===");
sandbox.loadLevel(0);
check("level 0 loaded grid", !!G.grid && G.W===L[0].w && G.H===L[0].h);
check("player spawned", G.player && G.player.hp===100);
check("enemies spawned (5)", G.enemies.length===5, "got "+G.enemies.length);
check("objectives count 2", G.objectives.length===2);
check("state is cutscene", G.state==="cutscene", G.state);

// skip cutscene
function skipCS(){ let n=0; while(G.state==="cutscene" && G.cutscene && n++<200){ sandbox.advanceCutscene(); } }
skipCS();

console.log("\n=== 2. Post-cutscene play state ===");
check("state play after cutscene", G.state==="play", G.state);

console.log("\n=== 3. Player movement & wall collision ===");
let p = G.player;
const sx = p.x, sy = p.y;
sandbox.keys["d"]=true; step(30);
check("player moved right", p.x > sx, "x "+sx+"->"+p.x);
// walk into left wall
p.x = 1.5*TS; p.y = 1.5*TS;
sandbox.keys["a"]=true; step(60);
sandbox.keys["a"]=false;
check("player blocked by wall", p.x > 0 && !sandbox.solidAtPx(p.x-p.r*0.6,p.y), "x="+p.x);

console.log("\n=== 4. Enemy vision detection ===");
["a","d","w","s"].forEach(k=>sandbox.keys[k]=false);
const e0 = G.enemies[0];
e0.path = [];                 // stationary, faces the player
p.x = e0.x + 60; p.y = e0.y;
e0.state="patrol"; e0.detect=0;
G.player.hp = 100;
G.graceT = 0;
step(4);
check("enemy detect rises when in front", e0.detect > 0, "detect="+e0.detect);
let becameChase = false;
for(let i=0;i<180;i++){ sandbox.update(1/60); if(e0.state==="chase"){becameChase=true;break;} }
check("enemy enters chase state", becameChase, "state="+e0.state);
check("detection raises global alarm", G.alarm > 0, "alarm="+G.alarm);

console.log("\n=== 4b. Chasing enemy damages the player ===");
const hpB = G.player.hp;
let hurt = false;
for(let i=0;i<420;i++){ sandbox.update(1/60); if(G.player.hp < hpB){ hurt=true; break; } }
check("enemy attack damages player", hurt, "hp="+G.player.hp);

console.log("\n=== 5. Behind-player not seen (cone) ===");
const e1 = G.enemies[1];
p.x = e1.x - 60; p.y = e1.y;  // behind (enemy facing +x)
e1.angle = 0; e1.detect = 0; e1.state = "patrol";
G.graceT = 0;
step(6);
check("enemy behind does not detect", e1.detect < 0.2, "detect="+e1.detect);

console.log("\n=== 6. Melee combat: light punch ===");
const tgt = G.enemies[2];
tgt.state="patrol"; tgt.x = p.x + 30; tgt.y = p.y; tgt.hp = 45;
p.angle = 0; p.atkCd = 0; p.st = 100;
const hpBefore = tgt.hp;
sandbox.playerAttack("light");
check("light punch damages enemy", tgt.hp < hpBefore, hpBefore+"->"+tgt.hp);

console.log("\n=== 7. Melee combat: heavy kick ===");
tgt.hp = 45; p.atkCd=0; p.st=100; p.angle=0; tgt.x=p.x+34; tgt.y=p.y;
sandbox.playerAttack("heavy");
check("heavy kick does >=25 dmg", 45 - tgt.hp >= 25, "dmg="+(45-tgt.hp));
check("heavy costs more stamina", p.st <= 76, "st="+p.st);

console.log("\n=== 8. Enemy can be defeated ===");
tgt.hp = 10; p.atkCd=0; p.st=100; p.angle=0; tgt.x=p.x+30; tgt.y=p.y;
sandbox.playerAttack("heavy");
check("enemy dies at 0 hp", tgt.dead===true, "hp="+tgt.hp);

console.log("\n=== 9. Takedown from behind ===");
const tk = G.enemies[3];
tk.dead=false; tk.hp=45; tk.state="patrol"; tk.boss=false;
tk.x = p.x + 20; tk.y = p.y; tk.angle = 0;      // enemy faces +x
p.angle = Math.PI;                               // player behind faces -x
sandbox.takedown();
check("takedown kills unaware enemy from behind", tk.dead===true, "dead="+tk.dead);

console.log("\n=== 10. Boss is immune to takedown ===");
sandbox.loadLevel(2);
skipCS();
const boss = G.enemies.find(x=>x.boss);
check("level 2 spawns a boss", !!boss);
boss.dead=false; boss.hp=boss.maxhp; boss.state="patrol";
boss.x = p.x + 20; boss.y = p.y; boss.angle = 0;
G.player.angle = Math.PI;
G.graceT = 0;
sandbox.takedown();
check("boss survives takedown", boss.dead===false);

sandbox.loadLevel(0);
skipCS();
p = G.player;

console.log("\n=== 11. Objectives: collect ===");
const obj = G.objectives[0];
p.x = obj.x*TS + TS/2; p.y = obj.y*TS + TS/2;
sandbox.updateObjectives();
check("collect objective marked done", obj.done===true);

console.log("\n=== 12. Win flow: reach exit ===");
G.objectives.forEach(o=>o.done = (o.type!=="reach" && (o.done||true)) );
// mark all non-last done
for(let i=0;i<G.objectives.length-1;i++) G.objectives[i].done = true;
const ex = G.level.exit;
p.x = ex.x*TS + TS/2; p.y = ex.y*TS + TS/2;
sandbox.updateObjectives();
check("final objective done triggers win", G.objectives[G.objectives.length-1].done===true);

console.log("\n=== 13. All 3 levels load cleanly ===");
for(let i=0;i<L.length;i++){
  sandbox.loadLevel(i);
  let ok = !!G.grid && G.enemies.length>0 && G.player && G.objectives.length>=2;
  check("level "+i+" ("+L[i].name+") loads", ok, "enemies="+G.enemies.length);
  if(i===2) check("level 2 has a boss", G.enemies.some(e=>e.boss));
}
for(let i=0;i<L.length;i++){ sandbox.loadLevel(i); }
check("all intro cutscenes have lines", L.every(l=>l.intro&&l.intro.length>0));
check("all outro cutscenes have lines", L.every(l=>l.outro&&l.outro.length>0));

console.log("\n=== 14. Spawn safety (not instantly spotted) ===");
sandbox.loadLevel(0);
G.state="play"; G.graceT = 2.5;
let spottedDuringGrace=false;
for(let i=0;i<150;i++){ sandbox.update(1/60); if(G.enemies.some(e=>e.state==="chase")){spottedDuringGrace=true;break;} }
check("no instant detection during 2.5s grace", !spottedDuringGrace);

console.log("\n=== 15. Rendering does not crash (all levels) ===");
for(let i=0;i<L.length;i++){
  let ok=true, err="";
  try{
    sandbox.loadLevel(i);
    skipCS();
    // force a boss chase so the boss health bar renders
    if(i===2){ const b=G.enemies.find(e=>e.boss); b.state="chase"; }
    for(let f=0;f<20;f++){ sandbox.update(1/60); sandbox.draw(); }
  }catch(ex){ ok=false; err=ex.message; }
  check("render level "+i+" without crashing", ok, err);
}
// render during menu (no grid) and during cutscene
let okMenu=true, errM="";
try{ G.grid=null; sandbox.draw(); }catch(e){ okMenu=false; errM=e.message; }
check("render with no level loaded is safe", okMenu, errM);

console.log("\n=================================================");
console.log("  RESULT:  " + pass + " passed, " + fail + " failed");
console.log("=================================================\n");
process.exit(fail>0?1:0);
