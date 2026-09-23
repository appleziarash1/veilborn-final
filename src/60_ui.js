
/* ==========================================================================
   SECTION 20 - UI / HUD
   ========================================================================== */
const $=function(id){ return document.getElementById(id); };
const UI = {
  open:{}, current:null, tab:'equip',
  init(){
    this.open={};
    this.bind();
    HUD.init();
  },
  isOpen(){
    for(const k in this.open) if(this.open[k]) return true;
    return Cutscene.active;
  },
  anyGameplayBlocked(){
    return this.isOpen();
  },
  set(name,on){
    const el=$(name);
    if(!el) return;
    if(on){ el.classList.remove('hidden'); } else { el.classList.add('hidden'); }
    this.open[name]=on;
    if(on){ this.current=name; Audio2.play('ui'); } else { if(this.current===name) this.current=null; Audio2.play('ui_back'); }
    if(on&&name==='map'){ Minimap.drawBig(); }
    if(on&&name==='inventory'){ HUD.renderInventory(); }
    if(on&&name==='skills'){ HUD.renderSkills(); }
    if(on&&name==='quests'){ HUD.renderQuests(); }
    if(on&&name==='pause'){ HUD.renderPauseStats(); }
    if(!this.isOpen()&&Game.state==='play') IN.locked||requestLock();
  },
  closeAll(){
    ['pause','settings','help','inventory','skills','quests','map','dialogue','death','victory'].forEach(function(n){
      const el=$(n); if(el) el.classList.add('hidden');
    });
    this.open={}; this.current=null;
  },
  toggle(name){ this.set(name,!this.open[name]); },
  bind(){
    const on=function(id,fn){ const el=$(id); if(el) el.addEventListener('click',function(ev){ ev.stopPropagation(); Audio2.resume(); fn(); }); };
    on('btnNew',function(){ Game.newGame(); });
    on('btnContinue',function(){ Game.continueGame(); });
    on('btnLoad',function(){ if(Save.has()){ Game.loadGame(); } else HUD.toast('No save found.'); });
    on('btnHelpM',function(){ UI.set('help',true); });
    on('btnHelpBack',function(){ UI.set('help',false); });
    on('btnHelp',function(){ UI.set('help',true); });
    on('btnResume',function(){ UI.set('pause',false); });
    on('btnSave',function(){ Save.save(); });
    on('btnLoad2',function(){ Game.loadGame(); });
    on('btnSettings',function(){ $('setAuto').value=Quality.auto?1:0; $('setAutoV').textContent=Quality.auto?'On':'Off';
      syncQualityControls(); UI.set('settings',true); UI.set('pause',false); });
    on('btnSettingsBack',function(){ applySettingsFromUI(); UI.set('settings',false); });
    on('btnQuit',function(){ Game.quitToMenu(); });
    on('btnInvBack',function(){ UI.set('inventory',false); });
    on('btnSkillsBack',function(){ UI.set('skills',false); });
    on('btnQuestsBack',function(){ UI.set('quests',false); });
    on('btnMapBack',function(){ UI.set('map',false); });
    on('btnRespawn',function(){ Game.respawn(); });
    on('btnDeathLoad',function(){ Game.loadGame(); });
    on('btnContPlay',function(){ UI.set('victory',false); Game.victoryContinue(); });
    on('btnVicMenu',function(){ Game.quitToMenu(); });
    // tabs
    const tabs=document.querySelectorAll('#invTabs .tab');
    for(let i=0;i<tabs.length;i++){
      tabs[i].addEventListener('click',function(ev){
        ev.stopPropagation(); Audio2.play('ui');
        for(let k=0;k<tabs.length;k++) tabs[k].classList.remove('on');
        this.classList.add('on');
        UI.tab=this.getAttribute('data-tab');
        HUD.renderInventory();
      });
    }
    // settings sliders
    bindSlider('setAuto',function(v){ $('setAutoV').textContent=v?'On':'Off'; Quality.auto=!!v; if(v) Quality.cooldown=1; });
    bindSlider('setQuality',function(v){ const n=['Minimal','Low','Medium','High'];
      $('setQualityV').textContent=n[v]; Quality.set(v); syncQualityControls(); });
    bindSlider('setScale',function(v){ $('setScaleV').textContent=v+'%'; renderScale=v/100; resizeRenderer(); });
    bindSlider('setShadow',function(v){ const names=['Off','Medium','High']; $('setShadowV').textContent=names[v]; shadowsOn=v; applyShadows(); });
    bindSlider('setFar',function(v){ $('setFarV').textContent=v; farDist=v; applyFar(); });
    bindSlider('setBloom',function(v){ $('setBloomV').textContent=v+'%'; bloomAmount=v/100; });
    bindSlider('setParts',function(v){ $('setPartsV').textContent=v+'%'; partsScale=v/100; });
    bindSlider('setMaster',function(v){ $('setMasterV').textContent=v+'%'; Audio2.setMaster(v/100); });
    bindSlider('setMusic',function(v){ $('setMusicV').textContent=v+'%'; Audio2.setMusic(v/100); });
    bindSlider('setSfx',function(v){ $('setSfxV').textContent=v+'%'; Audio2.setSfx(v/100); });
    bindSlider('setSens',function(v){ $('setSensV').textContent=v; Camera.sens=CFG.cam.sens*(v/110); });
    bindSlider('setInv',function(v){ $('setInvV').textContent=v?'On':'Off'; Camera.invertY=+v; });
    bindSlider('setShake',function(v){ $('setShakeV').textContent=v+'%'; shakeSetting=v/100; });
    bindSlider('setDiff',function(v){ const n=['Squire','Warden','Ashen Lord']; $('setDiffV').textContent=n[v]; diffIndex=+v; });
    // cutscene skip
    const cut=$('cut');
    cut.addEventListener('click',function(){ Cutscene.skip(); });
  },
  clickTarget(){ return this.current; }
};
function requestLock(){
  const cv=renderer.domElement;
  if(cv.requestPointerLock) cv.requestPointerLock();
}
function bindSlider(id,fn){
  const el=$(id); if(!el) return;
  el.addEventListener('input',function(){ fn(+this.value); });
}
function applySettingsFromUI(){
  Quality.auto=!!(+$('setAuto').value);
  Quality.apply(+$('setQuality').value,true);
  renderScale=(+$('setScale').value)/100;
  shadowsOn=+$('setShadow').value;
  farDist=+$('setFar').value;
  bloomAmount=(+$('setBloom').value)/100;
  partsScale=(+$('setParts').value)/100;
  shakeSetting=(+$('setShake').value)/100;
  diffIndex=+$('setDiff').value;
  Camera.sens=CFG.cam.sens*((+$('setSens').value)/110);
  Camera.invertY=+$('setInv').value;
  Audio2.setMaster((+$('setMaster').value)/100);
  Audio2.setMusic((+$('setMusic').value)/100);
  Audio2.setSfx((+$('setSfx').value)/100);
  applyShadows(); applyFar(); resizeRenderer();
}
/* Keep the numeric (render scale / shadow / bloom) sliders in step with the
   quality preset so the settings screen never shows contradictory values. */
