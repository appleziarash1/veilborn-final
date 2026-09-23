
/* ==========================================================================
   SECTION 5 - PLAYER (stats, leveling, procedural character, animation)
   ========================================================================== */
const Stats = {
  MAXLEVEL:50,
  xpFor(lv){ return Math.floor(80*Math.pow(lv,1.62)+40*lv); },
  create(){
    return {
      level:1, xp:0, gold:0, statPoints:0, skillPoints:1,
      strength:10, dexterity:10, intelligence:8, vitality:10, endurance:10, attunement:8,
      xpTotal:0, kills:0, deaths:0, bossesKilled:[], playtime:0, ending:null
    };
  },
  // Derived combat values from base stats plus equipment bonuses.
  derive(S, g){
    g=g||{};
    const hpMax = CFG.player.maxHp + (S.vitality-10)*11 + (g.hp||0);
    const stMax = CFG.player.maxStam + (S.endurance-10)*6 + (g.stam||0);
    const mnMax = CFG.player.maxMana + (S.attunement-10)*7 + (S.intelligence-8)*2 + (g.mana||0);
    return {
      hpMax:Math.round(hpMax), stMax:Math.round(stMax), mnMax:Math.round(mnMax),
      strScale:0.35 + S.strength*0.055 + (g.str||0)*0.03,
      dexScale:0.35 + S.dexterity*0.055 + (g.dex||0)*0.03,
      intScale:0.35 + S.intelligence*0.06 + (g.int||0)*0.03,
      armor:(g.armor||0) + Math.floor(S.vitality*0.45),
      critChance:clamp(0.04 + S.dexterity*0.0055 + (g.crit||0), 0, 0.75),
      critMult:CFG.combat.critMult + (g.critMult||0),
      stamRegen:CFG.player.stamRegen*(1+S.endurance*0.022),
      manaRegen:CFG.player.manaRegen*(1+S.intelligence*0.032),
      magicPower:1 + S.intelligence*0.028,
      speedMul:1 + S.dexterity*0.0035
    };
  }
};

