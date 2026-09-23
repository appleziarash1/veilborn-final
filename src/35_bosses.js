
/* --------------------------------------------------------------------------
   Enemy methods (stagger, knockback, slow, death) shared by all enemies.
   -------------------------------------------------------------------------- */
function attachEnemyMethods(e){
  e.applyStagger=function(n,dur){
    const resist=this.T.staggerRes||10;
    const add=n/(1+resist*0.05);
    this.staggerAccum=(this.staggerAccum||0)+add;
    if(this.staggerAccum>=30){
      this.staggerAccum=0;
      this.broken=CFG.combat.staggerTime;
      this.stagger=dur||CFG.combat.staggerTime;
      Audio2.play('hit_crit',{vol:0.8});
      FX.shock(this.pos.x,this.pos.y+0.1,this.pos.z,this.r*3.0,0xffd24a);
      FX.burst(this.pos.x,this.pos.y+this.h*0.6,this.pos.z,26,{color:[1,0.85,0.4],speed:8,life:0.7,size:0.5});
      DmgText.show(new THREE.Vector3(this.pos.x,this.pos.y+this.h+1.0,this.pos.z),'BROKEN','#ffd24a',true);
      HUD.comboText('STAGGER BREAK');
      if(this.isBoss&&this.onStagger) this.onStagger();
    }
  };
  e.knockback=function(f){
    if(this.isBoss) f*=0.12;
    const dx=this.pos.x-Player.pos.x, dz=this.pos.z-Player.pos.z;
    const l=Math.hypot(dx,dz)||1;
    this.vel.x+=dx/l*f; this.vel.z+=dz/l*f;
  };
  e.applySlow=function(dur,mul){ this.slow=dur; this.slowMul=mul; };
  e.die=function(){
    if(!this.alive) return;
    this.alive=false; this.dying=0; this.deathDone=false;
    Enemies.onDeath(this);
    const r=this.T;
    // rewards
    Player.addXP(this.xp);
    Player.addGold(this.gold);
    Player.S.kills++;
    Enemies.killedCounts[this.key]=(Enemies.killedCounts[this.key]||0)+1;
    DmgText.show(new THREE.Vector3(this.pos.x,this.pos.y+this.h+0.6,this.pos.z), '+'+this.xp+' XP','#c9e07a',false);
    // loot drop chance
    if(Math.random()<0.28||this.elite){
      Quests.spawnDrop(this.pos.x,this.pos.z,this.elite?2:1);
    }
    if(Quests) Quests.onEnemyKilled(this.key,this);
    if(this.isBoss) Bosses.onBossDefeated(this);
    HUD.dirty=true;
  };
}

/* ==========================================================================
   SECTION 10 - BOSSES
   Five Lords plus an optional guardian. Each has a unique arena, a HUD bar,
   phase 1 / phase 2 with a transition, a signature special attack, a unique
   attack pattern set and a death sequence with a reward.
   ========================================================================== */
const BOSS_DEFS = {
  ashwarden:{ name:'THE ASH WARDEN', region:'village', subtitle:'Lord of Cinders and Sorrow',
    hp:1150, dmg:26, def:0.18, spd:3.6, r:1.5, h:3.4, xp:1400, gold:260, scale:1.7,
    body:0x3a2a20, accent:0xff7a2a, sound:'boss_roar',
    intro:'You burned the village. You burned the children. The ash remembers every name.',
    defeat:'The Warden sinks to one knee. His shard of the Sun Forge falls into your hand, still warm.',
    reward:{shard:0, weapon:'axe', item:'flask_charge'},
    phase2At:0.5, attacks:['cleave','emberwave','ashesurge','cinderring'] },
  forestdevourer:{ name:'THE FOREST DEVOURER', region:'forest', subtitle:'That Which Ate the Roots',
    hp:1450, dmg:30, def:0.2, spd:3.9, r:1.7, h:3.1, xp:1700, gold:300, scale:1.8,
    body:0x2c3a1c, accent:0x9fe07a, sound:'beast',
    intro:'The forest is my stomach. You walked into my mouth, little ember.',
    defeat:'The Devourer collapses into leaf-mould and bone. Something green and living pushes up from the ruin.',
    reward:{shard:1, weapon:'spear', item:'ring_growth'},
    phase2At:0.55, attacks:['tendrils','leapslam','sporecloud','rootcage'] },
  crystalqueen:{ name:'THE CRYSTAL QUEEN', region:'caverns', subtitle:'Sovereign of Reflected Light',
    hp:1550, dmg:34, def:0.16, spd:3.4, r:1.4, h:3.2, xp:1900, gold:340, scale:1.8,
    body:0x2e4c60, accent:0x5fd0e8, sound:'boss_roar',
    intro:'You are a fracture in my perfect hall. Let me polish you out.',
    defeat:'The Queen shatters \u2014 thousands of shards hanging in the dark, each holding a frozen scream.',
    reward:{shard:2, weapon:'greatsword', item:'ring_prism'},
    phase2At:0.5, attacks:['shardvolley','blinkcrystal','prismbeam','crystalcage'] },
  frozensaint:{ name:'THE FROZEN SAINT', region:'cathedral', subtitle:'Who Prayed Until the Ice Came',
    hp:1750, dmg:38, def:0.22, spd:3.5, r:1.5, h:3.3, xp:2200, gold:390, scale:1.9,
    body:0xa8c4db, accent:0xdff4ff, sound:'boss_roar',
    intro:'I begged for stillness. The world kept moving. So I made the world stop.',
    defeat:'The Saint exhales once, and the ice around her heart finally cracks. She looks almost grateful.',
    reward:{shard:3, weapon:'staff', item:'ring_ward'},
    phase2At:0.5, attacks:['frostrings','icepillars','blizzard','judgement'] },
  fallenking:{ name:'THE FALLEN KING', region:'citadel', subtitle:'Last Monarch of the Sun Forge',
    hp:2400, dmg:44, def:0.3, spd:4.0, r:1.6, h:3.6, xp:3200, gold:520, scale:2.0,
    body:0x30281f, accent:0xffd070, sound:'boss_roar',
    intro:'I held the Forge. I held the light. You think you can carry it better than a king?',
    defeat:'The Fallen King kneels in his own cinders, and lets go of a crown he no longer wants.',
    reward:{shard:4, weapon:'greatsword', item:'crown_shard'},
    phase2At:0.5, attacks:['kingsblade','gaplunge','shockwave','bladestorm','royalguard'] },
  forgewarden:{ name:'THE FORGE WARDEN', region:'sunforge', subtitle:'Optional: Keeper of the Last Flame',
    hp:2000, dmg:42, def:0.34, spd:3.8, r:1.6, h:3.5, xp:2600, gold:600, scale:1.9,
    body:0x6a5a3a, accent:0xffc860, sound:'boss_roar',
    intro:'None pass to the anvil without proving their fire.',
    defeat:'The Forge Warden steps aside, and the way to the anvil is open.',
    reward:{shard:-1, weapon:'staff', item:'forge_core'},
    phase2At:0.5, attacks:['hammerfall','moltenring','forgebeam','stoking'], optional:true }
};

