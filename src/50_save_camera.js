
/* ==========================================================================
   SECTION 15 - SAVE SYSTEM (localStorage)
   ========================================================================== */
const Save = {
  KEY:'fotfk_save_v1',
  snapshot(){
    return {
      v:1, ts:Date.now(),
      S:JSON.parse(JSON.stringify(Player.S)),
      pos:{x:Player.pos.x,y:Player.pos.y,z:Player.pos.z},
      hp:Player.hp, stam:Player.stam, mana:Player.mana,
      flask:Player.flaskCount,
      shrine:Player.lastShrine?Player.lastShrine.id:null,
      weaponIndex:Player.weaponIndex,
      weapons:{owned:JSON.parse(JSON.stringify(Weapons.owned)),levels:JSON.parse(JSON.stringify(Weapons.levels))},
      inv:{items:JSON.parse(JSON.stringify(Inventory.items)),equipped:JSON.parse(JSON.stringify(Inventory.equipped))},
      skills:JSON.parse(JSON.stringify(Skills.owned)),
      quests:{counters:JSON.parse(JSON.stringify(Quests.counters)),
              active:JSON.parse(JSON.stringify(Quests.active)),
              completed:JSON.parse(JSON.stringify(Quests.completed)),
              history:JSON.parse(JSON.stringify(Quests.history))},
      bosses:JSON.parse(JSON.stringify(Bosses.defeated)),
      shrines:{list:World.shrines.filter(function(s){return s.lit;}).map(function(s){return s.id;})},
      chests:World.chests.filter(function(c){return c.opened;}).map(function(c){return c.id;}),
      enemyDeath:Enemies.list.filter(function(e){return !e.alive;}).map(function(e){return [e.key,Math.round(e.pos.x),Math.round(e.pos.z)];}),
      lore:World.loreObjs.filter(function(l){return l.read;}).map(function(l){return l.id;}),
      story:{fragments:Story.fragments.slice(), stage:Story.stage, choices:JSON.parse(JSON.stringify(Story.choices)),
             flag:JSON.parse(JSON.stringify(Story.flags))},
      settings:{renderScale:renderScale,shadowsOn:shadowsOn,farDist:farDist,bloomAmount:bloomAmount,
                partsScale:partsScale,shakeSetting:shakeSetting,diffIndex:diffIndex,
                sens:Camera.sens,invertY:Camera.invertY},
      audio:{master:0.7,music:0.45,sfx:0.8}
    };
  },
  has(){ try{ return !!localStorage.getItem(this.KEY); }catch(e){ return false; } },
  info(){
    try{
      const s=JSON.parse(localStorage.getItem(this.KEY));
      if(!s) return null;
      return {level:s.S.level, playtime:s.S.playtime||0, region:Story.currentRegionName||s.shrine||null};
    }catch(e){ return null; }
  },
  save(){
    try{
      localStorage.setItem(this.KEY, JSON.stringify(this.snapshot()));
      HUD.toast('Game saved.');
      Audio2.play('item');
      return true;
    }catch(e){
      HUD.toast('Save failed: storage unavailable.');
      return false;
    }
  },
  autosave(){
    // throttle autosaves to avoid hammering localStorage
    const now=Date.now();
    if(this._last&&now-this._last<20000) return;
    this._last=now;
    try{ localStorage.setItem(this.KEY, JSON.stringify(this.snapshot())); }catch(e){}
  },
  load(){
    let s=null;
    try{ s=JSON.parse(localStorage.getItem(this.KEY)); }catch(e){ return false; }
    if(!s) return false;
    // On a cold page load the player may not have been built yet (only
    // newGame() calls Player.init()). `parts` defaults to {} so test for the
    // mesh itself, otherwise loading a save throws on every animation frame.
    if(!Player.mesh) Player.init();
    // --- player ---
    Player.S=s.S;
    Player.weaponIndex=s.weaponIndex||0;
    Weapons.init();
    Weapons.owned=s.weapons.owned; Weapons.levels=s.weapons.levels;
    Inventory.init();
    Inventory.items=s.inv.items; Inventory.equipped=s.inv.equipped;
    Skills.init();
    Skills.owned=s.skills||{};
    Player.hasSecondBreath=Skills.has('g_last');
    Player.recalc();
    Player.hp=s.hp||Player.D.hpMax; Player.stam=s.stam||Player.D.stMax; Player.mana=s.mana||Player.D.mnMax;
    Player.flaskCount=s.flask!==undefined?s.flask:Player.flaskMax;
    // --- quests ---
    Quests.init();
    Quests.counters=s.quests.counters||{};
    Quests.active=s.quests.active||{};
    Quests.completed=s.quests.completed||{};
    // Older saves predate flag history; rebuild it from counters + completed
    // quests so retroactive crediting still works for returning players.
    Quests.history=s.quests.history||{};
    if(!s.quests.history){
      for(const k in Quests.counters) Quests.history[k]=Quests.counters[k];
      for(const id in Quests.completed){
        const d=Quests.byId(id);
        if(!d) continue;
        for(let i=0;i<d.objectives.length;i++){
          const ob=d.objectives[i];
          const need=ob.count||1;
          if((Quests.history[ob.flag]||0)<need) Quests.history[ob.flag]=need;
        }
      }
    }
    // --- bosses ---
    Bosses.init();
    Bosses.defeated=s.bosses||{};
    // --- world state ---
    for(let i=0;i<World.shrines.length;i++) World.shrines[i].lit=(s.shrines.list.indexOf(World.shrines[i].id)>=0);
    for(let i=0;i<World.chests.length;i++){
      const c=World.chests[i];
      c.opened=(s.chests.indexOf(c.id)>=0);
      if(c.opened) World.setChestLid(c, true);
    }
    for(let i=0;i<World.loreObjs.length;i++) World.loreObjs[i].read=(s.lore.indexOf(World.loreObjs[i].id)>=0);
    // remove enemies the player already killed, re-place the rest
    Enemies.clearAll();
    Bosses.active=null;
    // --- story ---
    Story.fragments=(s.story.fragments||[]).slice();
    Story.stage=s.story.stage||0;
    Story.choices=s.story.choices||{spare:false,kill:false,shards:0};
    Story.choices.shards=Story.fragments.length;
    Story.flags=s.story.flag||{};
    // --- resume position at last shrine ---
    let sp={x:-452,z:30};
    if(s.shrine){
      for(let i=0;i<World.shrines.length;i++){
        const sh=World.shrines[i];
        if(sh.id===s.shrine){ sp={x:sh.x,z:sh.z+6}; Player.lastShrine=sh; break; }
      }
    } else if(s.pos) sp={x:s.pos.x,z:s.pos.z};
    Player.spawn(sp.x,sp.z);
    // --- settings ---
    if(s.settings){
      renderScale=s.settings.renderScale; shadowsOn=s.settings.shadowsOn; farDist=s.settings.farDist;
      bloomAmount=s.settings.bloomAmount; partsScale=s.settings.partsScale; shakeSetting=s.settings.shakeSetting;
      diffIndex=s.settings.diffIndex;
      Camera.sens=s.settings.sens; Camera.invertY=s.settings.invertY;
      applySettings();
    }
    // --- world content ---
    World.populateTimer=0;
    Game.populate(false);
    Story.applyStage();
    HUD.dirty=true;
    return true;
  },
  reset(){
    try{ localStorage.removeItem(this.KEY); }catch(e){}
  }
};

