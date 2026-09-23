
/* ==========================================================================
   SECTION 21 - STORY PROGRESSION
   Five shards, five Lords, one Forge. Player choices at each Lord's fall
   decide which of three endings the anvil offers.
   ========================================================================== */
const Story = {
  fragments:[],                 // shard indices held (0..4)
  stage:0,
  choices:{spare:0, kill:0, truth:false, shards:0, ending:null},
  flags:{},
  loreCount:0,
  shardNames:['Shard of Ash','Shard of Root','Shard of Prism','Shard of Frost','Shard of Cinders'],
  currentRegion:null, currentRegionName:'',
  discovery:{},
  stagesFired:{},
  shardChoicesMade:{},          // bossId -> true once the post-boss choice is shown

  init(){
    this.fragments=[]; this.stage=0;
    this.choices={spare:0,kill:0,truth:false,shards:0,ending:null};
    this.flags={}; this.loreCount=0; this.discovery={}; this.stagesFired={};
    this.shardChoicesMade={}; this.currentRegion=null; this.currentRegionName='';
  },
  regionDiscovered(id){
    return !!this.discovery[id];
  },
  discover(R){
    if(this.discovery[R.id]) return false;
    this.discovery[R.id]=true;
    HUD.showRegion(R);
    Audio2.setRegionAmbience(R.idx);
    // shift lighting and fog for a distinct feel in each region
    const f=new THREE.Color(R.fogColor);
    scene.fog.color.copy(f);
    scene.fog.density=R.fogD;
    scene.background=new THREE.Color(R.sky);
    hemiLight.color=new THREE.Color(R.hemi[0]);
    hemiLight.groundColor=new THREE.Color(R.hemi[1]);
    hemiLight.intensity=R.hemi[2];
    sunLight.color=new THREE.Color(R.sun);
    sunLight.intensity=R.sunI;
    Quests.onFlag('region_'+R.id);
    if(!this.regionQuestDone[R.id]){ this.regionQuestDone[R.id]=true; }
    this.currentRegionName=R.name;
    Save.autosave();
    return true;
  },
  regionQuestDone:{},

  /* ---- stage advance ---------------------------------------------------- */
  setStage(n,msg){
    if(this.stagesFired[n]) return;
    this.stagesFired[n]=true;
    this.stage=Math.max(this.stage,n);
    if(msg) HUD.toast(msg);
  },
  applyStage(){
    // re-activate the quests the player should currently hold after a load
    const ids=['q_shrine','q_firstlord','q_devourer','q_mines','q_queen','q_saint','q_king','q_forge','q_warden'];
    const upto=clamp(this.fragments.length,0,5);
    for(let i=0;i<=upto&&i<ids.length;i++){
      if(!Quests.completed[ids[i]]) Quests.start(ids[i]);
    }
  },

  /* ---- shards ----------------------------------------------------------- */
  collectShard(i){
    if(this.fragments.indexOf(i)>=0) return;
    this.fragments.push(i);
    this.choices.shards=this.fragments.length;
    Audio2.play('quest');
    HUD.toast('SHARD RECOVERED ('+this.fragments.length+'/5): '+this.shardNames[i]);
    FX.burst(Player.pos.x,Player.pos.y+1.4,Player.pos.z,60,{color:[1,0.85,0.4],speed:9,life:1.4,size:0.6,up:1.0});
    FX.shock(Player.pos.x,Player.pos.y,Player.pos.z,9,0xffd070);
    if(this.fragments.length>=5){
      this.setStage(20,'All five shards are yours. The Sun Forge waits east of everything.');
      Quests.onFlag('shards_delivered');
      if(!Quests.completed.q_forge) Quests.start('q_forge');
      if(!Quests.completed.q_warden) Quests.start('q_warden');
    }
  },
  optionalBossDown(id){
    HUD.toast('Optional guardian defeated. The Forge anvil is unguarded.');
    Quests.onFlag('boss_'+id);
    Quests.onFlag('forge_open');
  },

  /* ---- narrative hooks -------------------------------------------------- */
  bossIntro(id,D){
    Cutscene.play([
      D.name,
      D.intro
    ], function(){});
  },
  onBossDefeated(id,D){
    Quests.onFlag('boss_'+id);
    // After a Lord falls the player must decide what to do with what remains.
    const after=function(){
      Story.shardChoice(id,D);
    };
    setTimeout(after, 2600);
  },
  // The choice that decides the ending: mercy or dominion.
  shardChoice(id,D){
    if(this.shardChoicesMade[id]) return;
    this.shardChoicesMade[id]=true;
    const self=this;
    Dialogue.custom(D.name+' \u2014 Remains', D.defeat, [
      { text:'Let it rest. Take only the shard.', fn:function(){
          self.choices.spare++;
          HUD.toast('You let the remnant go. Mercy: '+self.choices.spare);
        }},
      { text:'End it. Take everything.', fn:function(){
          self.choices.kill++;
          HUD.toast('You ended it cleanly. Dominion: '+self.choices.kill);
          Player.addGold(Math.round(D.gold*0.4));
        }},
      { text:'Ask it why.', fn:function(){
          self.choices.spare++;
          self.choices.truth=true;
          HUD.toast('It told you. The truth is worse than the fire.');
          Player.addXP(Math.round(D.xp*0.25));
        }}
    ]);
  },
  onMainQuestComplete(id){
    if(id==='q_shrine'){
      this.setStage(1,'Sera nods: "Now you know how to come back. Go north-east. He is in the ash."');
    } else if(id==='q_forge'){
      this.setStage(21,'The anvil is cold, but it is waiting.');
    }
  },
  /* ---- interaction flags ------------------------------------------------ */
  flag(name){
    if(this.flags[name]) return false;
    this.flags[name]=true;
    Quests.onFlag(name);
    return true;
  },
  onLoreRead(){
    this.loreCount++;
    Quests.onLore(this.loreCount);
  },

  /* ---- endgame ---------------------------------------------------------- */
  // Called when the player interacts with the Sun Forge anvil.
  atAnvil(){
    if(this.choices.ending) return;
    if(this.fragments.length<5){
      Dialogue.custom('THE SUN FORGE',
        'The anvil is cold and cracked. '+(5-this.fragments.length)+' shard'+
        ((5-this.fragments.length)>1?'s are':' is')+' still missing. It will not answer you yet.',
        [{text:'Step away.', fn:function(){}}]);
      return;
    }
    const mercyOK=this.choices.spare>=3;
    const opts=[
      { text:'Reforge the Sun. Give its light back to the whole kingdom.', fn:function(){ Story.finish('light'); } },
      { text:'Take the Forge for yourself. Wear the crown it makes.', fn:function(){ Story.finish('crown'); } },
      { text:'Break the shards. Let this age of light end.', fn:function(){ Story.finish('broken'); } }
    ];
    let line='The anvil drinks the five shards and grows warm. For the first time in a hundred years '+
             'someone stands here who is not a king.\n\nThe choice is yours, and no one else\u2019s.';
    if(!mercyOK) line+='\n\n(You have shown little mercy. Only some paths will answer.)';
    Dialogue.custom('THE SUN FORGE', line, opts);
  },
  finish(ending){
    this.choices.ending=ending;
    Quests.onFlag('ending_made');
    Game.endGame(ending);
  }
};