var Bosses = {
  active:null, defeated:{}, projectiles:[],
  init(){ this.active=null; },
  defById(id){ return BOSS_DEFS[id]; },
  // Spawn a boss in its arena (idempotent).
  spawn(id, opts){
    opts=opts||{};
    if(this.defeated[id]&&!opts.forceRevive) return null;
    const D=BOSS_DEFS[id];
    const R=regionById(D.region);
    const arena=R.arena;
    const e=makeEnemy('bonevestige', arena.x, arena.z+arena.r*0.4, Player.S.level, false);
    // convert the template entity into a boss
    e.isBoss=true; e.bossId=id;
    e.T=Object.assign({}, e.T, {
      name:D.name, arch:'elite', regions:[D.region], sound:D.sound, staggerRes:70, wind:0.7,
      atkRange:5.2, atkCD:2.2, det:200, body:D.body, accent:D.accent
    });
    e.name=D.name;
    e.arch='elite';
    e.hpMax=Math.round(D.hp); e.hp=e.hpMax;
    e.dmg=D.dmg; e.def=D.def; e.spd=D.spd; e.r=D.r; e.h=D.h;
    e.xp=D.xp; e.gold=D.gold; e.det=200; e.atkRange=5.4; e.atkCDBase=2.0;
    e.phase=1; e.phase2=false; e.specialCD=6; e.attackCD=2.4; e.telegraph=0;
    e.aggro=true; e.alertT=99999; e.homeX=arena.x; e.homeZ=arena.z;
    e.pos.set(arena.x, terrainHeight(arena.x, arena.z), arena.z+arena.r*0.45);
    e.summonedMinions=[];
    buildBossMesh(e, D);
    Enemies.list.push(e);
    HUD.showBoss(e);
    Audio2.play('boss_roar');
    FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,arena.r*0.6,D.accent);
    FX.burst(e.pos.x,e.pos.y+1.5,e.pos.z,70,{color:hexToArr(D.accent),speed:12,life:1.4,size:0.7});
    FX.shake(0.9,1.0);
    this.active=e;
    Player.lockTarget=e; Player.lockOn=true;
    if(Story.bossIntro) Story.bossIntro(id,D);
    return e;
  },
  onBossDefeated(e){
    const D=BOSS_DEFS[e.bossId];
    if(!D) return;
    this.defeated[e.bossId]=true;
    if(this.active===e) this.active=null;
    HUD.hideBoss();
    Player.S.bossesKilled.push(e.bossId);
    // death sequence: slow cinematic burst
    FX.shock(e.pos.x,e.pos.y+0.2,e.pos.z,22,D.accent);
    FX.shock(e.pos.x,e.pos.y+0.2,e.pos.z,14,0xffffff);
    FX.burst(e.pos.x,e.pos.y+e.h*0.5,e.pos.z,150,{color:hexToArr(D.accent),speed:16,life:2.2,size:0.8,up:1.2});
    FX.shake(1.2,1.6);
    Audio2.play('boss_roar',{vol:0.9});
    setTimeout(function(){ Audio2.play('death',{vol:0.6}); },700);
    // rewards
    if(D.reward.weapon&&!Weapons.owned[D.reward.weapon]){ Weapons.owned[D.reward.weapon]=true; Weapons.levels[D.reward.weapon]=1; }
    else if(D.reward.weapon) Weapons.upgrade(D.reward.weapon);
    if(D.reward.item) Inventory.add(D.reward.item,1);
    if(D.reward.shard>=0) Story.collectShard(D.reward.shard);
    else Story.optionalBossDown(e.bossId);
    Player.S.skillPoints+=2; Player.S.statPoints+=4;
    HUD.toast('LORD SLAIN: '+D.name+'  (+2 skill, +4 stat points)');
    Quests.onBossKilled(e.bossId);
    if(Story.onBossDefeated) Story.onBossDefeated(e.bossId,D);
    // revive lock so the boss stays dead
    setTimeout(function(){
      if(e.group) scene.remove(e.group);
    },2600);
    Save.autosave();
  },
  // boss AI: pattern-driven with telegraphed attacks and a phase transition
  update(dt,t){
    const e=this.active;
    if(!e||!e.alive) return;
    e.animT+=dt;
    if(e.hurtFlash>0) e.hurtFlash-=dt;
    if(e.stagger>0){ e.stagger-=dt; e.state='stagger'; this.animateBoss(e,dt); return; }
    if(e.broken>0) e.broken-=dt;
    if(e.slow>0){ e.slow-=dt; if(e.slow<=0) e.slowMul=1; }
    // phase check
    const frac=e.hp/e.hpMax;
    if(!e.phase2 && frac<=BOSS_DEFS[e.bossId].phase2At){
      e.phase2=true; e.phase=2; e.transition=2.0;
      Audio2.play('boss_roar');
      FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,30,0xff5a2a);
      FX.burst(e.pos.x,e.pos.y+1.6,e.pos.z,130,{color:[1,0.4,0.15],speed:18,life:1.6,size:0.8});
      FX.shake(1.0,1.2);
      HUD.bossPhase('PHASE II');
      HUD.toast(e.name+' enters PHASE II — '+BOSS_DEFS[e.bossId].subtitle);
      e.spd*=1.18; e.dmg*=1.22;
      e.transitionT=2.0;
      if(e.onPhase2) e.onPhase2();
    }
    if(e.transitionT>0){ e.transitionT-=dt; this.animateBoss(e,dt); return; }

    // movement: close distance, strafe
    const pd=Player.pos;
    const dx=pd.x-e.pos.x, dz=pd.z-e.pos.z;
    const d=Math.hypot(dx,dz)||1;
    const nx=dx/d, nz=dz/d;
    let tx=0,tz=0;
    e.atkCD-=dt;
    if(e.windT>0){
      e.windT-=dt;
      if(e.windT<=0) this.bossPerform(e);
      e.state='windup';
      this.animateBoss(e,dt); this.moveBoss(e,0,0,dt); return;
    }
    if(e.beamT>0){ this.updateBeam(e,dt); this.animateBoss(e,dt); return; }
    if(e.chargeT>0){
      e.chargeT-=dt;
      this.moveBoss(e, e.chx*22, e.chz*22, dt);
      if(d<4.0||e.chargeT<=0){ e.chargeT=0; this.bossShockwave(e); }
      this.animateBoss(e,dt); return;
    }
    const ideal=e.atkRange*0.62;
    if(d>ideal){ tx=nx; tz=nz; }
    else if(d<ideal*0.55){ tx=-nx; tz=-nz; }
    else { tx=-nz*0.6; tz=nx*0.6; }
    const sp=e.spd*e.slowMul*(e.phase2?1.1:1);
    this.moveBoss(e,tx*sp,tz*sp,dt);
    e.yaw=angLerp(e.yaw,Math.atan2(dx,dz),1-Math.exp(-6*dt));
    // attack selection
    if(e.atkCD<=0 && d<e.atkRange+3){
      this.chooseAttack(e,d);
    }
    this.animateBoss(e,dt);
  },
  moveBoss(e,vx,vz,dt){
    e.vel.x=vx; e.vel.z=vz;
    e.pos.x+=vx*dt; e.pos.z+=vz*dt;
    const gh=terrainHeight(e.pos.x,e.pos.z);
    e.pos.y=gh;
    if(e.group){ e.group.position.set(e.pos.x,e.pos.y,e.pos.z); e.group.rotation.y=e.yaw; }
  },
  chooseAttack(e,d){
    const D=BOSS_DEFS[e.bossId];
    e.attackIndex=(e.attackIndex||0)+1;
    const list=D.attacks;
    let atk;
    if(e.phase2 && Math.random()<0.42) e.specialCD=e.specialCD||0;
    // specials first, then pattern
    if(e.specialCD<=0){
      atk=list[list.length-1];
      e.specialCD=e.phase2?9.5:13.5;
      HUD.comboText('SPECIAL');
    } else {
      atk=list[e.attackIndex%Math.max(1,list.length-1)];
      e.specialCD-=1.6;
    }
    e.pendingAttack=atk;
    e.windT=this.windFor(atk);
    e.atkCD=e.phase2?1.5:2.2;
    // telegraph flash
    this.telegraph(e, atk);
    if(D.sound) Audio2.play(D.sound,{vol:0.4});
  },
  windFor(atk){
    const w={cleave:0.62, emberwave:0.85, ashesurge:1.0, cinderring:1.25,
      tendrils:0.8, leapslam:0.7, sporecloud:1.0, rootcage:1.2,
      shardvolley:0.9, blinkcrystal:0.6, prismbeam:1.1, crystalcage:1.3,
      frostrings:0.95, icepillars:0.9, blizzard:1.35, judgement:1.2,
      kingsblade:0.55, gaplunge:0.6, shockwave:1.0, bladestorm:1.3, royalguard:0.7,
      hammerfall:0.85, moltenring:1.15, forgebeam:1.0, stoking:1.25};
    return w[atk]||0.9;
  },
  telegraph(e,atk){
    FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z, 6+(e.r*2), BOSS_DEFS[e.bossId].accent);
    if(!particlesOff()) FX.burst(e.pos.x,e.pos.y+e.h*0.6,e.pos.z,18,
      {color:hexToArr(BOSS_DEFS[e.bossId].accent),speed:5,life:0.7,size:0.5});
  },
  bossPerform(e){
    const atk=e.pendingAttack; e.pendingAttack=null;
    const D=BOSS_DEFS[e.bossId];
    const pd=Player.pos;
    const dx=pd.x-e.pos.x, dz=pd.z-e.pos.z;
    const d=Math.hypot(dx,dz)||1;
    const nx=dx/d, nz=dz/d;
    const acc=hexToArr(D.accent);
    const hitArc=(range,arc,mult)=>{
      if(d<range&&Math.abs(angDelta(e.yaw,Math.atan2(dx,dz)))<arc)
        Damage.hurtPlayer(e.dmg*mult, e.pos.clone(), e);
    };
    switch(atk){
      /* ---- Ash Warden ---- */
      case 'cleave':{
        FX.slash(e.pos.x+Math.sin(e.yaw)*3, e.pos.y+1.6, e.pos.z+Math.cos(e.yaw)*3, e.yaw, 4.0, D.accent);
        Audio2.play('swing_heavy'); FX.shake(0.35,0.3);
        hitArc(8.5,1.4,1.25);
        if(e.phase2) setTimeout(function(){ if(e.alive) FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,10,0xff7a2a); },220);
        break;
      }
      case 'emberwave':{
        FX.burst(e.pos.x+nx*3,e.pos.y+1.4,e.pos.z+nz*3,60,{color:acc,speed:12,life:1.0,size:0.6,up:0.4});
        FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,13,0xff7a2a); FX.shake(0.55,0.4);
        Audio2.play('fire');
        this.coneHurt(e.pos.x,e.pos.z,e.yaw,1.2,13,e.dmg*1.4);
        break;
      }
      case 'ashesurge':{
        // raise ash pillars in a ring around the player
        for(let i=0;i<8;i++){
          const a=i/8*TAU+rr(-0.2,0.2), rad=rr(3,9);
          this.delayedPillar(pd.x+Math.cos(a)*rad, pd.z+Math.sin(a)*rad, 0.7, 5.5, e.dmg*0.85, 0x8a6a5a);
        }
        Audio2.play('boom',{vol:0.5});
        break;
      }
      case 'cinderring':{
        e.windT=0;
        for(let k=0;k<3;k++) this.delayedRing(e.pos.x,e.pos.z, 2.2+k*2.6, 0.4+k*0.45, e.dmg*0.9, 0xff7a2a);
        Audio2.play('boom');
        FX.shake(0.6,0.5);
        break;
      }
      /* ---- Forest Devourer ---- */
      case 'tendrils':{
        for(let i=0;i<5;i++) this.delayedSpike(pd.x+rr(-7,7), pd.z+rr(-7,7), e.dmg*0.8, 0x9fe07a, 0.55+i*0.12);
        Audio2.play('beast',{vol:0.7});
        break;
      }
      case 'leapslam':{
        e.chargeT=0.42; e.chx=nx; e.chz=nz;
        FX.burst(e.pos.x,e.pos.y+0.4,e.pos.z,26,{color:[0.6,0.8,0.4],speed:8,life:0.6,size:0.5});
        Audio2.play('beast');
        break;
      }
      case 'sporecloud':{
        for(let i=0;i<4;i++){
          const px=e.pos.x+rr(-9,9), pz=e.pos.z+rr(-9,9);
          this.delayedCloud(px,pz,4.6,1.0+i*0.25,e.dmg*0.55,0x9fe07a,4.0);
        }
        Audio2.play('beast',{vol:0.5});
        break;
      }
      case 'rootcage':{
        const cx=pd.x, cz=pd.z;
        for(let i=0;i<12;i++){
          const a=i/12*TAU;
          this.delayedSpike(cx+Math.cos(a)*5.2, cz+Math.sin(a)*5.2, e.dmg*0.75, 0x6ab060, 0.5+i*0.05);
        }
        Audio2.play('boom',{vol:0.5});
        break;
      }
      /* ---- Crystal Queen ---- */
      case 'shardvolley':{
        for(let i=-3;i<=3;i++){
          const a=e.yaw+i*0.16;
          this.bossProjectile(e.pos.x+Math.sin(a)*2, e.pos.y+2.2, e.pos.z+Math.cos(a)*2,
            Math.sin(a), 0.06, Math.cos(a), 22, e.dmg*0.6, 0x5fd0e8, 0.32);
        }
        Audio2.play('ice');
        break;
      }
      case 'blinkcrystal':{
        FX.burst(e.pos.x,e.pos.y+1.6,e.pos.z,30,{color:acc,speed:8,life:0.6,size:0.5});
        Audio2.play('teleport');
        const a=rr(0,TAU), rad=rr(9,15);
        e.pos.x=clamp(pd.x+Math.cos(a)*rad,-CFG.world.sizeX*0.46,CFG.world.sizeX*0.46);
        e.pos.z=clamp(pd.z+Math.sin(a)*rad,-CFG.world.sizeZ*0.46,CFG.world.sizeZ*0.46);
        e.pos.y=terrainHeight(e.pos.x,e.pos.z);
        FX.burst(e.pos.x,e.pos.y+1.6,e.pos.z,30,{color:acc,speed:8,life:0.6,size:0.5});
        FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,7,D.accent);
        break;
      }
      case 'prismbeam':{
        e.beamT=1.5;
        const from=new THREE.Vector3(e.pos.x,e.pos.y+2.6,e.pos.z);
        const dir=new THREE.Vector3(pd.x-from.x,(pd.y+1.0)-from.y,pd.z-from.z).normalize();
        const geo=new THREE.CylinderGeometry(0.55,0.75,60,10,1,true);
        const mesh=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:D.accent,transparent:true,opacity:0.7,
          blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
        mesh.position.copy(from).addScaledVector(dir,30);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
        scene.add(mesh);
        e.beam={mesh:mesh,dir:dir,from:from,life:1.5};
        Audio2.play('arcane');
        FX.shake(0.4,0.6);
        break;
      }
      case 'crystalcage':{
        for(let i=0;i<10;i++){
          const a=i/10*TAU;
          this.delayedCrystal(pd.x+Math.cos(a)*5.5, pd.z+Math.sin(a)*5.5, e.dmg*0.8, 0.5+i*0.06);
        }
        Audio2.play('ice');
        break;
      }
      /* ---- Frozen Saint ---- */
      case 'frostrings':{
        for(let k=0;k<4;k++) this.delayedRing(e.pos.x,e.pos.z,3.0+k*3.0,0.4+k*0.4,e.dmg*0.8,0x9fd8ff);
        Audio2.play('ice');
        break;
      }
      case 'icepillars':{
        for(let i=0;i<7;i++) this.delayedCrystal(pd.x+rr(-10,10), pd.z+rr(-10,10), e.dmg*0.85, 0.45+i*0.1, 0xa8d8ff);
        Audio2.play('ice');
        break;
      }
      case 'blizzard':{
        for(let i=0;i<16;i++) this.delayedCloud(e.pos.x+rr(-18,18), e.pos.z+rr(-18,18), 5.2, 1.0+i*0.06, e.dmg*0.5, 0xbfe8ff, 4.2);
        FX.shake(0.5,1.2);
        Audio2.play('ice');
        break;
      }
      case 'judgement':{
        for(let i=0;i<6;i++) this.delayedPillar(pd.x+rr(-11,11), pd.z+rr(-11,11), 0.85+i*0.16, 6.5, e.dmg*1.0, 0xdff4ff);
        Audio2.play('lightning',{vol:0.6});
        break;
      }
      /* ---- Fallen King ---- */
      case 'kingsblade':{
        Audio2.play('swing_heavy');
        FX.slash(e.pos.x+Math.sin(e.yaw)*3.4,e.pos.y+1.7,e.pos.z+Math.cos(e.yaw)*3.4,e.yaw,4.6,D.accent);
        hitArc(9.0,1.5,1.2);
        if(e.phase2){
          for(let i=0;i<3;i++) this.delayedSpike(pd.x+rr(-6,6),pd.z+rr(-6,6),e.dmg*0.6,0xffd070,0.4+i*0.2);
        }
        break;
      }
      case 'gaplunge':{
        e.chargeT=0.5; e.chx=nx; e.chz=nz;
        FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,7,D.accent);
        Audio2.play('swing_heavy');
        break;
      }
      case 'shockwave':{
        for(let k=0;k<3;k++) this.delayedRing(e.pos.x,e.pos.z,3.5+k*3.5,0.5+k*0.45,e.dmg*0.85,0xffb060);
        Audio2.play('boom');
        FX.shake(0.7,0.6);
        break;
      }
      case 'bladestorm':{
        for(let i=0;i<14;i++){
          const a=rr(0,TAU), rad=rr(4,16);
          this.delayedSpike(e.pos.x+Math.cos(a)*rad, e.pos.z+Math.sin(a)*rad, e.dmg*0.7, 0xffd070, 0.5+i*0.09);
        }
        for(let i=0;i<5;i++) this.delayedSpike(pd.x+rr(-8,8),pd.z+rr(-8,8),e.dmg*0.7,0xffe0a0,0.6+i*0.2);
        Audio2.play('boom');
        break;
      }
      case 'royalguard':{
        // heals slightly and spawns knights
        e.hp=Math.min(e.hpMax,e.hp+e.hpMax*0.02);
        FX.burst(e.pos.x,e.pos.y+1.6,e.pos.z,40,{color:[1,0.8,0.4],speed:9,life:1.0,size:0.6});
        if(Enemies.countAlive()<CFG.maxEnemiesActive){
          for(let i=0;i<2;i++){
            const s=Enemies.spawn('fallenknight', e.pos.x+rr(-7,7), e.pos.z+rr(-7,7), Player.S.level,false);
            if(s){ s.aggro=true; s.alertT=20;
              FX.burst(s.pos.x,s.pos.y+1,s.pos.z,22,{color:acc,speed:6,life:0.7,size:0.5}); }
          }
        }
        break;
      }
      /* ---- Forge Warden (optional) ---- */
      case 'hammerfall':{
        Audio2.play('boom');
        FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,12,0xffc860);
        for(let i=0;i<5;i++) this.delayedPillar(pd.x+rr(-8,8),pd.z+rr(-8,8),0.6+i*0.16,6.0,e.dmg*0.9,0xffc860);
        FX.shake(0.6,0.5);
        break;
      }
      case 'moltenring':{
        for(let k=0;k<3;k++) this.delayedRing(e.pos.x,e.pos.z,3.0+k*3.2,0.45+k*0.4,e.dmg*0.9,0xffa030);
        Audio2.play('fire');
        break;
      }
      case 'forgebeam':{
        e.beamT=1.7;
        const from=new THREE.Vector3(e.pos.x,e.pos.y+2.8,e.pos.z);
        const dir=new THREE.Vector3(pd.x-from.x,(pd.y+1.0)-from.y,pd.z-from.z).normalize();
        const mesh=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.9,60,10,1,true),
          new THREE.MeshBasicMaterial({color:0xffc860,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
        mesh.position.copy(from).addScaledVector(dir,30);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
        scene.add(mesh);
        e.beam={mesh:mesh,dir:dir,from:from,life:1.7};
        Audio2.play('lightning',{vol:0.6});
        break;
      }
      case 'stoking':{
        e.spd*=1.08;
        FX.burst(e.pos.x,e.pos.y+2,e.pos.z,50,{color:[1,0.7,0.3],speed:10,life:1.1,size:0.6});
        HUD.comboText('STOKED');
        break;
      }
      default:{
        hitArc(7,1.2,1.0);
      }
    }
    if(e.group){ e.group.position.set(e.pos.x,e.pos.y,e.pos.z); e.group.rotation.y=e.yaw; }
  },
  bossShockwave(e){
    const D=BOSS_DEFS[e.bossId];
    FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,11,D.accent);
    FX.shake(0.7,0.5); Audio2.play('boom');
    const dx=Player.pos.x-e.pos.x, dz=Player.pos.z-e.pos.z;
    if(Math.hypot(dx,dz)<11) Damage.hurtPlayer(e.dmg*1.15, e.pos.clone(), e);
    this.delayedRing(e.pos.x,e.pos.z,4,0.3,e.dmg*0.7,D.accent);
  },
  updateBeam(e,dt){
    const b=e.beam;
    if(!b)return;
    b.life-=dt;
    const tgt=new THREE.Vector3(Player.pos.x,Player.pos.y+1.0,Player.pos.z);
    const newDir=tgt.clone().sub(b.from).normalize();
    b.dir.lerp(newDir, 1-Math.exp(-2.4*dt)).normalize();
    b.mesh.position.copy(b.from).addScaledVector(b.dir,30);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.dir);
    b.mesh.material.opacity=0.5+0.25*Math.sin(performance.now()*0.03);
    // beam damage: point-line distance
    const toP=new THREE.Vector3(Player.pos.x,Player.pos.y+1.0,Player.pos.z).sub(b.from);
    const along=toP.dot(b.dir);
    if(along>0){
      const closest=b.from.clone().addScaledVector(b.dir,along);
      const dist=new THREE.Vector3(Player.pos.x,Player.pos.y+1.0,Player.pos.z).distanceTo(closest);
      if(dist<1.5 && Math.random()<dt*4) Damage.hurtPlayer(e.dmg*0.5, e.pos.clone(), e);
    }
    if(!particlesOff()&&Math.random()<dt*40){
      const p=b.from.clone().addScaledVector(b.dir, rr(2,50));
      FX.spawn(p.x,p.y,p.z,rr(-1,1),rr(-1,1),rr(-1,1),1,0.8,0.4,0.5,0.5);
    }
    if(b.life<=0){ scene.remove(b.mesh); e.beam=null; }
  },
  // ---- delayed effect helpers -------------------------------------------
  delayedRing(x,z,radius,delay,dmg,color){
    this.addTimed({t:delay,fn:function(){
      FX.shock(x,terrainHeight(x,z)+0.1,z,radius,color);
      FX.burst(x,terrainHeight(x,z)+0.3,z,26,{color:hexToArr(color),speed:7,life:0.7,size:0.5,up:0.5});
      Audio2.play('boom',{vol:0.4});
      const pdx=Player.pos.x-x, pdz=Player.pos.z-z;
      if(Math.hypot(pdx,pdz)<radius) Damage.hurtPlayer(dmg, new THREE.Vector3(x,0,z), Bosses.active);
    }});
  },
  delayedPillar(x,z,delay,height,dmg,color){
    this.addTimed({t:delay,fn:function(){
      const h=terrainHeight(x,z);
      const m=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.5,height,8),
        new THREE.MeshStandardMaterial({color:color,emissive:color,emissiveIntensity:0.9,roughness:0.6}));
      m.position.set(x,h+height/2,z); m.castShadow=true; scene.add(m);
      FX.burst(x,h+0.5,z,30,{color:hexToArr(color),speed:8,life:0.7,size:0.5});
      Audio2.play('hit',{vol:0.4});
      FX.shake(0.16,0.2);
      const pdx=Player.pos.x-x, pdz=Player.pos.z-z;
      if(Math.hypot(pdx,pdz)<2.2) Damage.hurtPlayer(dmg,new THREE.Vector3(x,0,z),Bosses.active);
      SpellFX.add(m,1.4);
      setTimeout(function(){ m.material.transparent=true; },900);
    }});
  },
  delayedSpike(x,z,dmg,color,delay){
    this.addTimed({t:delay,fn:function(){
      const h=terrainHeight(x,z);
      const m=new THREE.Mesh(new THREE.ConeGeometry(0.7,3.4,5),
        new THREE.MeshStandardMaterial({color:color,emissive:color,emissiveIntensity:0.6,roughness:0.7}));
      m.position.set(x,h+0.6,z); m.castShadow=true; m.scale.y=0.1; scene.add(m);
      m.userData.growCone=3.4;
      Bosses.cones.push({m:m,t:0});
      FX.burst(x,h+0.4,z,18,{color:hexToArr(color),speed:7,life:0.6,size:0.45});
      Audio2.play('hit',{vol:0.35});
      const pdx=Player.pos.x-x, pdz=Player.pos.z-z;
      if(Math.hypot(pdx,pdz)<1.9) Damage.hurtPlayer(dmg,new THREE.Vector3(x,0,z),Bosses.active);
      SpellFX.add(m,1.8);
    }});
  },
  delayedCrystal(x,z,dmg,delay,color){
    color=color||0x5fd0e8;
    this.addTimed({t:delay,fn:function(){
      const h=terrainHeight(x,z);
      const m=new THREE.Mesh(new THREE.OctahedronGeometry(1.1,0),
        new THREE.MeshStandardMaterial({color:color,emissive:color,emissiveIntensity:1.0,roughness:0.3}));
      m.position.set(x,h+1.6,z); m.scale.y=2.0; m.castShadow=true; scene.add(m);
      FX.shock(x,h+0.1,z,4.0,color);
      FX.burst(x,h+1,z,22,{color:hexToArr(color),speed:8,life:0.7,size:0.5});
      Audio2.play('ice',{vol:0.5});
      const pdx=Player.pos.x-x, pdz=Player.pos.z-z;
      if(Math.hypot(pdx,pdz)<2.4) Damage.hurtPlayer(dmg,new THREE.Vector3(x,0,z),Bosses.active);
      if(Bosses.active&&Bosses.active.bossId==='frozensaint') Player.slowT=1.6;
      SpellFX.add(m,1.6);
    }});
  },
  delayedCloud(x,z,radius,delay,dmg,color,dur){
    this.addTimed({t:delay,fn:function(){
      const h=terrainHeight(x,z);
      const m=new THREE.Mesh(new THREE.SphereGeometry(radius*0.7,10,8),
        new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false}));
      m.position.set(x,h+1.6,z); m.scale.y=0.6; scene.add(m);
      Bosses.clouds.push({m:m,x:x,z:z,r:radius,dmg:dmg,life:dur,tick:0});
      Audio2.play('beast',{vol:0.3});
    }});
  },
  coneHurt(x,z,yaw,arc,range,dmg){
    const dx=Player.pos.x-x, dz=Player.pos.z-z;
    const d=Math.hypot(dx,dz);
    if(d<range && Math.abs(angDelta(yaw,Math.atan2(dx,dz)))<arc)
      Damage.hurtPlayer(dmg, new THREE.Vector3(x,0,z), Bosses.active);
  },
  bossProjectile(x,y,z,dx,dy,dz,speed,dmg,color,size){
    const m=new THREE.Mesh(new THREE.SphereGeometry(size,8,6),
      new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.position.set(x,y,z); scene.add(m);
    const light=new THREE.PointLight(color,1.3,14,2); light.position.set(x,y,z); scene.add(light);
    this.projectiles.push({mesh:m,light:light,pos:new THREE.Vector3(x,y,z),
      dir:new THREE.Vector3(dx,dy,dz).normalize(),speed:speed,life:4.0,dmg:dmg,color:color});
  },
  addTimed(o){ this.timers=this.timers||[]; o.tLeft=o.t; this.timers.push(o); },
  updateTimed(dt){
    this.cones=this.cones||[]; this.clouds=this.clouds||[];
    if(this.timers){
      for(let i=this.timers.length-1;i>=0;i--){
        const tm=this.timers[i]; tm.tLeft-=dt;
        if(tm.tLeft<=0){ tm.fn(); this.timers.splice(i,1); }
      }
    }
    for(let i=this.cones.length-1;i>=0;i--){
      const c=this.cones[i]; c.t+=dt;
      if(c.t<0.22) c.m.scale.y=0.1+(c.t/0.22)*0.95;
      if(c.t>1.0){ scene.remove(c.m); this.cones.splice(i,1); }
    }
    for(let i=this.clouds.length-1;i>=0;i--){
      const c=this.clouds[i];
      c.life-=dt; c.tick-=dt;
      c.m.material.opacity=0.1+0.14*Math.max(0,c.life/4);
      if(c.tick<=0){
        c.tick=0.7;
        const dx=Player.pos.x-c.x, dz=Player.pos.z-c.z;
        if(Math.hypot(dx,dz)<c.r && Damage.hurtPlayer(c.dmg, new THREE.Vector3(c.x,0,c.z), Bosses.active)){
          FX.burst(Player.pos.x,Player.pos.y+1,Player.pos.z,10,{color:[0.6,0.9,0.6],speed:4,life:0.5,size:0.35});
        }
      }
      if(c.life<=0){ scene.remove(c.m); this.clouds.splice(i,1); }
    }
    // boss projectiles
    for(let i=this.projectiles.length-1;i>=0;i--){
      const pr=this.projectiles[i];
      pr.life-=dt;
      pr.pos.addScaledVector(pr.dir, pr.speed*dt);
      pr.mesh.position.copy(pr.pos); if(pr.light) pr.light.position.copy(pr.pos);
      const gh=terrainHeight(pr.pos.x,pr.pos.z);
      let dead=pr.life<=0||pr.pos.y<gh;
      if(!dead){
        const dx=Player.pos.x-pr.pos.x, dz=Player.pos.z-pr.pos.z, dy=(Player.pos.y+1)-pr.pos.y;
        if(dx*dx+dz*dz<1.6&&Math.abs(dy)<1.7){
          Damage.hurtPlayer(pr.dmg, pr.pos.clone(), this.active);
          FX.burst(pr.pos.x,pr.pos.y,pr.pos.z,16,{color:hexToArr(pr.color),speed:6,life:0.5,size:0.4});
          dead=true;
        }
      }
      if(dead){ scene.remove(pr.mesh); if(pr.light) scene.remove(pr.light); this.projectiles.splice(i,1); }
    }
  },
  animateBoss(e,dt){
    if(!e.group) return;
    e.group.position.set(e.pos.x,e.pos.y,e.pos.z);
    e.group.rotation.y=e.yaw;
    const D=BOSS_DEFS[e.bossId];
    const t=e.animT;
    const beat=Math.sin(t*3.4)*0.06;
    e.group.position.y=e.pos.y+Math.max(0,beat);
    if(e.parts.core) e.parts.core.material.emissiveIntensity=(e.phase2?1.7:0.9)+Math.sin(t*4)*0.25;
    if(e.parts.aura){
      e.parts.aura.material.opacity=(e.phase2?0.34:0.2)+0.1*Math.sin(t*2.4);
      e.parts.aura.rotation.z+=dt*0.7;
    }
    if(e.parts.blade){
      const wind=(e.windT>0)?1:0;
      e.parts.blade.rotation.x=-2.2*wind-(e.attackT>0?0.4:0);
    }
    if(e.windT>0){
      const k=1-e.windT/this.windFor(e.pendingAttack||'cleave');
      e.group.scale.setScalar(1+k*0.06);
    } else {
      e.group.scale.setScalar(damp(e.group.scale.x,1,8,dt));
    }
    if(e.stagger>0){ e.group.rotation.z=Math.sin(t*22)*0.14; e.group.rotation.x=-0.3; }
    else { e.group.rotation.z*=0.9; e.group.rotation.x*=0.9; }
  },
  // Called when the player rests so defeated optional bosses can respawn.
  onRest(){ /* bosses stay defeated */ }
};