const Player = {
  S:null, D:null,
  pos:new THREE.Vector3(), vel:new THREE.Vector3(),
  yaw:0, mesh:null, parts:{},
  hp:100, stam:100, mana:70,
  grounded:true, sprinting:false,
  state:'idle', stateT:0,
  comboStep:0, comboWindow:0, queuedAttack:false,
  chargeT:0, charging:false,
  invuln:0, dead:false, regenDelay:0, stepDist:0,
  lastShrine:null, flaskCount:3, flaskMax:3,
  weaponIndex:0, spellIndex:0, itemIndex:0,
  animT:0, lockTarget:null, lockOn:false,
  trailPts:[], attackHitDone:false,
  spawn(x,z){
    const y=terrainHeight(x,z);
    this.pos.set(x,y,z); this.vel.set(0,0,0);
    this.dead=false; this.state='idle'; this.stateT=0; this.invuln=1.2;
    this.hp=this.D.hpMax; this.stam=this.D.stMax; this.mana=this.D.mnMax;
    this.comboStep=0; this.comboWindow=0; this.charging=false; this.chargeT=0;
    this.flaskCount=this.flaskMax;
    if(this.mesh){ this.mesh.visible=true; }
    this.syncMesh();
  },
  init(){
    this.S=Stats.create();
    Gear.init();
    this.recalc();
    this.hp=this.D.hpMax; this.stam=this.D.stMax; this.mana=this.D.mnMax;
    this.buildMesh();
  },
  recalc(){
    this.D=Stats.derive(this.S, Gear.bonus());
    this.hp=Math.min(this.hp,this.D.hpMax);
    this.stam=Math.min(this.stam,this.D.stMax);
    this.mana=Math.min(this.mana,this.D.mnMax);
  },
  buildMesh(){
    if(this.mesh){ if(this.mesh.parent) this.mesh.parent.remove(this.mesh); this.mesh=null; this.parts=null; }
    const g=new THREE.Group();
    const skin=TEX.std(0xb08d6a,0.8,0.02);
    const cloth=TEX.std(0x3a2f3f,0.9,0.02);
    const leather=TEX.std(0x4a3324,0.85,0.05,TEX.bark);
    const metal=TEX.std(0x8a8f9c,0.35,0.75);
    const trim=TEX.emissive(0xff9a3d,0.5);
    const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
      m.castShadow=true; m.receiveShadow=true; g.add(m); return m; };
    const torso=add(new THREE.BoxGeometry(0.72,0.92,0.42), cloth, 0,1.18,0);
    const chest=add(new THREE.BoxGeometry(0.82,0.44,0.5), leather, 0,1.5,0);
    const emblem=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.22,0.06), trim);
    emblem.position.set(0,1.42,0.27); g.add(emblem);
    add(new THREE.BoxGeometry(0.66,0.36,0.4), leather, 0,0.72,0);
    const head=add(new THREE.BoxGeometry(0.42,0.44,0.4), skin, 0,1.82,0);
    const hood=add(new THREE.ConeGeometry(0.36,0.42,7), cloth, 0,2.06,0);
    add(new THREE.SphereGeometry(0.19,8,6), metal, -0.44,1.5,0);
    add(new THREE.SphereGeometry(0.19,8,6), metal, 0.44,1.5,0);
    const armL=new THREE.Group(); armL.position.set(-0.44,1.44,0); g.add(armL);
    add.call(null,new THREE.CylinderGeometry(0.11,0.1,0.5,7),skin,0,-0.26,0);
    armL.add(g.children[g.children.length-1]);
    const foreL=new THREE.Group(); foreL.position.y=-0.52; armL.add(foreL);
    const fl=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.09,0.46,7),skin);
    fl.position.y=-0.24; fl.castShadow=true; foreL.add(fl);
    const armR=new THREE.Group(); armR.position.set(0.44,1.44,0); g.add(armR);
    const ur=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.1,0.5,7),skin);
    ur.position.y=-0.26; ur.castShadow=true; armR.add(ur);
    const foreR=new THREE.Group(); foreR.position.y=-0.52; armR.add(foreR);
    const fr=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.09,0.46,7),skin);
    fr.position.y=-0.24; fr.castShadow=true; foreR.add(fr);
    const legL=new THREE.Group(); legL.position.set(-0.19,0.66,0); g.add(legL);
    const tl=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.12,0.56,7),leather);
    tl.position.y=-0.29; tl.castShadow=true; legL.add(tl);
    const shinL=new THREE.Group(); shinL.position.y=-0.58; legL.add(shinL);
    const sl=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.1,0.54,7),leather);
    sl.position.y=-0.28; sl.castShadow=true; shinL.add(sl);
    const legR=new THREE.Group(); legR.position.set(0.19,0.66,0); g.add(legR);
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.12,0.56,7),leather);
    tr.position.y=-0.29; tr.castShadow=true; legR.add(tr);
    const shinR=new THREE.Group(); shinR.position.y=-0.58; legR.add(shinR);
    const sr=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.1,0.54,7),leather);
    sr.position.y=-0.28; sr.castShadow=true; shinR.add(sr);
    const cape=new THREE.Mesh(new THREE.PlaneGeometry(0.86,1.35), TEX.std(0x5a1f1f,0.95,0.0));
    cape.material.side=THREE.DoubleSide; cape.position.set(0,1.09,-0.29); cape.castShadow=true; g.add(cape);
    const weaponHold=new THREE.Group(); foreR.add(weaponHold); weaponHold.position.y=-0.5;
    const castLight=new THREE.PointLight(0xb48cff,0.0,14,2); castLight.position.set(0,1.3,0.4); g.add(castLight);
    g.position.copy(this.pos);
    scene.add(g);
    this.mesh=g;
    this.parts={torso:torso,chest:chest,head:head,hood:hood,cape:cape,armL:armL,armR:armR,foreL:foreL,foreR:foreR,
      legL:legL,legR:legR,shinL:shinL,shinR:shinR,weaponHold:weaponHold,castLight:castLight,emblem:emblem};
    Weapons.attach(this.parts.weaponHold);
    if(this.auraRing&&this.auraRing.parent) this.auraRing.parent.remove(this.auraRing);
    this.auraRing=new THREE.Mesh(new THREE.RingGeometry(0.7,0.95,28),
      new THREE.MeshBasicMaterial({color:0xffc060,transparent:true,opacity:0.0,side:THREE.DoubleSide,
        depthWrite:false,blending:THREE.AdditiveBlending}));
    this.auraRing.rotation.x=-Math.PI/2; scene.add(this.auraRing);
  },
  levelUp(){
    if(this.S.level>=Stats.MAXLEVEL) return;
    this.S.level++; this.S.statPoints+=3; this.S.skillPoints+=1;
    this.recalc();
    this.hp=this.D.hpMax; this.stam=this.D.stMax; this.mana=this.D.mnMax;
    Audio2.play('levelup');
    HUD.toast('LEVEL '+this.S.level+' \u2014 the ember grows brighter. (+3 stat, +1 skill)');
    FX.burst(this.pos.x,this.pos.y+1.2,this.pos.z,40,{color:[1,0.8,0.35],speed:7,life:1.2,size:0.5,up:1.1});
    FX.shock(this.pos.x,this.pos.y,this.pos.z,6,0xffc060);
    FX.shake(0.25,0.5);
    HUD.dirty=true;
  },
  addXP(n){
    this.S.xp+=n; this.S.xpTotal+=n;
    while(this.S.xp>=Stats.xpFor(this.S.level) && this.S.level<Stats.MAXLEVEL){
      this.S.xp-=Stats.xpFor(this.S.level); this.levelUp();
    }
  },
  addGold(n){ this.S.gold+=n; },

  /* ---- locomotion ------------------------------------------------------- */
  wishDir(out){
    const f=(IN.keys.KeyW?1:0)-(IN.keys.KeyS?1:0);
    const s=(IN.keys.KeyD?1:0)-(IN.keys.KeyA?1:0);
    // Camera sits at P + (-sin yaw, .., -cos yaw)*dist, so its view direction is
    // (sin yaw, 0, cos yaw). Screen-right is cross(forward, up) = (-cos yaw, 0, sin yaw).
    const cy=Math.cos(Camera.yaw), sy=Math.sin(Camera.yaw);
    let dx=sy*f-cy*s;
    let dz=cy*f+sy*s;
    const l=Math.hypot(dx,dz);
    if(l>0.0001){ dx/=l; dz/=l; }
    out.set(dx,0,dz);
    return l>0.0001;
  },
  moveSpeed(){
    let base=CFG.player.walk*this.D.speedMul;
    if(this.state==='block') base*=0.45;
    if(this.state==='attack'||this.state==='heavy'||this.state==='charge') base*=0.18;
    if(this.state==='cast') base*=0.1;
    if(this.state==='roll'||this.state==='hurt') base=0;
    if(this.sprinting&&this.state!=='block') base=CFG.player.sprint*this.D.speedMul;
    return base;
  },
  startRoll(dx,dz){
    if(this.stam<18||this.state==='roll'||this.state==='dead') return;
    this.stam-=18;
    this.state='roll'; this.stateT=0; this.regenDelay=CFG.combat.regenDelay;
    this.invuln=CFG.combat.iframeRoll;
    const l=Math.hypot(dx,dz);
    if(l<0.01){ dx=Math.sin(this.yaw); dz=Math.cos(this.yaw); }
    else { dx/=l; dz/=l; }
    this.vel.x=dx*13.5; this.vel.z=dz*13.5;
    this.yaw=Math.atan2(dx,dz);
    Audio2.play('roll');
    FX.burst(this.pos.x,this.pos.y+0.3,this.pos.z,12,{color:[0.62,0.56,0.5],speed:3,life:0.5,size:0.35,up:0.2});
  },
  jump(){
    if(!this.grounded||this.stam<8) return;
    this.stam-=8; this.vel.y=CFG.player.jumpV;
    this.grounded=false;
    Audio2.play('jump');
  },
  takeDamage(amount, srcPos, opt){
    opt=opt||{};
    if(this.dead||this.invuln>0) return false;
    let dmg=amount;
    if(this.state==='block' && this.stateT<CFG.combat.parryWindow && opt.attacker){
      // PARRY: reflect the strike, break the attacker's poise
      Audio2.play('parry');
      FX.burst(this.pos.x,this.pos.y+1.2,this.pos.z,26,{color:[1,0.95,0.7],speed:9,life:0.7,size:0.45});
      FX.shock(this.pos.x,this.pos.y,this.pos.z,5,0xffe0a0);
      FX.shake(0.3,0.25);
      this.stam=Math.min(this.D.stMax,this.stam+24);
      HUD.comboText('PARRY');
      if(opt.attacker.applyStagger) opt.attacker.applyStagger(200,1.8);
      if(opt.attacker.hp!==undefined) Damage.hurtEnemy(opt.attacker, 16+this.S.dexterity*2.2, this.pos, {crit:true});
      return false;
    }
    if(this.state==='block'){
      const toSrc=srcPos?new THREE.Vector3().subVectors(srcPos,this.pos):new THREE.Vector3(0,0,1);
      const facing=new THREE.Vector3(Math.sin(this.yaw),0,Math.cos(this.yaw));
      const flat=new THREE.Vector3(toSrc.x,0,toSrc.z);
      if(flat.lengthSq()>0.0001) flat.normalize();
      if(facing.dot(flat)>0.1){
        dmg=dmg*(1-CFG.combat.blockReduction);
        this.stam-=dmg*CFG.combat.blockStamMult*0.6;
        if(this.stam<=0){ this.stam=0; HUD.comboText('GUARD BROKEN'); }
        Audio2.play('block');
        FX.burst(this.pos.x,this.pos.y+1.2,this.pos.z,12,{color:[1,0.85,0.5],speed:5,life:0.4,size:0.3});
        HUD.hitFlash(0.25);
      }
    }
    dmg=Math.max(1, dmg - this.D.armor*0.3);
    this.hp-=dmg;
    this.invuln=CFG.combat.iframeLight;
    Audio2.play('hurt');
    HUD.hitFlash(0.7); HUD.damageVignette();
    FX.shake(0.45,0.35);
    FX.burst(this.pos.x,this.pos.y+1.1,this.pos.z,16,{color:[0.8,0.16,0.13],speed:5,life:0.55,size:0.4});
    DmgText.show(new THREE.Vector3(this.pos.x,this.pos.y+2.3,this.pos.z), Math.round(dmg), '#ff6b5a', true);
    if(this.hp<=0){ this.hp=0; this.die(); }
    return true;
  },
  heal(n){
    this.hp=Math.min(this.D.hpMax,this.hp+n);
    Audio2.play('heal');
    FX.burst(this.pos.x,this.pos.y+1.2,this.pos.z,26,{color:[0.45,1,0.6],speed:5,life:1.0,size:0.45,up:1.4});
    DmgText.show(new THREE.Vector3(this.pos.x,this.pos.y+2.4,this.pos.z), '+'+Math.round(n), '#7dff9a');
  },
  restoreMana(n){ this.mana=Math.min(this.D.mnMax,this.mana+n); },
  die(){
    if(this.dead) return;
    this.dead=true; this.state='dead'; this.stateT=0;
    this.S.deaths++;
    Audio2.play('death');
    FX.burst(this.pos.x,this.pos.y+1.0,this.pos.z,40,{color:[0.7,0.12,0.1],speed:6,life:1.4,size:0.5});
    FX.shake(0.8,0.8);
    setTimeout(function(){ HUD.showDeath(); },1300);
  },

  /* ---- main update ------------------------------------------------------ */
  update(dt){
    if(this.S) this.S.playtime+=dt;
    const st=this.state;
    this.stateT+=dt; this.animT+=dt;
    if(this.invuln>0) this.invuln-=dt;
    if(this.comboWindow>0) this.comboWindow-=dt;
    if(this.regenDelay>0) this.regenDelay-=dt;

    const wish=new THREE.Vector3();
    const moving=this.wishDir(wish);
    const busy=(st==='attack'||st==='heavy'||st==='charge'||st==='roll'||st==='cast'||
                st==='hurt'||st==='dead'||st==='drink');

    if(!busy && !UI.isOpen()){
      this.sprinting=(!!IN.keys.ShiftLeft||!!IN.keys.ShiftRight)&&this.stam>2;
      if(this.sprinting&&moving&&this.grounded){
        this.stam-=(this.regenDelay>0?7:12)*dt;
        if(this.stam<0) this.stam=0;
        this.regenDelay=CFG.combat.regenDelay;
      }
      if(IN.mouse.r&&this.stam>0){
        if(this.state!=='block'){ this.state='block'; this.stateT=0; }
      } else if(this.state==='block'){ this.state='idle'; this.stateT=0; }
    } else this.sprinting=false;

    /* movement */
    const spd=this.moveSpeed();
    if(st!=='roll'&&st!=='hurt'&&st!=='dead'){
      const tvx=moving?wish.x*spd:0, tvz=moving?wish.z*spd:0;
      const acc=(this.grounded?CFG.player.accel:CFG.player.accel*0.35)*dt;
      this.vel.x+=clamp(tvx-this.vel.x,-acc*4,acc*4);
      this.vel.z+=clamp(tvz-this.vel.z,-acc*4,acc*4);
      if(!moving&&this.grounded){ const f=Math.pow(0.0009,dt); this.vel.x*=f; this.vel.z*=f; }
    } else if(st==='roll'){
      const drag=Math.pow(0.07,dt); this.vel.x*=drag; this.vel.z*=drag;
      if(this.stateT>0.5){ this.state='idle'; this.stateT=0; }
    } else if(st==='hurt'){
      const drag=Math.pow(0.02,dt); this.vel.x*=drag; this.vel.z*=drag;
      if(this.stateT>0.3){ this.state='idle'; this.stateT=0; }
    }

    /* facing */
    if(this.lockOn && this.lockTarget && this.lockTarget.alive && !busy){
      const t=this.lockTarget.pos;
      this.yaw=angLerp(this.yaw, Math.atan2(t.x-this.pos.x,t.z-this.pos.z), 1-Math.exp(-11*dt));
    } else if(moving && !busy){
      this.yaw=angLerp(this.yaw, Math.atan2(wish.x,wish.z), 1-Math.exp(-14*dt));
    }

    /* physics */
    this.vel.y+=CFG.gravity*dt;
    this.pos.x+=this.vel.x*dt; this.pos.z+=this.vel.z*dt; this.pos.y+=this.vel.y*dt;
    const bx=CFG.world.sizeX*0.485, bz=CFG.world.sizeZ*0.485;
    if(this.pos.x<-bx){this.pos.x=-bx;this.vel.x=0;} if(this.pos.x>bx){this.pos.x=bx;this.vel.x=0;}
    if(this.pos.z<-bz){this.pos.z=-bz;this.vel.z=0;} if(this.pos.z>bz){this.pos.z=bz;this.vel.z=0;}
    this.collide();

    const gh=terrainHeight(this.pos.x,this.pos.z);
    if(this.pos.y<=gh){
      if(!this.grounded && this.vel.y<-14){
        FX.burst(this.pos.x,gh+0.2,this.pos.z,16,{color:[0.55,0.5,0.45],speed:4.5,life:0.5,size:0.4,up:0.4});
        Audio2.play('step'); FX.shake(0.15,0.2);
        if(this.vel.y<-24) this.takeDamage(Math.abs(this.vel.y)*0.85,this.pos);
      }
      this.pos.y=gh; this.vel.y=0; this.grounded=true;
    } else this.grounded=false;

    /* footsteps */
    if(this.grounded){
      const planar=Math.hypot(this.vel.x,this.vel.z);
      if(planar>1.4){
        this.stepDist+=planar*dt;
        if(this.stepDist>CFG.player.stepDist/(this.sprinting?1.6:1)){
          this.stepDist=0; Audio2.play('step');
          if(!particlesOff()) FX.burst(this.pos.x,this.pos.y+0.12,this.pos.z,3,{color:[0.5,0.46,0.4],speed:1.2,life:0.4,size:0.22,up:0.15});
        }
      }
    }
    /* regen */
    if(this.regenDelay<=0 && this.state!=='block' && this.state!=='roll')
      this.stam=Math.min(this.D.stMax, this.stam+this.D.stamRegen*dt);
    this.mana=Math.min(this.D.mnMax, this.mana+this.D.manaRegen*dt);
    if(this.hp>0&&this.hp<this.D.hpMax) this.hp=Math.min(this.D.hpMax,this.hp+CFG.player.hpRegen*dt);

    this.animate(dt,moving);
    this.syncMesh();
    Combat.resolveAttack(this,dt);

    if(this.lockOn && (!this.lockTarget||!this.lockTarget.alive)) this.findLockTarget();
  },

  collide(){
    const tmp=World.tmpArr||(World.tmpArr=[]);
    World.hash.query(this.pos.x,this.pos.z,2.4,tmp);
    const r=CFG.player.radius;
    for(let i=0;i<tmp.length;i++){
      const c=tmp[i];
      if(c.top<this.pos.y+0.35) continue;
      const dx=this.pos.x-c.x, dz=this.pos.z-c.z;
      const d=Math.hypot(dx,dz), min=c.r+r;
      if(d<min&&d>0.0001){
        const push=(min-d)/d;
        this.pos.x+=dx*push; this.pos.z+=dz*push;
        const nx=dx/d, nz=dz/d;
        const vd=this.vel.x*nx+this.vel.z*nz;
        if(vd<0){ this.vel.x-=nx*vd; this.vel.z-=nz*vd; }
      }
    }
  },

  syncMesh(){
    if(!this.mesh) return;
    this.mesh.position.set(this.pos.x,this.pos.y,this.pos.z);
    this.mesh.rotation.y=this.yaw+Math.PI;
    this.auraRing.position.set(this.pos.x,this.pos.y+0.06,this.pos.z);
    this.auraRing.material.opacity=((this.state==='charge'||this.state==='cast')?0.32:(this.charging?0.2:0.08));
  },

  animate(dt,moving){
    const p=this.parts; if(!p) return;
    const t=this.animT;
    const planar=Math.hypot(this.vel.x,this.vel.z);
    const runAmt=clamp(planar/6.4,0,1.7);
    if(this.state==='roll'){
      const k=clamp(this.stateT/0.55,0,1);
      p.legL.rotation.x=-1.9*k; p.legR.rotation.x=-1.6*k;
      p.armL.rotation.x=-1.2*k; p.armR.rotation.x=-1.2*k;
      p.torso.rotation.x=0.55+0.55*Math.sin(k*Math.PI);
      p.torso.rotation.y=0;
      this.mesh.position.y=this.pos.y+0.06;
      p.cape.rotation.x=-0.8;
      return;
    }
    let la=0,ra=0,ll=0,rl=0,torso=0;
    const action=(this.state==='attack'||this.state==='heavy'||this.state==='charge');
    if(action){
      const w=Weapons.current();
      const prog=clamp(this.stateT/(w?aDur(this):0.4),0,1);
      const sw=Math.sin(prog*Math.PI);
      const dir=(this.comboStep%2===0)?1:-1;
      p.armR.rotation.x=-2.4*sw*dir-0.3;
      p.armR.rotation.z=-0.5*sw;
      p.foreR.rotation.x=-0.7+0.4*sw;
      p.armL.rotation.x=0.8*sw;
      p.torso.rotation.y=-0.55*sw*dir;
      torso=-0.2*sw;
      p.legL.rotation.x=0.25*sw; p.legR.rotation.x=-0.3*sw;
      if(this.state==='heavy'){ p.armR.rotation.x=-2.95*sw; p.armR.rotation.z=-0.9*sw; torso=-0.35*sw; }
      if(this.state==='charge'){
        const c=clamp(this.chargeT/1.1,0,1);
        p.armR.rotation.x=-2.2-c*0.7; p.armR.rotation.z=-0.4;
        p.torso.rotation.y=-0.85; torso=0.1+c*0.2;
      }
    } else if(this.state==='cast'){
      const k=clamp(this.stateT/0.7,0,1);
      p.armR.rotation.x=-2.2-0.4*Math.sin(k*Math.PI);
      p.armL.rotation.x=-2.0-0.4*Math.sin(k*Math.PI);
      p.foreR.rotation.x=-0.6; p.foreL.rotation.x=-0.6;
      torso=0.14; p.torso.rotation.y=0;
    } else if(this.state==='block'){
      p.armR.rotation.x=-1.5; p.armR.rotation.z=-0.7; p.foreR.rotation.x=-1.1;
      p.armL.rotation.x=-0.85; p.torso.rotation.y=0.5;
      p.legL.rotation.x=0.12; p.legR.rotation.x=-0.16;
      torso=0.16;
    } else if(this.state==='hurt'){
      torso=-0.45; p.armL.rotation.x=-0.5; p.armR.rotation.x=-0.4; p.torso.rotation.y=0;
    } else if(this.state==='drink'){
      p.armR.rotation.x=-2.6; p.armL.rotation.x=-2.2; torso=0.1; p.torso.rotation.y=0;
    } else {
      const swing=Math.sin(t*(6+runAmt*5.4))*0.85*clamp(runAmt,0,1.2);
      ll=swing; rl=-swing; la=-swing*0.85; ra=swing*0.85;
      torso=Math.sin(t*1.8)*0.03+runAmt*0.14;
      p.torso.rotation.y=0;
      if(!this.grounded){
        p.legL.rotation.x=-0.5; p.legR.rotation.x=0.35;
        la=-1.0; ra=-1.0;
      }
      p.armR.rotation.z=-0.12-runAmt*0.1;
      p.armL.rotation.z=0.12+runAmt*0.1;
      p.foreR.rotation.x=-0.25; p.foreL.rotation.x=-0.25;
    }
    p.legL.rotation.x=lerp(p.legL.rotation.x,ll,0.55);
    p.legR.rotation.x=lerp(p.legR.rotation.x,rl,0.55);
    p.shinL.rotation.x=Math.max(0,-ll)*0.9;
    p.shinR.rotation.x=Math.max(0,-rl)*0.9;
    if(!action&&this.state!=='block'&&this.state!=='cast'){
      p.armL.rotation.x=lerp(p.armL.rotation.x,la,0.55);
      p.armR.rotation.x=lerp(p.armR.rotation.x,ra,0.55);
    }
    p.torso.rotation.x=lerp(p.torso.rotation.x,torso,0.28);
    p.chest.rotation.x=p.torso.rotation.x;
    p.head.rotation.x=-p.torso.rotation.x*0.6;
    p.hood.rotation.x=p.head.rotation.x;
    p.cape.rotation.x=clamp(-0.28-runAmt*0.7, -1.1, 0.2)+Math.sin(t*4)*0.06;
    this.mesh.position.y=this.pos.y+(this.grounded?Math.sin(t*7.4)*0.05*clamp(runAmt,0,1):0);
    p.emblem.material.emissiveIntensity=0.4+Math.sin(t*3)*0.15;
    p.castLight.intensity=HUD.spellGlow||0;
  },
  frontPoint(dist,h){
    const d=dist||1.2, hh=(h===undefined?1.1:h);
    return new THREE.Vector3(this.pos.x+Math.sin(this.yaw)*d, this.pos.y+hh, this.pos.z+Math.cos(this.yaw)*d);
  },
  findLockTarget(){
    const cands=Enemies.list.filter(function(e){
      return e.alive && e.pos.distanceTo(Player.pos)<CFG.combat.lockRange;
    });
    if(!cands.length){ this.lockTarget=null; return; }
    let best=cands[0], bd=1e9;
    for(let i=0;i<cands.length;i++){
      const d=cands[i].pos.distanceToSquared(Player.pos);
      if(d<bd){ bd=d; best=cands[i]; }
    }
    this.lockTarget=best;
  }
};
function aDur(pl){
  const w=Weapons.current();
  return w? w.attackTime*(pl.state==='heavy'?1.85:(pl.state==='charge'?1.4:1)) : 0.4;
}