/* --------------------------------------------------------------------------
   DIALOGUE SYSTEM
   -------------------------------------------------------------------------- */
const Dialogue = {
  queue:[], current:null,
  // NPC conversation built from the NPC definition plus its quest hooks
  start(npc){
    const d=npc.def;
    const opts=[];
    const known={};
    if(d.quests) for(let i=0;i<d.quests.length;i++){
      const q=Quests.byId(d.quests[i]);
      if(!q) continue;
      if(Quests.completed[q.id]) continue;
      if(known[q.id]) continue;
      known[q.id]=true;
      const active=Quests.active[q.id];
      const self=this;
      if(!active){
        if(q.main&&Story.fragments.length<q.objectives.length&&Story.stage<1&&q.id!=='q_shrine') continue;
        opts.push({ text:'['+q.name+'] What do you need?', fn:function(){
          Quests.start(q.id);
          self.show('Need', q.desc, [{text:'I\u2019ll see it done.', fn:function(){ self.close(); }}]);
        }});
      } else {
        opts.push({ text:'['+q.name+'] I\u2019m still working on it.', fn:function(){
          let t='Objectives remaining:\n';
          for(let k=0;k<q.objectives.length;k++){
            const ob=q.objectives[k];
            const cur=ob.count?(active.o[k]||0):(active.o[k]?1:0);
            const need=ob.count||1;
            if(cur<need) t+='\u2022 '+ob.t+(ob.count?' ('+cur+'/'+need+')':'')+'\n';
          }
          self.show('Report', t, [{text:'Understood.', fn:function(){ self.close(); }}]);
        }});
      }
    }
    opts.push({ text:'Tell me about this place.', fn:function(){
      Dialogue.show(d.name.split(' ')[0], d.lines.about, [{text:'And the rest?', fn:function(){
        Dialogue.show(d.name.split(' ')[0], d.lines.end, [{text:'Thank you.', fn:function(){ Dialogue.close(); }}]);
      }}]);
    }});
    opts.push({ text:'Nothing for now.', fn:function(){ Dialogue.close(); }});
    npc.talked=true;
    this.show(d.name, d.lines.greet, opts);
  },
  // free-form dialogue with explicit options
  custom(who, text, opts){
    this.show(who, text, opts||[{text:'Continue.', fn:function(){ Dialogue.close(); }}]);
  },
  show(who,text,opts){
    this.current={who:who,text:text,opts:opts};
    const box=document.getElementById('dialogue');
    document.getElementById('dlgWho').textContent=who;
    document.getElementById('dlgLine').innerHTML=String(text).replace(/\n/g,'<br />');
    const box2=document.getElementById('dlgOpts');
    box2.innerHTML='';
    for(let i=0;i<opts.length;i++){
      const el=document.createElement('div');
      el.className='opt'; el.textContent=opts[i].text;
      (function(o){ el.addEventListener('click',function(ev){
        ev.stopPropagation(); Audio2.play('ui'); o.fn&&o.fn();
      }); })(opts[i]);
      box2.appendChild(el);
    }
    box.classList.remove('hidden');
    UI.open['dialogue']=true;
    UI.current='dialogue';
    try{ document.exitPointerLock&&document.exitPointerLock(); }catch(e){}
  },
  close(){
    const box=document.getElementById('dialogue');
    if(box) box.classList.add('hidden');
    UI.open['dialogue']=false;
    if(UI.current==='dialogue') UI.current=null;
  },
  isOpen(){ return UI.open['dialogue']===true; },
  skip(){
    if(this.current&&this.current.opts&&this.current.opts.length) return;
    this.close();
  }
};

/* --------------------------------------------------------------------------
   CUTSCENE (letterboxed text sequences)
   -------------------------------------------------------------------------- */
