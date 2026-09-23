
/* ==========================================================================
   SECTION 7 - COMBAT
   Attack wind-up/active/recovery, arc sweeps, stagger & critical hits.
   ========================================================================== */
function diffScale(){
  // difficulty 0 = Squire, 1 = Warden, 2 = Ashen Lord
  return [0.8,1.0,1.3][clamp(diffIndex,0,2)];
}

const Damage = {
  // player -> enemy
  hurtEnemy(e, amount, fromPos, opt){
    if(!e||!e.alive) return 0;
    opt=opt||{};
    let dmg=amount;
    let crit=false;
    const backAttack = (function(){
      if(!fromPos) return false;
      const facing=new THREE.Vector3(Math.sin(e.yaw),0,Math.cos(e.yaw));
      const toP=new THREE.Vector3(Player.pos.x-e.pos.x,0,Player.pos.z-e.pos.z);
      if(toP.lengthSq()<0.0001) return false;
      toP.normalize();
      return facing.dot(toP)>0.45 && !e.aggro;
    })();
    const broke=e.broken||0;
    if(e.broken>0) crit=true;
    else if(opt.crit) crit=true;
    else if(Math.random()<Player.D.critChance) crit=true;
    if(backAttack) { crit=true; dmg*=CFG.combat.backstabMult; }
    if(crit) dmg*=Player.D.critMult;
    dmg=Math.max(1,dmg*(1-e.def*0.35));
    e.hp-=dmg;
    e.aggro=true; e.alertT=6;
    e.hurtFlash=0.16;
    e.applyStagger((opt.stagger||0)+ (crit?22:10));
    if(opt.knockback) e.knockback(opt.knockback);
    // feedback
    const pos=new THREE.Vector3(e.pos.x, e.pos.y+e.h*0.85, e.pos.z);
    DmgText.show(pos, (crit?'':'')+Math.round(dmg), crit?'#ffd24a':'#ffe9c8', crit);
    if(crit){
      Audio2.play('hit_crit');
      HUD.hitMarker(1.0);
      FX.shake(0.34,0.22);
      FX.shock(e.pos.x,e.pos.y+0.1,e.pos.z,e.r*2.4,0xffd24a);
      FX.burst(pos.x,pos.y,pos.z,22,{color:[1,0.8,0.35],speed:8,life:0.6,size:0.45});
    } else {
      Audio2.play('hit');
      HUD.hitMarker(0.6);
      FX.shake(0.18,0.16);
      FX.burst(pos.x,pos.y,pos.z,14,{color:[0.95,0.55,0.3],speed:6,life:0.5,size:0.38});
    }
    FX.burst(pos.x,pos.y,pos.z,6,{color:[0.6,0.08,0.06],speed:4.5,life:0.55,size:0.3});
    if(e.hp<=0) e.die();
    return dmg;
  },
  // enemy -> player
  hurtPlayer(amount, fromPos, attacker){
    if(Player.invuln>0&&Player.state!=='block') return false;
    return Player.takeDamage(amount*diffScale(), fromPos, {attacker:attacker});
  },
  // generic area damage used by spells and boss attacks
  areaHurt(x,z,radius,amount,opt){
    opt=opt||{};
    let hits=0;
    for(let i=0;i<Enemies.list.length;i++){
      const e=Enemies.list[i];
      if(!e.alive) continue;
      const dx=e.pos.x-x, dz=e.pos.z-z;
      const dy=Math.abs(e.pos.y-(opt.y===undefined?e.pos.y:opt.y));
      if(dx*dx+dz*dz<radius*radius && dy<8){
        this.hurtEnemy(e, amount, new THREE.Vector3(x,0,z), opt);
        hits++;
      }
    }
    return hits;
  },
  spellHurt(e, amount, opt){
    opt=opt||{};
    if(!e||!e.alive) return 0;
    const dmg=Math.max(1,amount*(1-e.def*0.28));
    e.hp-=dmg;
    e.aggro=true; e.alertT=6;
    e.hurtFlash=0.18;
    const pos=new THREE.Vector3(e.pos.x,e.pos.y+e.h*0.85,e.pos.z);
    DmgText.show(pos, Math.round(dmg), opt.color||'#9fd0ff', opt.big===true);
    FX.burst(pos.x,pos.y,pos.z,12,{color:opt.pc||[0.6,0.85,1],speed:6,life:0.6,size:0.4});
    if(opt.stagger) e.applyStagger(opt.stagger);
    if(opt.knockback) e.knockback(opt.knockback);
    if(e.hp<=0) e.die();
    return dmg;
  }
};

