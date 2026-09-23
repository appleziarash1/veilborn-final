
/* ==========================================================================
   SECTION 13 - INVENTORY & EQUIPMENT
   ========================================================================== */
const ITEM_DEFS = {
  ember:{ name:'Ember Shard', kind:'material', desc:'A sliver of forge-heat. Merchants pay well.', value:12, glyph:'\u25C6' },
  ore:{ name:'Black Iron', kind:'material', desc:'Mine-iron, still ringing from the pick.', value:16, glyph:'\u25AA' },
  frost:{ name:'Frostglass', kind:'material', desc:'Cold enough to cut the eye.', value:20, glyph:'\u2744' },
  arcane:{ name:'Rune Dust', kind:'material', desc:'Ground from cathedral glass.', value:26, glyph:'\u2726' },
  herb:{ name:'Sallow Root', kind:'material', desc:'Bitter, but it closes wounds.', value:9, glyph:'\u2325' },
  flask_charge:{ name:'Ember Flask Charge', kind:'consumable', desc:'Refills one flask charge.', value:40, glyph:'\u2697', use:function(){ Player.flaskCount=Math.min(Player.flaskMax,Player.flaskCount+1); HUD.toast('The flask is full again.'); } },
  emberdraught:{ name:'Ember Draught', kind:'consumable', desc:'Heals 55% of your maximum health.', value:60, glyph:'\u2697', use:function(){ Player.heal(Player.D.hpMax*0.55); } },
  azuredraught:{ name:'Azure Draught', kind:'consumable', desc:'Restores 70% of your mana.', value:55, glyph:'\u2697', use:function(){ Player.restoreMana(Player.D.mnMax*0.7); Audio2.play('heal'); } },
  ash_bomb:{ name:'Ashfire Bomb', kind:'consumable', desc:'Throw a burst of forge-fire (deals fire damage around you).', value:70, glyph:'\u25CF',
    use:function(){ Magic.nova(Player.pos, {dmg:70,radius:8.0,stagger:60,knockback:9,color:0xff7a2a,pc:[1,0.5,0.2]}, 1.0);
      Audio2.play('boom'); } },
  // -------- rings / amulets (equipment) --------
  ring_growth:{ name:'Verdant Signet', kind:'ring', desc:'+14% stamina, +6 armour.', glyph:'\u25CB', bonus:{stam:16,armor:6} },
  ring_prism:{ name:'Prism Loop', kind:'ring', desc:'+16% max mana, +5% crit.', glyph:'\u25CB', bonus:{mana:18,crit:0.05} },
  ring_ward:{ name:'Ward of Stillness', kind:'ring', desc:'+26 armour, +16 HP.', glyph:'\u25CB', bonus:{armor:26,hp:16} },
  ring_ember:{ name:'Emberheart Ring', kind:'ring', desc:'+12 HP, +6% critical damage.', glyph:'\u25CB', bonus:{hp:12,critMult:0.35} },
  ring_hunt:{ name:'Hunter\u2019s Band', kind:'ring', desc:'+8% crit, +4% speed.', glyph:'\u25CB', bonus:{crit:0.08,dex:4} },
  crown_shard:{ name:'Crown Splinter', kind:'amulet', desc:'The Fallen King\u2019s authority. +30 HP, +30 armour, +5 to all damage.', glyph:'\u265B',
    bonus:{hp:30,armor:30,str:6,dex:6,int:6} },
  forge_core:{ name:'Forge Core', kind:'amulet', desc:'A living coal. +22% spell power, +24 mana.', glyph:'\u2726', bonus:{mana:24,int:7} },
  sigil_ash:{ name:'Sigil of Ash', kind:'amulet', desc:'+10% damage on staggered foes. +14 armour.', glyph:'\u2724', bonus:{armor:14,str:4} },
  // -------- weapon upgrade tokens --------
  whetstone:{ name:'Forge Whetstone', kind:'upgrade', desc:'Upgrades the equipped weapon by one rank.', glyph:'\u25B2',
    use:function(){
      const w=Weapons.current();
      Weapons.upgrade(w.id);
      HUD.toast(w.name+' is now rank '+Weapons.levelOf(w.id)+'.');
      Audio2.play('item');
    } },
  armorplate:{ name:'Black Iron Plating', kind:'armor', desc:'Straps of mine-iron. +18 armour, +10 HP.', glyph:'\u25A0', slot:'body',
    bonus:{armor:18,hp:10} },
  aegis:{ name:'Ashen Aegis', kind:'armor', desc:'Burnt scale mail. +30 armour, +24 HP, -3% speed.', glyph:'\u25A0', slot:'body',
    bonus:{armor:30,hp:24,dex:-3} },
  frostmail:{ name:'Frostweave Mail', kind:'armor', desc:'+26 armour, +16 mana, chilled to the touch.', glyph:'\u25A0', slot:'body',
    bonus:{armor:26,mana:16} },
  kingmail:{ name:'Kingsburn Plate', kind:'armor', desc:'+44 armour, +34 HP, +8% crit.', glyph:'\u25A0', slot:'body',
    bonus:{armor:44,hp:34,crit:0.08} }
};
const Inventory = {
  items:{}, equipped:{ring:null,amulet:null,body:null},
  init(){ this.items={}; this.equipped={ring:null,amulet:null,body:null}; },
  add(id,n){
    n=n||1;
    this.items[id]=(this.items[id]||0)+n;
    if(ITEM_DEFS[id]) HUD.toast('Obtained: '+ITEM_DEFS[id].name+(n>1?' x'+n:''));
    Audio2.play('item');
    HUD.dirty=true;
  },
  count(id){ return this.items[id]||0; },
  remove(id,n){
    n=n||1;
    if(!this.items[id]) return false;
    this.items[id]-=n;
    if(this.items[id]<=0) delete this.items[id];
    HUD.dirty=true;
    return true;
  },
  use(id){
    const d=ITEM_DEFS[id];
    if(!d||d.kind!=='consumable'&&d.kind!=='upgrade'){ HUD.toast('That cannot be used.'); return false; }
    if(!this.count(id)) return false;
    if(d.use){ d.use(); this.remove(id,1); return true; }
    return false;
  },
  equip(id){
    const d=ITEM_DEFS[id];
    if(!d||!d.slot&&d.kind!=='ring'&&d.kind!=='amulet'){ HUD.toast('That cannot be equipped.'); return false; }
    if(!this.count(id)) return false;
    const slot = d.kind==='ring'?'ring':(d.kind==='amulet'?'amulet':'body');
    const prev=this.equipped[slot];
    if(prev===id) return false;
    this.equipped[slot]=id;
    Player.recalc();
    Audio2.play('item');
    HUD.toast('Equipped '+d.name);
    HUD.dirty=true;
    return true;
  },
  unequip(slot){
    this.equipped[slot]=null; Player.recalc(); HUD.dirty=true;
  },
  bonus(){
    const out={hp:0,stam:0,mana:0,armor:0,crit:0,critMult:0,str:0,dex:0,int:0};
    const slots=['ring','amulet','body'];
    for(let i=0;i<slots.length;i++){
      const id=this.equipped[slots[i]];
      if(!id) continue;
      const b=ITEM_DEFS[id]&&ITEM_DEFS[id].bonus;
      if(!b) continue;
      for(const k in b) if(out[k]!==undefined) out[k]+=b[k];
    }
    // weapon mastery adds a little flat damage scaling
    if(Skills.has('w_mastery')){ out.str+=2; out.dex+=2; out.int+=2; }
    return out;
  }
};
// Gear is a thin alias so the player and items stay decoupled.
const Gear = {
  init(){ Inventory.init(); Skills.init(); },
  bonus(){ return Inventory.bonus(); }
};