const Cutscene = {
  active:false, lines:[], i:0, onDone:null, charT:0, full:'', done:false,
  play(lines,onDone){
    this.lines=lines||[]; this.i=0; this.onDone=onDone||null;
    if(!this.lines.length){ if(this.onDone) this.onDone(); return; }
    if(!Cutscene.active){ Cutscene.active=true; }
    this.active=true;
    document.getElementById('cut').classList.remove('hidden');
    this.render();
    try{ document.exitPointerLock&&document.exitPointerLock(); }catch(e){}
  },
  render(){
    const el=document.getElementById('cutTxt');
    el.innerHTML='';
    const t=this.lines[this.i];
    el.innerHTML=(this.i===0? '<em>'+t+'</em>' : t);
  },
  next(){
    this.i++;
    if(this.i>=this.lines.length){
      const f=this.onDone; 
      this.active=false;
      document.getElementById('cut').classList.add('hidden');
      this.onDone=null; this.lines=[];
      if(f) f();
      return;
    }
    this.render();
    Audio2.play('ui');
  },
  skip(){
    if(!this.active) return;
    const f=this.onDone;
    this.active=false;
    document.getElementById('cut').classList.add('hidden');
    this.onDone=null; this.lines=[]; this.i=0;
    if(f) f();
  }
};

/* ==========================================================================
   SECTION 18 - GAME LOOP + STATE
   ========================================================================== */