const Combat = {
  init(){ this.attackHitDone=false; },
  // ---- attack initiation -------------------------------------------------
  lightAttack(){
    const pl=Player;
    if(pl.dead||pl.state==='roll'||pl.state==='hurt'||pl.state==='cast'||pl.state==='drink') return;
    const w=Weapons.current();
    // chaining inside the combo window
    if(pl.state==='attack'){
      if(pl.stateT>w.attackTime*0.42){ pl.queuedAttack=true; }
      return;
    }
    if(pl.state==='heavy'||pl.state==='charge'){ pl.queuedAttack=true; return; }
    if(pl.stam<w.stam*0.8){ HUD.comboText('EXHAUSTED'); Audio2.play('ui_back'); return; }
    if(pl.comboWindow<=0) pl.comboStep=0; else pl.comboStep=(pl.comboStep+1)%w.combo.length;
    pl.state='attack'; pl.stateT=0; pl.attackHitDone=false;
    pl.stam-=w.stam; pl.regenDelay=CFG.combat.regenDelay;
    Audio2.play('swing');
    this.faceTargetAssist();
  },
  heavyAttack(){
    const pl=Player;
    if(pl.dead||pl.state==='roll'||pl.state==='hurt'||pl.state==='cast'||pl.state==='drink') return;
    const w=Weapons.current();
    if(pl.stam<w.stam*1.6){ HUD.comboText('EXHAUSTED'); Audio2.play('ui_back'); return; }
    pl.state='heavy'; pl.stateT=0; pl.attackHitDone=false;
    pl.comboStep=0; pl.stam-=w.stam*1.75; pl.regenDelay=CFG.combat.regenDelay;
    Audio2.play('swing_heavy');
    this.faceTargetAssist();
  },
  startCharge(){
    const pl=Player;
    if(pl.charging||pl.dead||pl.state==='roll'||pl.state==='hurt'||pl.state==='cast'||pl.state==='drink') return;
    const w=Weapons.current();
    if(pl.stam<w.stam*2) return;
    pl.charging=true; pl.chargeT=0;
    pl.state='charge'; pl.stateT=0; pl.attackHitDone=true;
  },
  releaseCharge(){
    const pl=Player;
    if(!pl.charging) return;
    const w=Weapons.current();
    pl.charging=false;
    if(pl.chargeT<0.3||pl.stam<w.stam*2){
      // too short or too tired: fall through to a normal swing
      pl.state='idle'; pl.stateT=0; pl.chargeT=0;
      return;
    }
    pl.state='charge'; pl.stateT=0; pl.attackHitDone=false;
    pl.stam-=w.stam*2; pl.regenDelay=CFG.combat.regenDelay;
    pl.chargedPower=clamp(pl.chargeT/1.15,0.6,1.5);
    Audio2.play('swing_heavy');
    FX.shock(pl.pos.x,pl.pos.y+0.1,pl.pos.z,3.2,0xffc060);
  },
  faceTargetAssist(){
    // small snap toward the nearest enemy in a forward cone (feels responsive)
    const pl=Player;
    let best=null,bd=1e9;
    for(let i=0;i<Enemies.list.length;i++){
      const e=Enemies.list[i]; if(!e.alive) continue;
      const dx=e.pos.x-pl.pos.x, dz=e.pos.z-pl.pos.z;
      const d=Math.hypot(dx,dz);
      if(d>5.6) continue;
      const a=Math.atan2(dx,dz);
      if(Math.abs(angDelta(pl.yaw,a))>1.1) continue;
      if(d<bd){bd=d;best=e;}
    }
    if(best){
      const a=Math.atan2(best.pos.x-pl.pos.x,best.pos.z-pl.pos.z);
      pl.yaw=angLerp(pl.yaw,a,0.7);
    }
  },
  // ---- per-frame resolution ---------------------------------------------
  resolveAttack(pl,dt){
    const st=pl.state;
    if(st==='charge'&&pl.charging){
      pl.chargeT+=dt;
      if(pl.chargeT>1.6){ this.releaseCharge(); }
      if(!particlesOff()&&Math.random()<dt*22){
        const fp=pl.frontPoint(1.4,1.4);
        FX.spawn(fp.x+rr(-0.5,0.5),fp.y+rr(-0.6,0.6),fp.z+rr(-0.5,0.5),0,1.2,0,1,0.7,0.3,0.35,0.5);
      }
      return;
    }
    if(st!=='attack'&&st!=='heavy'&&st!=='charge') return;
    const w=Weapons.current();
    const dur=aDur(pl);
    const prog=pl.stateT/dur;
    // active window is the middle of the animation
    const activeStart=0.24, activeEnd=0.62;
    if(!pl.attackHitDone && prog>=activeStart && prog<=activeEnd+0.1){
      pl.attackHitDone=this.doSweep(pl,w);
    }
    // weapon trail
    if(prog>activeStart-0.06&&prog<activeEnd+0.1&&!particlesOff()){
      const wm=Weapons.meshes[w.id];
      if(wm){
        pl.trailPts.length=0;
        const tip=new THREE.Vector3(0,2.0,0);
        wm.updateMatrixWorld(true);
        for(let i=0;i<6;i++){
          const v=tip.clone().applyMatrix4(wm.matrixWorld).lerp(pl.frontPoint(1.4,1.2), i/6);
          pl.trailPts.push(v);
        }
        FX.trail(pl.trailPts, w.kind==='staff'?0x9fd0ff:0xffd9a0);
      }
    }
    if(prog>=1){
      pl.comboWindow=(st==='attack')?0.42:0.0;
      if(pl.queuedAttack && st==='attack' && pl.stam>=w.stam*0.8){
        pl.queuedAttack=false;
        const next=(pl.comboStep+1)%w.combo.length;
        if(next!==0||w.combo.length>1){
          pl.comboStep=next; pl.state='attack'; pl.stateT=0; pl.attackHitDone=false;
          pl.stam-=w.stam*0.85;
          Audio2.play('swing');
          this.faceTargetAssist();
          return;
        }
      }
      if(pl.queuedAttack && st==='attack'){ Combat.heavyAttack(); pl.queuedAttack=false; return; }
      pl.queuedAttack=false;
      pl.state='idle'; pl.stateT=0;
    }
  },
  // ---- the actual hit test ----------------------------------------------
  doSweep(pl,w){
    let did=false;
    const isHeavy=(pl.state==='heavy');
    const isCharge=(pl.state==='charge');
    let spec, dmgMul;
    if(isCharge){ spec=w.charge; dmgMul=spec.dmg*(pl.chargedPower||1); }
    else if(isHeavy){ spec=w.heavy; dmgMul=spec.dmg; }
    else { spec=w.combo[clamp(pl.comboStep,0,w.combo.length-1)]; dmgMul=spec.dmg; }
    // weapon-mastery bonuses from the skill tree
    if(Skills.has('w_mastery')) dmgMul*=1.12;
    if(Skills.has('w_swift')&&w.kind==='spear') dmgMul*=1.15;
    // stat scaling
    let statScale = (w.scale==='str')?pl.D.strScale : (w.scale==='dex'?pl.D.dexScale:pl.D.intScale);
    if(isCharge) statScale*=1.1;
    const base=Weapons.dmgOf(w.id);
    const amount=base*dmgMul*statScale*0.85;
    const reach=spec.reach*(Skills.has('w_reach')?1.18:1);
    const arc=spec.arc*(Skills.has('w_wide')?1.22:1);
    const origin=pl.pos;
    for(let i=0;i<Enemies.list.length;i++){
      const e=Enemies.list[i];
      if(!e.alive) continue;
      const dx=e.pos.x-origin.x, dz=e.pos.z-origin.z;
      const dy=(e.pos.y+e.h*0.5)-(origin.y+1.0);
      if(Math.abs(dy)>e.h*0.5+1.4) continue;
      const d=Math.hypot(dx,dz);
      if(d>reach+e.r) continue;
      const a=Math.atan2(dx,dz);
      if(Math.abs(angDelta(pl.yaw,a))>arc*0.5) continue;
      const stagger=(isCharge?spec.stagger||70:(isHeavy?spec.stagger:26));
      Damage.hurtEnemy(e, amount, pl.pos, {stagger:stagger, knockback:(isHeavy||isCharge)?5:1.6});
      did=true;
      if(spec.magic){
        FX.burst(e.pos.x,e.pos.y+e.h*0.7,e.pos.z,18,{color:[0.65,0.85,1],speed:7,life:0.6,size:0.45});
      }
    }
    // hit environment feedback even when nothing is struck
    if(did){
      const fp=pl.frontPoint(reach*0.62,1.1);
      FX.slash(fp.x,fp.y,fp.z,pl.yaw,isHeavy||isCharge?2.3:1.5, w.kind==='staff'?0x9fd0ff:0xffe0b0);
      if(isHeavy||isCharge){ FX.shock(pl.pos.x,pl.pos.y+0.1,pl.pos.z, 4.0, 0xffb060); FX.shake(0.3,0.25); }
    } else if(isHeavy||isCharge){
      FX.slash(pl.frontPoint(reach*0.6,1.1).x, pl.pos.y+1.1, pl.frontPoint(reach*0.6,1.1).z, pl.yaw, 1.8, 0xffe0b0);
    }
    return true;
  }
};