/* ==========================================================================
   SECTION 14 - SKILLS
   Three paths. Skill points unlock passives and spells; spells gate on perks.
   ========================================================================== */
const SKILL_DEFS = [
  // --- Path of the Blade ---
  {id:'b_power', path:'blade', name:'Honed Edge', cost:1, req:[],
   desc:'+12% weapon damage.'},
  {id:'b_combo', path:'blade', name:'Relentless', cost:1, req:['b_power'],
   desc:'The combo window lasts 45% longer, making long chains easier.'},
  {id:'w_mastery', path:'blade', name:'Weapon Mastery', cost:2, req:['b_power'],
   desc:'+12% weapon damage and +2 to Strength, Dexterity and Intelligence.'},
  {id:'b_crit', path:'blade', name:'Find the Seam', cost:2, req:['b_combo'],
   desc:'+8% critical chance.'},
  {id:'w_reach', path:'blade', name:'Long Reach', cost:1, req:['b_combo'],
   desc:'+18% attack reach.'},
  {id:'w_wide', path:'blade', name:'Wide Arc', cost:1, req:['b_combo'],
   desc:'+22% attack arc width.'},
  {id:'w_swift', path:'blade', name:'Piercing Vigil', cost:2, req:['w_reach'],
   desc:'Spears deal +15% damage.'},
  {id:'b_overwhelm', path:'blade', name:'Overwhelm', cost:2, req:['b_crit','w_mastery'],
   desc:'Critical hits also add heavy stagger.'},
  // --- Path of the Ward ---
  {id:'g_tough', path:'ward', name:'Thick Hide', cost:1, req:[],
   desc:'+18% maximum health.'},
  {id:'g_block', path:'ward', name:'Iron Guard', cost:1, req:[],
   desc:'Blocking costs 40% less stamina and negates more damage.'},
  {id:'g_parry', path:'ward', name:'Perfect Guard', cost:2, req:['g_block'],
   desc:'The parry window is nearly twice as long.'},
  {id:'g_stam', path:'ward', name:'Deep Lungs', cost:1, req:['g_tough'],
   desc:'+22% maximum stamina and faster stamina recovery.'},
  {id:'g_roll', path:'ward', name:'Featherfall', cost:1, req:['g_stam'],
   desc:'Dodges cost less stamina and grant longer invulnerability.'},
  {id:'g_regen', path:'ward', name:'Emberblood', cost:2, req:['g_tough'],
   desc:'Slowly regenerate health in combat.'},
  {id:'g_armor', path:'ward', name:'Warded Skin', cost:2, req:['g_parry'],
   desc:'+30 armour.'},
  {id:'g_last', path:'ward', name:'Second Breath', cost:3, req:['g_regen','g_armor'],
   desc:'Once per rest, a fatal blow leaves you at 1 HP instead of killing you.'},
  // --- Path of the Flame ---
  {id:'m_focus', path:'flame', name:'Focus', cost:1, req:[],
   desc:'+20% spell power and +1 mana regeneration.'},
  {id:'sp_frostshard', path:'flame', name:'Frost Shard', cost:1, req:[],
   desc:'Unlocks the Frost Shard spell.'},
  {id:'sp_mend', path:'flame', name:'Ember Mend', cost:1, req:['m_focus'],
   desc:'Unlocks the Ember Mend healing spell.'},
  {id:'m_flow', path:'flame', name:'Smooth Casting', cost:1, req:['sp_frostshard'],
   desc:'Spells cost 18% less mana.'},
  {id:'m_haste', path:'flame', name:'Quick Study', cost:2, req:['m_flow'],
   desc:'Spell cooldowns are 22% shorter.'},
  {id:'sp_stormcall', path:'flame', name:'Storm Call', cost:2, req:['m_flow'],
   desc:'Unlocks the Storm Call lightning spell.'},
  {id:'sp_quake', path:'flame', name:'Ground Quake', cost:2, req:['m_haste','sp_stormcall'],
   desc:'Unlocks the Ground Quake spell.'},
  {id:'m_power', path:'flame', name:'Forgeheart', cost:2, req:['m_haste'],
   desc:'+18% spell power and faster mana regeneration.'},
  {id:'sp_arcaneburst', path:'flame', name:'Arcane Burst', cost:3, req:['m_power','sp_quake'],
   desc:'Unlocks the Arcane Burst spell.'}
];
const Skills = {
  defs:SKILL_DEFS, owned:{},
  init(){ this.owned={}; },
  has(id){ return !!this.owned[id]; },
  byId(id){ for(let i=0;i<this.defs.length;i++) if(this.defs[i].id===id) return this.defs[i]; return null; },
  canBuy(id){
    const d=this.byId(id);
    if(!d||this.owned[id]) return false;
    if(Player.S.skillPoints<d.cost) return false;
    for(let i=0;i<d.req.length;i++) if(!this.owned[d.req[i]]) return false;
    return true;
  },
  buy(id){
    if(!this.canBuy(id)) return false;
    const d=this.byId(id);
    Player.S.skillPoints-=d.cost;
    this.owned[id]=true;
    Player.recalc();
    if(id==='g_last') Player.hasSecondBreath=true;
    Audio2.play('levelup');
    HUD.toast('Learned: '+d.name);
    HUD.dirty=true;
    return true;
  }
};