const Game = {
  state:'boot',       // boot | menu | cut | play | dead | end
  fps:60, _fpsAcc:0, _fpsN:0, time:0, last:0, running:false,
  populateTimer:0, regionTimer:0, saveTimer:0, minimapTimer:0,
  paused:false,

  init(){
    this.last=performance.now();
    this.state='boot';
  },

  /* ---- lifecycle -------------------------------------------------------- */
  boot(){
    const self=this;
    const bar=document.querySelector('#bootbar i');
    const msg=document.getElementById('bootmsg');
    const step=function(p,txt){
      if(bar) bar.style.width=(p*100).toFixed(0)+'%';
      if(msg) msg.textContent=txt;
    };
    step(0.02,'Waking the embers');
    initThree();
    bindInput();
    FX.init();
    DmgText.init();
    Minimap.init();
    step(0.10,'Carving the world');
    // world generation is heavy: yield between the big steps so the bar paints
    let stage=0;
    const run=function(){
      if(stage===0){
        World.group=new THREE.Group(); scene.add(World.group);
        TEX.init();
        World.buildTerrain();
        step(0.30,'Sculpting the land'); stage++;
      } else if(stage===1){
        World.buildStructures();
        step(0.52,'Raising the ruins'); stage++;
      } else if(stage===2){
        World.scatterProps();
        step(0.68,'Seeding the wilds'); stage++;
      } else if(stage===3){
        World.buildShrines(); World.buildLoot(); World.buildArenas();
        step(0.80,'Lighting ember shrines'); stage++;
      } else if(stage===4){
        World.buildPortals(); World.buildLoreObjects();
        step(0.88,'Binding the paths'); stage++;
      } else if(stage===5){
        Magic.init();
        Combat.init();
        Weapons.init();
        Skills.init();
        Inventory.init();
        Quests.init();
        Story.init();
        Bosses.init();
        NPCs.init();
        UI.init();
        StatusFX.init();
        Quality.init();
        step(0.94,'Forging the ember'); stage++;
      } else {
        step(1.0,'Ready');
        Game.enterMenu();
        return;
      }
      setTimeout(run, 16);
    };
    setTimeout(run, 30);
  },
  enterMenu(){
    this.state='menu';
    document.getElementById('boot').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    const cont=document.getElementById('btnContinue');
    if(Save.has()){
      const info=Save.info();
      document.getElementById('contInfo').textContent=info? ('Level '+info.level+' \u00b7 '+formatTime(info.playtime)) : '';
      cont.classList.remove('disabled');
    } else {
      document.getElementById('contInfo').textContent='(no save found)';
      cont.style.opacity=0.4;
    }
    document.getElementById('hud').classList.add('hidden');
  },
  newGame(){
    Audio2.init(); Audio2.resume();
    UI.closeAll();
    Save.reset();
    Player.init();
    Player.lastShrine=null;
    // clear world transient state
    for(let i=0;i<World.shrines.length;i++) World.shrines[i].lit=false;
    for(let i=0;i<World.chests.length;i++){
      const c=World.chests[i]; c.opened=false;
      World.setChestLid(c, false);
    }
    for(let i=0;i<World.loreObjs.length;i++) World.loreObjs[i].read=false;
    for(let i=0;i<World.lootOrbs.length;i++){
      const o=World.lootOrbs[i];
      if(o.taken) World.setOrbTaken(o, false);
    }
    Quests.init(); Story.init(); Bosses.init(); Bosses.active=null; Bosses.defeated={};
    Enemies.clearAll();
    Buffs.clear();
    Camera.init();
    // start at the Ashen Hearth shrine
    const s=World.shrines[0];
    Player.spawn(s.x, s.z+7);
    Player.lastShrine=s;
    this.startPlay();
    // opening sequence
    const self=this;
    Cutscene.play([
      'FORGE OF THE FALLEN KING',
      'The Sun Forge kept the kingdom warm for six hundred years. It was not a god. It was a furnace, and someone was always standing near it.',
      'Then it shattered \u2014 no one agrees how \u2014 and five Courts each took a piece of the light and went home to become monsters.',
      'You woke in the ash with a sword you do not remember buying, and a village you do not remember burning.',
      'Walk east. The shrines still answer to a living hand.'
    ], function(){
      Quests.start('q_shrine');
      Quests.start('q_flame_herbs');
      Quests.start('q_hound_cull');
      HUD.toast('New quest: Kindle the Ember \u2014 press E at the shrine.');
    });
  },
  continueGame(){
    if(!Save.has()){ HUD.toast('No save found. Starting a new game.'); this.newGame(); return; }
    this.loadGame();
  },
  loadGame(){
    Audio2.init(); Audio2.resume();
    UI.closeAll();
    const ok=Save.load();
    if(!ok){ HUD.toast('Save could not be read.'); return; }
    Game.startPlay();
    HUD.toast('Game loaded.');
    Cutscene.active=false;
    document.getElementById('cut').classList.add('hidden');
  },
  startPlay(){
    UI.closeAll();
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('boot').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('death').classList.add('hidden');
    document.getElementById('victory').classList.add('hidden');
    this.state='play';
    this.paused=false;
    // prime the world around the player
    Enemies.clearAll();
    this.populate(true);
    // discover the starting region (silently sets atmosphere)
    const R=getRegionAt(Player.pos.x,Player.pos.z);
    if(R) Story.discover(R);
    HUD.dirty=true;
  },
  quitToMenu(){
    UI.closeAll();
    Dialogue.close();
    this.state='menu';
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('death').classList.add('hidden');
    document.getElementById('victory').classList.add('hidden');
    try{ document.exitPointerLock&&document.exitPointerLock(); }catch(e){}
  },
  respawn(){
    Audio2.init();
    UI.set('death',false);
    const s=Player.lastShrine;
    Player.dead=false; Player.state='idle';
    if(s){ Player.pos.set(s.x, terrainHeight(s.x,s.z), s.z+6); }
    const spawnPos=Player.pos.clone();
    Player.spawn(spawnPos.x,spawnPos.z);
    Player.hp=Player.D.hpMax; Player.stam=Player.D.stMax; Player.mana=Player.D.mnMax;
    Player.flaskCount=Player.flaskMax;
    Player.invuln=2.4;
    Enemies.reviveAll();
    Buffs.clear();
    Bosses.active=null;
    HUD.hideBoss();
    this.state='play';
    HUD.toast('The shrine pulls you back. The dead rise again.');
    Audio2.play('shrine');
    requestLock();
  },
  victoryContinue(){
    this.state='play';
    UI.set('victory',false);
    requestLock();
  },
  endGame(ending){
    const S=Player.S;
    const E=ENDINGS[ending];
    this.state='end';
    try{ document.exitPointerLock&&document.exitPointerLock(); }catch(e){}
    const body=document.getElementById('vicBody');
    document.getElementById('vicTitle').textContent=E.title;
    let html='<p>'+E.body.replace(/\n/g,'<br />')+'</p>';
    html+='<h3 style="color:#d9b26a;letter-spacing:.2em;margin-top:14px">Your Record</h3>';
    html+='<div class="statline"><span>Ending</span><b>'+E.title+'</b></div>';
    html+='<div class="statline"><span>Level</span><b>'+S.level+'</b></div>';
    html+='<div class="statline"><span>Playtime</span><b>'+formatTime(S.playtime)+'</b></div>';
    html+='<div class="statline"><span>Enemies Slain</span><b>'+S.kills+'</b></div>';
    html+='<div class="statline"><span>Deaths</span><b>'+S.deaths+'</b></div>';
    html+='<div class="statline"><span>Shards Recovered</span><b>'+Story.fragments.length+' / 5</b></div>';
    html+='<div class="statline"><span>Quests Completed</span><b>'+Quests.allCompletedCount()+' / '+Quests.defs.length+'</b></div>';
    html+='<div class="statline"><span>Lords Spared</span><b>'+Story.choices.spare+'</b></div>';
    html+='<div class="statline"><span>Lords Ended</span><b>'+Story.choices.kill+'</b></div>';
    html+='<div class="statline"><span>Lore Stones Read</span><b>'+Story.loreCount+' / 12</b></div>';
    html+='<div class="statline"><span>Other Endings</span><b>'+E.hint+'</b></div>';
    body.innerHTML=html;
    UI.set('victory',true);
    Audio2.play('boss_roar',{vol:0.6});
    FX.shock(Player.pos.x,Player.pos.y+0.1,Player.pos.z,30,0xffd070);
    FX.burst(Player.pos.x,Player.pos.y+1.5,Player.pos.z,200,{color:[1,0.85,0.45],speed:20,life:3.0,size:0.9,up:1.4});
    Save.autosave();
  },

  /* ---- spawn management ------------------------------------------------- */
  populate(initial){
    const px=Player.pos.x, pz=Player.pos.z;
    const want=Math.min(26,4+Math.round(Player.S.level*0.35)+Enemies.countAlive()*0);
    if(initial){
      // seed a wide ring so the world feels alive immediately
      Enemies.populateAround(px,pz,120,14);
      for(let i=0;i<REGIONS.length;i++){
        const R=REGIONS[i];
        const dx=R.c.x-px, dz=R.c.z-pz;
        if(Math.hypot(dx,dz)<420) Enemies.populateAround(R.c.x,R.c.z,R.radius*0.8,R.id==='village'?7:9);
      }
      return;
    }
    if(Enemies.countAlive()<want) Enemies.populateAround(px,pz,95,3);
  },
  // bosses wake when the player steps into their arena
  checkBossTriggers(){
    for(let i=0;i<REGIONS.length;i++){
      const R=REGIONS[i];
      const a=R.arena;
      const d=Math.hypot(Player.pos.x-a.x, Player.pos.z-a.z);
      if(d<a.r*0.86){
        const map={village:'ashwarden',forest:'forestdevourer',caverns:'crystalqueen',
                   cathedral:'frozensaint',citadel:'fallenking',sunforge:'forgewarden'};
        const id=map[R.id];
        if(!id) continue;
        if(Bosses.defeated[id]) continue;
        if(Bosses.active&&Bosses.active.bossId===id) continue;
        if(id==='ashwarden') Quests.onFlag('boss_enter_ashwarden');
        if(id==='forgewarden'&&!Bosses.defeated[id]&&Story.fragments.length<5) continue;
        Bosses.spawn(id);
      }
    }
  },
  // region transitions, discoveries and hidden-objective triggers
  checkRegion(){
    const R=getRegionAt(Player.pos.x,Player.pos.z);
    if(R){
      if(!Story.currentRegion||Story.currentRegion!==R.id){
        Story.currentRegion=R.id;
        Story.discover(R);
      }
    }
    // hidden: the world's edge
    const ex=Math.abs(Player.pos.x)/(CFG.world.sizeX*0.5);
    const ez=Math.abs(Player.pos.z)/(CFG.world.sizeZ*0.5);
    if(Math.max(ex,ez)>0.93) Story.flag('hidden_edge');
    // hidden: the deepest lamp
    if(Story.currentRegion==='caverns'&&
       Math.hypot(Player.pos.x+140,Player.pos.z-340)<26) Story.flag('hidden_deepcavern');
    // mine mouth trigger
    const M=regionById('mines');
    const mouths=[{x:M.c.x-60,z:M.c.z-40},{x:M.c.x+50,z:M.c.z+40},{x:M.c.x-20,z:M.c.z+80},{x:M.c.x+70,z:M.c.z-70}];
    for(let i=0;i<mouths.length;i++){
      if(Math.hypot(Player.pos.x-mouths[i].x,Player.pos.z-mouths[i].z)<7) Story.flag('mine_entered');
    }
  },

  /* ---- interaction ------------------------------------------------------ */
  findInteract(){
    const P=Player.pos;
    let best=null, bestD=1e9;
    const maxD=3.6;
    // shrines
    for(let i=0;i<World.shrines.length;i++){
      const s=World.shrines[i];
      const d=Math.hypot(P.x-s.x,P.z-s.z);
      if(d<maxD&&d<bestD){ bestD=d; best={kind:'shrine',obj:s,label:'Rest at <b>'+s.name+'</b>',key:'E'}; }
    }
    // chests
    for(let i=0;i<World.chests.length;i++){
      const c=World.chests[i];
      if(c.opened) continue;
      const d=Math.hypot(P.x-c.x,P.z-c.z);
      if(d<maxD&&d<bestD){ bestD=d; best={kind:'chest',obj:c,label:'Open <b>Chest</b>',key:'E'}; }
    }
    // lore
    for(let i=0;i<World.loreObjs.length;i++){
      const l=World.loreObjs[i];
      const d=Math.hypot(P.x-l.x,P.z-l.z);
      if(d<maxD&&d<bestD){ bestD=d; best={kind:'lore',obj:l,label:(l.read?'Re-read ':'Read ')+'<b>'+l.title+'</b>',key:'E'}; }
    }
    // npcs
    const npc=NPCs.nearest(P.x,P.z,maxD);
    if(npc){
      const d=Math.hypot(P.x-npc.x,P.z-npc.z);
      if(d<bestD){ bestD=d; best={kind:'npc',obj:npc,label:'Speak with <b>'+npc.def.name+'</b>',key:'E'}; }
    }
    // the Sun Forge anvil
    const SF=regionById('sunforge');
    if(Math.hypot(P.x-SF.c.x,P.z-SF.c.z)<7.5){
      best={kind:'anvil',obj:null,label:'Touch the <b>Sun Forge anvil</b>',key:'E'};
    }
    return best;
  },
  doInteract(target){
    if(!target) return;
    Audio2.init();
    if(target.kind==='shrine'){
      const s=target.obj;
      const first=!s.lit;
      s.lit=true;
      Player.lastShrine=s;
      Player.hp=Player.D.hpMax; Player.stam=Player.D.stMax; Player.mana=Player.D.mnMax;
      Player.flaskCount=Player.flaskMax;
      Enemies.reviveAll();
      Buffs.clear();
      Audio2.play('shrine');
      FX.burst(s.x,s.y+5.4,s.z,50,{color:[1,0.6,0.25],speed:7,life:1.4,size:0.55,up:1.2});
      FX.shock(s.x,s.y,s.z,8,0xff8a3d);
      HUD.toast('Rested at '+s.name+'. Flasks refilled. Enemies have returned.');
      if(first){
        Story.flag('shrine_lit');
        Quests.onShrine();
        HUD.toast('Ember Shrine lit. This is now your checkpoint.');
      }
      Save.autosave();
    } else if(target.kind==='chest'){
      const c=target.obj;
      c.opened=true;
      World.setChestLid(c, true);
      const tier=c.tier||0;
      const pool=[['ember','ore','herb','emberdraught','flask_charge'],
                  ['ore','frost','emberdraught','azuredraught','whetstone','ring_ember'],
                  ['arcane','frost','whetstone','armorplate','ring_hunt','ash_bomb'],
                  ['arcane','whetstone','aegis','ring_ward','azuredraught']][clamp(tier,0,3)];
      const n=1+Math.floor(Math.random()*2);
      for(let i=0;i<n;i++) Inventory.add(pick(pool),1);
      const gold=40+tier*70+Math.floor(Math.random()*40);
      Player.addGold(gold);
      Player.addXP(60+tier*90);
      Quests.onChest();
      Audio2.play('chest');
      FX.burst(c.x,c.y+1.3,c.z,30,{color:[1,0.85,0.45],speed:6,life:0.9,size:0.5});
      HUD.toast('Chest opened: '+gold+' gold.');
      Save.autosave();
    } else if(target.kind==='lore'){
      const l=target.obj;
      const first=!l.read;
      l.read=true;
      const txt=TEXT_LORE[l.title]||('The carving is worn past reading.');
      Dialogue.custom(l.title, txt, [{text:'Close the record.', fn:function(){ Dialogue.close(); }}]);
      if(first){
        Story.onLoreRead();
        Player.addXP(140);
        Story.flag('lore_'+(l.title==='Kingsroad Stone'?'kingsroad':''));
        if(l.title==='Kingsroad Stone') Story.flag('lore_kingsroad');
      }
      Audio2.play('item');
    } else if(target.kind==='npc'){
      Dialogue.start(target.obj);
    } else if(target.kind==='anvil'){
      Story.atAnvil();
    }
  },
  collectOrbs(){
    const P=Player.pos;
    for(let i=0;i<World.lootOrbs.length;i++){
      const o=World.lootOrbs[i];
      if(o.taken) continue;
      const dx=P.x-o.x, dz=P.z-o.z;
      if(dx*dx+dz*dz<3.6){
        World.setOrbTaken(o, true);
        if(o.light) o.light.intensity=0;
        Inventory.add(o.type,1);
        Quests.onItem(o.type,1);
        Player.addXP(18);
        FX.burst(o.x,o.y,o.z,16,{color:(function(){const c=new THREE.Color(o.color);return [c.r,c.g,c.b];})(),speed:5,life:0.6,size:0.4});
        Audio2.play('item');
      }
    }
  },
  collectDrops(){
    const P=Player.pos;
    for(let i=Quests.drops.length-1;i>=0;i--){
      const d=Quests.drops[i];
      const dx=P.x-d.x, dz=P.z-d.z;
      if(dx*dx+dz*dz<3.2){
        Inventory.add(d.id,1);
        Quests.onItem(d.id,1);
        scene.remove(d.mesh); scene.remove(d.light);
        Quests.drops.splice(i,1);
      }
    }
  },

  /* ---- main loop -------------------------------------------------------- */
  // Fixed-timestep simulation: rAF may fire slowly under load (or on weak
  // GPUs), so real elapsed time is accumulated and consumed in fixed 1/60
  // steps. That keeps movement and combat speed identical on every machine.
  FIXED:1/60, MAXSTEPS:8, acc:0, loopStarted:false,
  loop(){
    if(Game.loopStarted) return;
    Game.loopStarted=true;
    Game._tick();
  },
  _tick(){
    requestAnimationFrame(function(){ Game._tick(); });
    const now=performance.now();
    let dt=(now-Game.last)/1000;
    Game.last=now;
    if(!(dt>0)) return;
    if(dt>0.25) dt=0.25;                 // ignore huge stalls (tab switches)
    Game.realDt=dt;
    Game.fpsAcc+=dt; Game.fpsFrames++;
    if(Game.fpsAcc>=0.5){ Game.fps=Game.fpsFrames/Game.fpsAcc; Game.fpsAcc=0; Game.fpsFrames=0; }
    Game.acc+=dt;
    let steps=0;
    while(Game.acc>=Game.FIXED && steps<Game.MAXSTEPS){
      Game.acc-=Game.FIXED;
      steps++;
      Game.simulate(Game.FIXED);
    }
    // exactly one presentation per animation frame
    Game.present(dt);
  },
  /* ---- presentation (camera, effects, HUD, draw) ------------------------- */
  // Runs ONCE per rendered frame (never once per simulation step), so a slow
  // frame still renders exactly one image.
  present(dt){
    const t=Game.time;
    if(!Cutscene.active){
      FX.update(dt);
      DmgText.update(dt);
      Camera.update(dt,false);
      if(Game.state==='play'||Game.state==='dead'||Game.state==='end') HUD.update(dt,t);
      Game.minimapTimer+=dt;
      if(Game.minimapTimer>0.1){
        Game.minimapTimer=0;
        if(Game.state==='play') Minimap.draw();
      }
      Audio2.setIntensity(clamp(Camera.combatT+(Bosses.active?0.6:0),0,1));
      Quality.update(Game.realDt||dt);
    } else {
      Camera.update(dt,false);
    }
    renderComposer();
  },
  /* Fixed-step simulation only: no drawing, no presentation timers. */
  simulate(dt){
    Game.time+=dt;
    const t=Game.time;
    Magic.update(dt);
    SpellFX.update(dt);
    if(Cutscene.active) return;
    if(Game.state==='play'&&!UI.isOpen()){
      Player.update(dt);
      Enemies.update(dt,t);
      Bosses.update(dt,t);
      Bosses.updateTimed(dt);
      Enemies.updateProjectiles(dt);
      NPCs.update(dt,t);
      Buffs.update(dt);
      Quests.updateDrops(dt);
      Game.collectOrbs();
      Game.collectDrops();
      World.update(dt,t);
      const target=Game.findInteract();
      HUD.showPrompt(target? ('<kbd>'+target.key+'</kbd> '+target.label) : null);
      Game.interactTarget=target;
      Game.populateTimer+=dt;
      if(Game.populateTimer>6){ Game.populateTimer=0; Game.populate(false); }
      Game.regionTimer+=dt;
      if(Game.regionTimer>0.6){ Game.regionTimer=0; Game.checkRegion(); Game.checkBossTriggers(); }
      Game.saveTimer+=dt;
      if(Game.saveTimer>45){ Game.saveTimer=0; Save.autosave(); }
    }
    if(Game.state==='play') StatusFX.update(dt);
  },
  /* Kept for save/load and external callers: one sim step only. */
  frame(dt){ Game.simulate(dt); },

  /* ---- input handlers (called from bindInput) --------------------------- */
  handleKey(e,down){
    if(down) return;
    // nothing (keyup handled elsewhere)
  }
};

