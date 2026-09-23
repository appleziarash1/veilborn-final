
/* ==========================================================================
   SECTION 9 - ENEMIES
   26 enemy types across 8 archetypes, each with its own stats, silhouette,
   detection/patrol/chase/attack AI, hit reaction and death behaviour.
   Archetypes: melee, ranged, flying, tank, assassin, mage, beast, elite
   ========================================================================== */
const ENEMY_TYPES = {
  ashcreeper:{ name:'Ash Creeper', arch:'melee', tier:1, hp:54, dmg:9, def:0.05, spd:3.0, r:0.95, h:1.7,
    xp:26, gold:5, det:22, atkRange:2.6, atkCD:1.5, wind:0.4, staggerRes:8, body:0x4a4038, accent:0x8a5a30,
    regions:['village','citadel','sunforge'], sound:'undead' },
  charredhound:{ name:'Charred Hound', arch:'beast', tier:1, hp:46, dmg:11, def:0.02, spd:5.4, r:0.8, h:1.2,
    xp:30, gold:5, det:30, atkRange:2.4, atkCD:1.1, wind:0.28, staggerRes:6, body:0x3f2a1c, accent:0xff6a20,
    regions:['village','citadel','mines'], sound:'beast' },
  emberling:{ name:'Emberling', arch:'ranged', tier:1, hp:40, dmg:12, def:0.0, spd:2.6, r:0.75, h:1.5,
    xp:32, gold:6, det:28, atkRange:19, atkCD:2.3, wind:0.7, staggerRes:5, body:0x5a2a10, accent:0xff8a3d,
    regions:['village','citadel','sunforge'], sound:'fire', proj:{speed:17,color:0xff7a2a,size:0.42} },
  bonevestige:{ name:'Bone Vestige', arch:'melee', tier:1, hp:62, dmg:13, def:0.12, spd:2.6, r:0.9, h:1.9,
    xp:34, gold:7, det:24, atkRange:2.8, atkCD:1.7, wind:0.5, staggerRes:10, body:0xb9b0a0, accent:0x6a7a5a,
    regions:['mines','caverns','cathedral'], sound:'undead' },
  gravewright:{ name:'Gravewright', arch:'mage', tier:2, hp:78, dmg:16, def:0.05, spd:2.4, r:0.9, h:2.0,
    xp:58, gold:14, det:30, atkRange:22, atkCD:3.2, wind:0.9, staggerRes:10, body:0x2e2438, accent:0x9f6aff,
    regions:['forest','mines','caverns','cathedral'], sound:'undead', summon:'bonevestige' },
  rookswoop:{ name:'Rookswoop', arch:'flying', tier:1, hp:52, dmg:11, def:0.02, spd:6.2, r:0.85, h:1.1,
    xp:36, gold:6, det:32, atkRange:3.0, atkCD:1.6, wind:0.35, staggerRes:6, body:0x241f28, accent:0x7a6a8a,
    regions:['forest','caverns','citadel'], sound:'flyer', fly:6.5 },
  thornhusk:{ name:'Thornhusk', arch:'beast', tier:2, hp:112, dmg:15, def:0.15, spd:3.4, r:1.15, h:2.1,
    xp:56, gold:11, det:26, atkRange:3.2, atkCD:1.9, wind:0.55, staggerRes:16, body:0x33421f, accent:0x9fe07a,
    regions:['forest'], sound:'beast' },
  whisperling:{ name:'Whisperling', arch:'assassin', tier:2, hp:64, dmg:22, def:0.03, spd:5.8, r:0.8, h:1.7,
    xp:62, gold:13, det:34, atkRange:2.6, atkCD:1.8, wind:0.3, staggerRes:7, body:0x22282a, accent:0x5fd6a0,
    regions:['forest','caverns'], sound:'undead', ghost:true, dash:true },
  sporecaller:{ name:'Sporecaller', arch:'ranged', tier:2, hp:74, dmg:14, def:0.05, spd:2.7, r:0.95, h:1.9,
    xp:54, gold:12, det:30, atkRange:20, atkCD:2.6, wind:0.8, staggerRes:9, body:0x3a3f26, accent:0xbfe07a,
    regions:['forest','caverns'], sound:'beast', proj:{speed:15,color:0x9fe07a,size:0.5}, dot:true },
  mirestalker:{ name:'Mire Stalker', arch:'beast', tier:2, hp:98, dmg:17, def:0.08, spd:4.6, r:1.0, h:1.6,
    xp:60, gold:12, det:30, atkRange:2.8, atkCD:1.4, wind:0.36, staggerRes:11, body:0x26301f, accent:0x6ab060,
    regions:['forest','caverns'], sound:'beast', leap:true },
  pithauler:{ name:'Pit Hauler', arch:'tank', tier:2, hp:170, dmg:22, def:0.28, spd:2.1, r:1.35, h:2.6,
    xp:88, gold:18, det:24, atkRange:3.6, atkCD:2.6, wind:0.85, staggerRes:26, body:0x4b3f30, accent:0xffb040,
    regions:['mines','citadel'], sound:'boss_hit' },
  shaleslinger:{ name:'Shale Slinger', arch:'ranged', tier:2, hp:80, dmg:16, def:0.1, spd:2.4, r:0.95, h:2.0,
    xp:58, gold:14, det:32, atkRange:24, atkCD:2.8, wind:0.75, staggerRes:12, body:0x4a4438, accent:0xd0b060,
    regions:['mines','caverns','cathedral'], sound:'hit', proj:{speed:20,color:0xd0b060,size:0.55}, knock:true },
  rustsentinel:{ name:'Rust Sentinel', arch:'elite', tier:3, hp:240, dmg:28, def:0.4, spd:2.9, r:1.3, h:2.9,
    xp:150, gold:34, det:30, atkRange:3.8, atkCD:2.2, wind:0.6, staggerRes:34, body:0x5a4636, accent:0xff9a3d,
    regions:['mines','citadel'], sound:'boss_hit', guard:true },
  caveshrieker:{ name:'Cave Shrieker', arch:'flying', tier:2, hp:70, dmg:15, def:0.03, spd:7.0, r:0.85, h:1.1,
    xp:60, gold:13, det:36, atkRange:3.0, atkCD:1.5, wind:0.3, staggerRes:8, body:0x2a2634, accent:0x5fd0e8,
    regions:['caverns','mines'], sound:'flyer', fly:5.5, scream:true },
  prismwisp:{ name:'Prism Wisp', arch:'mage', tier:3, hp:96, dmg:22, def:0.06, spd:3.4, r:0.85, h:1.9,
    xp:96, gold:22, det:34, atkRange:23, atkCD:2.6, wind:0.85, staggerRes:12, body:0x2a3a4c, accent:0x8fead8,
    regions:['caverns'], sound:'arcane', proj:{speed:19,color:0x8fead8,size:0.5}, blink:true },
  crystalgolem:{ name:'Crystal Golem', arch:'tank', tier:3, hp:280, dmg:30, def:0.45, spd:2.3, r:1.5, h:3.2,
    xp:170, gold:36, det:26, atkRange:4.0, atkCD:2.7, wind:0.9, staggerRes:40, body:0x35505f, accent:0x5fd0e8,
    regions:['caverns'], sound:'boss_hit', shatter:true },
  sharddancer:{ name:'Shard Dancer', arch:'assassin', tier:3, hp:120, dmg:32, def:0.08, spd:6.4, r:0.85, h:1.9,
    xp:130, gold:26, det:36, atkRange:3.0, atkCD:1.7, wind:0.28, staggerRes:12, body:0x33505f, accent:0xa8f0ff,
    regions:['caverns','cathedral'], sound:'ice', ghost:true, dash:true },
  frostwraith:{ name:'Frost Wraith', arch:'mage', tier:3, hp:130, dmg:26, def:0.12, spd:3.2, r:0.95, h:2.1,
    xp:132, gold:28, det:34, atkRange:24, atkCD:2.8, wind:0.8, staggerRes:16, body:0x33485c, accent:0x9fd8ff,
    regions:['cathedral','caverns'], sound:'ice', proj:{speed:20,color:0x9fd8ff,size:0.5}, slow:true, blink:true },
  icestalker:{ name:'Ice Stalker', arch:'beast', tier:3, hp:160, dmg:27, def:0.16, spd:5.2, r:1.05, h:1.7,
    xp:126, gold:24, det:32, atkRange:3.0, atkCD:1.4, wind:0.34, staggerRes:18, body:0x9fc0d8, accent:0xdff4ff,
    regions:['cathedral'], sound:'beast', leap:true },
  choir_automaton:{ name:'Choir Automaton', arch:'elite', tier:4, hp:340, dmg:36, def:0.5, spd:3.1, r:1.4, h:3.1,
    xp:220, gold:48, det:32, atkRange:4.2, atkCD:2.3, wind:0.62, staggerRes:48, body:0xc8d8e8, accent:0x9fd0ff,
    regions:['cathedral'], sound:'boss_hit', guard:true },
  cinderbrute:{ name:'Cinder Brute', arch:'tank', tier:4, hp:380, dmg:40, def:0.42, spd:2.8, r:1.55, h:3.3,
    xp:240, gold:52, det:28, atkRange:4.4, atkCD:2.6, wind:0.85, staggerRes:52, body:0x35231a, accent:0xff5a1a,
    regions:['citadel'], sound:'boss_roar', slam:true },
  moltenhound:{ name:'Molten Hound', arch:'beast', tier:4, hp:180, dmg:34, def:0.14, spd:6.6, r:0.9, h:1.4,
    xp:190, gold:38, det:36, atkRange:3.0, atkCD:1.1, wind:0.26, staggerRes:16, body:0x2a1408, accent:0xff7a2a,
    regions:['citadel','sunforge'], sound:'beast', leap:true },
  ashmagus:{ name:'Ash Magus', arch:'mage', tier:4, hp:220, dmg:38, def:0.16, spd:3.4, r:1.0, h:2.3,
    xp:250, gold:56, det:36, atkRange:26, atkCD:2.5, wind:0.75, staggerRes:22, body:0x36241c, accent:0xffb060,
    regions:['citadel','sunforge'], sound:'fire', proj:{speed:24,color:0xff9a3d,size:0.6}, blink:true, summon:'emberling' },
  fallenknight:{ name:'Fallen Knight', arch:'elite', tier:5, hp:420, dmg:46, def:0.55, spd:3.6, r:1.25, h:2.9,
    xp:330, gold:74, det:34, atkRange:4.0, atkCD:2.0, wind:0.55, staggerRes:58, body:0x3a3030, accent:0xffd070,
    regions:['sunforge','citadel'], sound:'boss_hit', guard:true, riposte:true },
  voidling:{ name:'Voidling', arch:'assassin', tier:5, hp:240, dmg:52, def:0.12, spd:7.2, r:0.9, h:2.0,
    xp:340, gold:70, det:40, atkRange:3.2, atkCD:1.6, wind:0.24, staggerRes:20, body:0x1c1830, accent:0xb48cff,
    regions:['sunforge','caverns'], sound:'teleport', ghost:true, dash:true, blink:true },
  stormherald:{ name:'Storm Herald', arch:'elite', tier:5, hp:360, dmg:44, def:0.3, spd:3.8, r:1.15, h:2.8,
    xp:360, gold:80, det:38, atkRange:25, atkCD:2.2, wind:0.7, staggerRes:36, body:0x28344c, accent:0xbfe6ff,
    regions:['sunforge','cathedral'], sound:'lightning', proj:{speed:26,color:0xbfe6ff,size:0.5}, chain:true }
};
const ENEMY_KEYS=Object.keys(ENEMY_TYPES);