/* ==========================================================================
   SECTION 11 - NPCs  (dialogue trees, quest hooks, lore)
   ========================================================================== */
const NPC_DEFS = [
  { id:'sera', name:'SERA THE EMBER-KEEPER', region:'village', x:-452, z:44, hue:0xff8a3d, robe:0x4a2a30,
    lines:{
      greet:"You're breathing. Good. The ash took everyone else in this village. I keep the shrine lit so the dead have somewhere to look.",
      about:"The Sun Forge broke, and five Lords swallowed the pieces. Each shard made them worse. You'll need all five before the Forge will answer you.",
      end:"Take the road east. There's a forest that used to be called Whispering. It whispers because it's hungry now."
    },
    quests:['q_shrine','q_firstlord'] },
  { id:'garrick', name:'GARRICK THE FORGEMAN', region:'village', x:-470, z:-34, hue:0xffd070, robe:0x3a3226,
    lines:{
      greet:"My hammer's cold and my anvil's cracked. You look like the kind that hits things. Bring me black iron and I'll warm your steel.",
      about:"Weapons are only honest things left. Rank them up with whetstones — I hid a few where the mines swallow men.",
      end:"Kill something big and bring me its weight. I'll make it into a blade."
    },
    quests:['q_craft'] },
  { id:'mirren', name:'MIRREN OF THE ROOTS', region:'forest', x:-198, z:-166, hue:0x9fe07a, robe:0x2a3a24,
    lines:{
      greet:"Stay on the stone. The roots don't like boots that hurry.",
      about:"The Devourer was a tree once. Then a shard fell into its fork and it learned to want.",
      end:"Burn it. Its seeds are already poison."
    },
    quests:['q_devourer','q_seeds'] },
  { id:'hallow', name:'BROTHER HALLOW', region:'mines', x:52, z:126, hue:0xffb040, robe:0x2e2a20,
    lines:{
      greet:"Don't ring the timbers. Every echo in this mine wakes a name I'd rather forget.",
      about:"We dug for iron and found a shard. It's in the Crystal Caverns now, keeping a Queen warm.",
      end:"Take the deep shaft. It comes out below the prism halls."
    },
    quests:['q_mines'] },
  { id:'lyra', name:'LYRA SHARD-SINGER', region:'caverns', x:-152, z:312, hue:0x5fd0e8, robe:0x1e3a4a,
    lines:{
      greet:"Listen \u2014 do you hear the prism humming? That's her. She sings to keep the shard quiet.",
      about:"I was her apprentice. When the shard came, she stopped singing as a woman and started singing as a thing.",
      end:"Break her. It's the kindest thing anyone's done in a century."
    },
    quests:['q_queen','q_reflection'] },
  { id:'osric', name:'SIR OSRIC, OATHBROKEN', region:'cathedral', x:212, z:322, hue:0xdff4ff, robe:0x33485c,
    lines:{
      greet:"Kneel. No \u2014 don't. I've made enough people kneel.",
      about:"The Saint froze this hall mid-prayer. I was her knight. I still am, in the parts of me that remember.",
      end:"She will not stop. Not until someone makes her."
    },
    quests:['q_saint','q_oath'] },
  { id:'vael', name:'VAEL THE CINDER-PRIEST', region:'citadel', x:408, z:22, hue:0xff5a1a, robe:0x2a1a14,
    lines:{
      greet:"Another ember walking into the wind. Do you know what the King did to be called Fallen?",
      about:"He didn't fall. He was pushed \u2014 by his own court, who wanted the Forge's light for themselves. He burned them and kept the crown.",
      end:"Go up. He is already waiting, and he has been waiting a long time."
    },
    quests:['q_king','q_truth'] },
  { id:'kal', name:'KAL, FORGE-SMITH OF THE LAST FLAME', region:'sunforge', x:158, z:36, hue:0xfff0c0, robe:0x4a3a24,
    lines:{
      greet:"You brought them all. I can feel the shards pulling at each other through your pack.",
      about:"The Warden blocks the anvil \u2014 the last guardian, undecided about what the Forge should become.",
      end:"Then decide. That's all the Forge ever asked of a king."
    },
    quests:['q_forge','q_warden'] }
];
const NPCs = {
  list:[],
  init(){
    for(let i=0;i<NPC_DEFS.length;i++){
      const d=NPC_DEFS[i];
      this.spawn(d);
    }
  },
  spawn(d){
    const g=new THREE.Group();
    const h=terrainHeight(d.x,d.z);
    const skin=TEX.std(0xc0a080,0.85,0.02);
    const robe=TEX.std(d.robe,0.9,0.03);
    const trim=TEX.emissive(d.hue,0.6);
    const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z);
      m.castShadow=true; m.receiveShadow=true; g.add(m); return m; };
    add(new THREE.ConeGeometry(0.62,1.7,8), robe, 0,0.85,0);
    add(new THREE.BoxGeometry(0.6,0.3,0.44), trim, 0,1.62,0);
    add(new THREE.BoxGeometry(0.38,0.4,0.36), skin, 0,1.88,0);
    add(new THREE.ConeGeometry(0.34,0.5,7), robe, 0,2.12,0);
    const lamp=add(new THREE.IcosahedronGeometry(0.22,1), trim, 0.5,1.3,0.3);
    const light=new THREE.PointLight(d.hue,1.0,14,2); light.position.set(d.x,h+1.4,d.z); scene.add(light);
    g.position.set(d.x,h,d.z);
    g.rotation.y=rr(0,TAU);
    scene.add(g);
    World.addCollider(d.x,d.z,0.9,h+2.0,'npc');
    const npc={def:d,name:d.name,x:d.x,z:d.z,y:h,group:g,lamp:lamp,light:light,ph:rr(0,TAU),talked:false};
    this.list.push(npc);
  },
  nearest(x,z,maxD){
    let best=null,bd=maxD*maxD;
    for(let i=0;i<this.list.length;i++){
      const n=this.list[i];
      const dx=n.x-x, dz=n.z-z, d2=dx*dx+dz*dz;
      if(d2<bd){ bd=d2; best=n; }
    }
    return best;
  },
  update(dt,t){
    for(let i=0;i<this.list.length;i++){
      const n=this.list[i];
      n.lamp.rotation.y+=dt*1.6; n.lamp.rotation.x+=dt*0.9;
      n.lamp.position.y=1.3+Math.sin(t*1.7+n.ph)*0.1;
      n.light.intensity=0.9+Math.sin(t*2.2+n.ph)*0.2;
      n.group.rotation.y+=Math.sin(t*0.4+n.ph)*dt*0.06;
    }
  }
};