/* global-ish helpers used by the boot sequence */
var there=0;

/* --------------------------------------------------------------------------
   KEY HANDLING
   -------------------------------------------------------------------------- */
function onKeyDown(e){
  Audio2.resume();
  // cutscene first: any key advances
  if(Cutscene.active){
    if(e.code==='Space'||e.code==='Enter') Cutscene.next();
    if(e.code==='Escape') Cutscene.skip();
    return;
  }
  // dialogue: number keys pick options, Escape closes
  if(Dialogue.isOpen()){
    if(e.code==='Escape'){ Dialogue.close(); return; }
    const n=e.code.indexOf('Digit')===0? parseInt(e.code.slice(5),10) : -1;
    if(n>=1){
      const opts=document.querySelectorAll('#dlgOpts .opt');
      if(opts[n-1]) opts[n-1].click();
    }
    if(e.code==='Space'&&Dialogue.current&&Dialogue.current.opts.length===1) Dialogue.close();
    return;
  }
  // Escape: pause / back out of screens
  if(e.code==='Escape'){
    if(UI.isOpen()){ UI.closeAll(); }
    else { UI.set('pause',true); }
    return;
  }
  if(UI.isOpen()){
    if(e.code==='KeyH'&&UI.open['help']) UI.set('help',false);
    return;
  }
  if(Game.state!=='play') return;
  const P=Player;
  switch(e.code){
    case 'KeyI': UI.set('inventory',true); return;
    case 'KeyK': UI.set('skills',true); return;
    case 'KeyJ': UI.set('quests',true); return;
    case 'KeyM': UI.set('map',true); return;
    case 'KeyH': UI.set('help',true); return;
    case 'KeyP': screenshot(); return;
    case 'KeyE': Game.doInteract(Game.interactTarget); return;
    case 'KeyF':
      P.lockOn=!P.lockOn;
      if(P.lockOn){ P.findLockTarget(); if(!P.lockTarget) P.lockOn=false; }
      else P.lockTarget=null;
      Audio2.play('ui');
      return;
    case 'Tab':
      if(P.lockOn){
        // cycle to the next living enemy
        const list=Enemies.list.filter(function(x){return x.alive;});
        if(list.length){
          let idx=list.indexOf(P.lockTarget);
          idx=(idx+1)%list.length;
          P.lockTarget=list[idx];
        }
      } else { P.lockOn=true; P.findLockTarget(); }
      return;
    case 'Space':
      // dodge roll when a direction is held, otherwise jump
      (function(){
        const w=new THREE.Vector3();
        const moving=P.wishDir(w);
        if(moving||P.lockOn) P.startRoll(w.x,w.z);
        else P.jump();
      })();
      return;
    case 'KeyQ': Magic.cast(P.spellIndex); return;
    case 'KeyR': useFlask(); return;
    case 'KeyZ': cycleSpell(1); return;
    case 'KeyX': cycleItem(1); return;
    case 'Digit1': Weapons.equipIndex(0); return;
    case 'Digit2': Weapons.equipIndex(1); return;
    case 'Digit3': Weapons.equipIndex(2); return;
    case 'Digit4': Weapons.equipIndex(3); return;
    case 'Digit5': Weapons.equipIndex(4); return;
  }
}
function onKeyUp(e){ void e; }
function onLightRelease(){
  if(Player.charging){ Combat.releaseCharge(); }
}
function onHeavyRelease(){
  if(Game.state!=='play'||UI.isOpen()||Dialogue.isOpen()) return;
  // a short right-click is a heavy attack; holding it was a block
  const held=(performance.now()-IN.mouse.rDown)/1000;
  if(held<0.24) Combat.heavyAttack();
}
function hitTestUI(){ return UI.isOpen(); }

