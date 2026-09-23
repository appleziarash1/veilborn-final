
/* ============================================================================
   FORGE OF THE FALLEN KING
   A single-file 3D action RPG built on Three.js (r128, CDN).
   Sections: 1 Config  2 UI refs  3 Three init  4 World  5 Player  6 Weapons
             7 Combat  8 Magic  9 Enemies  10 Bosses  11 NPCs  12 Quests
             13 Inventory  14 Skills  15 Save  16 Audio  17 Effects  18 Loop
             19 Input  20 HUD  21 Story  22 Endings
   ==========================================================================*/
(function(){
'use strict';

/* ==========================================================================
   SECTION 1 - CONFIGURATION
   ========================================================================== */
const CFG = {
  version: '1.0.0',
  saveKey: 'fotfk_save_v1',
  gravity: -26,
  player: {
    radius: 0.55, height: 1.75, walk: 6.2, sprint: 10.4, accel: 34, friction: 11,
    jumpV: 10.2, maxHp: 120, maxStam: 100, maxMana: 70,
    stamRegen: 17, manaRegen: 3.1, hpRegen: 0.25,
    stepDist: 2.35
  },
  combat: {
    parryWindow: 0.22, blockReduction: 0.68, blockStamMult: 0.6,
    critMult: 2.15, backstabMult: 1.6, staggerTime: 2.6, regenDelay: 0.85,
    lockRange: 34, iframeLight: 0.34, iframeRoll: 0.58
  },
  cam: {
    dist: 8.4, minDist: 3.2, maxDist: 18, height: 2.25, look: 1.5,
    sens: 0.0021, smooth: 12, pitchMin: -0.95, pitchMax: 1.15, fov: 62, fovCombat: 66
  },
  world: { sizeX: 1250, sizeZ: 900, segX: 190, segZ: 140, emitRange: 250 },
  maxEnemiesActive: 26,
  maxParticles: 1500
};

/* ==========================================================================
   UTILITIES (deterministic RNG, math, noise, spatial hashing)
   ========================================================================== */
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const damp=(a,b,l,dt)=>lerp(a,b,1-Math.exp(-l*dt));
const sgn=v=>v<0?-1:1;
const TAU=Math.PI*2;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let RNG = mulberry32(1337);
const rnd=()=>RNG();
const rr=(a,b)=>a+(b-a)*RNG();
const ri=(a,b)=>Math.floor(a+(b-a+1)*RNG());
const pick=arr=>arr[Math.floor(RNG()*arr.length)];
function angLerp(a,b,t){let d=((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;return a+d*t;}
function angDelta(a,b){return ((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;}

// Cheap deterministic value noise - used for terrain and prop scattering.
function hash2(x,y){let h=Math.sin(x*127.1+y*311.7)*43758.5453123;return h-Math.floor(h);}
function vnoise(x,y){
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  const a=hash2(xi,yi), b=hash2(xi+1,yi), c=hash2(xi,yi+1), d=hash2(xi+1,yi+1);
  return lerp(lerp(a,b,u),lerp(c,d,u),v);
}
function fbm(x,y,oct,lac,gain){
  let f=1,amp=1,s=0,n=0;
  for(let i=0;i<oct;i++){s+=amp*vnoise(x*f,y*f);n+=amp;f*=lac;amp*=gain;}
  return s/n;
}
function smoothstep(e0,e1,x){const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);}

// terrainHeight: single analytic height field shared by the mesh generator and
// the physics/ground sampler, so no raycasting is needed at runtime.
let H_MODE = 0;
function terrainHeight(x,z){
  const base = fbm(x*0.0042, z*0.0042, 5, 2.05, 0.5) * 26 - 8;
  const ridge = fbm(x*0.011+40, z*0.011-17, 3, 2.1, 0.5);
  let h = base;
  const reg = getRegionAt(x,z);
  if(reg){
    const dx=x-reg.c.x, dz=z-reg.c.z;
    const d=Math.sqrt(dx*dx+dz*dz), t=clamp(1-d/reg.radius,0,1);
    const ring=smoothstep(1.0,1.28,d/reg.radius);
    h += reg.hFn(x,z,t)*t + ring*reg.wallAmp;
    h = lerp(h, lerp(h, reg.plateau, t*t*0.9), reg.flat);
  }
  h += (ridge-0.5)*7*smoothstep(0.35,1.2,Math.abs(x)/CFG.world.sizeX*2);
  // Border mountains keep the player in the world.
  const ex=Math.abs(x)/(CFG.world.sizeX*0.5), ez=Math.abs(z)/(CFG.world.sizeZ*0.5);
  const bd=Math.max(ex,ez);
  h += smoothstep(0.82,1.06,bd)*95;
  return h;
}

// ---- spatial hash for prop/obstacle collision -------------------------------
class SpatialHash{
  constructor(cell){this.cell=cell;this.map=new Map();}
  key(cx,cz){return cx*73856093^cz*19349663;}
  insert(o){
    const c=this.cell;
    const minx=Math.floor((o.x-o.r)/c), maxx=Math.floor((o.x+o.r)/c);
    const minz=Math.floor((o.z-o.r)/c), maxz=Math.floor((o.z+o.r)/c);
    for(let i=minx;i<=maxx;i++)for(let j=minz;j<=maxz;j++){
      const k=this.key(i,j); let a=this.map.get(k); if(!a){a=[];this.map.set(k,a);} a.push(o);
    }
  }
  query(x,z,r,out){
    out.length=0;
    const c=this.cell, i0=Math.floor((x-r)/c), i1=Math.floor((x+r)/c);
    const j0=Math.floor((z-r)/c), j1=Math.floor((z+r)/c);
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
      const a=this.map.get(this.key(i,j)); if(a) for(let n=0;n<a.length;n++) out.push(a[n]);
    }
    return out;
  }
}

/* ==========================================================================
   SECTION 16 - AUDIO (fully procedural Web Audio; no external files)
   ========================================================================== */
const Audio2 = {
  ctx:null, master:null, sfxGain:null, musGain:null, enabled:true,
  init(){
    if(this.ctx) return;
    const AC = window.AudioContext||window.webkitAudioContext; if(!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value=0.7; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value=0.8; this.sfxGain.connect(this.master);
    this.musGain = this.ctx.createGain(); this.musGain.gain.value=0.42; this.musGain.connect(this.master);
    this.startAmbience();
  },
  resume(){ if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
  setMaster(v){ if(this.master) this.master.gain.value=v; },
  setSfx(v){ if(this.sfxGain) this.sfxGain.gain.value=v; },
  setMusic(v){ if(this.musGain) this.musGain.gain.value=v; },
  // ---- low level synth voices -----------------------------------------------
  tone(o){
    if(!this.ctx||!this.enabled) return;
    const t0=this.ctx.currentTime+(o.delay||0);
    const osc=this.ctx.createOscillator(); osc.type=o.type||'sine';
    const g=this.ctx.createGain();
    const f0=o.f0||440, f1=(o.f1===undefined)?f0:o.f1;
    osc.frequency.setValueAtTime(f0,t0);
    if(f1!==f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t0+(o.dur||0.2));
    const vol=(o.vol===undefined?0.3:o.vol);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol), t0+(o.att||0.006));
    g.gain.exponentialRampToValueAtTime(0.0001,t0+(o.dur||0.2));
    let node=osc;
    if(o.filter){const f=this.ctx.createBiquadFilter();f.type=o.filter;f.frequency.value=o.fc||900;f.Q.value=o.q||1;node.connect(f);node=f;}
    node.connect(g); g.connect(o.bus==='mus'?this.musGain:this.sfxGain);
    osc.start(t0); osc.stop(t0+(o.dur||0.2)+0.05);
  },
  noise(o){
    if(!this.ctx||!this.enabled) return;
    const dur=o.dur||0.2, sr=this.ctx.sampleRate, n=Math.max(1,Math.floor(sr*dur));
    const buf=this.ctx.createBuffer(1,n,sr), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    let node=src;
    if(o.type){const f=this.ctx.createBiquadFilter();f.type=o.type;f.frequency.value=o.fc||800;f.Q.value=o.q||1;node.connect(f);node=f;}
    else {const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=o.fc||900;f.Q.value=o.q||0.8;node.connect(f);node=f;}
    const g=this.ctx.createGain();
    const t0=this.ctx.currentTime+(o.delay||0);
    g.gain.setValueAtTime(o.vol===undefined?0.3:o.vol,t0);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    node.connect(g); g.connect(this.sfxGain);
    src.start(t0); src.stop(t0+dur+0.03);
  },
  // ---- named sounds --------------------------------------------------------
  play(name,opt){
    if(!this.ctx||!this.enabled) return;
    opt=opt||{};
    const v=opt.vol===undefined?1:opt.vol;
    switch(name){
      case 'swing': this.noise({dur:0.16,fc:1500+Math.random()*700,q:1.6,vol:0.20*v,type:'bandpass'}); break;
      case 'swing_heavy': this.noise({dur:0.3,fc:420,q:0.9,vol:0.3*v,type:'lowpass'});
        this.tone({type:'sawtooth',f0:180,f1:60,dur:0.26,vol:0.10*v}); break;
      case 'hit': this.noise({dur:0.14,fc:2600,q:1.1,vol:0.34*v});
        this.tone({type:'square',f0:420,f1:120,dur:0.12,vol:0.16*v}); break;
      case 'hit_crit': this.noise({dur:0.2,fc:3600,q:0.9,vol:0.4*v});
        this.tone({type:'square',f0:900,f1:200,dur:0.18,vol:0.2*v});
        this.tone({type:'sine',f0:1800,f1:600,dur:0.24,vol:0.14*v}); break;
      case 'block': this.tone({type:'square',f0:2200,f1:900,dur:0.13,vol:0.22*v});
        this.noise({dur:0.1,fc:4200,q:2.2,vol:0.2*v,type:'highpass'}); break;
      case 'parry': this.tone({type:'square',f0:3000,f1:1400,dur:0.16,vol:0.26*v});
        this.tone({type:'sine',f0:4200,f1:2600,dur:0.3,vol:0.16*v});
        this.noise({dur:0.18,fc:5200,q:1.4,vol:0.22*v,type:'highpass'}); break;
      case 'hurt': this.tone({type:'sawtooth',f0:260,f1:90,dur:0.32,vol:0.24*v});
        this.noise({dur:0.22,fc:600,q:0.8,vol:0.2*v,type:'lowpass'}); break;
      case 'roll': this.noise({dur:0.34,fc:300,q:0.6,vol:0.16*v,type:'lowpass'}); break;
      case 'jump': this.tone({type:'sine',f0:330,f1:640,dur:0.16,vol:0.14*v}); break;
      case 'step': this.noise({dur:0.07,fc:180+Math.random()*120,q:0.9,vol:0.09*v,type:'lowpass'}); break;
      case 'fire': this.noise({dur:0.6,fc:900,q:0.5,vol:0.28*v,type:'lowpass'});
        this.tone({type:'sine',f0:180,f1:60,dur:0.6,vol:0.12*v}); break;
      case 'ice': this.tone({type:'triangle',f0:1600,f1:2600,dur:0.3,vol:0.18*v});
        this.noise({dur:0.35,fc:5200,q:2.1,vol:0.16*v,type:'highpass'}); break;
      case 'lightning': this.noise({dur:0.5,fc:2400,q:0.4,vol:0.36*v,type:'highpass'});
        this.tone({type:'sawtooth',f0:1200,f1:120,dur:0.5,vol:0.18*v}); break;
      case 'heal': this.tone({type:'sine',f0:520,f1:900,dur:0.7,vol:0.16*v});
        this.tone({type:'sine',f0:780,f1:1320,dur:0.9,vol:0.1*v,delay:0.08}); break;
      case 'arcane': this.tone({type:'triangle',f0:300,f1:1200,dur:0.5,vol:0.16*v});
        this.noise({dur:0.4,fc:1800,q:1.2,vol:0.14*v,type:'bandpass'}); break;
      case 'boom': this.noise({dur:0.75,fc:220,q:0.5,vol:0.42*v,type:'lowpass'});
        this.tone({type:'sine',f0:120,f1:32,dur:0.8,vol:0.3*v}); break;
      case 'levelup': [523,659,784,1046].forEach((f,i)=>this.tone({type:'triangle',f0:f,dur:0.42,vol:0.16*v,delay:i*0.11})); break;
      case 'quest': [392,523,659].forEach((f,i)=>this.tone({type:'sine',f0:f,dur:0.4,vol:0.15*v,delay:i*0.1})); break;
      case 'item': this.tone({type:'triangle',f0:900,f1:1500,dur:0.24,vol:0.16*v}); break;
      case 'shrine': [261,392,523,784].forEach((f,i)=>this.tone({type:'sine',f0:f,dur:0.9,vol:0.13*v,delay:i*0.16})); break;
      case 'death': this.tone({type:'sawtooth',f0:220,f1:45,dur:1.8,vol:0.24*v});
        this.noise({dur:1.5,fc:300,q:0.5,vol:0.18*v,type:'lowpass'}); break;
      case 'ui': this.tone({type:'square',f0:760,f1:900,dur:0.07,vol:0.09*v}); break;
      case 'ui_back': this.tone({type:'square',f0:520,f1:400,dur:0.09,vol:0.09*v}); break;
      case 'boss_roar': this.tone({type:'sawtooth',f0:130,f1:44,dur:1.5,vol:0.34*v});
        this.noise({dur:1.4,fc:420,q:0.6,vol:0.3*v,type:'lowpass'});
        this.tone({type:'square',f0:88,f1:60,dur:1.6,vol:0.14*v}); break;
      case 'boss_hit': this.noise({dur:0.2,fc:1500,q:0.8,vol:0.3*v});
        this.tone({type:'square',f0:180,f1:80,dur:0.22,vol:0.18*v}); break;
      case 'beast': this.tone({type:'sawtooth',f0:300,f1:140,dur:0.5,vol:0.2*v});
        this.noise({dur:0.45,fc:800,q:0.7,vol:0.16*v,type:'bandpass'}); break;
      case 'undead': this.tone({type:'triangle',f0:150,f1:90,dur:0.9,vol:0.16*v});
        this.noise({dur:0.8,fc:520,q:0.6,vol:0.12*v,type:'lowpass'}); break;
      case 'flyer': this.noise({dur:0.4,fc:2600,q:2.4,vol:0.12*v,type:'bandpass'}); break;
      case 'teleport': this.tone({type:'sine',f0:1600,f1:200,dur:0.28,vol:0.16*v});
        this.noise({dur:0.26,fc:3000,q:1.4,vol:0.14*v,type:'bandpass'}); break;
      case 'chest': [330,494,660].forEach((f,i)=>this.tone({type:'sine',f0:f,dur:0.35,vol:0.13*v,delay:i*0.08})); break;
      case 'fountain': this.tone({type:'sine',f0:660,f1:990,dur:1.2,vol:0.12*v});
        this.noise({dur:1.0,fc:1200,q:0.8,vol:0.1*v,type:'bandpass'}); break;
    }
  },
  // ---- per-region ambient drone -------------------------------------------
  startAmbience(){
    if(!this.ctx) return;
    const c=this.ctx;
    this.amb=[];
    for(let i=0;i<3;i++){
      const osc=c.createOscillator(); osc.type=i===0?'sine':'triangle';
      osc.frequency.value=[55,82.5,110][i];
      const g=c.createGain(); g.gain.value=0.0;
      const lfo=c.createOscillator(); lfo.frequency.value=0.03+i*0.017;
      const lg=c.createGain(); lg.gain.value=0.018+i*0.006;
      lfo.connect(lg); lg.connect(g.gain);
      osc.connect(g); g.connect(this.musGain);
      osc.start(); lfo.start();
      this.amb.push({osc,g,target:0.03});
    }
    // wind/air bed
    const len=c.sampleRate*4, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    let last=0;
    for(let i=0;i<len;i++){ last=(last+Math.random()*2-1)*0.5; d[i]=last*0.4; }
    const src=c.createBufferSource(); src.buffer=buf; src.loop=true;
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; f.Q.value=0.7;
    const g=c.createGain(); g.gain.value=0.1;
    src.connect(f); f.connect(g); g.connect(this.musGain); src.start();
    this.windFilter=f; this.windGain=g;
  },
  setRegionAmbience(idx){
    if(!this.amb) return;
    const scales=[[55,82.5,110],[49,73.4,98],[41.2,61.7,82.4],[58.3,87.3,116.5],[36.7,55,73.4],[43.7,65.4,87.3],[65.4,98,130.8]];
    const s=scales[clamp(idx,0,6)];
    for(let i=0;i<3;i++){ try{ this.amb[i].osc.frequency.value=s[i]; }catch(e){} }
    if(this.windFilter) this.windFilter.frequency.value=[420,560,300,900,240,180,700][clamp(idx,0,6)];
  },
  setIntensity(v){ if(this.amb) for(let i=0;i<this.amb.length;i++) this.amb[i].g.gain.value=0.012+0.03*v; }
};

/* ==========================================================================
   SECTION 19 - INPUT
   ========================================================================== */
const IN = {
  keys:{}, mouse:{x:0,y:0,dx:0,dy:0,l:false,r:false,lDown:0,rDown:0,lHeld:false},
  wheel:0, locked:false
};
function bindInput(){
  const kd=e=>{
    if(IN.keys[e.code]) return;
    IN.keys[e.code]=true;
    onKeyDown(e);
    if(['Space','Tab','KeyI','KeyM','KeyJ','KeyK','KeyH','KeyE','KeyQ','KeyR',
        'Digit1','Digit2','Digit3','Digit4','Digit5','Escape','KeyF','KeyZ','KeyX','KeyP'].indexOf(e.code)>=0) e.preventDefault();
  };
  const ku=e=>{ IN.keys[e.code]=false; onKeyUp(e); };
  window.addEventListener('keydown',kd,{passive:false});
  window.addEventListener('keyup',ku);
  const cv=renderer.domElement;
  cv.addEventListener('mousedown',e=>{
    Audio2.resume();
    if(e.button===0){IN.mouse.l=true; IN.mouse.lDown=performance.now(); IN.mouse.lHeld=true; onLightPress();}
    if(e.button===2){IN.mouse.r=true; IN.mouse.rDown=performance.now();}
  });
  window.addEventListener('mouseup',e=>{
    if(e.button===0){IN.mouse.l=false; IN.mouse.lHeld=false; onLightRelease();}
    if(e.button===2){IN.mouse.r=false; onHeavyRelease();}
  });
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('mousemove',e=>{
    if(IN.locked){ IN.mouse.dx+=e.movementX||0; IN.mouse.dy+=e.movementY||0; }
    IN.mouse.x=e.clientX; IN.mouse.y=e.clientY;
  });
  document.addEventListener('pointerlockchange',()=>{ IN.locked=(document.pointerLockElement===cv); });
  cv.addEventListener('wheel',e=>{ IN.wheel+=Math.sign(e.deltaY); e.preventDefault(); },{passive:false});
  window.addEventListener('blur',()=>{ IN.keys={}; IN.mouse.l=false; IN.mouse.r=false; });
}

/* ==========================================================================
   SECTION 3 - THREE.JS INITIALISATION (+ lightweight custom bloom composer)
   ========================================================================== */
let renderer, scene, camera, clock, sunLight, hemiLight;
let rtScene, rtBright, rtBlurA, rtBlurB, fsQuad, fsCam, fsScene, bloomMatA, bloomMatB, compMat;
let bloomAmount=1.0, renderScale=1.0, shadowsOn=1, farDist=340;
let blankTex=null;   // 1x1 black texture used when bloom is off

function initThree(){
  renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:'high-performance', stencil:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  document.getElementById('gl').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a2620, 0.0075);
  scene.background = new THREE.Color(0x151318);

  camera = new THREE.PerspectiveCamera(CFG.cam.fov, window.innerWidth/window.innerHeight, 0.28, farDist+220);
  clock = new THREE.Clock();

  hemiLight = new THREE.HemisphereLight(0x8fa0bb, 0x2a2118, 0.55);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xffe0b0, 1.15);
  sunLight.position.set(-90, 140, 70);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024,1024);
  const sc = sunLight.shadow.camera;
  sc.left=-70; sc.right=70; sc.top=70; sc.bottom=-70; sc.near=1; sc.far=420;
  sunLight.shadow.bias = -0.0016;
  scene.add(sunLight); scene.add(sunLight.target);

  const opts={minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat};
  blankTex=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat);
  blankTex.needsUpdate=true;
  // The scene target is sized at renderScale * native resolution, so the
  // High preset renders at true display resolution and lower presets simply
  // render fewer pixels (then upscale in the composite pass).
  const w=Math.max(64,Math.floor(window.innerWidth*renderScale));
  const h=Math.max(64,Math.floor(window.innerHeight*renderScale));
  rtScene = new THREE.WebGLRenderTarget(w,h,opts);
  rtBright= new THREE.WebGLRenderTarget(Math.floor(w/2),Math.floor(h/2),opts);
  rtBlurA = new THREE.WebGLRenderTarget(Math.floor(w/2),Math.floor(h/2),opts);
  rtBlurB = new THREE.WebGLRenderTarget(Math.floor(w/2),Math.floor(h/2),opts);
  fsCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), null);
  fsScene = new THREE.Scene(); fsScene.add(fsQuad);
  const V = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
  bloomMatA = new THREE.ShaderMaterial({
    uniforms:{tDiffuse:{value:null}, threshold:{value:0.62}, amount:{value:1.0}},
    vertexShader:V,
    fragmentShader:'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float threshold; uniform float amount;\n'+
      'void main(){ vec4 c=texture2D(tDiffuse,vUv); float l=dot(c.rgb,vec3(0.299,0.587,0.114));\n'+
      'float k=max(0.0,l-threshold)/max(0.0001,1.0-threshold);\n'+
      'gl_FragColor=vec4(c.rgb*k*amount, 1.0); }'
  });
  bloomMatB = new THREE.ShaderMaterial({
    uniforms:{tDiffuse:{value:null}, dir:{value:new THREE.Vector2(1,0)}, texel:{value:new THREE.Vector2(1/512,1/512)}},
    vertexShader:V,
    fragmentShader:'varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 dir; uniform vec2 texel;\n'+
      'void main(){ vec3 s=texture2D(tDiffuse,vUv).rgb*0.227;\n'+
      'vec2 o1=dir*texel*1.3846; vec2 o2=dir*texel*3.2308;\n'+
      's += (texture2D(tDiffuse,vUv+o1).rgb + texture2D(tDiffuse,vUv-o1).rgb)*0.3162;\n'+
      's += (texture2D(tDiffuse,vUv+o2).rgb + texture2D(tDiffuse,vUv-o2).rgb)*0.0702;\n'+
      'gl_FragColor=vec4(s,1.0); }'
  });
  compMat = new THREE.ShaderMaterial({
    uniforms:{tScene:{value:null}, tBloom:{value:null}, strength:{value:0.95}, vig:{value:0.5}, tint:{value:new THREE.Color(1,0.97,0.93)}},
    vertexShader:V,
    fragmentShader:'varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform float strength; uniform float vig; uniform vec3 tint;\n'+
      'void main(){ vec3 base=texture2D(tScene,vUv).rgb; vec3 bloom=texture2D(tBloom,vUv).rgb;\n'+
      'vec3 c=base+bloom*strength; float d=distance(vUv,vec2(0.5));\n'+
      'c*=1.0-smoothstep(0.42,0.98,d)*vig; c=tint*c;\n'+
      'gl_FragColor=vec4(c,1.0); }'
  });
  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);
}
function resizeRenderer(){
  if(!renderer) return;
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setSize(w,h);
  camera.aspect=w/h; camera.updateProjectionMatrix();
  const rw=Math.max(64,Math.floor(w*renderScale)), rh=Math.max(64,Math.floor(h*renderScale));
  rtScene.setSize(rw,rh);
  rtBright.setSize(Math.floor(rw/2),Math.floor(rh/2));
  rtBlurA.setSize(Math.floor(rw/2),Math.floor(rh/2));
  rtBlurB.setSize(Math.floor(rw/2),Math.floor(rh/2));
}
function renderComposer(){
  // The scene is always drawn into rtScene, which is renderScale*0.5 of the
  // canvas — so lowering quality genuinely lowers fill cost instead of
  // accidentally switching to a full-resolution direct render.
  renderer.setRenderTarget(rtScene);
  renderer.render(scene,camera);
  if(bloomAmount>0.01){
    fsQuad.material=bloomMatA; bloomMatA.uniforms.tDiffuse.value=rtScene.texture;
    bloomMatA.uniforms.amount.value=bloomAmount;
    renderer.setRenderTarget(rtBright); renderer.render(fsScene,fsCam);
    const tw=1/Math.max(1,rtBright.width), th=1/Math.max(1,rtBright.height);
    fsQuad.material=bloomMatB;
    bloomMatB.uniforms.tDiffuse.value=rtBright.texture;
    bloomMatB.uniforms.dir.value.set(1,0); bloomMatB.uniforms.texel.value.set(tw,th);
    renderer.setRenderTarget(rtBlurA); renderer.render(fsScene,fsCam);
    bloomMatB.uniforms.tDiffuse.value=rtBlurA.texture;
    bloomMatB.uniforms.dir.value.set(0,1);
    renderer.setRenderTarget(rtBlurB); renderer.render(fsScene,fsCam);
  }
  fsQuad.material=compMat;
  compMat.uniforms.tScene.value=rtScene.texture;
  compMat.uniforms.tBloom.value=(bloomAmount>0.01?rtBlurB.texture:blankTex);
  compMat.uniforms.strength.value=0.85*bloomAmount;
  renderer.setRenderTarget(null);
  renderer.render(fsScene,fsCam);
}