/* ==========================================================================
   THIRD-PERSON CAMERA (orbit, smoothing, collision, combat/boss behaviour)
   ========================================================================== */
const Camera = {
  yaw:0, pitch:0.22, dist:CFG.cam.dist, targetDist:CFG.cam.dist,
  pos:new THREE.Vector3(), look:new THREE.Vector3(),
  sens:CFG.cam.sens, invertY:0, shakeX:0, shakeY:0, combatT:0, bossT:0,
  initialised:false,
  init(){
    this.yaw=0; this.pitch=0.22; this.dist=CFG.cam.dist; this.targetDist=CFG.cam.dist;
    this.initialised=false;
  },
  addLook(dx,dy){
    const s=this.sens;
    this.yaw-=dx*s;
    this.pitch+=(this.invertY?1:-1)*dy*s;
    this.pitch=clamp(this.pitch,CFG.cam.pitchMin,CFG.cam.pitchMax);
    this.yaw=this.yaw%TAU;
  },
  update(dt,instant){
    const P=Player.pos;
    // distance
    this.targetDist=clamp(this.dist, CFG.cam.minDist, CFG.cam.maxDist);
    // camera is pulled in during boss fights for drama
    const inBoss=(Bosses.active&&Bosses.active.alive);
    if(inBoss) this.bossT=Math.min(1,this.bossT+dt*0.7); else this.bossT=Math.max(0,this.bossT-dt*0.5);
    const combat=(Enemies.nearest(P.x,P.z,14)!==null);
    if(combat) this.combatT=Math.min(1,this.combatT+dt*2.2); else this.combatT=Math.max(0,this.combatT-dt*0.8);
    const wantDist=this.targetDist*(1-0.16*this.combatT)*(1-0.12*this.bossT)*(Player.sprinting?1.08:1);
    // desired camera position behind the player
    let cp=Math.sin(this.pitch), cc=Math.cos(this.pitch);
    const offX=-Math.sin(this.yaw)*cc*wantDist;
    const offZ=-Math.cos(this.yaw)*cc*wantDist;
    const offY=cp*wantDist+CFG.cam.height;
    let desired=new THREE.Vector3(P.x+offX, P.y+offY, P.z+offZ);
    // collision: never below terrain
    const minY=terrainHeight(desired.x,desired.z)+1.05;
    if(desired.y<minY) desired.y=minY;
    // obstacle avoidance: pull in if a tall prop sits between player and camera
    const dir=new THREE.Vector3().subVectors(desired,P); dir.y=0;
    const len=dir.length();
    if(len>0.6){
      dir.normalize();
      const tmp=World.tmpArr4||(World.tmpArr4=[]);
      let hitAt=len;
      for(let s=1;s<=5;s++){
        const f=(s/5)*len;
        const tx=P.x+dir.x*f, tz=P.z+dir.z*f;
        World.hash.query(tx,tz,1.2,tmp);
        for(let k=0;k<tmp.length;k++){
          const c=tmp[k];
          if(c.top>desired.y&&c.r>1.0&&Math.hypot(tx-c.x,tz-c.z)<c.r*0.9){
            hitAt=Math.min(hitAt,f*0.85);
          }
        }
      }
      if(hitAt<len){
        const shrink=hitAt/len;
        desired.set(P.x+offX*shrink, Math.max(terrainHeight(P.x+offX*shrink,P.z+offZ*shrink)+0.9, P.y+offY*shrink), P.z+offZ*shrink);
      }
    }
    const sm=instant?1e9:CFG.cam.smooth;
    this.pos.x=damp(this.pos.x,desired.x,sm,dt);
    this.pos.y=damp(this.pos.y,desired.y,sm*0.85,dt);
    this.pos.z=damp(this.pos.z,desired.z,sm,dt);
    // look target: slightly ahead of the player, or at the lock target
    const lookTarget=new THREE.Vector3(P.x,P.y+CFG.cam.look,P.z);
    if(Player.lockOn&&Player.lockTarget&&Player.lockTarget.alive){
      const t=Player.lockTarget.pos;
      lookTarget.set(lerp(P.x,t.x,0.35), lerp(P.y+CFG.cam.look,t.y+t.h*0.55,0.5), lerp(P.z,t.z,0.35));
    } else {
      const fx=Math.sin(this.yaw)*1.4, fz=Math.cos(this.yaw)*1.4;
      lookTarget.x+=fx; lookTarget.z+=fz;
    }
    this.look.x=damp(this.look.x,lookTarget.x,sm*1.3,dt);
    this.look.y=damp(this.look.y,lookTarget.y,sm*1.1,dt);
    this.look.z=damp(this.look.z,lookTarget.z,sm*1.3,dt);
    // build the camera transform with impact shake
    const sh=FX.shakeOff;
    camera.position.set(this.pos.x+sh.x*0.6, this.pos.y+sh.y*0.6, this.pos.z+sh.z*0.6);
    camera.lookAt(this.look.x,this.look.y,this.look.z);
    camera.rotation.z+=sh.x*0.03;
    // dynamic FOV
    const wantFov=CFG.cam.fov+(CFG.cam.fovCombat-CFG.cam.fov)*this.combatT+(Player.sprinting?4:0)+(inBoss?3:0);
    camera.fov=damp(camera.fov,wantFov,6,dt);
    camera.updateProjectionMatrix();
  }
};