function syncQualityControls(){
  const q=Quality.levels[Quality.level];
  $('setScale').value=Math.round(q.scale*100); $('setScaleV').textContent=Math.round(q.scale*100)+'%';
  $('setShadow').value=q.shadows>0?(q.shadowSize>=2048?2:1):0;
  $('setShadowV').textContent=['Off','Medium','High'][+$('setShadow').value];
  $('setBloom').value=Math.round(q.bloom*100); $('setBloomV').textContent=Math.round(q.bloom*100)+'%';
  $('setParts').value=Math.round(q.parts*100); $('setPartsV').textContent=Math.round(q.parts*100)+'%';
  $('setQualityV').textContent=Quality.levels[Quality.level].name;
  $('setQuality').value=Quality.level;
}
function applyShadows(){
  renderer.shadowMap.enabled=shadowsOn>0;
  sunLight.castShadow=shadowsOn>0;
  if(shadowsOn===2){ sunLight.shadow.mapSize.set(2048,2048); }
  else if(shadowsOn===1){ sunLight.shadow.mapSize.set(1024,1024); }
  sunLight.shadow.map&&sunLight.shadow.map.dispose&&sunLight.shadow.map.dispose();
  sunLight.shadow.map=null;
}
function applyFar(){
  camera.far=farDist+220; camera.updateProjectionMatrix();
}

/* --------------------------------------------------------------------------
   HUD: bars, prompts, boss bar, toasts, panels
   -------------------------------------------------------------------------- */