/* ==========================================================================
   SECTION 17b - ADAPTIVE QUALITY
   Watches the smoothed frame rate and steps the expensive effects down (or
   back up) so the game stays playable on low-end integrated graphics. Only
   render resolution, bloom and shadow resolution change - never gameplay.
   ========================================================================== */
const Quality = {
  level:3,                    // 3 = full, 0 = minimum
  levels:[
    {name:'Minimal', bloom:0.0, shadows:0, shadowSize:512,  scale:0.62, parts:0.35, fog:0.0055, far:300},
    {name:'Low',     bloom:0.0, shadows:1, shadowSize:512,  scale:0.75, parts:0.55, fog:0.0065, far:340},
    {name:'Medium',  bloom:0.5, shadows:1, shadowSize:1024, scale:0.85, parts:0.8,  fog:0.0075, far:340},
    {name:'High',    bloom:1.0, shadows:1, shadowSize:1024, scale:1.0,  parts:1.0,  fog:0.0075, far:360}
  ],
  auto:true, lowCount:0, highCount:0, cooldown:2.0,
  init(){ this.level=3; this.apply(3,true); },
  /* manual selection from the settings screen (disables the auto watcher) */
  set(index){ this.auto=false; this.apply(clamp(index,0,3),true); },
  apply(i,silent){
    const q=this.levels[clamp(i,0,3)];
    this.level=clamp(i,0,3);
    renderScale=q.scale;
    bloomAmount=q.bloom;
    partsScale=q.parts;
    if(scene&&scene.fog) scene.fog.density=q.fog;
    shadowsOn=q.shadows;
    if(renderer){
      renderer.shadowMap.enabled=q.shadows>0;
      if(sunLight){
        const size=q.shadowSize;
        if(sunLight.shadow.mapSize.width!==size){
          sunLight.shadow.mapSize.set(size,size);
          if(sunLight.shadow.map){ sunLight.shadow.map.dispose(); sunLight.shadow.map=null; }
        }
      }
      resizeRenderer();
    }
    if(!silent&&typeof HUD!=='undefined') HUD.toast('Graphics: '+q.name);
  },
  update(dt){
    if(!this.auto) return;
    this.cooldown-=dt;
    if(this.cooldown>0) return;
    const f=Game.fps;
    if(!isFinite(f)||f<=0) return;
    if(f<34){ this.lowCount++; this.highCount=0; }
    else if(f>56){ this.highCount++; this.lowCount=0; }
    else { this.lowCount=Math.max(0,this.lowCount-1); this.highCount=Math.max(0,this.highCount-1); }
    if(this.lowCount>=8&&this.level>0){ this.lowCount=0; this.cooldown=4; this.apply(this.level-1); }
    else if(this.highCount>=14&&this.level<3){ this.highCount=0; this.cooldown=8; this.apply(this.level+1); }
  }
};