/* ==========================================================================
   SECTION 8 - MAGIC
   Six original spells with cooldowns, mana costs and distinct behaviour.
   ========================================================================== */
const SPELL_DEFS = [
  { id:'emberlance', name:'Ember Lance', glyph:'\u25C6', cost:14, cd:1.1, kind:'projectile',
    dmg:36, speed:34, color:0xff7a2a, pc:[1,0.5,0.15], pierce:1, stagger:18,
    desc:'Hurls a mote of forge-fire. Fast, cheap, burns what it touches.' },
  { id:'frostshard', name:'Frost Shard', glyph:'\u2744', cost:16, cd:1.4, kind:'projectile',
    dmg:30, speed:28, color:0x7fd8ff, pc:[0.5,0.85,1], pierce:2, stagger:34, slow:true,
    desc:'Splinter of the Frozen Cathedral. Chills a foe\u2019s limbs.' },
  { id:'stormcall', name:'Storm Call', glyph:'\u26A1', cost:26, cd:3.4, kind:'strike',
    dmg:64, radius:4.6, color:0xbfe6ff, pc:[0.7,0.9,1], stagger:70,
    desc:'Calls lightning down on a point ahead of you. Enormous stagger.' },
  { id:'quake', name:'Ground Quake', glyph:'\u25CF', cost:30, cd:4.2, kind:'nova',
    dmg:52, radius:8.5, color:0xffb060, pc:[1,0.7,0.3], stagger:90, knockback:8,
    desc:'Shatters the earth around you. Breaks a crowd\u2019s poise at once.' },
  { id:'mend', name:'Ember Mend', glyph:'\u271A', cost:34, cd:9.0, kind:'heal',
    heal:0.42, color:0x7dff9a, pc:[0.5,1,0.6],
    desc:'Draws the forge\u2019s warmth inward. Restores a share of your wounds.' },
  { id:'arcaneburst', name:'Arcane Burst', glyph:'\u2726', cost:44, cd:6.5, kind:'burst',
    dmg:96, radius:11.0, color:0xb48cff, pc:[0.75,0.6,1], stagger:130, knockback:12,
    desc:'A ring of raw rune-force. Devastating, and expensive.' }
];