/* ==========================================================================
   SECTION 6 - WEAPONS
   Each weapon differs in damage, speed, reach, arc, stamina cost and art.
   ========================================================================== */
const WEAPON_DEFS = [
  { id:'sword', name:'Ashen Longsword', kind:'sword', glyph:'/',
    base:22, attackTime:0.40, reach:2.9, arc:2.1, stam:13, scale:'str', speed:'medium',
    combo:[{dmg:1.0,arc:2.1,reach:2.9},{dmg:1.1,arc:2.3,reach:2.9},{dmg:1.5,arc:2.9,reach:3.1}],
    heavy:{dmg:2.15,arc:2.6,reach:3.3,stagger:60},
    charge:{dmg:3.1,arc:2.4,reach:3.4,name:'Cleaving Ember'},
    desc:'Balanced and reliable. The blade of a dead kingdom.' },
  { id:'greatsword', name:'Gravewatcher Greatsword', kind:'greatsword', glyph:'|',
    base:38, attackTime:0.66, reach:3.4, arc:2.5, stam:22, scale:'str', speed:'slow',
    combo:[{dmg:1.0,arc:2.5,reach:3.4},{dmg:1.25,arc:2.7,reach:3.5},{dmg:2.0,arc:3.3,reach:3.8}],
    heavy:{dmg:2.6,arc:3.2,reach:4.0,stagger:95},
    charge:{dmg:3.8,arc:2.6,reach:3.6,name:'Tombstone Fall'},
    desc:'Slow, enormous, breaks poise like a falling wall.' },
  { id:'axe', name:'Cinderwrath Axe', kind:'axe', glyph:'X',
    base:30, attackTime:0.54, reach:2.7, arc:2.6, stam:18, scale:'str', speed:'medium',
    combo:[{dmg:1.05,arc:2.6,reach:2.7},{dmg:1.2,arc:2.9,reach:2.7},{dmg:1.8,arc:3.3,reach:3.0}],
    heavy:{dmg:2.4,arc:3.1,reach:3.1,stagger:80},
    charge:{dmg:3.4,arc:3.0,reach:3.2,name:'Riftmaker'},
    desc:'Wide sweeps, brutal recovery, feeds on the staggered.' },
  { id:'spear', name:'Vigil Spear', kind:'spear', glyph:'-',
    base:18, attackTime:0.32, reach:4.3, arc:1.0, stam:10, scale:'dex', speed:'fast',
    combo:[{dmg:1.0,arc:1.0,reach:4.3},{dmg:1.0,arc:1.0,reach:4.3},{dmg:1.35,arc:1.1,reach:4.6}],
    heavy:{dmg:1.9,arc:1.2,reach:5.2,stagger:55},
    charge:{dmg:2.6,arc:1.1,reach:5.6,name:'Lance of Noon'},
    desc:'Longest reach in the kingdom. Punish from beyond their guard.' },
  { id:'staff', name:'Sunforged Staff', kind:'staff', glyph:'*',
    base:16, attackTime:0.46, reach:3.1, arc:2.4, stam:11, scale:'int', speed:'medium',
    combo:[{dmg:1.0,arc:2.4,reach:3.1},{dmg:1.05,arc:2.6,reach:3.1},{dmg:1.4,arc:3.0,reach:3.3}],
    heavy:{dmg:1.7,arc:2.8,reach:3.4,stagger:40,magic:true},
    charge:{dmg:2.2,arc:2.6,reach:3.4,name:'Sunburst',magic:true},
    magicBonus:0.35,
    desc:'Turns spellwork into a weapon. Lends power to every cast.' }
];