/* ==========================================================================
   SECTION 12 - QUESTS  (main arc, side quests, hidden objectives, drops)
   ========================================================================== */
const QUEST_DEFS = [
  /* ---- MAIN (21 objectives) ---- */
  {id:'q_shrine', main:true, name:'Kindle the Ember', giver:'Sera the Ember-Keeper',
   objectives:[{t:'Light the Ember Shrine at Ashen Hearth',flag:'shrine_lit'},
               {t:'Open a supply cache',flag:'chest_open',count:1},
               {t:'Slay 5 foes threatening the village',flag:'kill_total',count:5}],
   reward:{xp:120,gold:20,item:'emberdraught'},
   desc:'Sera says the shrines still answer to a living hand. Light one and learn how to come back from death.'},
  {id:'q_firstlord', main:true, name:'I: The Ash Warden', giver:'Sera the Ember-Keeper',
   objectives:[{t:'Enter the Warden\u2019s arena in Ashen Village',flag:'boss_enter_ashwarden'},
               {t:'Defeat the Ash Warden',flag:'boss_ashwarden'},
               {t:'Read the Kingsroad Stone',flag:'lore_kingsroad'}],
   reward:{xp:800,gold:120,item:'sigil_ash'},
   desc:'Five Lords took the shards of the Sun Forge. The first burned your village. Take his shard.'},
  {id:'q_devourer', main:true, name:'II: The Forest Devourer', giver:'Mirren of the Roots',
   objectives:[{t:'Enter the Whispering Forest',flag:'region_forest'},
               {t:'Defeat the Forest Devourer',flag:'boss_forestdevourer'}],
   reward:{xp:1100,gold:150,item:'emberdraught'},
   desc:'The Devourer swallowed a shard and grew a mouth. Mirren wants the forest breathing again.'},
  {id:'q_mines', main:true, name:'III: Beneath the Mines', giver:'Brother Hallow',
   objectives:[{t:'Find the mine mouth marked by Brother Hallow',flag:'mine_entered'},
               {t:'Descend into the Forgotten Mines',flag:'region_mines'},
               {t:'Reach the Crystal Caverns',flag:'region_caverns'}],
   reward:{xp:600,gold:90,item:'whetstone'},
   desc:'Hallow marked a shaft that falls straight into the prism halls. Take it.'},
  {id:'q_queen', main:true, name:'IV: The Crystal Queen', giver:'Lyra Shard-Singer',
   objectives:[{t:'Defeat the Crystal Queen in Crystal Caverns',flag:'boss_crystalqueen'},
               {t:'Recover 4 pieces of the old record',flag:'lore_count',count:4}],
   reward:{xp:1500,gold:190,item:'ring_prism'},
   desc:'Lyra\u2019s old master wears a shard like a crown. She has stopped being a person about it.'},
  {id:'q_saint', main:true, name:'V: The Frozen Saint', giver:'Sir Osric, Oathbroken',
   objectives:[{t:'Cross into the Frozen Cathedral',flag:'region_cathedral'},
               {t:'Light 4 Ember Shrines on the pilgrimage',flag:'shrine_count',count:4},
               {t:'Defeat the Frozen Saint',flag:'boss_frozensaint'}],
   reward:{xp:1900,gold:230,item:'frostmail'},
   desc:'A prayer that became a blizzard. Osric cannot bring himself to end it, so you will.'},
  {id:'q_king', main:true, name:'VI: The Fallen King', giver:'Vael the Cinder-Priest',
   objectives:[{t:'Enter the Scorched Citadel',flag:'region_citadel'},
               {t:'Open 3 supply caches',flag:'chest_open',count:3},
               {t:'Defeat the Fallen King',flag:'boss_fallenking'}],
   reward:{xp:2600,gold:340,item:'kingmail'},
   desc:'The last monarch kept the Forge for himself and burned his own court to do it. He is still sitting there.'},
  {id:'q_forge', main:true, name:'VII: The Sun Forge', giver:'Kal, Forge-Smith',
   objectives:[{t:'Carry all five shards to the Sun Forge anvil',flag:'shards_delivered'},
               {t:'Decide the fate of the Forge',flag:'ending_made'}],
   reward:{xp:4000,gold:500},
   desc:'Five shards, one anvil, and nobody left to tell you what to do with them.'},
  {id:'q_warden', main:true, name:'VIII: The Last Guardian', giver:'Kal, Forge-Smith',
   objectives:[{t:'Reach the Forge Threshold',flag:'region_sunforge'},
               {t:'Defeat the Forge Warden (optional) or slip past him',flag:'forge_open'}],
   reward:{xp:1200,gold:160,item:'forge_core'},
   desc:'The Forge Warden is the only thing left that remembers its duty. It will not simply let you pass.'},
  /* ---- SIDE (16) ---- */
  {id:'q_roots', side:true, name:'Roots That Remember', giver:'Mirren of the Roots',
   objectives:[{t:'Slay 8 Thornhusks in Whispering Forest',flag:'kill_thornhusk',count:8}],
   reward:{xp:420,gold:70,item:'ring_hunt'},
   desc:'The Thornhusks choke everything slower than them. Thin them out.'},
  {id:'q_seeds', side:true, name:'Seeds of the Devourer', giver:'Mirren of the Roots',
   objectives:[{t:'Collect 6 Ember Shards from forest beasts',flag:'item_ember',count:6}],
   reward:{xp:380,gold:80,item:'emberdraught'},
   desc:'Burn the seeds before they sprout legs.'},
  {id:'q_craft', side:true, name:'Cold Anvil, Warm Steel', giver:'Garrick the Forgeman',
   objectives:[{t:'Collect 8 Black Iron',flag:'item_ore',count:8}],
   reward:{xp:500,gold:90,item:'whetstone'},
   desc:'Garrick can reforge what you carry if you bring him enough iron.'},
  {id:'q_mine_ore', side:true, name:'Nine Shafts Deep', giver:'Brother Hallow',
   objectives:[{t:'Slay 10 Bone Vestiges in the Forgotten Mines',flag:'kill_bonevestige',count:10}],
   reward:{xp:520,gold:95,item:'armorplate'},
   desc:'Something in the mine is still digging. Stop it.'},
  {id:'q_reflection', side:true, name:'Reflection', giver:'Lyra Shard-Singer',
   objectives:[{t:'Slay 8 Cave Shriekers in the Caverns',flag:'kill_caveshrieker',count:8}],
   reward:{xp:700,gold:120,item:'azuredraught'},
   desc:'The shriekers copy your voice back badly. Lyra cannot sleep.'},
  {id:'q_prism', side:true, name:'Prism Harvest', giver:'Lyra Shard-Singer',
   objectives:[{t:'Collect 8 Frostglass',flag:'item_frost',count:8}],
   reward:{xp:640,gold:110,item:'azuredraught'},
   desc:'Frostglass holds a spell like a cup holds water.'},
  {id:'q_oath', side:true, name:'An Old Oath', giver:'Sir Osric, Oathbroken',
   objectives:[{t:'Slay 8 Choir Automatons',flag:'kill_choir_automaton',count:8}],
   reward:{xp:900,gold:150,item:'aegis'},
   desc:'Osric\u2019s companions still walk the choir stalls in armour that never rusted.'},
  {id:'q_blizzard', side:true, name:'Widow of the Blizzard', giver:'Sir Osric, Oathbroken',
   objectives:[{t:'Slay 10 Frostwraiths',flag:'kill_frostwraith',count:10}],
   reward:{xp:1100,gold:180,item:'frostmail'},
   desc:'Every wraith is a prayer she answered badly.'},
  {id:'q_truth', side:true, name:'What the Priest Knows', giver:'Vael the Cinder-Priest',
   objectives:[{t:'Collect 10 Rune Dust',flag:'item_arcane',count:10}],
   reward:{xp:1000,gold:170,item:'ring_ember'},
   desc:'Vael can read the old court records, but needs rune dust to see past the burn.'},
  {id:'q_cinders', side:true, name:'Cinders and Crowns', giver:'Vael the Cinder-Priest',
   objectives:[{t:'Slay 12 Cinder Brutes in the Citadel',flag:'kill_cinderbrute',count:12}],
   reward:{xp:1400,gold:220,item:'kingmail'},
   desc:'The King\u2019s old guard do not know he lost. Tell them with steel.'},
  {id:'q_flame_herbs', side:true, name:'Bitter Medicine', giver:'Sera the Ember-Keeper',
   objectives:[{t:'Collect 12 Sallow Root',flag:'item_herb',count:12}],
   reward:{xp:360,gold:70,item:'flask_charge'},
   desc:'Sera can stretch your flask further with the right weeds.'},
  {id:'q_hound_cull', side:true, name:'A Village Afraid', giver:'Sera the Ember-Keeper',
   objectives:[{t:'Slay 10 Charred Hounds',flag:'kill_charredhound',count:10}],
   reward:{xp:400,gold:75,item:'emberdraught'},
   desc:'The hounds still patrol streets their masters no longer own.'},
  {id:'q_lost_patrol', side:true, name:'The Lost Patrol', giver:'Sir Osric, Oathbroken',
   objectives:[{t:'Find the Kingsroad Stone and read it',flag:'lore_kingsroad'}],
   reward:{xp:480,gold:80,item:'ring_ward'},
   desc:'A patrol went east and never returned. A stone at the road remembers them.'},
  {id:'q_wayfarer', side:true, name:'Wayfarer\u2019s Debt', giver:'Brother Hallow',
   objectives:[{t:'Read 4 lore stones across the kingdom',flag:'lore_count',count:4}],
   reward:{xp:560,gold:100,item:'azuredraught'},
   desc:'Read what the dead bothered to carve.'},
  {id:'q_hoarder', side:true, name:'The Hoarder', giver:'Garrick the Forgeman',
   objectives:[{t:'Open 10 chests',flag:'chest_open',count:10}],
   reward:{xp:620,gold:130,item:'whetstone'},
   desc:'Chests are where the dead hide what they wanted to keep.'},
  {id:'q_pilgrim', side:true, name:'Pilgrim\u2019s Road', giver:'Kal, Forge-Smith',
   objectives:[{t:'Light 6 Ember Shrines',flag:'shrine_count',count:6}],
   reward:{xp:800,gold:150,item:'emberdraught'},
   desc:'Every shrine is a step toward the Forge.'},
  /* ---- HIDDEN ---- */
  {id:'h_deep', hidden:true, name:'Hidden: The Deep Lamp', giver:'',
   objectives:[{t:'Reach the deepest point of the Crystal Caverns',flag:'hidden_deepcavern'}],
   reward:{xp:900,gold:200,item:'forge_core'},
   desc:'A lamp burns where nothing should be able to breathe.'},
  {id:'h_edge', hidden:true, name:'Hidden: The World\u2019s Edge', giver:'',
   objectives:[{t:'Stand at the far border of the kingdom',flag:'hidden_edge'}],
   reward:{xp:1000,gold:220,item:'crown_shard'},
   desc:'Beyond the mountains there is only more mountain. Someone left a mark anyway.'},
  {id:'h_killall', hidden:true, name:'Hidden: The Long War', giver:'',
   objectives:[{t:'Slay 150 enemies',flag:'kill_total',count:150}],
   reward:{xp:2000,gold:400,item:'kingmail'},
   desc:'Nobody asked you to do this.'},
  {id:'h_warden', hidden:true, name:'Hidden: Honour the Guardian', giver:'',
   objectives:[{t:'Defeat the Forge Warden, the optional Lord',flag:'boss_forgewarden'}],
   reward:{xp:2200,gold:450,item:'forge_core'},
   desc:'It had one job. You did it for it.'},
  {id:'h_lore', hidden:true, name:'Hidden: The Whole Record', giver:'',
   objectives:[{t:'Read all 12 lore stones',flag:'lore_count',count:12}],
   reward:{xp:2400,gold:500,item:'crown_shard'},
   desc:'The kingdom\u2019s entire memory, in twelve carved lines.'}
];
const Quests = {
  defs:QUEST_DEFS, active:{}, completed:{}, counters:{}, drops:[], history:{},
  init(){ this.active={}; this.completed={}; this.counters={}; this.history={}; },
  byId(id){ for(let i=0;i<this.defs.length;i++) if(this.defs[i].id===id) return this.defs[i]; return null; },
  start(id){
    const d=this.byId(id);
    if(!d||this.active[id]||this.completed[id]) return false;
    this.active[id]={o:d.objectives.map(function(){return 0;})};
    // Credit objectives whose event already happened (bosses killed, regions
    // entered, shrines lit...) so accepting a quest late never soft-locks the
    // player into re-doing something the world has already acknowledged.
    for(let i=0;i<d.objectives.length;i++){
      const ob=d.objectives[i];
      const done=this.history[ob.flag];
      if(done===undefined) continue;
      this.active[id].o[i]=ob.count?Math.min(ob.count,done):1;
    }
    this.tryComplete(id);
    if(this.completed[id]) return true;
    Audio2.play('quest');
    HUD.toast('Quest started: '+d.name);
    HUD.dirty=true;
    return true;
  },
  // flags: 'shrine_lit', 'kill_<key>', 'item_<id>', 'chest_open', 'region_<id>'...
  progress(flag,n){
    n=n||1;
    this.history[flag]=(this.history[flag]||0)+n;
    let changed=false;
    for(const id in this.active){
      const d=this.byId(id);
      if(!d) continue;
      for(let i=0;i<d.objectives.length;i++){
        const ob=d.objectives[i];
        if(ob.flag!==flag) continue;
        if(this.active[id].o[i]>=1) continue;
        if(ob.count){
          this.active[id].o[i]=Math.min(ob.count,(this.active[id].o[i]||0)+n);
          if(this.active[id].o[i]>=ob.count){ this.active[id].o[i]=ob.count; this.tryComplete(id); }
          changed=true;
        } else {
          this.active[id].o[i]=1;
          changed=true;
          this.tryComplete(id);
        }
      }
    }
    if(changed) HUD.dirty=true;
  },
  // absolute set (for counters that track totals like lore read)
  progressTo(flag,total){
    if(total>(this.history[flag]||0)) this.history[flag]=total;
    for(const id in this.active){
      const d=this.byId(id);
      if(!d) continue;
      for(let i=0;i<d.objectives.length;i++){
        const ob=d.objectives[i];
        if(ob.flag!==flag||!ob.count) continue;
        const cur=this.active[id].o[i]||0;
        if(total>cur){ this.active[id].o[i]=Math.min(ob.count,total); }
        if(this.active[id].o[i]>=ob.count) this.tryComplete(id);
      }
    }
    HUD.dirty=true;
  },
  tryComplete(id){
    const d=this.byId(id);
    const st=this.active[id];
    if(!d||!st) return;
    for(let i=0;i<d.objectives.length;i++){
      const ob=d.objectives[i];
      const need=ob.count||1;
      if((st.o[i]||0)<need) return;
    }
    this.complete(id);
  },
  complete(id){
    const d=this.byId(id);
    if(!d||this.completed[id]) return;
    this.completed[id]=true;
    delete this.active[id];
    Audio2.play('quest');
    HUD.toast('Quest complete: '+d.name);
    if(d.reward){
      if(d.reward.xp) Player.addXP(d.reward.xp);
      if(d.reward.gold) Player.addGold(d.reward.gold);
      if(d.reward.item) Inventory.add(d.reward.item,1);
    }
    if(d.main) Story.onMainQuestComplete(id);
    HUD.dirty=true;
    Save.autosave();
  },
  onEnemyKilled(key,e){
    this.counters['kill_'+key]=(this.counters['kill_'+key]||0)+1;
    this.counters['kill_total']=(this.counters['kill_total']||0)+1;
    this.progress('kill_'+key,1);
    this.progressTo('kill_total', this.counters['kill_total']);
  },
  onBossKilled(bossId){ this.progress('boss_'+bossId); },
  onItem(id,n){
    this.counters['item_'+id]=(this.counters['item_'+id]||0)+n;
    this.progressTo('item_'+id, this.counters['item_'+id]);
  },
  onChest(){ this.counters['chest_open']=(this.counters['chest_open']||0)+1; this.progressTo('chest_open',this.counters['chest_open']); },
  onShrine(){ this.counters['shrine_count']=(this.counters['shrine_count']||0)+1; this.progressTo('shrine_count',this.counters['shrine_count']); },
  onLore(total){ this.counters['lore_count']=total; this.progressTo('lore_count',total); },
  onFlag(flag){ this.progress(flag); },
  // loot drops from enemies (collected by walking over them)
  spawnDrop(x,z,tier){
    const pool=tier>1?['emberdraught','azuredraught','whetstone','ember','arcane','armorplate']
                      :['ember','ore','herb','frost','emberdraught'];
    const id=pick(pool);
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry(0.32,1),
      new THREE.MeshBasicMaterial({color:0xffd070,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false}));
    const y=terrainHeight(x,z)+0.8;
    m.position.set(x,y,z);
    scene.add(m);
    const light=new THREE.PointLight(0xffd070,0.7,8,2); light.position.copy(m.position); scene.add(light);
    this.drops.push({id:id,mesh:m,light:light,x:x,z:z,y:y,t:0});
  },
  updateDrops(dt){
    for(let i=this.drops.length-1;i>=0;i--){
      const d=this.drops[i];
      d.t+=dt;
      d.mesh.rotation.y+=dt*2; d.mesh.rotation.x+=dt*1.1;
      d.mesh.position.y=d.y+Math.sin(d.t*3)*0.16;
      d.light.position.copy(d.mesh.position);
      const dx=Player.pos.x-d.x, dz=Player.pos.z-d.z;
      if(dx*dx+dz*dz<2.6){
        // magnet toward the player
        d.mesh.position.lerp(new THREE.Vector3(Player.pos.x,Player.pos.y+1.0,Player.pos.z),1-Math.exp(-6*dt));
        if(dx*dx+dz*dz<0.9){
          Inventory.add(d.id,1);
          this.onItem(d.id,1);
          scene.remove(d.mesh); scene.remove(d.light);
          this.drops.splice(i,1);
        }
      }
      if(d.t>70){ scene.remove(d.mesh); scene.remove(d.light); this.drops.splice(i,1); }
    }
  },
  clear(){ this.drops.length=0; },
  activeList(main){
    const out=[];
    for(const id in this.active){
      const d=this.byId(id);
      if(!d) continue;
      if(!!d.main!==!!main) continue;
      out.push({d:d,s:this.active[id]});
    }
    return out;
  },
  allCompletedCount(){ let n=0; for(const k in this.completed) n++; return n; }
};