const HUD = {
  dirty:true, lastQuestRender:0, spellGlow:0, hpShown:1, hpGhost:1,
  init(){
    this.hpF=$('hpF'); this.hpE=$('hpE'); this.stF=$('stF'); this.mnF=$('mnF'); this.xpF=$('xpF');
    this.hpTxt=$('hpTxt'); this.stTxt=$('stTxt'); this.mnTxt=$('mnTxt'); this.xpTxt=$('xpTxt');
    this.goldTxt=$('goldTxt'); this.lvlNum=$('lvlNum'); this.effBox=$('statusEffects');
    this.weaponBox=$('weapons'); this.spellBox=$('spells');
    this.bossbar=$('bossbar'); this.bossName=$('bossName'); this.bossF=$('bossF'); this.bossE=$('bossE');
    this.bossPhaseEl=$('bossPhase');
    this.prompt=$('prompt'); this.promptTxt=$('promptTxt');
    this.questList=$('questList'); this.comboEl=$('combo');
    this.dmgV=document.getElementById('dmgVig'); this.lowHp=document.getElementById('lowHp');
    this.hitmark=document.getElementById('hitmark'); this.toastBox=$('toast');
    this.region=$('region'); this.regionName=$('regionName'); this.regionSub=$('regionSub');
    this.fps=$('fps');
    this.comboT=0; this.hitmarkT=0;
    this.buildWeaponSlots();
    this.buildSpellSlots();
    this.toasts=[];
    $('hud').classList.remove('hidden');
  },
  buildWeaponSlots(){
    this.weaponBox.innerHTML='';
    for(let i=0;i<Weapons.defs.length;i++){
      const d=Weapons.defs[i];
      const el=document.createElement('div');
      el.className='wslot'; el.id='wslot'+i;
      el.innerHTML='<div style="font-size:1.35em">'+d.glyph+'</div><div>'+(i+1)+'</div>';
      el.title=d.name;
      this.weaponBox.appendChild(el);
    }
  },
  buildSpellSlots(){
    this.spellBox.innerHTML='';
    for(let i=0;i<Magic.defs.length;i++){
      const d=Magic.defs[i];
      const el=document.createElement('div');
      el.className='spell'; el.id='sslot'+i;
      el.innerHTML='<div>'+d.glyph+'</div><div class="cd" id="scd'+i+'"></div>';
      el.title=d.name;
      this.spellBox.appendChild(el);
    }
  },
  updateWeaponSlots(){
    for(let i=0;i<Weapons.defs.length;i++){
      const el=$('wslot'+i); if(!el) continue;
      const owned=Weapons.owned[Weapons.defs[i].id];
      el.style.opacity=owned?1:0.28;
      el.className='wslot'+(Player.weaponIndex===i?' on':'');
    }
    for(let i=0;i<Magic.defs.length;i++){
      const el=$('sslot'+i); if(!el) continue;
      const known=Magic.isKnown(i);
      el.className='spell'+(known?'':' locked')+(Player.spellIndex===i?' on':'');
      el.style.borderColor=Player.spellIndex===i?'#b48cff':'';
    }
  },
  toast(msg){
    const d=document.createElement('div');
    d.className='toast'; d.textContent=msg;
    this.toastBox.appendChild(d);
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },4700);
    while(this.toastBox.children.length>5) this.toastBox.removeChild(this.toastBox.firstChild);
  },
  comboText(t){
    this.comboEl.textContent=t;
    this.comboEl.style.opacity=1;
    this.comboT=0.7;
  },
  hitMarker(v){ this.hitmark.style.opacity=v; this.hitmarkT=0.16; },
  hitFlash(v){ this.dmgV.style.opacity=v; },
  damageVignette(){ this.dmgV.style.opacity=0.75; },
  showRegion(R){
    this.regionName.textContent=R.name;
    this.regionSub.textContent=R.sub;
    this.region.style.opacity=1;
    this.regionT=3.2;
    $('mmLabel').textContent=R.name;
  },
  showBoss(e){
    this.bossbar.classList.remove('hidden');
    this.bossName.textContent=e.name;
    this.bossPhaseEl.textContent='PHASE I';
    this.bossF.style.transform='scaleX(1)';
    this.bossE.style.transform='scaleX(0)';
    this.bossGhost=1;
  },
  hideBoss(){ this.bossbar.classList.add('hidden'); },
  bossPhase(txt){ this.bossPhaseEl.textContent=txt; },
  showPrompt(txt){
    if(!txt){ this.prompt.classList.add('hidden'); return; }
    if(this.promptTxt.innerHTML!==txt) this.promptTxt.innerHTML=txt;
    this.prompt.classList.remove('hidden');
  },
  showDeath(){
    UI.set('death',true);
    try{ document.exitPointerLock&&document.exitPointerLock(); }catch(e){}
    const tips=['The embers remember you.','Shrines remember the fallen. Light one.','Stagger is a resource. Break their poise.','Roll through attacks, not away.','Parry early, not late.'];
    $('deathTip').textContent=tips[Math.floor(Math.random()*tips.length)];
  },
  renderPauseStats(){
    const S=Player.S, D=Player.D;
    const rows=[
      ['Level',S.level],['XP',S.xp+' / '+Stats.xpFor(S.level)],
      ['Strength',S.strength],['Dexterity',S.dexterity],['Intelligence',S.intelligence],
      ['Vitality',S.vitality],['Endurance',S.endurance],['Attunement',S.attunement],
      ['Health',Math.round(Player.hp)+' / '+D.hpMax],
      ['Stamina',Math.round(Player.stam)+' / '+D.stMax],
      ['Mana',Math.round(Player.mana)+' / '+D.mnMax],
      ['Armour',D.armor],['Crit Chance',(D.critChance*100).toFixed(1)+'%'],
      ['Gold',S.gold],['Enemies Slain',S.kills],['Deaths',S.deaths],
      ['Shards Recovered',Story.fragments.length+' / 5'],
      ['Playtime',formatTime(S.playtime)]
    ];
    let html='<h3>Character</h3>';
    for(let i=0;i<rows.length;i++) html+='<div class="statline"><span>'+rows[i][0]+'</span><b>'+rows[i][1]+'</b></div>';
    $('pauseStats').innerHTML=html;
  },
  renderInventory(){
    const L=$('invLeft'), R=$('invRight');
    if(!L) return;
    const tab=UI.tab;
    if(tab==='equip'){
      let html='<h3>Equipped</h3>';
      const slots=[['ring','Ring'],['amulet','Amulet'],['body','Armour']];
      for(let i=0;i<slots.length;i++){
        const id=Inventory.equipped[slots[i][0]];
        const d=id?ITEM_DEFS[id]:null;
        html+='<div class="card'+(d?' eq':'')+'" data-unequip="'+slots[i][0]+'"><b>'+slots[i][1]+'</b>'+
          '<span class="stat">'+(d?d.name+'\n'+d.desc:'(empty)')+'</span></div>';
      }
      html+='<h3>Weapon</h3>';
      const w=Weapons.current();
      html+='<div class="card eq"><b>'+w.name+' — Rank '+Weapons.levelOf(w.id)+'</b>'+
        '<span class="stat">Damage '+Weapons.dmgOf(w.id).toFixed(1)+' &middot; '+w.speed+' speed &middot; reach '+w.reach.toFixed(1)+
        '\n'+w.desc+'</span></div>';
      L.innerHTML=html;
      // derived stats
      const S=Player.S,D=Player.D;
      let h2='<h3>Attributes</h3>';
      const attrs=[['Strength','strength'],['Dexterity','dexterity'],['Intelligence','intelligence'],
                   ['Vitality','vitality'],['Endurance','endurance'],['Attunement','attunement']];
      for(let i=0;i<attrs.length;i++){
        const can=S.statPoints>0;
        const up=S.level===1&&S.statPoints>0;
        h2+='<div class="statline"><span>'+attrs[i][0]+'</span><span><b>'+S[attrs[i][1]]+'</b> '+
            (can?'<button class="plus" data-stat="'+attrs[i][1]+'">+</button>':'')+'</span></div>';
        void up;
      }
      h2+='<h3>Derived</h3>';
      h2+='<div class="statline"><span>Health</span><b>'+D.hpMax+'</b></div>';
      h2+='<div class="statline"><span>Stamina</span><b>'+D.stMax+'</b></div>';
      h2+='<div class="statline"><span>Mana</span><b>'+D.mnMax+'</b></div>';
      h2+='<div class="statline"><span>Armour</span><b>'+D.armor+'</b></div>';
      h2+='<div class="statline"><span>Weapon Power</span><b>'+(Weapons.dmgOf(w.id)*D.strScale).toFixed(1)+'</b></div>';
      h2+='<div class="statline"><span>Spell Power</span><b>'+(D.magicPower*100).toFixed(0)+'%</b></div>';
      h2+='<div class="statline"><span>Critical Chance</span><b>'+(D.critChance*100).toFixed(1)+'%</b></div>';
      h2+='<div class="statline"><span>Critical Damage</span><b>'+(D.critMult*100).toFixed(0)+'%</b></div>';
      h2+='<div class="statline"><span>Stat Points</span><b>'+(Player.S.statPoints)+'</b></div>';
      h2+='<div class="statline"><span>Skill Points</span><b>'+(Player.S.skillPoints)+'</b></div>';
      R.innerHTML=h2;
    } else if(tab==='weapons'){
      let html='<h3>Weapons Carried</h3><div class="grid">';
      for(let i=0;i<Weapons.defs.length;i++){
        const d=Weapons.defs[i];
        const owned=Weapons.owned[d.id];
        html+='<div class="card'+(owned?(Player.weaponIndex===i?' eq':''):' no')+'" data-weapon="'+i+'">'+
          '<span class="tag">'+(i+1)+'</span><b>'+d.glyph+' '+d.name+'</b>'+
          '<span class="stat">Rank '+Weapons.levelOf(d.id)+' &middot; dmg '+Weapons.dmgOf(d.id).toFixed(1)+'</span>'+
          '<span class="stat">'+d.speed+' &middot; reach '+d.reach.toFixed(1)+' &middot; stam '+d.stam+'</span>'+
          '<span class="stat">'+(owned?'':'(not found)')+'</span></div>';
      }
      html+='</div>';
      L.innerHTML=html;
      let h2='<h3>Weapon Detail</h3>';
      const w=Weapons.current();
      h2+='<div class="card eq"><b>'+w.name+'</b><span class="stat">'+w.desc+'</span></div>';
      h2+='<h3>Combo Chain</h3>';
      for(let i=0;i<w.combo.length;i++){
        h2+='<div class="statline"><span>Hit '+(i+1)+'</span><b>x'+w.combo[i].dmg.toFixed(2)+' dmg &middot; arc '+w.combo[i].arc.toFixed(1)+'</b></div>';
      }
      h2+='<div class="statline"><span>Heavy</span><b>x'+w.heavy.dmg.toFixed(2)+' (stagger '+w.heavy.stagger+')</b></div>';
      h2+='<div class="statline"><span>Charged Art</span><b>'+(w.charge.name||'—')+' x'+w.charge.dmg.toFixed(2)+'</b></div>';
      h2+='<h3>Crafting</h3>';
      h2+='<div class="statline"><span>Forge Whetstones</span><b>'+Inventory.count('whetstone')+'</b></div>';
      h2+='<div class="mbtn" data-use="whetstone" style="margin-top:8px">Reforge Equipped Weapon</div>';
      R.innerHTML=h2;
    } else if(tab==='items'){
      let html='<h3>Satchel</h3><div class="grid">';
      const keys=Object.keys(Inventory.items);
      if(!keys.length) html+='<div class="stat">Nothing but dust.</div>';
      for(let i=0;i<keys.length;i++){
        const id=keys[i], d=ITEM_DEFS[id];
        if(!d) continue;
        const usable=(d.kind==='consumable'||d.kind==='upgrade');
        const equippable=(d.kind==='ring'||d.kind==='amulet'||d.kind==='armor');
        html+='<div class="card'+(usable||equippable?'':' no')+'" data-item="'+id+'" data-act="'+(usable?'use':(equippable?'equip':''))+'">'+
          '<span class="tag">x'+Inventory.items[id]+'</span><b>'+d.glyph+' '+d.name+'</b>'+
          '<span class="stat">'+d.desc+'</span>'+
          '<span class="stat">'+(usable?'[click to use]':(equippable?'[click to equip]':'material'))+'</span></div>';
      }
      html+='</div>';
      L.innerHTML=html;
      let h2='<h3>Flask</h3>';
      h2+='<div class="statline"><span>Ember Flask</span><b>'+Player.flaskCount+' / '+Player.flaskMax+'</b></div>';
      h2+='<div class="statline"><span>Key R: drink</span><b>heals '+Math.round(Player.D.hpMax*0.4)+' HP</b></div>';
      h2+='<h3>Elemental Resistances</h3>';
      const res=[['Fire','+'+Math.round(Player.D.armor*0.12)+'%'],['Frost','+'+Math.round(Player.D.armor*0.1)+'%'],
                 ['Lightning','+'+Math.round(Player.D.armor*0.08)+'%'],['Arcane','+'+Math.round(Player.D.armor*0.06)+'%']];
      for(let i=0;i<res.length;i++) h2+='<div class="statline"><span>'+res[i][0]+'</span><b>'+res[i][1]+'</b></div>';
      h2+='<h3>Shards of the Sun Forge</h3>';
      for(let i=0;i<5;i++){
        const have=Story.fragments.indexOf(i)>=0;
        h2+='<div class="statline"><span>Shard '+(i+1)+'</span><b>'+(have?'RECOVERED':'missing')+'</b></div>';
      }
      R.innerHTML=h2;
    } else {
      // lore
      let html='<h3>Lore Stones Read ('+Story.loreCount+' / 12)</h3>';
      for(let i=0;i<World.loreObjs.length;i++){
        const l=World.loreObjs[i];
        html+='<div class="card'+(l.read?'':' no')+'"><b>'+l.title+'</b><span class="stat">'+(l.read?'read':'undiscovered')+'</span></div>';
      }
      L.innerHTML=html;
      let h2='<h3>The Shattering</h3><p style="font-size:0.92em;line-height:1.7;color:#c6bba4">'+
        'When the Sun Forge broke, five Lords each took a fragment. Ash Warden, Forest Devourer, Crystal Queen, '+
        'Frozen Saint and the Fallen King. Each grew monstrous in their keeping.<br><br>'+
        'An ember drifts east, unnoticed. It has no crown and no oath &mdash; only the will to reach the Forge.</p>';
      h2+='<h3>Fragments</h3>';
      for(let i=0;i<5;i++) h2+='<div class="statline"><span>'+(Story.shardNames[i])+'</span><b>'+(Story.fragments.indexOf(i)>=0?'held':'lost')+'</b></div>';
      R.innerHTML=h2;
    }
    this.bindPanelClicks();
  },
  bindPanelClicks(){
    const self=this;
    const cards=document.querySelectorAll('#invLeft .card, #invRight .card, #invLeft .mbtn, #invRight .mbtn, #invLeft .plus, #invRight .plus');
    for(let i=0;i<cards.length;i++){
      const el=cards[i];
      el.addEventListener('click',function(ev){
        ev.stopPropagation();
        Audio2.play('ui');
        const wsel=this.getAttribute&&this.getAttribute('data-weapon');
        if(wsel!==null&&wsel!==undefined) { Weapons.equipIndex(+wsel); HUD.renderInventory(); return; }
        const st=this.getAttribute&&this.getAttribute('data-stat');
        if(st){
          if(Player.S.statPoints>0){ Player.S.statPoints--; Player.S[st]++; Player.recalc(); HUD.dirty=true; HUD.renderInventory(); }
          return;
        }
        const un=this.getAttribute&&this.getAttribute('data-unequip');
        if(un){ Inventory.unequip(un); HUD.dirty=true; HUD.renderInventory(); return; }
        const it=this.getAttribute&&this.getAttribute('data-item');
        if(it){
          const act=this.getAttribute('data-act');
          if(act==='use') Inventory.use(it);
          else if(act==='equip') Inventory.equip(it);
          HUD.dirty=true; HUD.renderInventory(); return;
        }
        const use=this.getAttribute&&this.getAttribute('data-use');
        if(use){ Inventory.use(use); HUD.dirty=true; HUD.renderInventory(); return; }
        void self;
      });
    }
  },
  renderSkills(){
    if(!$('spAvail')) return;
    $('spAvail').textContent=Player.S.skillPoints;
    const paths=[['blade','Path of the Blade'],['ward','Path of the Ward'],['flame','Path of the Flame']];
    let html='';
    for(let p=0;p<paths.length;p++){
      html+='<div class="col"><h3>'+paths[p][1]+'</h3><div style="display:flex;flex-direction:column;gap:7px">';
      for(let i=0;i<Skills.defs.length;i++){
        const d=Skills.defs[i];
        if(d.path!==paths[p][0]) continue;
        const owned=Skills.has(d.id);
        const can=Skills.canBuy(d.id);
        const locked=!owned&&!can;
        html+='<div class="skill'+(owned?' owned':'')+(locked?' locked':'')+'" data-skill="'+d.id+'">'+
          '<b>'+d.name+' <span style="color:#8d7440">('+d.cost+' pt'+(d.cost>1?'s':'')+')</span>'+(owned?' — LEARNED':'')+'</b>'+
          '<span style="color:#a89a80">'+d.desc+'</span>';
        if(!owned&&d.req.length){
          html+='<div style="color:#7d7466;font-size:.9em;margin-top:3px">requires: ';
          for(let r=0;r<d.req.length;r++){ const q=Skills.byId(d.req[r]); html+=(r?', ':'')+(q?q.name:d.req[r]); }
          html+='</div>';
        }
        if(can) html+='<div style="color:#b48cff;margin-top:4px">[click to learn]</div>';
        html+='</div>';
      }
      html+='</div></div>';
    }
    $('skillCols').innerHTML=html;
    const els=document.querySelectorAll('#skillCols .skill');
    for(let i=0;i<els.length;i++){
      els[i].addEventListener('click',function(ev){
        ev.stopPropagation();
        const id=this.getAttribute('data-skill');
        if(Skills.buy(id)){ HUD.renderSkills(); }
        else Audio2.play('ui_back');
      });
    }
  },
  renderQuests(){
    const main=Quests.activeList(true), side=Quests.activeList(false);
    const mainDone=[], sideDone=[];
    for(const id in Quests.completed){
      const d=Quests.byId(id); if(!d) continue;
      (d.main?mainDone:sideDone).push(d);
    }
    const render=function(list,done){
      let html='';
      for(let i=0;i<list.length;i++){
        const d=list[i].d, st=list[i].s;
        html+='<div class="card"><b>'+(d.hidden?'\u2724 ':'')+d.name+'</b>';
        for(let k=0;k<d.objectives.length;k++){
          const ob=d.objectives[k];
          const cur=ob.count?(st.o[k]||0):(st.o[k]?1:0);
          const need=ob.count||1;
          const ok=cur>=need;
          html+='<span class="stat" style="color:'+(ok?'#8fbf8f':'#c6bba4')+'">'+(ok?'\u2713 ':'\u2022 ')+ob.t+(ob.count?' ('+cur+'/'+need+')':'')+'</span>';
        }
        html+='<span class="stat" style="color:#8d7440">'+(d.giver?'from '+d.giver+' — ':'')+d.desc+'</span>';
        if(d.reward) html+='<span class="stat" style="color:#d9b26a">reward: '+
          (d.reward.xp?d.reward.xp+' xp ':'')+(d.reward.gold?d.reward.gold+' gold ':'')+
          (d.reward.item&&ITEM_DEFS[d.reward.item]?'+ '+ITEM_DEFS[d.reward.item].name:'')+'</span>';
        html+='</div>';
      }
      for(let i=0;i<done.length;i++){
        html+='<div class="card" style="opacity:.5"><b>\u2713 '+done[i].name+'</b><span class="stat">complete</span></div>';
      }
      if(!html) html='<div class="stat">Nothing here yet.</div>';
      return html;
    };
    $('qMain').innerHTML='<h3>Main Quest — '+main.length+' active / '+mainDone.length+' done</h3>'+render(main,mainDone);
    $('qSide').innerHTML='<h3>Side &amp; Hidden — '+side.length+' active / '+sideDone.length+' done</h3>'+render(side,sideDone);
  },
  // called every frame
  update(dt,t){
    const S=Player.S, D=Player.D;
    if(!S) return;
    // bars
    const hpF=clamp(Player.hp/D.hpMax,0,1);
    this.hpF.style.transform='scaleX('+hpF.toFixed(3)+')';
    this.hpGhost=Math.max(hpF, this.hpGhost-Math.max(0.35,(this.hpGhost-hpF))*dt*1.1);
    this.hpE.style.transform='scaleX('+this.hpGhost.toFixed(3)+')';
    this.hpTxt.textContent=Math.ceil(Player.hp)+' / '+D.hpMax;
    this.stF.style.transform='scaleX('+clamp(Player.stam/D.stMax,0,1).toFixed(3)+')';
    this.stTxt.textContent=Math.ceil(Player.stam)+' / '+D.stMax;
    this.mnF.style.transform='scaleX('+clamp(Player.mana/D.mnMax,0,1).toFixed(3)+')';
    this.mnTxt.textContent=Math.ceil(Player.mana)+' / '+D.mnMax;
    const xpNeed=Stats.xpFor(S.level);
    this.xpF.style.transform='scaleX('+clamp(S.xp/xpNeed,0,1).toFixed(3)+')';
    this.xpTxt.textContent='XP '+Math.floor(S.xp)+' / '+xpNeed;
    this.goldTxt.textContent=S.gold+' gold';
    this.lvlNum.textContent=S.level;
    // low health pulse
    this.lowHp.style.opacity=hpF<0.3?(0.35+0.3*Math.sin(t*4))*(1-hpF/0.3):0;
    // damage vignette decay
    const dv=parseFloat(this.dmgV.style.opacity||'0');
    if(dv>0.01) this.dmgV.style.opacity=(dv-dt*1.9).toFixed(3); else this.dmgV.style.opacity=0;
    // hit marker decay
    if(this.hitmarkT>0){ this.hitmarkT-=dt; if(this.hitmarkT<=0) this.hitmark.style.opacity=0; }
    // combo text
    if(this.comboT>0){ this.comboT-=dt; if(this.comboT<=0) this.comboEl.style.opacity=0; }
    // region title fade
    if(this.regionT>0){ this.regionT-=dt; if(this.regionT<=0) this.region.style.opacity=0; }
    // boss bar
    if(Bosses.active&&Bosses.active.alive){
      const b=Bosses.active;
      const f=clamp(b.hp/b.hpMax,0,1);
      this.bossF.style.transform='scaleX('+f.toFixed(3)+')';
      this.bossGhost=Math.max(f,this.bossGhost-dt*0.28);
      this.bossE.style.transform='scaleX('+(this.bossGhost-f).toFixed(3)+')';
    }
    // weapon + spell slots
    this.updateWeaponSlots();
    for(let i=0;i<Magic.defs.length;i++){
      const el=$('scd'+i); if(!el) continue;
      const cd=Magic.cd[i]||0, max=Magic.cdOf(i);
      el.style.transform='scaleY('+(max>0?clamp(cd/max,0,1):0).toFixed(3)+')';
    }
    // status effects
    let eff='';
    if(Player.poisonT>0) eff+='<div class="eff" style="color:#9fe07a">POISONED</div>';
    if(Player.slowT>0) eff+='<div class="eff" style="color:#7fd8ff">CHILLED</div>';
    if(Player.charging) eff+='<div class="eff" style="color:#ffc060">CHARGING</div>';
    if(Player.invuln>0&&Player.state==='roll') eff+='<div class="eff" style="color:#ffd070">EVADING</div>';
    if(Buffs.list.length) for(let i=0;i<Buffs.list.length;i++) eff+='<div class="eff" style="color:#d9b26a">'+Buffs.list[i].name+'</div>';
    if(this.effBox.innerHTML!==eff) this.effBox.innerHTML=eff;
    // quest tracker (throttled)
    this.lastQuestRender+=dt;
    if(this.lastQuestRender>0.5||this.dirty){
      this.lastQuestRender=0;
      if(this.dirty){ this.dirty=false; this.renderTracker(); }
    }
    if(this.fpsT===undefined) this.fpsT=0;
    this.fpsT+=dt;
    if(this.fpsT>0.5){
      this.fpsT=0;
      this.fps.textContent=Math.round(Game.fps)+' fps';
    }
  },
  renderTracker(){
    let html='';
    const main=Quests.activeList(true);
    for(let i=0;i<Math.min(2,main.length);i++){
      const d=main[i].d, st=main[i].s;
      let obTxt='', obDone=false;
      for(let k=0;k<d.objectives.length;k++){
        const ob=d.objectives[k];
        const cur=ob.count?(st.o[k]||0):(st.o[k]?1:0);
        const need=ob.count||1;
        if(cur<need){ obTxt=ob.t+(ob.count?' ('+cur+'/'+need+')':''); break; }
        obDone=true;
      }
      html+='<div class="q'+(obDone?' done':'')+'"><b>'+d.name+'</b><span>'+(obDone?'return to the Forge':obTxt)+'</span></div>';
    }
    const side=Quests.activeList(false);
    if(side.length){
      const d=side[0].d, st=side[0].s;
      let obTxt='';
      for(let k=0;k<d.objectives.length;k++){
        const ob=d.objectives[k];
        const cur=ob.count?(st.o[k]||0):(st.o[k]?1:0);
        const need=ob.count||1;
        if(cur<need){ obTxt=ob.t+(ob.count?' ('+cur+'/'+need+')':''); break; }
      }
      html+='<div class="q"><b>'+d.name+'</b><span>'+obTxt+'</span></div>';
    }
    if(!html) html='<div class="q"><b>Explore the kingdom</b><span>Find Sera at the Ashen Hearth shrine.</span></div>';
    this.questList.innerHTML=html;
  },
  renderAll(){
    this.renderInventory(); this.renderSkills(); this.renderQuests(); this.renderPauseStats();
  }
};
function formatTime(sec){
  sec=Math.floor(sec||0);
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60);
  return h+'h '+m+'m';
}

/* ==========================================================================
   BUFFS (temporary effects from items, shrines and story events)
   ========================================================================== */
const Buffs = {
  list:[],
  add(name,dur,apply){
    this.list.push({name:name,t:dur,apply:apply});
    HUD.toast('Blessing: '+name);
  },
  update(dt){
    for(let i=this.list.length-1;i>=0;i--){
      const b=this.list[i];
      b.t-=dt;
      if(b.apply) b.apply(dt);
      if(b.t<=0){ this.list.splice(i,1); }
    }
  },
  clear(){ this.list.length=0; }
};