const Weapons = {
  defs:WEAPON_DEFS, owned:{}, levels:{}, hold:null, meshes:{},
  init(){ this.owned={sword:true}; this.levels={sword:1}; },
  current(){ return this.defs[Player.weaponIndex]; },
  levelOf(id){ return this.levels[id]||1; },
  upgrade(id){ this.levels[id]=Math.min(8,(this.levels[id]||1)+1); },
  dmgOf(id){ return this.byId(id).base*(1+(this.levelOf(id)-1)*0.18); },
  byId(id){
    for(let i=0;i<this.defs.length;i++) if(this.defs[i].id===id) return this.defs[i];
    return this.defs[0];
  },
  equipIndex(i){
    if(i<0||i>=this.defs.length) return false;
    const d=this.defs[i];
    if(!this.owned[d.id]){ HUD.toast('You do not carry the '+d.name+'.'); return false; }
    if(Player.weaponIndex===i) return false;
    Player.weaponIndex=i;
    Audio2.play('ui');
    HUD.toast('Equipped '+d.name);
    this.swapMesh(d.id);
    return true;
  },
  attach(holder){ this.hold=holder; this.swapMesh(this.current().id); },
  buildMesh(id){
    const grp=new THREE.Group();
    const steel=TEX.std(0xb8bec9,0.3,0.85);
    const dark=TEX.std(0x3a3026,0.7,0.3);
    const gold=TEX.emissive(0xffb347,0.7);
    const bm=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=true; grp.add(m); return m; };
    if(id==='sword'){
      bm(new THREE.BoxGeometry(0.09,1.65,0.02), steel, 0,0.85,0);
      bm(new THREE.BoxGeometry(0.3,0.09,0.07), dark, 0,0.06,0);
      bm(new THREE.CylinderGeometry(0.045,0.05,0.3,6), dark, 0,-0.12,0);
      bm(new THREE.OctahedronGeometry(0.06,0), gold, 0,-0.3,0);
    } else if(id==='greatsword'){
      bm(new THREE.BoxGeometry(0.2,2.45,0.05), steel, 0,1.2,0);
      bm(new THREE.BoxGeometry(0.44,0.14,0.1), dark, 0,0.04,0);
      bm(new THREE.CylinderGeometry(0.06,0.07,0.6,6), dark, 0,-0.34,0);
      bm(new THREE.SphereGeometry(0.08,6,5), gold, 0,-0.66,0);
    } else if(id==='axe'){
      bm(new THREE.CylinderGeometry(0.05,0.06,1.7,6), dark, 0,0.6,0);
      bm(new THREE.BoxGeometry(0.62,0.5,0.06), steel, 0.3,1.35,0);
      bm(new THREE.BoxGeometry(0.5,0.36,0.05), steel, -0.26,1.3,0);
      bm(new THREE.BoxGeometry(0.14,0.16,0.12), gold, 0.3,1.35,0);
    } else if(id==='spear'){
      bm(new THREE.CylinderGeometry(0.045,0.045,3.2,6), dark, 0,1.1,0);
      bm(new THREE.ConeGeometry(0.1,0.6,5), steel, 0,2.85,0);
      bm(new THREE.CylinderGeometry(0.07,0.07,0.2,6), gold, 0,2.5,0);
    } else {
      bm(new THREE.CylinderGeometry(0.05,0.055,2.2,6), dark, 0,0.6,0);
      bm(new THREE.TorusGeometry(0.16,0.04,6,12), gold, 0,1.72,0);
      bm(new THREE.OctahedronGeometry(0.13,0), TEX.emissive(0x9fd0ff,1.1), 0,1.72,0);
      bm(new THREE.TorusGeometry(0.11,0.03,6,10), gold, 0,1.2,0);
    }
    return grp;
  },
  swapMesh(id){
    if(!this.hold) return;
    if(this.meshes[id] && this.meshes[id].parent===this.hold) return;
    while(this.hold.children.length) this.hold.remove(this.hold.children[0]);
    if(!this.meshes[id]) this.meshes[id]=this.buildMesh(id);
    this.meshes[id].position.set(0,-0.02,0);
    this.hold.add(this.meshes[id]);
  },
  cycle(dir){
    let i=Player.weaponIndex;
    for(let n=0;n<this.defs.length;n++){
      i=(i+dir+this.defs.length)%this.defs.length;
      if(this.owned[this.defs[i].id]){ this.equipIndex(i); return; }
    }
  }
};