/* ==========================================================================
   MINIMAP + WORLD MAP
   ========================================================================== */
const Minimap = {
  cv:null, ctx:null, big:null, bigCtx:null, timer:0,
  init(){
    this.cv=document.getElementById('minimap'); this.ctx=this.cv.getContext('2d');
    this.big=document.getElementById('bigmap'); this.bigCtx=this.big.getContext('2d');
  },
  draw(){
    const ctx=this.ctx, W=this.cv.width, H=this.cv.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#070605'; ctx.fillRect(0,0,W,H);
    const pd=86;   // world units shown across the minimap
    const px=Player.pos.x, pz=Player.pos.z;
    // regions
    ctx.save();
    ctx.translate(W/2,H/2);
    for(let i=0;i<REGIONS.length;i++){
      const R=REGIONS[i];
      const sx=(R.c.x-px)/pd*W, sz=(R.c.z-pz)/pd*H;
      const r=(R.radius/pd)*W;
      const discovered=Story.regionDiscovered(R.id);
      ctx.globalAlpha=discovered?0.30:0.10;
      ctx.fillStyle='#'+new THREE.Color(R.ground).getHexString();
      ctx.beginPath(); ctx.arc(sx,sz,r,0,TAU); ctx.fill();
      if(discovered){
        ctx.globalAlpha=0.5; ctx.strokeStyle='#'+new THREE.Color(R.acc[0]).getHexString();
        ctx.lineWidth=1; ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    // roads
    ctx.strokeStyle='rgba(200,180,140,0.30)'; ctx.lineWidth=1.5;
    for(let i=0;i<REGIONS.length-1;i++){
      const A=REGIONS[i], B=REGIONS[i+1];
      ctx.beginPath();
      ctx.moveTo((A.c.x-px)/pd*W,(A.c.z-pz)/pd*H);
      ctx.lineTo((B.c.x-px)/pd*W,(B.c.z-pz)/pd*H);
      ctx.stroke();
    }
    // shrines
    for(let i=0;i<World.shrines.length;i++){
      const s=World.shrines[i];
      const sx=(s.x-px)/pd*W, sz=(s.z-pz)/pd*H;
      ctx.fillStyle=s.lit?'#ffb060':'#7d7466';
      ctx.beginPath(); ctx.arc(sx,sz,3.4,0,TAU); ctx.fill();
      if(s.lit){ ctx.fillStyle='rgba(255,176,96,0.25)'; ctx.beginPath(); ctx.arc(sx,sz,7,0,TAU); ctx.fill(); }
    }
    // chests (only undiscovered shown faint)
    for(let i=0;i<World.chests.length;i++){
      const c=World.chests[i];
      if(c.opened) continue;
      const sx=(c.x-px)/pd*W, sz=(c.z-pz)/pd*H;
      ctx.fillStyle='rgba(217,178,106,0.65)';
      ctx.fillRect(sx-2,sz-2,4,4);
    }
    // npcs
    for(let i=0;i<NPCs.list.length;i++){
      const n=NPCs.list[i];
      const sx=(n.x-px)/pd*W, sz=(n.z-pz)/pd*H;
      ctx.fillStyle='#8fd0ff';
      ctx.beginPath(); ctx.arc(sx,sz,3,0,TAU); ctx.fill();
    }
    // enemies
    for(let i=0;i<Enemies.list.length;i++){
      const e=Enemies.list[i];
      if(!e.alive||e.dormant) continue;
      const sx=(e.pos.x-px)/pd*W, sz=(e.pos.z-pz)/pd*H;
      ctx.fillStyle=e.isBoss?'#ff5a4a':(e.elite?'#ffc060':'#c04030');
      const r2=e.isBoss?5:(e.elite?3.4:2.4);
      ctx.beginPath(); ctx.arc(sx,sz,r2,0,TAU); ctx.fill();
    }
    ctx.restore();
    // player arrow (always centre)
    ctx.save();
    ctx.translate(W/2,H/2);
    ctx.rotate(-Player.yaw);
    ctx.fillStyle='#f0e0b0';
    ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(4.5,5); ctx.lineTo(-4.5,5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // frame
    ctx.strokeStyle='rgba(217,178,106,0.35)'; ctx.lineWidth=1;
    ctx.strokeRect(0.5,0.5,W-1,H-1);
    // compass
    ctx.fillStyle='rgba(217,178,106,0.75)'; ctx.font='11px Georgia'; ctx.textAlign='center';
    ctx.fillText('N',W/2,12);
  },
  drawBig(){
    const ctx=this.bigCtx, W=this.big.width, H=this.big.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#070605'; ctx.fillRect(0,0,W,H);
    // must match the world's procedural continent: giant terrain ring inside [0,1]
    const mapX=function(wx){ return (wx/(CFG.world.sizeX*0.5)*0.5+0.5)*W; };
    const mapY=function(wz){ return (wz/(CFG.world.sizeZ*0.5)*0.5+0.5)*H; };
    ctx.strokeStyle='rgba(217,178,106,0.25)'; ctx.lineWidth=2;
    ctx.beginPath();
    for(let a=0;a<=72;a++){
      const ang=a/72*TAU;
      const x=mapX(Math.cos(ang)*CFG.world.sizeX*0.47);
      const y=mapY(Math.sin(ang)*CFG.world.sizeZ*0.47);
      if(a===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
    // regions
    for(let i=0;i<REGIONS.length;i++){
      const R=REGIONS[i];
      const cx=mapX(R.c.x), cy=mapY(R.c.z);
      const rx=(R.radius/CFG.world.sizeX)*W*1.0, ry=(R.radius/CFG.world.sizeZ)*H*1.0;
      const disc=Story.regionDiscovered(R.id);
      ctx.globalAlpha=disc?0.42:0.13;
      ctx.fillStyle='#'+new THREE.Color(R.ground).getHexString();
      ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,TAU); ctx.fill();
      ctx.globalAlpha=disc?0.8:0.3;
      ctx.strokeStyle='#'+new THREE.Color(R.acc[0]).getHexString(); ctx.lineWidth=1.5;
      ctx.stroke();
      ctx.globalAlpha=1;
      ctx.fillStyle=disc?'#f0e0b0':'#6b6355';
      ctx.font='bold 13px Georgia'; ctx.textAlign='center';
      ctx.fillText(disc?R.name:'UNKNOWN', cx, cy+4);
      ctx.font='11px Georgia'; ctx.fillStyle=disc?'#a89a80':'#5a5348';
      ctx.fillText(disc?R.sub:'', cx, cy+19);
    }
    // shrines / bosses / collectibles
    for(let i=0;i<World.shrines.length;i++){
      const s=World.shrines[i];
      ctx.fillStyle=s.lit?'#ffb060':'#5a5348';
      ctx.beginPath(); ctx.arc(mapX(s.x),mapY(s.z),3.4,0,TAU); ctx.fill();
    }
    for(let i=0;i<World.chests.length;i++){
      const c=World.chests[i];
      if(c.opened) continue;
      ctx.fillStyle='rgba(217,178,106,0.5)';
      ctx.fillRect(mapX(c.x)-2,mapY(c.z)-2,4,4);
    }
    for(let i=0;i<World.loreObjs.length;i++){
      const l=World.loreObjs[i];
      ctx.fillStyle=l.read?'#6b6355':'rgba(159,208,255,0.75)';
      ctx.beginPath(); ctx.arc(mapX(l.x),mapY(l.z),2.6,0,TAU); ctx.fill();
    }
    // boss markers
    for(const id in BOSS_DEFS){
      const D=BOSS_DEFS[id];
      const R=regionById(D.region);
      const bx=mapX(R.arena.x), by=mapY(R.arena.z);
      const dead=Bosses.defeated[id];
      ctx.strokeStyle=dead?'#6b6355':'#ff5a4a'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(bx,by,7,0,TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx-4,by-4); ctx.lineTo(bx+4,by+4);
      ctx.moveTo(bx+4,by-4); ctx.lineTo(bx-4,by+4); ctx.stroke();
    }
    // npcs
    for(let i=0;i<NPCs.list.length;i++){
      const n=NPCs.list[i];
      ctx.fillStyle='#8fd0ff';
      ctx.beginPath(); ctx.arc(mapX(n.x),mapY(n.z),3.2,0,TAU); ctx.fill();
    }
    // player
    const px=mapX(Player.pos.x), py=mapY(Player.pos.z);
    ctx.save(); ctx.translate(px,py); ctx.rotate(-Player.yaw);
    ctx.fillStyle='#fff2cf';
    ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(6,6); ctx.lineTo(-6,6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle='rgba(217,178,106,0.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(px,py,11,0,TAU); ctx.stroke();
  }
};