/* --------------------------------------------------------------------------
   Boss visual construction — large, distinct silhouettes per Lord.
   -------------------------------------------------------------------------- */
function buildBossMesh(e, D){
  if(e.group) scene.remove(e.group);
  const g=new THREE.Group();
  const bodyMat=TEX.std(D.body,0.8,0.12);
  const accentMat=TEX.emissive(D.accent,1.15);
  const darkMat=TEX.std(0x14100e,0.9,0.15);
  const steelMat=TEX.std(0xb8bec9,0.34,0.85);
  const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
    m.castShadow=true; m.receiveShadow=true; g.add(m); return m; };
  e.parts={};
  const kind=e.bossId;
  if(kind==='ashwarden'||kind==='fallenking'||kind==='forgewarden'){
    const tall = kind==='fallenking'?1.25:(kind==='forgewarden'?1.15:1.0);
    add(new THREE.BoxGeometry(1.5,1.5,1.0), bodyMat, 0,1.9*tall,0);
    e.parts.core=add(new THREE.BoxGeometry(1.75,0.7,1.2), bodyMat, 0,2.85*tall,0);
    add(new THREE.BoxGeometry(0.9,0.62,0.66), darkMat, 0,3.4*tall,0);
    add(new THREE.BoxGeometry(1.5,0.3,0.4), accentMat, 0,2.35*tall,0.62);
    const eyes=[];
    eyes.push(add(new THREE.BoxGeometry(0.18,0.11,0.1), accentMat,-0.2,3.42*tall,0.36));
    eyes.push(add(new THREE.BoxGeometry(0.18,0.11,0.1), accentMat,0.2,3.42*tall,0.36));
    e.parts.eyes=eyes;
    if(kind==='fallenking'){
      const crown=add(new THREE.CylinderGeometry(0.62,0.5,0.3,8), TEX.emissive(0xffd070,0.9), 0,3.8,0);
      e.parts.crown=crown;
      e.parts.blade=add(new THREE.BoxGeometry(0.24,3.6,0.07), steelMat, 1.55,2.2,0.2);
      e.parts.blade.position.set(1.5,2.1,0.25);
      e.parts.blade.rotation.z=-0.08;
    } else {
      e.parts.blade=add(new THREE.BoxGeometry(0.2,2.6,0.06), accentMat, 1.4,1.9,0.2);
    }
    for(let s=-1;s<=1;s+=2){
      add(new THREE.SphereGeometry(0.46,10,8), bodyMat, s*1.0,2.85*tall,0);
      e.parts['arm'+(s<0?'L':'R')]=add(new THREE.BoxGeometry(0.44,1.6,0.44), bodyMat, s*1.05,1.85*tall,0);
    }
    add(new THREE.BoxGeometry(1.3,0.4,0.7), darkMat, 0,1.05*tall,0);
    add(new THREE.CylinderGeometry(0.36,0.3,1.4,7), bodyMat, -0.45,0.7*tall,0);
    add(new THREE.CylinderGeometry(0.36,0.3,1.4,7), bodyMat, 0.45,0.7*tall,0);
    e.parts.aura=add(new THREE.RingGeometry(1.6,2.4,32),
      new THREE.MeshBasicMaterial({color:D.accent,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    e.parts.aura.rotation.x=-Math.PI/2; e.parts.aura.position.y=0.1;
    e.h=3.8*tall;
    e.parts.healthBar=null; e.parts.healthBarGroup=new THREE.Group();
  } else if(kind==='forestdevourer'){
    add(new THREE.BoxGeometry(1.7,1.4,3.6), bodyMat, 0,1.35,0);
    e.parts.core=add(new THREE.BoxGeometry(1.5,1.3,1.5), bodyMat, 0,1.6,2.1);
    const eyes=[];
    eyes.push(add(new THREE.SphereGeometry(0.19,8,6), accentMat,-0.34,2.0,3.1));
    eyes.push(add(new THREE.SphereGeometry(0.19,8,6), accentMat,0.34,2.0,3.1));
    e.parts.eyes=eyes;
    // thorned spine
    for(let i=0;i<6;i++){
      const sp=add(new THREE.ConeGeometry(0.34,1.5,5), accentMat, 0,2.5-i*0.06,-1.4+i*0.5);
      sp.rotation.x=-0.4;
    }
    for(let s=-1;s<=1;s+=2){
      for(let f=-1;f<=1;f+=2){
        const leg=add(new THREE.CylinderGeometry(0.3,0.22,1.5,6), bodyMat, s*0.85,0.75,f*1.1);
        e.parts['leg'+s+f]=leg;
      }
      e.parts['arm'+(s<0?'L':'R')]=add(new THREE.ConeGeometry(0.5,1.9,6), bodyMat, s*1.2,1.4,1.6);
    }
    const tail=add(new THREE.ConeGeometry(0.6,3.2,6), bodyMat, 0,1.5,-2.4);
    tail.rotation.x=Math.PI/2+0.3; e.parts.tail=tail;
    e.parts.aura=add(new THREE.RingGeometry(2.0,2.9,32),
      new THREE.MeshBasicMaterial({color:D.accent,transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    e.parts.aura.rotation.x=-Math.PI/2; e.parts.aura.position.y=0.12;
    e.h=3.4;
    e.parts.healthBar=null; e.parts.healthBarGroup=new THREE.Group();
  } else if(kind==='crystalqueen'){
    add(new THREE.BoxGeometry(1.2,1.9,0.9), bodyMat, 0,2.2,0);
    e.parts.core=add(new THREE.BoxGeometry(1.4,0.6,1.05), bodyMat, 0,3.3,0);
    add(new THREE.BoxGeometry(0.7,0.6,0.62), darkMat, 0,3.85,0);
    const eyes=[];
    eyes.push(add(new THREE.SphereGeometry(0.13,8,6), accentMat,-0.18,3.85,0.34));
    eyes.push(add(new THREE.SphereGeometry(0.13,8,6), accentMat,0.18,3.85,0.34));
    e.parts.eyes=eyes;
    // crystal crown and radiant wings
    for(let i=0;i<7;i++){
      const a=-0.9+i*0.3;
      const cr=add(new THREE.OctahedronGeometry(0.42,0), accentMat, Math.sin(a)*1.1,4.3+Math.cos(a)*0.35,Math.cos(a)*0.3);
      cr.scale.set(0.6,2.1,0.6); cr.rotation.z=a*0.4;
    }
    for(let s=-1;s<=1;s+=2){
      for(let i=0;i<3;i++){
        const cr=add(new THREE.OctahedronGeometry(0.5,0), accentMat, s*(1.0+i*0.42),3.0-i*0.44,-0.2+i*0.12);
        cr.scale.set(0.5,1.7,0.5); cr.rotation.z=s*(0.5+i*0.24);
      }
      e.parts['arm'+(s<0?'L':'R')]=add(new THREE.BoxGeometry(0.32,1.3,0.32), bodyMat, s*1.0,2.5,0);
    }
    e.parts.aura=add(new THREE.RingGeometry(1.8,2.7,32),
      new THREE.MeshBasicMaterial({color:D.accent,transparent:true,opacity:0.24,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    e.parts.aura.rotation.x=-Math.PI/2; e.parts.aura.position.y=0.1;
    e.h=4.4;
    e.parts.healthBar=null; e.parts.healthBarGroup=new THREE.Group();
  } else if(kind==='frozensaint'){
    add(new THREE.BoxGeometry(1.3,2.0,1.0), bodyMat, 0,2.1,0);
    e.parts.core=add(new THREE.BoxGeometry(1.5,0.6,1.1), bodyMat, 0,3.25,0);
    add(new THREE.BoxGeometry(0.72,0.62,0.64), darkMat, 0,3.8,0);
    const halo=add(new THREE.TorusGeometry(0.95,0.1,8,26), accentMat, 0,4.5,0);
    halo.rotation.x=Math.PI/2; e.parts.halo=halo;
    const eyes=[];
    eyes.push(add(new THREE.SphereGeometry(0.12,8,6), accentMat,-0.18,3.8,0.34));
    eyes.push(add(new THREE.SphereGeometry(0.12,8,6), accentMat,0.18,3.8,0.34));
    e.parts.eyes=eyes;
    for(let s=-1;s<=1;s+=2){
      add(new THREE.SphereGeometry(0.42,10,8), bodyMat, s*0.95,3.2,0);
      e.parts['arm'+(s<0?'L':'R')]=add(new THREE.BoxGeometry(0.4,1.5,0.4), bodyMat, s*1.0,2.3,0);
    }
    // ice shards radiating from the back
    for(let i=0;i<9;i++){
      const a=(i/9)*TAU;
      const sh=add(new THREE.ConeGeometry(0.26,2.2,5), accentMat, Math.sin(a)*1.4,3.0+Math.cos(a)*0.2,-0.7);
      sh.rotation.set(rr(-0.3,0.3), a, rr(-0.4,0.4));
    }
    add(new THREE.CylinderGeometry(0.34,0.28,1.5,7), bodyMat, -0.4,0.8,0);
    add(new THREE.CylinderGeometry(0.34,0.28,1.5,7), bodyMat, 0.4,0.8,0);
    e.parts.aura=add(new THREE.RingGeometry(2.0,3.0,32),
      new THREE.MeshBasicMaterial({color:D.accent,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    e.parts.aura.rotation.x=-Math.PI/2; e.parts.aura.position.y=0.1;
    e.h=4.6;
    e.parts.healthBar=null; e.parts.healthBarGroup=new THREE.Group();
  }
  e.group=g;
  g.position.copy(e.pos);
  g.rotation.y=e.yaw;
  scene.add(g);
}
function hexToArr(hex){ const c=new THREE.Color(hex); return [c.r,c.g,c.b]; }