/* ==========================================================================
   SECTION 17 - EFFECTS (particles, shock rings, weapon trails, floating text)
   ========================================================================== */
let partsScale=1.0, shakeSetting=1.0, diffIndex=1;
function particlesOff(){ return partsScale<=0.01; }

const FX = {
  pos:null, col:null, vel:null, life:null, maxlife:null, size:null, head:0,
  init(){
    const N=CFG.maxParticles;
    const g=new THREE.BufferGeometry();
    this.pos=new Float32Array(N*3); this.col=new Float32Array(N*3); this.size=new Float32Array(N);
    this.vel=new Float32Array(N*3); this.life=new Float32Array(N); this.maxlife=new Float32Array(N);
    for(let i=0;i<N;i++) this.pos[i*3+1]=-9999;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos,3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col,3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size,1));
    const mat=new THREE.ShaderMaterial({
      uniforms:{},
      vertexShader:'attribute float size; varying vec3 vCol;\n'+
        'void main(){ vCol=color; vec4 mv=modelViewMatrix*vec4(position,1.0);\n'+
        'gl_PointSize=size*(300.0/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }',
      fragmentShader:'varying vec3 vCol;\n'+
        'void main(){ vec2 d=gl_PointCoord-vec2(0.5); float a=smoothstep(0.5,0.05,length(d));\n'+
        'gl_FragColor=vec4(vCol,a); }',
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, vertexColors:true
    });
    this.points=new THREE.Points(g,mat);
    this.points.frustumCulled=false;
    scene.add(this.points);
    this.geo=g;
    this.slashPool=[]; this.ringPool=[]; this.trailPool=[];
    const slashG=new THREE.RingGeometry(0.35,1.0,22,1,0,Math.PI*1.2);
    for(let i=0;i<14;i++){
      const m=new THREE.Mesh(slashG, new THREE.MeshBasicMaterial({color:0xffdca8,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      m.visible=false; scene.add(m); this.slashPool.push(m);
    }
    const ringG=new THREE.RingGeometry(0.86,1.0,44);
    for(let i=0;i<22;i++){
      const m=new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({color:0xffaa55,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      m.rotation.x=-Math.PI/2; m.visible=false; scene.add(m); this.ringPool.push(m);
    }
    for(let i=0;i<10;i++){
      const gq=new THREE.BufferGeometry(); const cnt=16, arr=new Float32Array(cnt*3);
      gq.setAttribute('position',new THREE.BufferAttribute(arr,3));
      const ln=new THREE.Line(gq,new THREE.LineBasicMaterial({color:0xffe6c0,transparent:true,opacity:0,blending:THREE.AdditiveBlending}));
      ln.frustumCulled=false; ln.visible=false; scene.add(ln); this.trailPool.push({ln,arr,cnt});
    }
    this.shakeT=0; this.shakeAmp=0; this.shakeOff=new THREE.Vector3();
  },
  spawn(x,y,z,vx,vy,vz,r,g2,b,size,life){
    if(particlesOff()) return;
    const i=this.head; this.head=(this.head+1)%CFG.maxParticles;
    this.pos[i*3]=x; this.pos[i*3+1]=y; this.pos[i*3+2]=z;
    this.vel[i*3]=vx; this.vel[i*3+1]=vy; this.vel[i*3+2]=vz;
    this.col[i*3]=r; this.col[i*3+1]=g2; this.col[i*3+2]=b;
    this.size[i]=size; this.life[i]=life; this.maxlife[i]=life;
  },
  burst(x,y,z,count,opt){
    opt=opt||{};
    const spd=opt.speed===undefined?6:opt.speed, life=opt.life||0.7;
    const sz=opt.size||0.5, c=opt.color||[1,0.7,0.3];
    const spread=opt.spread===undefined?1:opt.spread, up=opt.up===undefined?0.6:opt.up;
    const jit=opt.jitter===undefined?0.4:opt.jitter;
    for(let i=0;i<count;i++){
      const th=Math.random()*TAU, ph=Math.random()*Math.PI;
      const s=spd*(0.4+Math.random()*0.9);
      const j=v=>clamp(v+(Math.random()-0.5)*jit,0,2);
      this.spawn(x+rr(-0.3,0.3)*spread, y+rr(-0.2,0.3), z+rr(-0.3,0.3)*spread,
        Math.cos(th)*Math.sin(ph)*s, Math.abs(Math.sin(ph))*s*up+rr(0,2), Math.sin(th)*Math.sin(ph)*s,
        j(c[0]), j(c[1]), j(c[2]), sz*rr(0.6,1.4), life*rr(0.7,1.3));
    }
  },
  update(dt){
    const p=this.pos, v=this.vel, l=this.life, ml=this.maxlife, s=this.size;
    const g=-9*dt, drag=Math.pow(0.94,dt*60);
    for(let i=0;i<CFG.maxParticles;i++){
      if(l[i]<=0){ if(p[i*3+1]>-9000) p[i*3+1]=-9999; continue; }
      l[i]-=dt;
      v[i*3]*=drag; v[i*3+1]=v[i*3+1]*drag+g; v[i*3+2]*=drag;
      p[i*3]+=v[i*3]*dt; p[i*3+1]+=v[i*3+1]*dt; p[i*3+2]+=v[i*3+2]*dt;
      if(l[i]<ml[i]*0.45) s[i]*=Math.max(0,1-dt*2.4);
      if(l[i]<=0||s[i]<0.012){ l[i]=0; s[i]=0; p[i*3+1]=-9999; }
    }
    this.geo.attributes.position.needsUpdate=true;
    this.geo.attributes.color.needsUpdate=true;
    this.geo.attributes.size.needsUpdate=true;
    for(let i=0;i<this.slashPool.length;i++){ const m=this.slashPool[i]; if(m.visible){
      m.material.opacity-=dt*6.5; m.scale.multiplyScalar(1+dt*2.4); if(m.material.opacity<=0) m.visible=false; } }
    for(let i=0;i<this.ringPool.length;i++){ const m=this.ringPool[i]; if(m.visible){
      m.material.opacity-=dt*2.4; const gr=m.userData.grow||3; m.scale.x+=gr*dt; m.scale.y+=gr*dt; m.scale.z+=gr*dt;
      if(m.material.opacity<=0) m.visible=false; } }
    for(let i=0;i<this.trailPool.length;i++){ const t=this.trailPool[i]; if(t.ln.visible){
      t.ln.material.opacity-=dt*7; if(t.ln.material.opacity<=0) t.ln.visible=false; } }
    if(this.shakeT>0) this.shakeT-=dt;
    const amp=(this.shakeT>0?this.shakeAmp:0)*shakeSetting;
    this.shakeOff.set(rr(-amp,amp), rr(-amp,amp), rr(-amp,amp));
  },
  shake(amp,dur){ this.shakeAmp=Math.max(this.shakeAmp,amp); this.shakeT=Math.max(this.shakeT,dur||0.3); },
  slash(x,y,z,rot,size,color){
    const m=this.slashPool.find(o=>!o.visible); if(!m) return;
    m.visible=true; m.position.set(x,y,z); m.rotation.set(rr(-0.3,0.3),rot+rr(-0.25,0.25),rr(-0.4,0.4));
    m.scale.setScalar(size||1.4);
    m.material.color.setHex(color===undefined?0xffe0b0:color);
    m.material.opacity=0.85;
  },
  shock(x,y,z,radius,color){
    const m=this.ringPool.find(o=>!o.visible); if(!m) return;
    m.visible=true; m.position.set(x,y+0.1,z); m.scale.setScalar(radius*0.28);
    m.material.color.setHex(color===undefined?0xffaa55:color); m.material.opacity=0.9;
    m.userData.grow=radius/0.5;
  },
  trail(points,color){
    const t=this.trailPool.find(o=>!o.ln.visible); if(!t) return;
    for(let i=0;i<t.cnt;i++){
      const p=points[Math.min(points.length-1,i)];
      t.arr[i*3]=p.x; t.arr[i*3+1]=p.y; t.arr[i*3+2]=p.z;
    }
    t.ln.geometry.attributes.position.needsUpdate=true;
    t.ln.material.color.setHex(color===undefined?0xffe0b0:color);
    t.ln.material.opacity=0.9; t.ln.visible=true;
  }
};

// Floating combat text (pooled DOM elements: crisp and cheap)
const DmgText = {
  pool:[], active:[],
  init(){ for(let i=0;i<30;i++){ const d=document.createElement('div');
      d.style.cssText='position:absolute;font-size:15px;letter-spacing:.04em;text-shadow:0 2px 4px #000;pointer-events:none;font-weight:bold;white-space:nowrap;';
      d.style.display='none'; document.getElementById('hud').appendChild(d); this.pool.push(d);} },
  show(worldPos, text, color, big){
    const d=this.pool.pop(); if(!d) return;
    d.textContent=text; d.style.color=color; d.style.fontSize=(big?22:15)+'px';
    d._world=worldPos.clone(); d._life=big?1.2:0.95; d._max=d._life;
    d._vy=big?1.6:1.15; d._vx=(Math.random()-0.5)*1.3;
    this.active.push(d);
  },
  update(dt){
    for(let i=this.active.length-1;i>=0;i--){
      const d=this.active[i];
      d._life-=dt; d._world.y+=d._vy*dt; d._world.x+=d._vx*dt; d._vy*=Math.pow(0.9,dt*60);
      if(d._life<=0){ d.style.display='none'; this.active.splice(i,1); this.pool.push(d); continue; }
      const v=d._world.clone().project(camera);
      if(v.z>1){ d.style.display='none'; continue; }
      d.style.display='block';
      d.style.left=((v.x*0.5+0.5)*window.innerWidth)+'px';
      d.style.top=((-v.y*0.5+0.5)*window.innerHeight)+'px';
      d.style.transform='translate(-50%,-50%) scale('+(0.85+0.35*(d._life/d._max)).toFixed(2)+')';
      d.style.opacity=clamp(d._life/d._max*1.5,0,1).toFixed(2);
    }
  }
};

/* ==========================================================================
   SECTION 4a - PROCEDURAL MATERIALS + TEXTURE FACTORY
   ========================================================================== */
function canvasTex(size, fn, repeat){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d'); fn(ctx,size);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  if(repeat) t.repeat.set(repeat,repeat);
  t.anisotropy=4;
  return t;
}
function noiseFill(ctx,size,base,amp){
  const img=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const n=fbm(x/16,y/16,4,2.1,0.5);
    const n2=fbm(x/5+13,y/5+7,2,2,0.6);
    const v=clamp(base+(n-0.5)*amp+(n2-0.5)*amp*0.35,0,1);
    const i=(y*size+x)*4;
    img.data[i]=v*255; img.data[i+1]=v*255; img.data[i+2]=v*255; img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
}
const TEX = {
  init(){
    this.rock = canvasTex(128,(c,s)=>noiseFill(c,s,0.62,0.5),1);
    this.dirt = canvasTex(96,(c,s)=>noiseFill(c,s,0.55,0.6),1);
    this.bark = canvasTex(64,(c,s)=>{
      const img=c.createImageData(s,s);
      for(let y=0;y<s;y++)for(let x=0;x<s;x++){
        const v=0.45+fbm(x/6,y/40,3,2,0.5)*0.5;
        const i=(y*s+x)*4; img.data[i]=v*255; img.data[i+1]=v*230; img.data[i+2]=v*200; img.data[i+3]=255;
      }
      c.putImageData(img,0,0);
    },1);
    this.crystal = canvasTex(64,(c,s)=>{
      const img=c.createImageData(s,s);
      for(let y=0;y<s;y++)for(let x=0;x<s;x++){
        const v=clamp(0.55+fbm(x/9,y/9,3,2,0.55)*0.7,0,1);
        const i=(y*s+x)*4; img.data[i]=v*200; img.data[i+1]=v*255; img.data[i+2]=v*255; img.data[i+3]=255;
      }
      c.putImageData(img,0,0);
    },1);
    this.ice = canvasTex(128,(c,s)=>{
      const img=c.createImageData(s,s);
      for(let y=0;y<s;y++)for(let x=0;x<s;x++){
        const v=clamp(0.7+fbm(x/12,y/12,4,2.1,0.5)*0.45,0,1);
        const i=(y*s+x)*4; img.data[i]=v*235; img.data[i+1]=v*250; img.data[i+2]=255; img.data[i+3]=255;
      }
      c.putImageData(img,0,0);
    },1);
    this.lava = canvasTex(128,(c,s)=>{
      const img=c.createImageData(s,s);
      for(let y=0;y<s;y++)for(let x=0;x<s;x++){
        const n=fbm(x/14,y/14,4,2.2,0.55);
        const v=Math.pow(clamp(n*1.35,0,1),1.6);
        const i=(y*s+x)*4;
        img.data[i]=(0.25+v)*255; img.data[i+1]=(0.05+v*0.55)*255; img.data[i+2]=(0.02+v*0.12)*255; img.data[i+3]=255;
      }
      c.putImageData(img,0,0);
    },1);
    this.stone = canvasTex(128,(c,s)=>{
      const img=c.createImageData(s,s);
      for(let y=0;y<s;y++)for(let x=0;x<s;x++){
        const bx=(x%32)/32, by=(y%32)/32;
        const mortar=(bx<0.05||by<0.05)?0.35:1.0;
        const v=clamp((0.5+fbm(x/7,y/7,3,2,0.5)*0.6)*mortar,0,1);
        const i=(y*s+x)*4; img.data[i]=v*255; img.data[i+1]=v*250; img.data[i+2]=v*240; img.data[i+3]=255;
      }
      c.putImageData(img,0,0);
    },1);
  },
  std(color,rough,metal,tex){
    return new THREE.MeshStandardMaterial({color:color, roughness:rough===undefined?0.9:rough, metalness:metal===undefined?0.03:metal, map:tex||null});
  },
  emissive(color,inten,tex){
    return new THREE.MeshStandardMaterial({color:color, emissive:color, emissiveIntensity:inten||1.0, roughness:0.6, metalness:0.0, map:tex||null});
  }
};

/* ==========================================================================
   SECTION 4b - WORLD REGION DEFINITIONS
   Each region defines: plateau height, height modulator, rim amplitude,
   atmosphere (fog, sun, hemisphere), prop palette and a boss arena anchor.
   ========================================================================== */
const REGIONS = [
  { id:'village', name:'ASHEN VILLAGE', sub:'The Hearth is Cold', idx:0,
    c:{x:-460,z:0}, radius:205, plateau:4, flat:0.55, wallAmp:10,
    fogColor:0x3b332a, fogD:0.0125, hemi:[0x8d8676,0x2f2822,0.5], sun:0xffca8a, sunI:0.85, sky:0x1b1713,
    ground:0x4a4239, rock:0x54504a, acc:[0xff8a3d,0xffd070],
    hFn:(x,z,t)=>Math.sin(x*0.06)*1.2+Math.cos(z*0.07)*1.2+t*2.0,
    arena:{x:-430,z:120,r:26} },
  { id:'forest', name:'WHISPERING FOREST', sub:'Where Roots Remember', idx:1,
    c:{x:-190,z:-190}, radius:215, plateau:6, flat:0.42, wallAmp:14,
    fogColor:0x1e2a22, fogD:0.017, hemi:[0x7fa08a,0x1d2018,0.55], sun:0xbfe0b0, sunI:0.62, sky:0x101a13,
    ground:0x2c3a28, rock:0x3a4636, acc:[0x9fe07a,0x5fd6a0],
    hFn:(x,z,t)=>Math.sin(x*0.05)*1.8+Math.sin(z*0.045)*1.8+t*3.5,
    arena:{x:-160,z:-230,r:28} },
  { id:'mines', name:'FORGOTTEN MINES', sub:'Digging Toward the Dark', idx:2,
    c:{x:40,z:150}, radius:200, plateau:2, flat:0.6, wallAmp:12,
    fogColor:0x2c241c, fogD:0.019, hemi:[0x8a7a5c,0x1a1410,0.42], sun:0xffb877, sunI:0.5, sky:0x14100c,
    ground:0x463b2e, rock:0x504434, acc:[0xffb040,0xff8030],
    hFn:(x,z,t)=>Math.sin(x*0.08)*2.2+Math.cos(z*0.09)*2.2-t*2.0,
    arena:{x:70,z:170,r:26} },
  { id:'caverns', name:'CRYSTAL CAVERNS', sub:'Light Beneath the World', idx:3,
    c:{x:-140,z:340}, radius:200, plateau:-6, flat:0.7, wallAmp:16,
    fogColor:0x101c2c, fogD:0.032, hemi:[0x6fa8d0,0x0a1018,0.6], sun:0x88c8ff, sunI:0.32, sky:0x050a12,
    ground:0x2a3646, rock:0x36485c, acc:[0x5fd0e8,0x8f7ad8],
    hFn:(x,z,t)=>Math.sin(x*0.07)*2.6+Math.cos(z*0.06)*2.6,
    arena:{x:-120,z:390,r:28} },
  { id:'cathedral', name:'FROZEN CATHEDRAL', sub:'A Prayer Held in Ice', idx:4,
    c:{x:200,z:360}, radius:205, plateau:10, flat:0.55, wallAmp:15,
    fogColor:0x37404c, fogD:0.016, hemi:[0xc8dcef,0x2a3038,0.72], sun:0xdceaff, sunI:0.72, sky:0x1c2430,
    ground:0xb9c8d6, rock:0x8fa3b5, acc:[0xdff0ff,0x7fd8ff],
    hFn:(x,z,t)=>Math.sin(x*0.05)*1.5+Math.cos(z*0.055)*1.5+t*4,
    arena:{x:230,z:400,r:30} },
  { id:'citadel', name:'SCORCHED CITADEL', sub:'The Throne of Cinders', idx:5,
    c:{x:420,z:60}, radius:210, plateau:6, flat:0.6, wallAmp:18,
    fogColor:0x2b1a12, fogD:0.020, hemi:[0x9a6a48,0x1a0d07,0.42], sun:0xffa050, sunI:0.55, sky:0x170a06,
    ground:0x3a2c22, rock:0x44302a, acc:[0xff7a2a,0xffd070],
    hFn:(x,z,t)=>Math.sin(x*0.06)*2.0+Math.cos(z*0.07)*2.0+t*2.5,
    arena:{x:440,z:80,r:32} },
  { id:'sunforge', name:'THE SUN FORGE', sub:'Where Light Was Made', idx:6,
    c:{x:150,z:-40}, radius:215, plateau:14, flat:0.6, wallAmp:20,
    fogColor:0x4a3a24, fogD:0.011, hemi:[0xffe0a8,0x3a2810,0.66], sun:0xfff0c0, sunI:1.0, sky:0x2a2014,
    ground:0x5a4a34, rock:0x6a5a40, acc:[0xffd070,0xffb040],
    hFn:(x,z,t)=>Math.sin(x*0.04)*2.0+Math.cos(z*0.045)*2.0+t*3.0,
    arena:{x:150,z:-80,r:40} }
];
function getRegionAt(x,z){
  let best=null,bd=1e9;
  for(let i=0;i<REGIONS.length;i++){
    const R=REGIONS[i], dx=x-R.c.x, dz=z-R.c.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d<R.radius*1.42 && d<bd){ bd=d; best=R; }
  }
  return best;
}
function regionT(x,z,R){
  const dx=x-R.c.x, dz=z-R.c.z;
  return clamp(1-Math.sqrt(dx*dx+dz*dz)/R.radius,0,1);
}
function regionById(id){ for(let i=0;i<REGIONS.length;i++) if(REGIONS[i].id===id) return REGIONS[i]; return REGIONS[0]; }
