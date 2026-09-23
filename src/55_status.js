
/* ==========================================================================
   STATUS EFFECTS
   Small timer holders used by enemies (poison, chill, slow) and the HUD.
   Player.poisonT / slowT are ticked here and their ambient visuals applied.
   ========================================================================== */
const StatusFX = {
  init(){ Player.poisonT=0; Player.slowT=0; this.tick=0; },
  update(dt){
    if(Player.poisonT>0){
      Player.poisonT-=dt;
      this.tick-=dt;
      if(this.tick<=0){
        this.tick=0.6;
        Player.takeDamage(3+Player.S.level*0.35, Player.pos, {});
        FX.burst(Player.pos.x,Player.pos.y+1.2,Player.pos.z,6,{color:[0.5,0.85,0.4],speed:3,life:0.6,size:0.3});
      }
      if(Player.poisonT<=0) HUD.toast('The poison runs its course.');
    }
    if(Player.slowT>0){
      Player.slowT-=dt;
      if(Player.slowT<=0) Player.slowMul=1;
      else Player.slowMul=0.62;
      if(!particlesOff()&&Math.random()<dt*14)
        FX.spawn(Player.pos.x+rr(-0.5,0.5),Player.pos.y+rr(0.2,1.8),Player.pos.z+rr(-0.5,0.5),
          0,-0.4,0,0.5,0.8,1,0.3,0.5);
    } else if(Player.slowMul!==1) Player.slowMul=1;
  }
};