// Left mouse: start the light combo, or begin winding up a charged attack.
function onLightPress(){
  if(Game.state!=='play'||UI.isOpen()||Dialogue.isOpen()||Cutscene.active) return;
  Combat.lightAttack();
  Combat.startCharge();
}

function useFlask(){
  const P=Player;
  if(P.flaskCount<=0){ HUD.comboText('NO FLASK'); Audio2.play('ui_back'); return; }
  if(P.hp>=P.D.hpMax*0.995){ HUD.comboText('HEALTH FULL'); Audio2.play('ui_back'); return; }
  P.flaskCount--;
  P.state='drink'; P.stateT=0;
  const heal=Math.round(P.D.hpMax*0.42);
  setTimeout(function(){
    if(!Player.dead){ Player.heal(heal); Player.state='idle'; }
  },420);
  Audio2.play('heal');
  HUD.dirty=true;
}
function cycleSpell(dir){
  const P=Player;
  let i=P.spellIndex;
  for(let n=0;n<Magic.defs.length;n++){
    i=(i+dir+Magic.defs.length)%Magic.defs.length;
    if(Magic.isKnown(i)){
      if(i!==P.spellIndex){ P.spellIndex=i; HUD.toast('Spell: '+Magic.defs[i].name); Audio2.play('ui'); }
      return;
    }
  }
}
function cycleItem(dir){
  const keys=Object.keys(Inventory.items).filter(function(k){
    const d=ITEM_DEFS[k]; return d&&(d.kind==='consumable'||d.kind==='upgrade');
  });
  if(!keys.length){ HUD.toast('Nothing usable in the satchel.'); return; }
  let idx=keys.indexOf(Player._itemKey);
  idx=(idx+dir+keys.length)%keys.length;
  Player._itemKey=keys[idx];
  HUD.toast('Next item: '+ITEM_DEFS[keys[idx]].name+' (press X again then use from the satchel)');
  Audio2.play('ui');
}