/* --------------------------------------------------------------------------
   Enemy entity
   -------------------------------------------------------------------------- */
function makeEnemy(key, x, z, level, elite){
  const T=ENEMY_TYPES[key];
  const lv=Math.max(1,level|0);
  const scale=1+(lv-1)*0.14;
  const e={
    key:key, T:T, name:T.name+(elite?' (Elite)':''), arch:T.arch, level:lv, elite:!!elite,
    pos:new THREE.Vector3(x, terrainHeight(x,z), z),
    vel:new THREE.Vector3(),
    yaw:rr(0,TAU), hp:0, hpMax:0, dmg:0, def:0, r:T.r, h:T.h, spd:T.spd,
    alive:true, aggro:false, alertT:0, atkCD:rr(0,1), windT:0, attackT:0,
    state:'patrol', stateT:0, patrolTarget:new THREE.Vector3(x+rr(-14,14),0,z+rr(-14,14)),
    patrolWait:rr(0,3), homeX:x, homeZ:z, stagger:0, broken:0, slow:0, slowMul:1,
    hurtFlash:0, hitstop:0, dying:0, deathDone:false, group:null, parts:{}, ph:rr(0,TAU),
    fly:T.fly||0, flyPhase:rr(0,TAU), ghostFade:1, summons:0, animT:0, lastAtk:0,
    attackChain:0, dodgeCD:0, dashT:0, target:null, isBoss:false, ring:null,
    spawnFx:1.2, dormant:false
  };
  e.hpMax=Math.round(T.hp*scale*(elite?2.1:1));
  e.hp=e.hpMax;
  e.dmg=T.dmg*(1+(lv-1)*0.12)*(elite?1.3:1);
  e.def=T.def;
  e.xp=Math.round(T.xp*(1+(lv-1)*0.28)*(elite?2.6:1));
  e.gold=Math.round(T.gold*(1+(lv-1)*0.22)*(elite?2.5:1));
  e.det=T.det;
  e.atkRange=T.atkRange;
  e.atkCDBase=T.atkCD;
  buildEnemyMesh(e);
  attachEnemyMethods(e);
  return e;
}
function buildEnemyMesh(e){
  const T=e.T;
  const g=new THREE.Group();
  const bodyMat=TEX.std(T.body,0.85,0.06);
  const accentMat=TEX.emissive(T.accent, e.arch==='mage'||T.accent===0xff7a2a?1.0:0.55);
  const darkMat=TEX.std(0x1a1614,0.9,0.1);
  const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true; g.add(m); return m; };
  let core=null, eyes=[], aura=null;
  switch(e.arch){
    case 'melee':
      add(new THREE.BoxGeometry(0.7,0.95,0.42), bodyMat, 0,1.15,0);
      core=add(new THREE.BoxGeometry(0.78,0.4,0.5), bodyMat, 0,1.5,0);
      add(new THREE.BoxGeometry(0.4,0.42,0.4), darkMat, 0,1.82,0);
      add(new THREE.BoxGeometry(0.56,0.2,0.2), accentMat, 0,1.46,0.28);
      add(new THREE.CylinderGeometry(0.11,0.1,0.72,6), bodyMat, -0.45,1.05,0);
      add(new THREE.CylinderGeometry(0.11,0.1,0.72,6), bodyMat, 0.45,1.05,0);
      add(new THREE.CylinderGeometry(0.13,0.11,0.8,6), bodyMat, -0.18,0.4,0);
      add(new THREE.CylinderGeometry(0.13,0.11,0.8,6), bodyMat, 0.18,0.4,0);
      e.parts.blade=add(new THREE.BoxGeometry(0.08,1.3,0.03), TEX.std(0x9aa2ad,0.4,0.8), 0.45,0.75,0.25);
      break;
    case 'beast':
      add(new THREE.BoxGeometry(0.62,0.56,1.5), bodyMat, 0,0.72,0);
      core=add(new THREE.BoxGeometry(0.5,0.44,0.5), bodyMat, 0,0.8,0.85);
      add(new THREE.BoxGeometry(0.34,0.3,0.42), darkMat, 0,0.86,1.06);
      eyes.push(add(new THREE.BoxGeometry(0.09,0.07,0.06), accentMat,-0.11,0.92,1.26));
      eyes.push(add(new THREE.BoxGeometry(0.09,0.07,0.06), accentMat,0.11,0.92,1.26));
      add(new THREE.BoxGeometry(0.42,0.18,0.5), accentMat, 0,1.0,-0.16);
      for(let s=-1;s<=1;s+=2){ for(let f=-1;f<=1;f+=2){
        add(new THREE.CylinderGeometry(0.1,0.08,0.72,5), bodyMat, s*0.28,0.34,f*0.5);
      }}
      add(new THREE.ConeGeometry(0.1,0.5,5), darkMat, 0,0.5,-0.95).rotation.x=Math.PI/2;
      break;
    case 'ranged':
      add(new THREE.BoxGeometry(0.7,1.1,0.42), bodyMat, 0,1.2,0);
      core=add(new THREE.BoxGeometry(0.8,0.34,0.52), bodyMat, 0,1.62,0);
      add(new THREE.BoxGeometry(0.42,0.44,0.42), darkMat, 0,1.98,0);
      eyes.push(add(new THREE.SphereGeometry(0.08,6,5), accentMat,-0.11,2.0,0.22));
      eyes.push(add(new THREE.SphereGeometry(0.08,6,5), accentMat,0.11,2.0,0.22));
      add(new THREE.CylinderGeometry(0.1,0.09,0.8,6), bodyMat, -0.46,1.15,0);
      add(new THREE.CylinderGeometry(0.1,0.09,0.8,6), bodyMat, 0.46,1.15,0);
      add(new THREE.CylinderGeometry(0.13,0.11,0.9,6), bodyMat, -0.19,0.45,0);
      add(new THREE.CylinderGeometry(0.13,0.11,0.9,6), bodyMat, 0.19,0.45,0);
      e.parts.orb=add(new THREE.IcosahedronGeometry(0.22,1), accentMat, 0.5,1.4,0.5);
      break;
    case 'flying':
      add(new THREE.BoxGeometry(0.7,0.5,0.9), bodyMat, 0,0.5,0);
      core=add(new THREE.BoxGeometry(0.44,0.4,0.46), bodyMat, 0,0.62,0.5);
      eyes.push(add(new THREE.SphereGeometry(0.06,6,4), accentMat,-0.1,0.64,0.72));
      eyes.push(add(new THREE.SphereGeometry(0.06,6,4), accentMat,0.1,0.64,0.72));
      add(new THREE.ConeGeometry(0.09,0.4,5), darkMat, 0,0.72,0.82).rotation.x=Math.PI/2;
      for(let s=-1;s<=1;s+=2){
        const w=add(new THREE.BoxGeometry(1.3,0.06,0.52), bodyMat, s*0.95,0.62,-0.1);
        w.rotation.z=s*0.2; e.parts['wing'+(s<0?'L':'R')]=w;
      }
      e.parts.tail=add(new THREE.BoxGeometry(0.09,0.09,0.8), darkMat, 0,0.4,-0.8);
      break;
    case 'tank':
      add(new THREE.BoxGeometry(1.3,1.3,0.95), bodyMat, 0,1.5,0);
      core=add(new THREE.BoxGeometry(1.45,0.55,1.05), bodyMat, 0,2.2,0);
      add(new THREE.BoxGeometry(0.6,0.55,0.55), darkMat, 0,2.65,0);
      eyes.push(add(new THREE.BoxGeometry(0.14,0.1,0.08), accentMat,-0.16,2.68,0.3));
      eyes.push(add(new THREE.BoxGeometry(0.14,0.1,0.08), accentMat,0.16,2.68,0.3));
      add(new THREE.BoxGeometry(1.35,0.3,0.3), accentMat, 0,1.9,0.5);
      for(let s=-1;s<=1;s+=2){
        add(new THREE.SphereGeometry(0.3,8,6), bodyMat, s*0.85,2.2,0);
        e.parts['arm'+(s<0?'L':'R')]=add(new THREE.BoxGeometry(0.34,1.3,0.34), bodyMat, s*0.9,1.3,0);
      }
      add(new THREE.CylinderGeometry(0.24,0.2,1.0,6), bodyMat, -0.38,0.5,0);
      add(new THREE.CylinderGeometry(0.24,0.2,1.0,6), bodyMat, 0.38,0.5,0);
      break;
    case 'assassin':
      add(new THREE.BoxGeometry(0.5,1.0,0.36), TEX.std(T.body,0.9,0.05), 0,1.2,0);
      core=add(new THREE.BoxGeometry(0.6,0.34,0.44), TEX.std(T.body,0.9,0.05), 0,1.6,0);
      add(new THREE.ConeGeometry(0.3,0.5,6), TEX.std(T.body,0.95,0.0), 0,1.95,0);
      eyes.push(add(new THREE.SphereGeometry(0.07,6,4), accentMat,-0.1,1.86,0.2));
      eyes.push(add(new THREE.SphereGeometry(0.07,6,4), accentMat,0.1,1.86,0.2));
      add(new THREE.CylinderGeometry(0.08,0.07,0.9,5), TEX.std(T.body,0.9,0.05), -0.35,1.1,0);
      add(new THREE.CylinderGeometry(0.08,0.07,0.9,5), TEX.std(T.body,0.9,0.05), 0.35,1.1,0);
      add(new THREE.CylinderGeometry(0.1,0.09,0.9,5), TEX.std(T.body,0.9,0.05), -0.16,0.45,0);
      add(new THREE.CylinderGeometry(0.1,0.09,0.9,5), TEX.std(T.body,0.9,0.05), 0.16,0.45,0);
      e.parts.blade=add(new THREE.BoxGeometry(0.06,0.85,0.03), accentMat, 0.4,0.6,0.2);
      e.parts.blade2=add(new THREE.BoxGeometry(0.06,0.85,0.03), accentMat, -0.4,0.6,0.2);
      break;
    case 'mage':
      add(new THREE.BoxGeometry(0.62,1.0,0.4), bodyMat, 0,1.2,0);
      core=add(new THREE.BoxGeometry(0.72,0.32,0.48), bodyMat, 0,1.6,0);
      add(new THREE.ConeGeometry(0.36,0.7,7), bodyMat, 0,2.15,0);
      eyes.push(add(new THREE.SphereGeometry(0.1,6,5), accentMat,-0.11,1.92,0.2));
      eyes.push(add(new THREE.SphereGeometry(0.1,6,5), accentMat,0.11,1.92,0.2));
      add(new THREE.CylinderGeometry(0.09,0.08,0.9,6), bodyMat, -0.4,1.15,0);
      add(new THREE.CylinderGeometry(0.09,0.08,0.9,6), bodyMat, 0.4,1.15,0);
      add(new THREE.CylinderGeometry(0.12,0.1,0.95,6), bodyMat, -0.17,0.48,0);
      add(new THREE.CylinderGeometry(0.12,0.1,0.95,6), bodyMat, 0.17,0.48,0);
      e.parts.staff=add(new THREE.CylinderGeometry(0.05,0.05,2.0,5), darkMat, 0.55,1.3,0.15);
      e.parts.staff.rotation.z=-0.12;
      e.parts.orb=add(new THREE.IcosahedronGeometry(0.2,1), accentMat, 0.62,2.3,0.15);
      aura=new THREE.Mesh(new THREE.RingGeometry(1.0,1.3,24),
        new THREE.MeshBasicMaterial({color:T.accent,transparent:true,opacity:0.24,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      aura.rotation.x=-Math.PI/2; aura.position.y=0.1; g.add(aura);
      break;
    case 'elite':
      add(new THREE.BoxGeometry(0.95,1.25,0.62), bodyMat, 0,1.4,0);
      core=add(new THREE.BoxGeometry(1.1,0.5,0.78), bodyMat, 0,2.15,0);
      add(new THREE.BoxGeometry(0.5,0.5,0.5), darkMat, 0,2.6,0);
      eyes.push(add(new THREE.BoxGeometry(0.13,0.08,0.08), accentMat,-0.14,2.6,0.28));
      eyes.push(add(new THREE.BoxGeometry(0.13,0.08,0.08), accentMat,0.14,2.6,0.28));
      add(new THREE.BoxGeometry(0.3,0.6,0.2), accentMat, 0,2.1,0.42);
      for(let s=-1;s<=1;s+=2){
        add(new THREE.SphereGeometry(0.28,8,6), bodyMat, s*0.68,2.15,0);
        e.parts['arm'+(s<0?'L':'R')]=add(new THREE.BoxGeometry(0.28,1.2,0.28), bodyMat, s*0.72,1.25,0);
      }
      add(new THREE.CylinderGeometry(0.2,0.17,1.0,6), bodyMat, -0.3,0.5,0);
      add(new THREE.CylinderGeometry(0.2,0.17,1.0,6), bodyMat, 0.3,0.5,0);
      e.parts.blade=add(new THREE.BoxGeometry(0.1,1.9,0.04), TEX.std(0xc0c8d2,0.3,0.85), 0.85,1.1,0.2);
      break;
  }
  // additive glow shell for arcane enemies
  if(e.arch==='mage'||e.arch==='assassin'){
    aura=aura||new THREE.Mesh(new THREE.RingGeometry(0.8,1.05,20),
      new THREE.MeshBasicMaterial({color:T.accent,transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.08; g.add(aura);
  }
  // health bar sprite above head (bosses use the HUD bar instead)
  const barW=1.9, bar=new THREE.Mesh(new THREE.PlaneGeometry(barW,0.14),
    new THREE.MeshBasicMaterial({color:0xa8231f,transparent:true,opacity:0.85,depthWrite:false,depthTest:false}));
  bar.position.y=e.h+0.55;
  const barBg=new THREE.Mesh(new THREE.PlaneGeometry(barW+0.08,0.2),
    new THREE.MeshBasicMaterial({color:0x120c0a,transparent:true,opacity:0.75,depthWrite:false,depthTest:false}));
  barBg.position.set(0,e.h+0.55,-0.02);
  const hb=new THREE.Group(); hb.add(barBg); hb.add(bar);
  hb.renderOrder=999; g.add(hb);
  e.parts.healthBar=bar; e.parts.healthBarGroup=hb; e.parts.aura=aura;
  e.parts.eyes=eyes; e.parts.core=core;
  e.group=g;
  g.position.copy(e.pos);
  g.rotation.y=e.yaw;
  scene.add(g);
}

const Enemies = {
  list:[], byKeyCache:{'':null}, killedCounts:{}, spawnCooldowns:{},
  levelOverride:null,
  init(){ this.list=[]; },
  // ---- spawning ----------
  spawn(key,x,z,level,elite){
    if(this.list.length>=CFG.maxEnemiesActive*2) return null;
    const e=makeEnemy(key,x,z,level||this.levelFor(x,z),elite);
    // world collider so props do not intersect spawns
    this.list.push(e);
    if(this.countAlive()>=CFG.maxEnemiesActive) e.dormant=true;
    return e;
  },
  levelFor(x,z){
    const R=getRegionAt(x,z);
    const base=R? (R.idx+1)*3+2 : 3;
    return clamp(Math.round(base+Player.S.level*0.32), 1, 60);
  },
  countAlive(){ let n=0; for(let i=0;i<this.list.length;i++) if(this.list[i].alive) n++; return n; },

  /* ---- region-based ambient spawning ------------------------------------ */
  populateAround(x,z,radius,count){
    const keys=[];
    const R=getRegionAt(x,z);
    for(let i=0;i<ENEMY_KEYS.length;i++){
      const T=ENEMY_TYPES[ENEMY_KEYS[i]];
      if(!R||T.regions.indexOf(R.id)>=0) keys.push(ENEMY_KEYS[i]);
    }
    if(!keys.length) keys=ENEMY_KEYS.slice(0,6);
    for(let i=0;i<count;i++){
      const a=rr(0,TAU), d=rr(radius*0.45,radius);
      const ex=x+Math.cos(a)*d, ez=z+Math.sin(a)*d;
      if(getRegionAt(ex,ez)===null&&R) continue;
      if(Math.abs(ex)>CFG.world.sizeX*0.47||Math.abs(ez)>CFG.world.sizeZ*0.47) continue;
      const key=pick(keys);
      // bosses are spawned explicitly, not ambiently
      this.spawn(key,ex,ez,this.levelFor(ex,ez), Math.random()<0.08);
    }
  },
  clearAll(){
    for(let i=0;i<this.list.length;i++){
      if(this.list[i].group) scene.remove(this.list[i].group);
    }
    this.list.length=0;
  },
  // On rest at a shrine, all killed enemies return.
  reviveAll(){
    for(let i=this.list.length-1;i>=0;i--){
      const e=this.list[i];
      if(!e.alive){
        if(e.group) scene.remove(e.group);
        this.list.splice(i,1);
      } else if(e.isBoss){ /* bosses persist */ }
    }
    this.killedCounts={};
  },

  /* ---- AI update -------------------------------------------------------- */
  update(dt,t){
    const px=Player.pos.x, pz=Player.pos.z;
    let active=0;
    for(let i=0;i<this.list.length;i++){
      const e=this.list[i];
      if(!e.alive){ this.updateDeath(e,dt); continue; }
      const dx=e.pos.x-px, dz=e.pos.z-pz;
      const dist=Math.hypot(dx,dz);
      // distance-based activation and animation LOD
      if(dist>CFG.world.emitRange){ e.dormant=true; if(e.group) e.group.visible=false; continue; }
      e.dormant=false; if(e.group) e.group.visible=true;
      if(e.isBoss){
        // bosses are driven by Bosses.update(); the generic pass only
        // animates their death so they are never simulated twice
        if(!e.alive) this.updateDeath(e,dt);
        continue;
      }
      if(active>CFG.maxEnemiesActive && dist>48){ e.lod=true; } else { e.lod=false; active++; }
      this.updateOne(e,dt,t,dist);
    }
  },
  updateOne(e,dt,t,dist){
    e.animT+=dt;
    if(e.hurtFlash>0){ e.hurtFlash-=dt; }
    if(e.alertT>0) e.alertT-=dt;
    if(e.atkCD>0) e.atkCD-=dt;
    if(e.stagger>0) e.stagger-=dt;
    if(e.broken>0) e.broken-=dt;
    if(e.slow>0){ e.slow-=dt; if(e.slow<=0) e.slowMul=1; }
    if(e.dodgeCD>0) e.dodgeCD-=dt;
    if(e.spawnFx>0) e.spawnFx-=dt;
    e.stateT+=dt;

    const wasAlive=e.alive;
    // aggro by proximity / being struck
    if(!e.aggro && dist<e.det && this.canSee(e)){ e.aggro=true; e.alertT=4; if(e.T.sound) Audio2.play(e.T.sound,{vol:0.5}); }

    if(e.stagger>0){
      // staggered: no actions
      e.state='stagger';
      this.moveEnemy(e,e.vel.x*0.4,e.vel.z*0.4,dt,0.6);
      this.animateEnemy(e,dt);
      this.updateHealthBar(e);
      return;
    }

    let tx=0, tz=0, speed=e.spd*e.slowMul;
    if(e.aggro && e.alertT>0){
      const dxv=Player.pos.x-e.pos.x, dzv=Player.pos.z-e.pos.z;
      const d=Math.hypot(dxv,dzv)||1;
      const nx=dxv/d, nz=dzv/d;
      // mages/assassins blink when crowded
      if((e.T.blink||e.T.ghost) && e.dodgeCD<=0 && d<5.5 && e.arch!=='melee'){
        e.dodgeCD=6.5; this.blink(e); return;
      }
      if(e.arch==='ranged'||e.arch==='mage'){
        const ideal=e.atkRange*0.7;
        if(d>ideal*1.15){ tx=nx; tz=nz; }
        else if(d<ideal*0.55){ tx=-nx; tz=-nz; speed*=0.8; }
        if(e.atkCD<=0 && d<e.atkRange && this.canSee(e)){ this.rangedAttack(e); }
        // mage summons
        if(e.T.summon && Math.random()<dt*0.16 && this.countAlive()<CFG.maxEnemiesActive){
          const s=this.spawn(e.T.summon, e.pos.x+rr(-4,4), e.pos.z+rr(-4,4), Math.max(1,e.level-1), false);
          if(s){ FX.burst(s.pos.x,s.pos.y+1,s.pos.z,18,{color:[0.6,0.4,1],speed:5,life:0.8,size:0.45});
            Audio2.play('teleport'); }
        }
      } else if(e.arch==='flying'){
        // circle then dive
        const ang=Math.atan2(e.pos.x-Player.pos.x, e.pos.z-Player.pos.z);
        const circ=ang+dt*1.1;
        const rad=Math.max(4.2, e.h+3.2);
        const wantX=Player.pos.x+Math.sin(circ)*rad;
        const wantZ=Player.pos.z+Math.cos(circ)*rad;
        tx=(wantX-e.pos.x); tz=(wantZ-e.pos.z);
        const l=Math.hypot(tx,tz)||1; tx/=l; tz/=l;
        if(e.atkCD<=0 && d<e.atkRange+1.2){ this.meleeAttack(e); }
      } else {
        // ground melee / beast / assassin / tank / elite
        const reach=e.atkRange;
        if(d>reach*0.86){ tx=nx; tz=nz; }
        if(e.arch==='assassin' && d>6 && d<16 && e.dodgeCD<=0 && e.T.dash){
          e.dodgeCD=4.2; e.dashT=0.3; e.vel.x=nx*16; e.vel.z=nz*16;
          Audio2.play('roll',{vol:0.5});
          FX.burst(e.pos.x,e.pos.y+0.4,e.pos.z,10,{color:[0.5,0.4,0.7],speed:4,life:0.4,size:0.3});
        }
        if(d<reach+0.5 && e.atkCD<=0){
          if(e.arch==='tank'&&e.T.slam&&Math.random()<0.4) this.slamAttack(e);
          else if(e.arch==='beast'&&e.T.leap&&d>4.5&&Math.random()<0.35) this.leapAttack(e);
          else this.meleeAttack(e);
        }
        // guard behaviour for elites
        if(e.T.guard && d<reach*0.8 && e.atkCD>0.4) e.guarding=true;
        else if(e.guarding) e.guarding=false;
      }
    } else {
      // patrol
      const pdx=e.patrolTarget.x-e.pos.x, pdz=e.patrolTarget.z-e.pos.z;
      const pd=Math.hypot(pdx,pdz);
      if(pd<1.6||e.patrolWait>0){
        e.patrolWait-=dt;
        if(e.patrolWait<=0){
          const a=rr(0,TAU), d=rr(6,20);
          e.patrolTarget.set(e.homeX+Math.cos(a)*d,0,e.homeZ+Math.sin(a)*d);
          e.patrolWait=rr(0.6,3.0);
        }
      } else { tx=pdx/pd; tz=pdz/pd; speed*=0.55; }
      e.state='patrol';
    }
    // apply movement
    if(e.windT>0||e.attackT>0){
      this.moveEnemy(e, e.vel.x*0.2, e.vel.z*0.2, dt, 0.5);
      e.state=e.windT>0?'windup':'attack';
    } else {
      this.moveEnemy(e, tx*speed, tz*speed, dt, e.lod?0.35:1);
      if(e.state!=='attack') e.state=(tx||tz)?'chase':'idle';
    }
    // face movement/player
    if(e.aggro&&e.alertT>0){
      const want=Math.atan2(Player.pos.x-e.pos.x, Player.pos.z-e.pos.z);
      e.yaw=angLerp(e.yaw,want,1-Math.exp(-7*dt));
    } else if(tx||tz){
      e.yaw=angLerp(e.yaw,Math.atan2(tx,tz),1-Math.exp(-5*dt));
    }
    this.attackTimers(e,dt);
    this.animateEnemy(e,dt);
    this.updateHealthBar(e);
    if(!e.alive&&wasAlive) this.onDeath(e);
  },
  canSee(e){
    // cheap line of sight: no tall prop within the same hash cell along the ray
    const dx=Player.pos.x-e.pos.x, dz=Player.pos.z-e.pos.z;
    const d=Math.hypot(dx,dz);
    if(d<6) return true;
    if(d>e.det) return false;
    const steps=Math.min(6,Math.floor(d/6));
    for(let i=1;i<=steps;i++){
      const tx=e.pos.x+dx*(i/(steps+1)), tz=e.pos.z+dz*(i/(steps+1));
      const tmp=World.tmpArr2||(World.tmpArr2=[]);
      World.hash.query(tx,tz,1.0,tmp);
      for(let k=0;k<tmp.length;k++){
        const c=tmp[k];
        if(c.r>1.4 && c.top>e.pos.y+2.2){
          if(Math.hypot(tx-c.x,tz-c.z)<c.r) return false;
        }
      }
    }
    return true;
  },
  moveEnemy(e,vx,vz,dt,animScale){
    e.vel.x=vx; e.vel.z=vz;
    e.pos.x+=vx*dt; e.pos.z+=vz*dt;
    // keep out of props
    const tmp=World.tmpArr3||(World.tmpArr3=[]);
    World.hash.query(e.pos.x,e.pos.z,1.6,tmp);
    for(let i=0;i<tmp.length;i++){
      const c=tmp[i];
      if(c.top<e.pos.y+0.3) continue;
      const dx=e.pos.x-c.x, dz=e.pos.z-c.z;
      const d=Math.hypot(dx,dz), min=c.r+e.r*0.8;
      if(d<min&&d>0.0001){
        const push=(min-d)/d;
        e.pos.x+=dx*push; e.pos.z+=dz*push;
        // simple steering around obstacles
        const nx=dx/d, nz=dz/d;
        e.pos.x+=-nz*0.35; e.pos.z+=nx*0.35;
      }
    }
    // ground / flight
    const gh=terrainHeight(e.pos.x,e.pos.z);
    if(e.fly>0){
      e.flyPhase+=dt*2.2;
      const target=gh+e.fly+Math.sin(e.flyPhase)*0.5;
      e.pos.y=damp(e.pos.y,target,6,dt);
    } else {
      const target=gh;
      if(e.pos.y>target) e.pos.y=Math.max(target, e.pos.y-CFG.gravity*0.5*dt*dt*10);
      else e.pos.y=target;
    }
    // avoid falling off borders
    const bx=CFG.world.sizeX*0.47, bz=CFG.world.sizeZ*0.47;
    e.pos.x=clamp(e.pos.x,-bx,bx); e.pos.z=clamp(e.pos.z,-bz,bz);
    // separation from other enemies (soft)
    const list=this.list;
    for(let i=0;i<list.length;i++){
      const o=list[i];
      if(o===e||!o.alive) continue;
      const dx=e.pos.x-o.pos.x, dz=e.pos.z-o.pos.z;
      const d2=dx*dx+dz*dz;
      const minD=(e.r+o.r)*0.9;
      if(d2<minD*minD&&d2>0.0001){
        const d=Math.sqrt(d2), p=(minD-d)/d*0.5;
        e.pos.x+=dx*p; e.pos.z+=dz*p;
      }
    }
    if(e.group){
      e.group.position.set(e.pos.x,e.pos.y,e.pos.z);
      e.group.rotation.y=e.yaw;
    }
  },
  attackTimers(e,dt){
    if(e.windT>0){
      e.windT-=dt;
      if(e.windT<=0){ this.performAttack(e); }
    }
    if(e.attackT>0){ e.attackT-=dt; if(e.attackT<=0){ e.state='chase'; } }
    if(e.dashT>0) e.dashT-=dt;
  },
  meleeAttack(e){
    e.windT=e.T.wind; e.atkCD=e.atkCDBase; e.pendingAttack='melee'; e.attackChain=(e.attackChain+1)%3;
    Audio2.play(e.T.sound||'swing',{vol:0.6});
    if(e.T.arch==='melee'||e.arch==='elite') Audio2.play('swing',{vol:0.5});
  },
  slamAttack(e){
    e.windT=e.T.wind*1.35; e.atkCD=e.atkCDBase*1.5; e.pendingAttack='slam';
    Audio2.play('swing_heavy',{vol:0.7});
  },
  leapAttack(e){
    e.windT=e.T.wind*0.9; e.atkCD=e.atkCDBase*1.3; e.pendingAttack='leap';
  },
  rangedAttack(e){
    e.windT=e.T.wind; e.atkCD=e.atkCDBase; e.pendingAttack='ranged';
    if(e.T.sound) Audio2.play(e.T.sound,{vol:0.45});
  },
  performAttack(e){
    const D=Damage;
    const from=new THREE.Vector3(e.pos.x,e.pos.y,e.pos.z);
    const pd=Player.pos;
    const dist=Math.hypot(pd.x-e.pos.x,pd.z-e.pos.z);
    const atk=e.pendingAttack||'melee';
    e.attackT=0.3; e.pendingAttack=null;
    if(atk==='ranged'){
      const pr=e.T.proj||{speed:18,color:0xffffff,size:0.45};
      const from2=new THREE.Vector3(e.pos.x, e.pos.y+e.h*0.72, e.pos.z);
      const to=new THREE.Vector3(pd.x, pd.y+1.0, pd.z);
      const dir=to.sub(from2).normalize();
      const m=new THREE.Mesh(new THREE.SphereGeometry(pr.size,8,6),
        new THREE.MeshBasicMaterial({color:pr.color,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}));
      m.position.copy(from2); scene.add(m);
      const light=new THREE.PointLight(pr.color,1.1,12,2); light.position.copy(from2); scene.add(light);
      this.projectiles=this.projectiles||[];
      this.projectiles.push({mesh:m,light:light,pos:from2.clone(),dir:dir,speed:pr.speed,life:3.0,dmg:e.dmg*0.62,e:e,
        color:pr.color,dot:e.T.dot,slow:e.T.slow,knock:e.T.knock,chain:e.T.chain});
      return;
    }
    if(atk==='slam'){
      const rad=e.atkRange*0.95;
      FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,rad,0xff9a3d);
      FX.burst(e.pos.x,e.pos.y+0.3,e.pos.z,34,{color:[1,0.6,0.25],speed:9,life:0.7,size:0.5,up:0.8});
      FX.shake(0.45,0.35); Audio2.play('boom',{vol:0.7});
      if(dist<rad+1.0) D.hurtPlayer(e.dmg*1.1, from, e);
      return;
    }
    if(atk==='leap'){
      const dirx=pd.x-e.pos.x, dirz=pd.z-e.pos.z;
      const l=Math.hypot(dirx,dirz)||1;
      e.vel.x=dirx/l*13; e.vel.z=dirz/l*13; e.dashT=0.42;
      e.hop=1;
      Audio2.play('beast',{vol:0.6});
      if(dist<e.atkRange+1.6) D.hurtPlayer(e.dmg*0.95, from, e);
      return;
    }
    // melee strike (arc)
    Audio2.play('swing',{vol:0.6});
    const reach=e.atkRange+ (e.arch==='tank'||e.arch==='elite'?1.0:0.5);
    const arc=(e.arch==='tank'||e.arch==='elite')?1.5:1.15;
    const ang=Math.atan2(pd.x-e.pos.x, pd.z-e.pos.z);
    if(dist<reach+1.0 && Math.abs(angDelta(e.yaw,ang))<arc){
      if(e.T.riposte && Math.random()<0.22) D.hurtPlayer(e.dmg*1.6, from, e);
      else D.hurtPlayer(e.dmg, from, e);
    }
    if(e.parts.blade||e.parts.armR||e.parts.armL){
      FX.slash(e.pos.x+Math.sin(e.yaw)*1.2, e.pos.y+e.h*0.6, e.pos.z+Math.cos(e.yaw)*1.2, e.yaw, 1.3, e.T.accent);
    }
  },
  blink(e){
    const pd=Player.pos;
    const a=rr(0,TAU), d=rr(7,13);
    const nx=pd.x+Math.cos(a)*d, nz=pd.z+Math.sin(a)*d;
    FX.burst(e.pos.x,e.pos.y+1,e.pos.z,26,{color:[0.6,0.5,1],speed:7,life:0.6,size:0.45});
    Audio2.play('teleport',{vol:0.5});
    e.pos.x=nx; e.pos.z=nz; e.pos.y=terrainHeight(nx,nz)+(e.fly>0?e.fly:0);
    FX.burst(e.pos.x,e.pos.y+1,e.pos.z,26,{color:[0.6,0.5,1],speed:7,life:0.6,size:0.45});
  },
  animateEnemy(e,dt){
    if(!e.group) return;
    const T=e.T;
    e.group.position.set(e.pos.x,e.pos.y,e.pos.z);
    e.group.rotation.y=e.yaw;
    const t=e.animT;
    const sp=Math.hypot(e.vel.x,e.vel.z);
    const bob=Math.sin(t*(4+sp*0.9))*0.05*(sp>0.4?1:0.3);
    e.group.position.y=e.pos.y+bob+ (e.hop? 0.6:0);
    if(e.hop){ e.hop=0; }
    // blink hit flash
    if(e.parts.core){
      const fl=e.hurtFlash>0?1:0;
      if(T.accent===0xff7a2a||e.arch==='mage'||e.arch==='assassin'||e.arch==='elite'){
        e.parts.core.material.emissiveIntensity=0.5+ (fl?2.2:0) + Math.sin(t*3+e.ph)*0.2;
      }
    }
    if(e.parts.aura) e.parts.aura.material.opacity=0.12+0.1*Math.sin(t*2+e.ph)+(e.arch==='mage'?0.1:0);
    if(e.parts.orb){
      e.parts.orb.rotation.y+=dt*2.4; e.parts.orb.rotation.x+=dt*1.3;
      e.parts.orb.material.emissiveIntensity=(e.windT>0?2.0:1.0);
    }
    if(e.parts.blade){
      const swing=Math.sin(clamp(1-(e.attackT/0.3||1),0,1)*Math.PI);
      e.parts.blade.rotation.x=-2.0+ (e.attackT>0? swing*2.6:0);
    }
    if(e.parts.blade2){
      const swing=Math.sin(clamp(1-(e.attackT/0.3||1),0,1)*Math.PI);
      e.parts.blade2.rotation.x=-2.0+(e.attackT>0?swing*2.6:0);
    }
    if(e.arch==='flying'){
      if(e.parts.wingL) e.parts.wingL.rotation.z=0.2+Math.sin(t*11)*0.7;
      if(e.parts.wingR) e.parts.wingR.rotation.z=-0.2-Math.sin(t*11)*0.7;
      if(e.parts.tail) e.parts.tail.rotation.y=Math.sin(t*3)*0.3;
    }
    if(e.arch==='beast'){ e.group.rotation.z=Math.sin(t*9)*0.05*(sp>1?1:0); }
    if(e.stagger>0){ e.group.rotation.z=Math.sin(t*20)*0.12; e.group.rotation.x=-0.25; }
    else { e.group.rotation.z*=0.85; e.group.rotation.x*=0.85; }
    // ghost fade
    if(T.ghost){ /* handled via materials below */ }
    e.parts.healthBarGroup.visible=(e.hp<e.hpMax)&&!e.dormant;
    e.parts.healthBarGroup.quaternion.copy(camera.quaternion);
  },
  updateHealthBar(e){
    if(!e.parts.healthBar) return;
    const f=clamp(e.hp/e.hpMax,0,1);
    e.parts.healthBar.scale.x=f;
    e.parts.healthBar.position.x=-(1-f)*0.95;
    e.parts.healthBar.material.color.setHex(e.broken>0?0xffcf5a:0xa8231f);
  },
  onDeath(e){
    Audio2.play(e.arch==='beast'?'beast':'hit',{vol:0.6});
    FX.burst(e.pos.x,e.pos.y+e.h*0.5,e.pos.z,30,{color:[0.75,0.2,0.15],speed:7,life:0.9,size:0.5});
  },
  updateDeath(e,dt){
    if(e.deathDone) return;
    e.dying+=dt;
    if(e.group){
      e.group.rotation.x=Math.min(Math.PI/2, e.dying*3.2);
      e.group.position.y=e.pos.y-Math.min(0.6, e.dying*0.9);
      if(e.dying>1.6){ e.deathDone=true; scene.remove(e.group); }
    } else e.deathDone=true;
  },
  /* ---- projectile update (enemy shots) ---------------------------------- */
  updateProjectiles(dt){
    if(!this.projectiles) return;
    for(let i=this.projectiles.length-1;i>=0;i--){
      const pr=this.projectiles[i];
      pr.life-=dt;
      pr.pos.addScaledVector(pr.dir, pr.speed*dt);
      pr.mesh.position.copy(pr.pos);
      if(pr.light) pr.light.position.copy(pr.pos);
      if(!particlesOff()&&Math.random()<dt*22)
        FX.spawn(pr.pos.x,pr.pos.y,pr.pos.z,rr(-0.8,0.8),rr(-0.8,0.8),rr(-0.8,0.8),0.9,0.6,0.3,0.35,0.4);
      const gh=terrainHeight(pr.pos.x,pr.pos.z);
      let dead=pr.life<=0||pr.pos.y<gh-0.2;
      if(!dead){
        const dx=Player.pos.x-pr.pos.x, dz=Player.pos.z-pr.pos.z;
        const dy=(Player.pos.y+1.0)-pr.pos.y;
        if(dx*dx+dz*dz<1.5 && Math.abs(dy)<1.6){
          if(Damage.hurtPlayer(pr.dmg, pr.pos.clone(), pr.e)){
            if(pr.dot) Player.poisonT=3.0;
            if(pr.slow){ Player.slowT=2.4; }
            if(pr.knock){ Player.vel.x-=pr.dir.x*6; Player.vel.z-=pr.dir.z*6; }
            if(pr.chain){
              FX.shock(Player.pos.x,Player.pos.y,Player.pos.z,5,0xbfe6ff); Audio2.play('lightning',{vol:0.5});
            }
          }
          FX.burst(pr.pos.x,pr.pos.y,pr.pos.z,18,{color:[0.9,0.5,0.25],speed:6,life:0.5,size:0.4});
          dead=true;
        }
      }
      if(dead){
        scene.remove(pr.mesh); if(pr.light) scene.remove(pr.light);
        this.projectiles.splice(i,1);
      }
    }
  },
  // helper: find the nearest living enemy to a point
  nearest(x,z,maxD){
    let best=null,bd=maxD*maxD;
    for(let i=0;i<this.list.length;i++){
      const e=this.list[i]; if(!e.alive) continue;
      const dx=e.pos.x-x, dz=e.pos.z-z, d2=dx*dx+dz*dz;
      if(d2<bd){ bd=d2; best=e; }
    }
    return best;
  }
};