const Magic = {
  defs:SPELL_DEFS,
  cd:[],
  projectiles:[],
  init(){
    this.cd=[0,0,0,0,0,0];
    // shared geometry for projectiles
    this.projGeo=new THREE.SphereGeometry(0.42,10,8);
    this.trailGeo=new THREE.SphereGeometry(0.22,6,5);
  },
  learned(id){
    const map={emberlance:0, frostshard:1, mend:2, stormcall:3, quake:4, arcaneburst:5};
    return Skills.has('sp_'+id)|| (id==='emberlance') || (id==='frostshard'&&Skills.has('sp_frostshard'))
        || (id==='mend'&&Skills.has('sp_mend')) || (id==='stormcall'&&Skills.has('sp_stormcall'))
        || (id==='quake'&&Skills.has('sp_quake')) || (id==='arcaneburst'&&Skills.has('sp_arcaneburst'));
    void map;
  },
  isKnown(i){
    const ids=['emberlance','frostshard','mend','stormcall','quake','arcaneburst'];
    if(i===0) return true;
    return Skills.has('sp_'+ids[i]);
  },
  currentCaster(){
    const w=Weapons.current();
    let bonus=1;
    if(w.magicBonus) bonus+=w.magicBonus;
    if(Skills.has('m_power')) bonus+=0.18;
    if(Skills.has('m_flow')) bonus+=0.1;
    return Player.D.magicPower*bonus;
  },
  costOf(i){
    let c=this.defs[i].cost;
    if(Skills.has('m_flow')) c*=0.82;
    return Math.round(c);
  },
  cdOf(i){
    let c=this.defs[i].cd;
    if(Skills.has('m_haste')) c*=0.78;
    return c;
  },
  cast(i){
    const pl=Player;
    if(!this.isKnown(i)){ HUD.toast('That spell is not yet learned. Unlock it in Paths of Power.'); return false; }
    if(pl.dead||pl.state==='roll'||pl.state==='hurt'||pl.state==='drink') return false;
    if(pl.state==='attack'||pl.state==='heavy'||pl.state==='charge') return false;
    if(this.cd[i]>0){ HUD.comboText('NOT READY'); Audio2.play('ui_back'); return false; }
    const cost=this.costOf(i);
    if(pl.mana<cost){ HUD.comboText('NO MANA'); Audio2.play('ui_back'); return false; }
    const def=this.defs[i];
    pl.mana-=cost;
    this.cd[i]=this.cdOf(i);
    pl.state='cast'; pl.stateT=0;
    HUD.spellGlow=0.8;
    const power=this.currentCaster()*powerScaleExtra();
    const origin=pl.frontPoint(1.0,1.45);
    const dir=new THREE.Vector3(Math.sin(pl.yaw),0,Math.cos(pl.yaw));
    // aim toward lock target if present
    if(pl.lockOn&&pl.lockTarget&&pl.lockTarget.alive){
      const t=pl.lockTarget.pos;
      dir.set(t.x-origin.x, (t.y+pl.lockTarget.h*0.5)-origin.y, t.z-origin.z).normalize();
    } else if(Math.abs(Camera.pitch)>0.05){
      dir.y=-Math.sin(Camera.pitch)*0.9;
      dir.normalize();
    }
    if(def.kind==='projectile'){
      this.spawnProjectile(origin,dir,def,power);
      Audio2.play(def.id==='frostshard'?'ice':'fire');
    } else if(def.kind==='strike'){
      const target=this.aimPoint(def.radius);
      this.lightningStrike(target,def,power);
      Audio2.play('lightning');
      FX.shake(0.4,0.35);
    } else if(def.kind==='nova'){
      this.nova(pl.pos,def,power);
      Audio2.play('boom'); FX.shake(0.65,0.5);
    } else if(def.kind==='heal'){
      const amount=pl.D.hpMax*def.heal*power*0.9;
      pl.heal(amount);
      pl.restoreMana(pl.D.mnMax*0.08);
      FX.shock(pl.pos.x,pl.pos.y+0.1,pl.pos.z,6,0x7dff9a);
    } else if(def.kind==='burst'){
      this.burst(pl.pos,def,power);
      Audio2.play('arcane'); FX.shake(0.8,0.6);
    }
    return true;
  },
  aimPoint(radius){
    const pl=Player;
    if(pl.lockOn&&pl.lockTarget&&pl.lockTarget.alive) return pl.lockTarget.pos.clone();
    const d=Math.min(18,radius*2.6+7);
    const p=pl.frontPoint(d,0);
    p.y=terrainHeight(p.x,p.z);
    return p;
  },
  spawnProjectile(origin,dir,def,power){
    const mat=new THREE.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false});
    const m=new THREE.Mesh(this.projGeo,mat);
    m.position.copy(origin); m.scale.setScalar(def.id==='frostshard'?1.05:1.25);
    scene.add(m);
    const light=new THREE.PointLight(def.color,1.4,16,2); light.position.copy(origin); scene.add(light);
    const halo=new THREE.Mesh(new THREE.SphereGeometry(0.8,8,6), new THREE.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.2,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.add(halo);
    this.projectiles.push({mesh:m,light:light,pos:origin.clone(),dir:dir.clone(),
      speed:def.speed,life:2.6,def:def,power:power,pierce:def.pierce||1,hits:[]});
  },
  lightningStrike(target,def,power){
    // visual: vertical bolt + flash, then damage
    const pts=[];
    const top=new THREE.Vector3(target.x,target.y+34,target.z);
    const bot=new THREE.Vector3(target.x,target.y,target.z);
    for(let i=0;i<9;i++){
      const t=i/8;
      pts.push(new THREE.Vector3(lerp(top.x,bot.x,t)+rr(-2.2,2.2), lerp(top.y,bot.y,t), lerp(top.z,bot.z,t)+rr(-2.2,2.2)));
    }
    const g=new THREE.BufferGeometry().setFromPoints(pts);
    const ln=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xdff0ff,transparent:true,opacity:0.98,blending:THREE.AdditiveBlending}));
    scene.add(ln);
    const light=new THREE.PointLight(0xcfe8ff,4.0,44,2); light.position.copy(target).add(new THREE.Vector3(0,3,0)); scene.add(light);
    SpellFX.add(ln,0.34); SpellFX.addLight(light,0.34);
    FX.burst(target.x,target.y+0.4,target.z,60,{color:def.pc,speed:14,life:0.9,size:0.55,up:1.2});
    FX.shock(target.x,target.y,target.z,def.radius,def.color);
    const amt=def.dmg*power;
    Damage.areaHurt(target.x,target.z,def.radius,amt,{stagger:def.stagger,y:target.y});
  },
  nova(pos,def,power){
    FX.burst(pos.x,pos.y+0.5,pos.z,80,{color:def.pc,speed:15,life:1.0,size:0.6,up:1.1});
    FX.shock(pos.x,pos.y,pos.z,def.radius,def.color);
    FX.shock(pos.x,pos.y,pos.z,def.radius*0.6,0xffe0a0);
    FX.shake(0.7,0.5);
    const amt=def.dmg*power;
    Damage.areaHurt(pos.x,pos.z,def.radius,amt,{stagger:def.stagger,knockback:def.knockback,y:pos.y});
    Audio2.play('boom');
  },
  burst(pos,def,power){
    FX.burst(pos.x,pos.y+1.0,pos.z,110,{color:def.pc,speed:20,life:1.2,size:0.7,up:1.0});
    FX.shock(pos.x,pos.y,pos.z,def.radius,def.color);
    FX.shock(pos.x,pos.y,pos.z,def.radius*0.7,0xffffff);
    const amt=def.dmg*power;
    Damage.areaHurt(pos.x,pos.z,def.radius,amt,{stagger:def.stagger,knockback:def.knockback,big:true,y:pos.y});
    Audio2.play('boom');
  },
  update(dt){
    for(let i=0;i<this.cd.length;i++) if(this.cd[i]>0) this.cd[i]-=dt;
    for(let i=this.projectiles.length-1;i>=0;i--){
      const pr=this.projectiles[i];
      pr.life-=dt;
      pr.pos.addScaledVector(pr.dir,pr.speed*dt);
      pr.mesh.position.copy(pr.pos);
      if(pr.light) pr.light.position.copy(pr.pos);
      if(!particlesOff()&&Math.random()<dt*30)
        FX.spawn(pr.pos.x,pr.pos.y,pr.pos.z,rr(-1,1),rr(-1,1),rr(-1,1),pr.def.pc[0],pr.def.pc[1],pr.def.pc[2],0.4,0.4);
      // terrain collision
      const gh=terrainHeight(pr.pos.x,pr.pos.z);
      let dead=pr.life<=0||pr.pos.y<gh;
      // enemy collision
      if(!dead){
        for(let k=0;k<Enemies.list.length;k++){
          const e=Enemies.list[k];
          if(!e.alive) continue;
          if(pr.hits.indexOf(e)>=0) continue;
          const dx=e.pos.x-pr.pos.x, dz=e.pos.z-pr.pos.z;
          const dy=(e.pos.y+e.h*0.5)-pr.pos.y;
          if(Math.abs(dy)>e.h*0.5+0.7) continue;
          if(dx*dx+dz*dz < (e.r+0.6)*(e.r+0.6)){
            pr.hits.push(e);
            Damage.spellHurt(e, pr.def.dmg*pr.power, {color:'#'+pr.def.color.toString(16).padStart(6,'0'),
              pc:pr.def.pc, stagger:pr.def.stagger, knockback:3, big:false});
            if(pr.def.slow) e.applySlow(3.2,0.55);
            FX.burst(pr.pos.x,pr.pos.y,pr.pos.z,24,{color:pr.def.pc,speed:8,life:0.6,size:0.5});
            Audio2.play(pr.def.id==='frostshard'?'ice':'hit');
            pr.pierce--;
            if(pr.pierce<=0) dead=true;
            break;
          }
        }
      }
      if(dead){
        FX.burst(pr.pos.x,pr.pos.y,pr.pos.z,26,{color:pr.def.pc,speed:7,life:0.7,size:0.5});
        FX.shock(pr.pos.x, pr.pos.y>gh?pr.pos.y:gh, pr.pos.z, 3.2, pr.def.color);
        scene.remove(pr.mesh); if(pr.light) scene.remove(pr.light);
        this.projectiles.splice(i,1);
      }
    }
    HUD.spellGlow=Math.max(0,(HUD.spellGlow||0)-dt*2.4);
  }
};

// Spell visual auto-cleanup registry
const SpellFX = {
  items:[],
  add(obj,life){ obj.userData._life=life; this.items.push({o:obj,life:life,type:'mesh'}); },
  addLight(obj,life){ obj.userData._life=life; this.items.push({o:obj,life:life,type:'light'}); },
  update(dt){
    for(let i=this.items.length-1;i>=0;i--){
      const it=this.items[i];
      it.life-=dt;
      const t=clamp(it.life/ (it.o.userData._life||1),0,1);
      if(it.type==='mesh') it.o.material.opacity=t;
      else it.o.intensity=t*3.6;
      if(it.life<=0){ scene.remove(it.o); this.items.splice(i,1); }
    }
  }
};
function powerScaleExtra(){
  let extra=1;
  if(Skills.has('m_focus')) extra+=0.2;
  return extra;
}