function screenshot(){
  try{
    renderComposer();
    const url=renderer.domElement.toDataURL('image/png');
    const a=document.createElement('a');
    a.href=url; a.download='forge-of-the-fallen-king.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    HUD.toast('Screenshot saved.');
  }catch(e){ HUD.toast('Screenshot unavailable.'); }
}

function applySettings(){
  if(!renderer) return;
  resizeRenderer();
  applyShadows();
  applyFar();
}

/* --------------------------------------------------------------------------
   LORE TEXT
   -------------------------------------------------------------------------- */
const TEXT_LORE = {
  'First Ash':'"We burned the orchard so the fire could not be blamed on the Warden. It was always going to be blamed on the Warden."',
  'Root Verse':'"Root drinks root. Branch shades branch. One shard fell, and the forest learned to chew."',
  "Foreman's Ledger":'"Day 41: struck a seam that breathes. Day 44: no longer counting days."',
  'Prism Litany':'"She sang to keep the light quiet. The light learned the song. Now the song is the light."',
  'Frozen Prayer':'"Make me still. Make the world still. Make it not move away from me. Amen."',
  'Cinder Edict':'"By the King\'s word: no courtier shall stand nearer the Forge than another. The courtiers objected. There is very little left of the courtiers."',
  'Forge Record':'"Six hundred years of output. Nine hundred tonnes of warmth. One line at the bottom, in a different hand: \'It was never meant to be kept.\'"',
  "Wayfarer's Note":'"If you are reading this, the road east is real. The mountains are only pretending."',
  'Kingsroad Stone':'"Here fell the Third Patrol, holding the pass so the villagers could reach the shrine. No one remembers their names, including this stone."',
  'Siege Account':'"We came to take the shard from him. He opened the gates and invited us in. He was already burning."',
  "Miner's Grave":'"He dug for thirty years and found nothing. Then in one night he found everything, and it found him back."',
  "Ice Sister's Vigil":'"I will not sleep until she does. I have not slept in forty years. Neither has she. We are both still here."'
};

/* --------------------------------------------------------------------------
   ENDINGS
   -------------------------------------------------------------------------- */
const ENDINGS = {
  light:{
    title:'THE LIGHT RETURNED',
    body:'You set the five shards into the anvil and did the one thing no King ever managed: you let go of it.\n\n'+
         'The Sun Forge does not roar back to life. It warms slowly, like a hearth someone finally remembered to feed. '+
         'By the time you walk down the mountain the ash is already growing something green in the cracks.\n\n'+
         'They will not know your name. That was the point.',
    hint:'Crown of Ashes \u00b7 The Broken Age'
  },
  crown:{
    title:'THE CROWN OF ASHES',
    body:'You took the Forge, and the Forge took you.\n\n'+
         'The light answers now only when you command it, and it obeys the way a hound obeys: eagerly, and with something behind the eyes. '+
         'The villages that survived the Lords will survive you too, for a while.\n\n'+
         'The anvil is warm. The throne it makes is warmer. You will sit in it and wonder, for a very long time, whether this is what the Fallen King felt like on his first day.',
    hint:'The Light Returned \u00b7 The Broken Age'
  },
  broken:{
    title:'THE BROKEN AGE',
    body:'You broke the shards on the anvil, one by one, and the light went out of the world.\n\n'+
         'It is cold now. Genuinely, permanently cold. Nothing rises from the ash because nothing has the warmth to rise.\n\n'+
         'But nothing burns either. No Lord, no crown, no furnace that must be fed. The kingdom will not be great again \u2014 it will simply be quiet, and the quiet belongs to itself.\n\n'+
         'It is the only ending where nobody has to be king.',
    hint:'The Light Returned \u00b7 Crown of Ashes'
  }
};

/* ==========================================================================
   BOOT
   ========================================================================== */
function boot(){
  Game.init();
  Game.boot();
  // the frame loop starts with the first rendered frame
  Game.loop();
  // expose a small debug handle (harmless, useful in the console)
  window.FOTFK={ CFG:CFG, Player:Player, World:World, Enemies:Enemies, Bosses:Bosses, Quests:Quests,
                 Story:Story, Game:Game, Save:Save, Weapons:Weapons, Magic:Magic, Inventory:Inventory,
                 Skills:Skills, NPCs:NPCs, Damage:Damage, Combat:Combat, UI:UI, HUD:HUD,
                 IN:IN, REGIONS:REGIONS, getRegionAt:getRegionAt, Camera:Camera, Audio2:Audio2,
                 FX:FX, ItemDefs:ITEM_DEFS, BossDefs:BOSS_DEFS, EnemyTypes:ENEMY_TYPES, Dialogue:Dialogue,
                 Cutscene:Cutscene, Minimap:Minimap, Stats:Stats, StatusFX:StatusFX, terrainHeight:terrainHeight,
                 Quality:Quality, renderer:renderer, scene:scene, renderComposer:renderComposer,
                 SpatialHash:SpatialHash, Magic:Magic };
}
if(document.readyState==='complete'||document.readyState==='interactive'){
  setTimeout(boot,0);
} else {
  document.addEventListener('DOMContentLoaded',boot);
}
})();
</script>
</body>
</html>
