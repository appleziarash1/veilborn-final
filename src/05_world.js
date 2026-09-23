
/* ==========================================================================
   SECTION 4c - WORLD GENERATION
   Terrain mesh (vertex-coloured, analytic height field), instanced prop
   scatter, hand-placed structures, shrines, chests, arenas, portals and
   readable lore stones. Everything is generated at load time; nothing is
   downloaded.
   ========================================================================== */
const _matW=new THREE.Matrix4(), _qW=new THREE.Quaternion(), _upW=new THREE.Vector3(0,1,0), _colW=new THREE.Color();
const _eulerW=new THREE.Euler(), _posW=new THREE.Vector3(), _sclW=new THREE.Vector3();

const World = {
  terrain:null, hash:new SpatialHash(8), colliders:[],
  props:[], shrines:[], chests:[], lootOrbs:[], arenas:[], portals:[], loreObjs:[], bridges:[],
  _dirtyInst:new Set(),
  group:null, villageFire:null,
  tmpArr:[], tmpArr2:[], tmpArr3:[], tmpArr4:[],

  /* ---- full build (no progress callback; the boot sequence stages it) ---- */
  build(){
    this.group=new THREE.Group(); scene.add(this.group);
    TEX.init();
    this.buildTerrain();
    this.buildStructures();
    this.scatterProps();
    this.buildShrines();
    this.buildLoot();
    this.buildArenas();
    this.buildPortals();
    this.buildLoreObjects();
  },

  /* ---- terrain ---------------------------------------------------------- */
  buildTerrain(){
    const SX=CFG.world.sizeX, SZ=CFG.world.sizeZ, NX=CFG.world.segX, NZ=CFG.world.segZ;
    const geo=new THREE.PlaneGeometry(SX,SZ,NX,NZ);
    geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;
    const colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), z=pos.getZ(i);
      const h=terrainHeight(x,z);
      pos.setY(i,h);
      const R=getRegionAt(x,z);
      let r,g,b;
      if(R){
        const t=regionT(x,z,R);
        const c=new THREE.Color(R.ground), rock=new THREE.Color(R.rock);
        c.lerp(rock, smoothstep(0.45,0.0,t)*0.7);
        r=c.r; g=c.g; b=c.b;
      } else {
        const n=fbm(x*0.02,z*0.02,3,2,0.5);
        r=0.20+n*0.10; g=0.19+n*0.09; b=0.16+n*0.08;
      }
      const hx=terrainHeight(x+4,z), hz=terrainHeight(x,z+4);
      const slope=Math.min(1,(Math.abs(hx-h)+Math.abs(hz-h))/12);
      const shade=(1-slope*0.22)*(0.92+0.26*fbm(x*0.09,z*0.09,3,2,0.5));
      const frost=smoothstep(48,78,h)*0.55;
      colors[i*3]  =clamp(r*shade+frost*0.60,0,1);
      colors[i*3+1]=clamp(g*shade+frost*0.62,0,1);
      colors[i*3+2]=clamp(b*shade+frost*0.75,0,1);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
    geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.97, metalness:0.02, map:TEX.dirt});
    mat.map.repeat.set(120,86);
    this.terrain=new THREE.Mesh(geo,mat);
    this.terrain.receiveShadow=true;
    this.group.add(this.terrain);
    geo.computeBoundingSphere();
  },

  /* ---- instance helpers ------------------------------------------------- */
  addCollider(x,z,r,top,tag){
    const c={x:x,z:z,r:r,top:(top===undefined?999:top),tag:tag||'prop'};
    this.colliders.push(c); this.hash.insert(c);
    return c;
  },
  instanced(geo,mat,count,castShadow,receiveShadow){
    const m=new THREE.InstancedMesh(geo,mat,count);
    m.castShadow=castShadow!==false;
    m.receiveShadow=receiveShadow!==false;
    m.count=0;
    this.group.add(m);
    const rec={mesh:m,cap:count};
    this.props.push(rec);
    return rec;
  },
  place(rec,x,y,z,ry,sx,sy,sz,color){
    const m=rec.mesh;
    if(m.count>=rec.cap) return false;
    _qW.setFromAxisAngle(_upW, ry||0);
    _matW.compose(new THREE.Vector3(x,y,z), _qW,
      new THREE.Vector3(sx===undefined?1:sx, sy===undefined?1:sy, sz===undefined?1:sz));
    m.setMatrixAt(m.count,_matW);
    if(color!==undefined){
      if(!m.instanceColor)
        m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(m.cap*3).fill(1),3);
      m.setColorAt(m.count, _colW.setHex(color));
    }
    m.count++;
    return true;
  },
  finalizeProps(){
    for(let i=0;i<this.props.length;i++){
      const r=this.props[i];
      r.mesh.instanceMatrix.needsUpdate=true;
      if(r.mesh.instanceColor) r.mesh.instanceColor.needsUpdate=true;
      if(r.mesh.count===0) r.mesh.visible=false;
    }
  },
  nearArena(x,z,pad){
    for(let i=0;i<REGIONS.length;i++){
      const a=REGIONS[i].arena, dx=x-a.x, dz=z-a.z;
      if(Math.sqrt(dx*dx+dz*dz)<a.r+pad) return true;
    }
    return false;
  },
  /* Mark an instance batch dirty; World.update flushes once per frame so
     hundreds of animated instances cost one buffer upload, not hundreds. */
  _markDirty(m){ this._dirtyInst.add(m); },
  flushInstanced(){
    if(this._dirtyInst.size===0) return;
    this._dirtyInst.forEach(m=>{ m.instanceMatrix.needsUpdate=true; });
    this._dirtyInst.clear();
  },
  /* Re-place an instance (used by animated instanced decor such as shrine flames). */
  instUpdate(rec,index,x,y,z,ry,sx,sy,sz){
    _qW.setFromAxisAngle(_upW, ry||0);
    _matW.compose(_posW.set(x,y,z), _qW,
      _sclW.set(sx===undefined?1:sx, sy===undefined?1:sy, sz===undefined?1:sz));
    rec.mesh.setMatrixAt(index,_matW);
    this._markDirty(rec.mesh);
  },
  /* Re-place an instance with a yaw + pitch rotation (animated decor). */
  instUpdateEuler(rec,index,x,y,z,ry,rx,sx,sy,sz){
    _qW.setFromEuler(_eulerW.set(rx||0, ry||0, 0, 'YXZ'));
    _matW.compose(_posW.set(x,y,z), _qW,
      _sclW.set(sx===undefined?1:sx, sy===undefined?1:sy, sz===undefined?1:sz));
    rec.mesh.setMatrixAt(index,_matW);
    this._markDirty(rec.mesh);
  },
  /* Chest lid open/close visuals (the lids are one instanced batch). */
  setChestLid(c, open){
    if(!this.chestLids) return;
    const lift=open?1.62:1.35, tilt=open?-1.1:0, back=open?-0.36:0;
    // the lid pivots from its back edge, so the offset is rotated by the chest yaw
    const sinA=Math.sin(c.ry), cosA=Math.cos(c.ry);
    this.instUpdateEuler(this.chestLids, c.lidIndex,
      c.x+sinA*back, c.y+lift, c.z+cosA*back, c.ry, tilt, 2.0,0.5,1.4);
  },
  /* Instanced gatherables cannot toggle per-instance visibility, so a
     collected orb is scaled to zero and restored by scaling back up. */
  setOrbTaken(o, taken){
    if(!this.orbBatches||!this.orbBatches[o.batch]) return;
    o.taken=taken;
    this.instUpdate(this.orbBatches[o.batch], o.index, o.x, o.y+1.1, o.z, 0, taken?0:1, taken?0:1, taken?0:1);
  },
  /* Shared geometries for the structured decor, so instancing is cheap. */
  geo:{
    box:null,cone:null,cyl:null,oct:null,rock:null,torus:null,sphere:null,circle:null
  },
  ensureGeo(){
    if(this.geo.box) return this.geo;
    this.geo.box=new THREE.BoxGeometry(1,1,1);
    this.geo.cone=new THREE.ConeGeometry(1,1,7,1);
    this.geo.cyl=new THREE.CylinderGeometry(1,1,1,8,1);
    this.geo.oct=new THREE.OctahedronGeometry(1,0);
    this.geo.rock=new THREE.DodecahedronGeometry(1,0);
    this.geo.torus=new THREE.TorusGeometry(1,0.14,8,18);
    this.geo.sphere=new THREE.SphereGeometry(1,7,5);
    this.geo.circle=new THREE.CircleGeometry(1,20); this.geo.circle.rotateX(-Math.PI/2);
    return this.geo;
  },

  /* ---- structures ------------------------------------------------------- */
  buildStructures(){
    const g=this.group;
    const G=this.ensureGeo();
    const boxGeo=G.box, coneGeo=G.cone, cylGeo=G.cyl, octGeo=G.oct,
          rockGeo=G.rock, torusGeo=G.torus, sphereGeo=G.sphere, circleGeo=G.circle;
    // Every structure class below is emitted as instanced meshes so the whole
    // village / forest / cathedral costs a handful of draw calls instead of
    // one per object.
    const woodMat=TEX.std(0x453323,0.92,0.02,TEX.bark);
    const wallMat=TEX.std(0x4b4239,0.95,0.02,TEX.stone);
    const roofMat=TEX.std(0x2b241d,0.9,0.03);
    const ruins=this.instanced(boxGeo,wallMat,320);
    const roofs=this.instanced(coneGeo,roofMat,160);
    const woods=this.instanced(cylGeo,woodMat,700);
    const V=regionById('village');
    let built=0;
    for(let i=0;i<90 && built<36;i++){
      const a=rr(0,TAU), d=rr(38,V.radius*0.9);
      const x=V.c.x+Math.cos(a)*d, z=V.c.z+Math.sin(a)*d;
      if(this.nearArena(x,z,10)) continue;
      const h=terrainHeight(x,z);
      if(h>52||h<-40) continue;
      const w=rr(6,13), hh=rr(4,7), dp=rr(6,12);
      this.place(ruins,x,h+hh*0.42,z,rr(0,TAU),w,hh,dp, pick([0x564a3e,0x4a3f34,0x5d5145]));
      built++;
      if(rr(0,1)<0.55){
        this.place(ruins,x-w*0.42,h+hh*0.95,z+dp*0.40,rr(-0.5,0.5),w*0.50,0.70,dp*0.40,0x413830);
        this.place(ruins,x+w*0.40,h+hh*0.80,z-dp*0.35,rr(-0.5,0.5),w*0.45,0.60,dp*0.35,0x3a322b);
      } else {
        this.place(roofs,x,h+hh*0.9,z,0,w*0.78,hh*0.7,dp*0.78,0x2d2620);
      }
      for(let bn=0;bn<3;bn++)
        this.place(woods, x+rr(-w*0.5,w*0.5), h+hh*0.5, z+rr(-dp*0.5,dp*0.5),
                   rr(0,TAU), 0.22, hh*1.1, 0.22, 0x453323);
      if(w>9) this.addCollider(x,z,Math.max(w,dp)*0.44,h+hh*0.6,'house');
    }
    // the village well + bonfire (two unique meshes; kept as-is)
    const well=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.9,2.6,12,1,true),
      TEX.std(0x5a5248,0.9,0.05,TEX.stone));
    well.position.set(V.c.x+6, terrainHeight(V.c.x+6,V.c.z+4)+1.3, V.c.z+4);
    well.receiveShadow=true; well.castShadow=true; g.add(well);
    this.addCollider(V.c.x+6,V.c.z+4,2.9,terrainHeight(V.c.x+6,V.c.z+4)+2.5,'well');
    // a fence ring
    for(let i=0;i<40;i++){
      const x=V.c.x+Math.cos(i*0.34)*34+rr(-1,1), z=V.c.z+Math.sin(i*0.34)*34;
      this.place(woods,x,terrainHeight(x,z)+0.9,z,rr(-0.2,0.2),0.14,1.8,0.14,0x3f2f22);
    }
    // village bonfire (the one warm thing left)
    const bf=new THREE.Mesh(new THREE.IcosahedronGeometry(1.6,1), TEX.emissive(0xff7a2a,1.2));
    bf.position.set(V.c.x-10, terrainHeight(V.c.x-10,V.c.z-8)+1.2, V.c.z-8);
    g.add(bf);
    const bfl=new THREE.PointLight(0xff7a2a,2.0,40,2); bfl.position.copy(bf.position); g.add(bfl);
    this.villageFire=bf;

    /* ================= WHISPERING FOREST: trees, rocks, mushrooms ======== */
    const F=regionById('forest');
    const trunks=this.instanced(cylGeo,TEX.std(0x3a2c1e,0.95,0.01,TEX.bark),1000,true,false);
    const canopy=this.instanced(coneGeo,TEX.std(0x2f4a28,0.9,0.0),1000,true,false);
    const shrooms=this.instanced(coneGeo,TEX.std(0x6b4a7a,0.8,0.05),160,true,false);
    const rocksA=this.instanced(rockGeo,TEX.std(0x3d4a3a,0.97,0.02,TEX.rock),400);
    let trees=0;
    for(let i=0;i<560 && trees<340;i++){
      const a=rr(0,TAU), d=rr(14,F.radius*1.02);
      const x=F.c.x+Math.cos(a)*d, z=F.c.z+Math.sin(a)*d;
      if(this.nearArena(x,z,12)) continue;
      const h=terrainHeight(x,z); if(h>56||h<-38) continue;
      const th=rr(9,20), tw=rr(0.5,1.1);
      this.place(trunks,x,h+th*0.5,z,rr(0,TAU),tw,th,tw, pick([0x3d2f20,0x453525,0x33281a]));
      const cw=rr(3.6,7.2);
      this.place(canopy,x,h+th*0.86,z,rr(0,TAU),cw,rr(5,10),cw, pick([0x2c4a26,0x35542c,0x243d20,0x3f6033]));
      trees++;
      this.addCollider(x,z,tw*0.75,h+th*0.7,'tree');
      if(rr(0,1)<0.25)
        this.place(shrooms,x+rr(-6,6),h+0.9,z+rr(-6,6),rr(0,TAU),rr(0.5,1.1),rr(1.2,2.6),rr(0.5,1.1),0x6b4a7a);
      if(rr(0,1)<0.20)
        this.place(rocksA,x+rr(-8,8),h+0.6,z+rr(-8,8),rr(0,TAU),rr(0.8,2.2),rr(0.7,1.8),rr(0.8,2.2),0x3d4a3a);
    }

    /* ================= FORGOTTEN MINES: portals, timber, ore ============= */
    const M=regionById('mines');
    const mineBeam=TEX.std(0x3d2e1f,0.94,0.02,TEX.bark);
    const beams=this.instanced(boxGeo,mineBeam,460);
    const mstone=this.instanced(rockGeo,TEX.std(0x4a3f31,0.95,0.03,TEX.stone),380);
    const ores=this.instanced(sphereGeo,TEX.emissive(0xffa030,0.85),240,false,false);
    const mineEntrances=[{x:M.c.x-60,z:M.c.z-40},{x:M.c.x+50,z:M.c.z+40},
                         {x:M.c.x-20,z:M.c.z+80},{x:M.c.x+70,z:M.c.z-70}];
    for(let mi=0;mi<mineEntrances.length;mi++){
      const e=mineEntrances[mi];
      const h=terrainHeight(e.x,e.z);
      this.place(beams,e.x-3.4,h+3.4,e.z,0,0.8,6.8,0.8,0x3d2e1f);
      this.place(beams,e.x+3.4,h+3.4,e.z,0,0.8,6.8,0.8,0x3d2e1f);
      this.place(beams,e.x,   h+6.4,e.z,0,8.0,0.9,1.0,0x3d2e1f);
      const dark=new THREE.Mesh(new THREE.BoxGeometry(7.2,5.6,1.2), TEX.std(0x0d0a08,1,0));
      dark.position.set(e.x,h+2.8,e.z); dark.rotation.y=rr(0,TAU); g.add(dark);
      this.addCollider(e.x-3.4,e.z,1.0,h+7,'minepost');
      this.addCollider(e.x+3.4,e.z,1.0,h+7,'minepost');
    }
    for(let i=0;i<190;i++){
      const a=rr(0,TAU), d=rr(16,M.radius*0.95);
      const x=M.c.x+Math.cos(a)*d, z=M.c.z+Math.sin(a)*d;
      if(this.nearArena(x,z,12)) continue;
      const h=terrainHeight(x,z); if(h>56||h<-40) continue;
      this.place(mstone,x,h+rr(0.4,1.6),z,rr(0,TAU),rr(0.8,2.6),rr(0.6,2.4),rr(0.8,2.6),
                 pick([0x4a3f31,0x554838,0x3f3629]));
      if(rr(0,1)<0.35) this.place(beams,x,h+2.2,z,rr(0,0.4),0.5,4.4,0.5,0x3d2e1f);
      if(rr(0,1)<0.22) this.place(ores,x,h+0.6,z,rr(0,TAU),rr(0.3,0.7),rr(0.3,0.7),rr(0.3,0.7),0xffa030);
    }

    /* ================= CRYSTAL CAVERNS: crystals + stalagmites ========== */
    const C=regionById('caverns');
    const crystals =this.instanced(octGeo,TEX.emissive(0x5fd0e8,0.9,TEX.crystal),480,false,false);
    const crystals2=this.instanced(octGeo,TEX.emissive(0x8f7ad8,0.9,TEX.crystal),320,false,false);
    const stalag=this.instanced(coneGeo,TEX.std(0x36485c,0.9,0.05,TEX.rock),420);
    for(let i=0;i<340;i++){
      const a=rr(0,TAU), d=rr(12,C.radius);
      const x=C.c.x+Math.cos(a)*d, z=C.c.z+Math.sin(a)*d;
      if(this.nearArena(x,z,12)) continue;
      const h=terrainHeight(x,z);
      const sc=rr(0.7,4.2);
      const rec=(rr(0,1)<0.6)?crystals:crystals2;
      this.place(rec,x,h+sc*0.4,z,rr(0,TAU),
                 sc*rr(0.3,0.7), sc*rr(1.4,2.8), sc*rr(0.3,0.7),
                 rr(0,1)<0.6?0x5fd0e8:0x8f7ad8);
      if(sc>2.4) this.addCollider(x,z,sc*0.4,h+sc,'crystal');
      if(rr(0,1)<0.4)
        this.place(stalag,x+rr(-8,8),h+rr(1,3),z+rr(-8,8),rr(0,TAU),
                   rr(0.6,1.8),rr(2,5),rr(0.6,1.8),0x36485c);
    }

    /* ================= FROZEN CATHEDRAL: pillars, arches, ice ============ */
    const K=regionById('cathedral');
    const iceMat=TEX.std(0xa8c4db,0.5,0.05,TEX.ice);
    const pillars=this.instanced(cylGeo,TEX.std(0xd6e2ec,0.6,0.03),280);
    const archB=this.instanced(boxGeo,iceMat,340);
    const iceSpikes=this.instanced(coneGeo,iceMat,340);
    for(let i=0;i<80;i++){
      const a=rr(0,TAU), d=rr(28,K.radius);
      const x=K.c.x+Math.cos(a)*d, z=K.c.z+Math.sin(a)*d;
      if(this.nearArena(x,z,14)) continue;
      const h=terrainHeight(x,z), ph=rr(7,15);
      this.place(pillars,x,h+ph*0.5,z,rr(0,TAU),rr(1.0,1.7),ph,rr(1.0,1.7),0xc9d8e4);
      this.addCollider(x,z,1.5,h+ph,'pillar');
      if(rr(0,1)<0.5) this.place(archB,x,h+ph+0.6,z,rr(0,0.2),5.4,0.8,1.2,0xbfd6e6);
      if(rr(0,1)<0.4)
        this.place(iceSpikes,x+rr(-12,12),h+rr(1,3),z+rr(-12,12),rr(0,TAU),
                   rr(0.6,1.8),rr(2,6),rr(0.6,1.8),0xa8c4db);
    }
    // the nave: two rows of pillars and a lintel
    const cx=K.c.x, cz=K.c.z+20, ch=terrainHeight(cx,cz);
    for(let s=-1;s<=1;s+=2){
      for(let i=0;i<7;i++){
        const px=cx+s*16, pz=cz-45+i*15, ph=terrainHeight(px,pz);
        this.place(pillars,px,ph+9,pz,0,1.5,18,1.5,0xc9d8e4);
        this.addCollider(px,pz,1.5,ph+18,'pillar');
      }
    }
    this.place(archB,cx,ch+19,cz,0,38,1.6,4,0xbfd6e6);

    /* ================= SCORCHED CITADEL: obsidian, lava, keep =========== */
    const T=regionById('citadel');
    const obsMat=TEX.std(0x231a16,0.6,0.35);
    const towers=this.instanced(cylGeo,obsMat,240);
    const spikesI=this.instanced(coneGeo,obsMat,320);
    const braziers=this.instanced(cylGeo,TEX.emissive(0xff5a1a,1.0),160,false,false);
    for(let i=0;i<100;i++){
      const a=rr(0,TAU), d=rr(26,T.radius);
      const x=T.c.x+Math.cos(a)*d, z=T.c.z+Math.sin(a)*d;
      if(this.nearArena(x,z,16)) continue;
      const h=terrainHeight(x,z);
      if(rr(0,1)<0.45){
        const th=rr(10,26);
        this.place(towers,x,h+th*0.5,z,rr(0,TAU),rr(2.0,4.6),th,rr(2.0,4.6),0x2a201b);
        this.addCollider(x,z,3.0,h+th,'tower');
      } else {
        const sc=rr(2,5);
        this.place(spikesI,x,h+sc*0.9,z,rr(0,TAU),sc*0.5,sc*2.4,sc*0.5,0x231a16);
      }
      if(rr(0,1)<0.3) this.place(braziers,x+rr(-8,8),h+1.1,z+rr(-8,8),0,0.7,2.2,0.7,0xff5a1a);
    }
    // the keep where the King sits
    const kx=T.c.x+34, kz=T.c.z+30, kh=terrainHeight(kx,kz);
    for(let i=0;i<5;i++){
      const a=i/5*TAU;
      this.place(towers,kx+Math.cos(a)*22,kh+15,kz+Math.sin(a)*22,0,4,30,4,0x251c17);
      this.addCollider(kx+Math.cos(a)*22,kz+Math.sin(a)*22,3.4,kh+30,'tower');
    }
    this.place(towers,kx,kh+18,kz,0,7,36,7,0x2a201b);
    this.addCollider(kx,kz,5.4,kh+36,'keep');
    // lava pools (emissive material only — a light per pool would be too many)
    const lavaMat=TEX.emissive(0xff4a10,1.3,TEX.lava);
    for(let i=0;i<26;i++){
      const a=rr(0,TAU), d=rr(30,T.radius*0.95);
      const x=T.c.x+Math.cos(a)*d, z=T.c.z+Math.sin(a)*d;
      const h=terrainHeight(x,z);
      const m=new THREE.Mesh(circleGeo,lavaMat);
      m.position.set(x,h+0.18,z); m.scale.setScalar(rr(3,9));
      m.rotation.y=rr(0,TAU); g.add(m);
    }
    // a single representative glow for the citadel's lava field
    const lavaGlow=new THREE.PointLight(0xff5a1a,1.5,52,2);
    lavaGlow.position.set(T.c.x, terrainHeight(T.c.x,T.c.z)+4, T.c.z); g.add(lavaGlow);

    /* ================= THE SUN FORGE: pillars, rings, anvil ============= */
    const SF=regionById('sunforge');
    const sfPillars=this.instanced(cylGeo,TEX.std(0x6a5a40,0.7,0.25,TEX.stone),160);
    const rings=this.instanced(torusGeo,TEX.emissive(0xffc860,1.0),90,false,false);
    for(let i=0;i<8;i++){
      const a=i/8*TAU, d=54;
      const x=SF.c.x+Math.cos(a)*d, z=SF.c.z+Math.sin(a)*d, h=terrainHeight(x,z);
      this.place(sfPillars,x,h+13,z,0,3.2,26,3.2,0x7a6a4a);
      this.addCollider(x,z,2.6,h+26,'forgepillar');
    }
    const sfh=terrainHeight(SF.c.x,SF.c.z);
    for(let i=0;i<5;i++)
      this.place(rings,SF.c.x,sfh+6+i*5.5,SF.c.z,0,16-i*1.4,16-i*1.4,16-i*1.4,0xffd070);
    const anvil=new THREE.Mesh(new THREE.BoxGeometry(9,3.2,5), TEX.std(0x4a4a52,0.4,0.7));
    anvil.position.set(SF.c.x, sfh+1.6, SF.c.z);
    anvil.castShadow=true; anvil.receiveShadow=true; g.add(anvil);
    this.addCollider(SF.c.x,SF.c.z,4.2,sfh+3.2,'anvil');
    const forgeGlow=new THREE.PointLight(0xffc860,2.4,90,2);
    forgeGlow.position.set(SF.c.x,sfh+14,SF.c.z); g.add(forgeGlow);
    this.anvilObj=anvil;
    this.anvilGlow=forgeGlow;
    this.buildBridges();
  },

  /* ---- rope bridges linking adjacent regions ---------------------------- */
  buildBridges(){
    const pairs=[['village','forest'],['forest','mines'],['mines','caverns'],
                 ['caverns','cathedral'],['cathedral','citadel'],['citadel','sunforge'],['village','mines']];
    const bridgeMat=TEX.std(0x4a3b28,0.9,0.03,TEX.bark);
    const pierMat=TEX.emissive(0x7fd8ff,0.35,TEX.stone);
    // pre-count so the instanced batches can be sized exactly
    let nDeck=0, nPier=0;
    const steps=18;
    for(let pi=0;pi<pairs.length;pi++){ nDeck+=steps+1; nPier+=steps-1; }
    const deck=this.instanced(this.geo.box,bridgeMat,nDeck,true,true);
    const piers=this.instanced(this.geo.cyl,pierMat,nPier,true,false);
    for(let pi=0;pi<pairs.length;pi++){
      const A=REGIONS.find(r=>r.id===pairs[pi][0]), B=REGIONS.find(r=>r.id===pairs[pi][1]);
      for(let s=0;s<=steps;s++){
        const t=s/steps;
        const x=lerp(A.c.x,B.c.x,t)+rr(-6,6), z=lerp(A.c.z,B.c.z,t)+rr(-6,6);
        const h=terrainHeight(x,z);
        const ry=Math.atan2(B.c.x-A.c.x,B.c.z-A.c.z);
        this.place(deck,x,h+0.6,z,ry,rr(7,13),1,7.5,0x4a3b28);
      }
      for(let s=1;s<steps;s++){
        const t=s/steps;
        const x=lerp(A.c.x,B.c.x,t)+7, z=lerp(A.c.z,B.c.z,t)+4;
        const h=terrainHeight(x,z);
        this.place(piers,x,h+2.1,z,0,0.9,4.2,0.9,0x7fd8ff);
      }
    }
  },

  /* ---- world scatter outside the regions -------------------------------- */
  scatterProps(){
    const rocks=this.instanced(new THREE.DodecahedronGeometry(1,0),TEX.std(0x4a4640,0.95,0.02,TEX.rock),780);
    const shrubs=this.instanced(new THREE.ConeGeometry(1,1,6,1),TEX.std(0x33291f,0.95,0.0),440,true,false);
    for(let i=0;i<980;i++){
      const x=rr(-CFG.world.sizeX*0.48,CFG.world.sizeX*0.48);
      const z=rr(-CFG.world.sizeZ*0.48,CFG.world.sizeZ*0.48);
      const h=terrainHeight(x,z);
      if(h>60) continue;
      if(getRegionAt(x,z)) continue;
      if(rr(0,1)<0.72)
        this.place(rocks,x,h+rr(0.3,1.4),z,rr(0,TAU),rr(0.8,3.2),rr(0.6,2.4),rr(0.8,3.2),
                   pick([0x4a4640,0x54504a,0x403c36]));
      else
        this.place(shrubs,x,h+rr(0.4,1.2),z,rr(0,TAU),rr(0.6,1.6),rr(1,3.2),rr(0.6,1.6),0x33291f);
    }
    this.finalizeProps();
  },

  /* ---- ember shrines (checkpoints) -------------------------------------- */
  buildShrines(){
    const spots=[
      {id:'s_village',   r:'village',   name:'Ashen Hearth',    x:-470, z:60},
      {id:'s_village2',  r:'village',   name:'Burnt Fields',    x:-380, z:-90},
      {id:'s_forest',    r:'forest',    name:'Root Shrine',     x:-190, z:-150},
      {id:'s_forest2',   r:'forest',    name:'Whisper Hollow',  x:-120, z:-280},
      {id:'s_mines',     r:'mines',     name:'Deepwatch',       x:40,   z:110},
      {id:'s_mines2',    r:'mines',     name:'Shaft Nine',      x:100,  z:200},
      {id:'s_caverns',   r:'caverns',   name:'Prism Rest',      x:-140, z:300},
      {id:'s_caverns2',  r:'caverns',   name:'Glowdeep',        x:-200, z:400},
      {id:'s_cathedral', r:'cathedral', name:'Nave of Ice',     x:200,  z:310},
      {id:'s_cathedral2',r:'cathedral', name:'Choir Vault',     x:140,  z:430},
      {id:'s_citadel',   r:'citadel',   name:'Cinder Gate',     x:420,  z:10},
      {id:'s_citadel2',  r:'citadel',   name:'Ash Walk',        x:350,  z:140},
      {id:'s_forge',     r:'sunforge',  name:'Forge Threshold', x:150,  z:20}
    ];
    const stoneMat=TEX.std(0x39332c,0.87,0.06,TEX.stone);
    const shp=new THREE.IcosahedronGeometry(0.5,1);
    const ringGeo=new THREE.RingGeometry(2.0,3.4,26);
    const n=spots.length;
    // one instanced batch per shrine part (base / column / bowl) + one for the
    // animated flames and one for the halo discs: 5 draw calls for all shrines.
    const bases=this.instanced(this.geo.cyl,stoneMat,n,true,true);
    const cols =this.instanced(this.geo.cyl,stoneMat,n,true,false);
    const bowls=this.instanced(this.geo.cyl,stoneMat,n,true,false);
    this.shrineFlames=this.instanced(shp,TEX.emissive(0xff8a3d,1.1),n,false,false);
    const haloMat=new THREE.MeshBasicMaterial({color:0xff8a3d,transparent:true,opacity:0.26,
      side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    const halos=new THREE.Mesh(ringGeo,haloMat); halos.rotation.x=-Math.PI/2;
    const haloM=new THREE.InstancedMesh(ringGeo,haloMat,n);
    haloM.count=n; this.group.add(haloM);
    for(let si=0;si<n;si++){
      const s=spots[si], h=terrainHeight(s.x,s.z);
      this.place(bases, s.x, h+0.55, s.z, 0, 3.2,1.1,3.2, 0x39332c);
      this.place(cols,  s.x, h+2.8,  s.z, 0, 0.85,3.6,0.85, 0x39332c);
      this.place(bowls, s.x, h+4.9,  s.z, 0, 1.5,0.9,1.5, 0x39332c);
      this.place(this.shrineFlames, s.x, h+5.6, s.z, 0, 1.05,1.47,1.05, 0xff8a3d);
      this.instUpdate({mesh:haloM}, si, s.x, h+0.06, s.z, 0, 1,1,1);
      const light=new THREE.PointLight(0xff8a3d, 1.2, 38, 2);
      light.position.set(s.x,h+5.7,s.z); this.group.add(light);
      this.addCollider(s.x,s.z,3.4,h+4.8,'shrine');   // full column height, so the camera avoids it
      this.shrines.push({id:s.id,name:s.name,region:s.r,x:s.x,z:s.z,y:h,
        flameIndex:si,light:light,lit:false});
    }
  },

  /* ---- chests and gatherable orbs --------------------------------------- */
  buildLoot(){
    const chestSpots=[
      {x:-500,z:-60},{x:-420,z:-140},{x:-250,z:-120},{x:-120,z:-160},{x:-60,z:-260},
      {x:20,z:200},{x:120,z:120},{x:-30,z:60},{x:-200,z:250},{x:-80,z:400},
      {x:180,z:420},{x:280,z:300},{x:360,z:20},{x:480,z:120},{x:200,z:-60},
      {x:100,z:-120},{x:-320,z:120},{x:320,z:340},{x:-260,z:60},{x:60,z:300},
      {x:420,z:200},{x:-140,z:140},{x:260,z:-140},{x:-60,z:-40},{x:520,z:-40},
      {x:-540,z:180},{x:-300,z:40},{x:440,z:-60},{x:230,z:180},{x:-220,z:120}
    ];
    const cbody=TEX.std(0x4a3a22,0.85,0.15,TEX.bark);
    const cband=TEX.std(0x8a6a2a,0.5,0.65);
    // Bodies and trims are instanced; only the animated lids stay individual
    // meshes (there are 30 of them, and each one rotates when opened).
    const nChest=chestSpots.length;
    const bodies=this.instanced(this.geo.box,cbody,nChest,true,true);
    const trims =this.instanced(this.geo.box,cband,nChest,true,false);
    const lids  =this.instanced(this.geo.box,cband,nChest,true,false);
    this.chestLids=lids;
    for(let i=0;i<nChest;i++){
      const p=chestSpots[i], h=terrainHeight(p.x,p.z);
      const ry=rr(0,TAU);
      this.place(bodies,p.x,h+0.6, p.z,ry,1.9,1.2,1.3,0x4a3a22);
      this.place(trims, p.x,h+0.75,p.z,ry,2.05,0.16,1.45,0x8a6a2a);
      this.place(lids,  p.x,h+1.35,p.z,ry,2.0,0.5,1.4,0x8a6a2a);
      this.addCollider(p.x,p.z,1.3,h+1.4,'chest');
      this.chests.push({id:'chest_'+i,x:p.x,z:p.z,y:h,ry:ry,lidIndex:i,
        opened:false,tier:Math.floor(i/9)});
    }
    const orbGeo=new THREE.IcosahedronGeometry(0.34,1);
    // Gatherables use emissive materials only — no per-orb lights, which
    // would otherwise add ~160 dynamic lights and destroy performance.
    // One instanced batch per tint (4 tints => 4 draw calls for all 160 orbs).
    const ORB_TINTS=[0xffc060,0x7fd8ff,0xb48cff,0x9fe07a];
    const orbBatches={};
    this.orbBatches=orbBatches;
    for(let ti=0;ti<ORB_TINTS.length;ti++){
      orbBatches[ORB_TINTS[ti]]=this.instanced(orbGeo,
        new THREE.MeshBasicMaterial({color:ORB_TINTS[ti],transparent:true,opacity:0.9,
          blending:THREE.AdditiveBlending,depthWrite:false}),40,false,false);
    }
    for(let i=0;i<160;i++){
      const R=pick(REGIONS), a=rr(0,TAU), d=rr(10,R.radius);
      const x=R.c.x+Math.cos(a)*d, z=R.c.z+Math.sin(a)*d, h=terrainHeight(x,z);
      const col=pick(ORB_TINTS);
      const rec=orbBatches[col];
      this.place(rec,x,h+1.1,z,0,1,1,1,col);
      this.lootOrbs.push({x:x,z:z,y:h+1.1,batch:col,index:rec.mesh.count-1,light:null,color:col,
        type:pick(['ember','ember','ore','frost','arcane','herb']),taken:false,ph:rr(0,TAU)});
    }
  },

  /* ---- boss arenas ------------------------------------------------------ */
  buildArenas(){
    // All 7 arenas share three instanced batches (posts / bridges / glow rings)
    // and one material per arena accent for the ring, so ring colours stay
    // reg-ish while still costing only one draw call per arena.
    const G=this.ensureGeo();
    const postGeo=new THREE.CylinderGeometry(0.9,1.3,5.4,6);
    const totalPosts=REGIONS.length*26;
    const postMats={}; const postByRegion={};
    for(let ri=0;ri<REGIONS.length;ri++){
      const R=REGIONS[ri];
      if(!postMats[R.rock]) postMats[R.rock]=TEX.std(R.rock,0.9,0.05,TEX.stone);
    }
    // one instanced batch per distinct post colour
    for(const col in postMats){
      postByRegion[col]=this.instanced(postGeo,postMats[col],REGIONS.length*26,true,true);
    }
    for(let ri=0;ri<REGIONS.length;ri++){
      const R=REGIONS[ri], a=R.arena, h=terrainHeight(a.x,a.z);
      const rec=postByRegion[R.rock];
      for(let i=0;i<26;i++){
        const ang=i/26*TAU;
        const px=a.x+Math.cos(ang)*a.r, pz=a.z+Math.sin(ang)*a.r, ph=terrainHeight(px,pz);
        this.place(rec,px,ph+2.4,pz,0,0.9,5.4,0.9,R.rock);
        this.addCollider(px,pz,1.2,ph+5.4,'arenapost');
      }
      const glow=new THREE.Mesh(new THREE.RingGeometry(a.r*0.72,a.r*0.78,60),
        new THREE.MeshBasicMaterial({color:R.acc[0],transparent:true,opacity:0.14,
          side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      glow.rotation.x=-Math.PI/2; glow.position.set(a.x,h+0.12,a.z);
      this.group.add(glow);
      this.arenas.push({region:R.id,x:a.x,z:a.z,r:a.r,y:h,glow:glow});
    }
  },

  /* ---- portal arches beside every shrine (unlocked travel markers) ------ */
  buildPortals(){
    const n=this.shrines.length;
    const stoneMat=TEX.emissive(0x9fd0ff,0.5,TEX.stone);
    // arches + gates are two instanced batches sharing one animated material,
    // so every portal pulses in unison for two draw calls total.
    const arches=this.instanced(this.geo.torus,stoneMat,n,true,true);
    this.portalGateMat=new THREE.MeshBasicMaterial({color:0x9fd0ff,transparent:true,opacity:0.16,
      side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    this.portalGates=new THREE.InstancedMesh(new THREE.PlaneGeometry(4.4,4.4),
      this.portalGateMat,n);
    this.portalGates.count=n;
    this.portalGates.frustumCulled=false;
    this.group.add(this.portalGates);
    for(let i=0;i<n;i++){
      const s=this.shrines[i];
      const gx=s.x+6, gz=s.z+6, h=terrainHeight(gx,gz);
      const archM=new THREE.Matrix4().compose(
        new THREE.Vector3(gx,h+0.2,gz), new THREE.Quaternion(), new THREE.Vector3(2.4,2.4,2.4));
      arches.mesh.setMatrixAt(i,archM); arches.mesh.count=n;
      archM.compose(new THREE.Vector3(gx,h+2.2,gz), new THREE.Quaternion(), new THREE.Vector3(1,1,1));
      this.portalGates.setMatrixAt(i,archM);
      this.portals.push({x:gx,z:gz,y:h,region:s.region,name:s.name});
    }
    arches.mesh.instanceMatrix.needsUpdate=true;
    this.portalGates.instanceMatrix.needsUpdate=true;
  },

  /* ---- readable lore stones --------------------------------------------- */
  buildLoreObjects(){
    const stones=[
      {x:-500,z:100,t:'First Ash'},{x:-300,z:-160,t:'Root Verse'},{x:60,z:230,t:"Foreman's Ledger"},
      {x:-180,z:360,t:'Prism Litany'},{x:250,z:330,t:'Frozen Prayer'},{x:430,z:130,t:'Cinder Edict'},
      {x:170,z:-30,t:'Forge Record'},{x:-140,z:-40,t:"Wayfarer's Note"},{x:340,z:-40,t:'Kingsroad Stone'},
      {x:520,z:200,t:'Siege Account'},{x:-60,z:180,t:"Miner's Grave"},{x:100,z:420,t:"Ice Sister's Vigil"}
    ];
    const mat=TEX.std(0x5a5348,0.9,0.05,TEX.stone);
    const n=stones.length;
    const slabs=this.instanced(this.geo.box,mat,n,true,true);
    const runeMat=new THREE.MeshBasicMaterial({color:0x9fd0ff,transparent:true,opacity:0.35,
      depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.loreRunes=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.0,1.8),runeMat,n);
    this.loreRunes.frustumCulled=false; this.group.add(this.loreRunes);
    for(let i=0;i<n;i++){
      const s=stones[i], h=terrainHeight(s.x,s.z), ry=rr(0,TAU);
      this.place(slabs,s.x,h+1.3,s.z,ry,1.5,2.6,0.4,0x5a5348);
      const m=new THREE.Matrix4().compose(new THREE.Vector3(s.x,h+1.4,s.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,0)), new THREE.Vector3(1,1,1));
      this.loreRunes.setMatrixAt(i,m);
      this.addCollider(s.x,s.z,0.8,h+2.6,'lore');
      this.loreObjs.push({id:'lore_'+i,x:s.x,z:s.z,y:h,title:s.t,runeIndex:i,read:false});
    }
    this.loreRunes.instanceMatrix.needsUpdate=true;
  },

  /* ---- per-frame ambience ----------------------------------------------- */
  update(dt,t){
    for(let i=0;i<this.lootOrbs.length;i++){
      const o=this.lootOrbs[i];
      if(o.taken) continue;
      // bob + spin the shared-orb instance in place
      const bob=Math.sin(t*2+o.ph)*0.22;
      this.instUpdateEuler(this.orbBatches[o.batch], o.index,
        o.x, o.y+bob, o.z, t*1.4+i, t*0.7, 1,1,1);
    }
    for(let i=0;i<this.shrines.length;i++){
      const s=this.shrines[i];
      const f=0.85+Math.sin(t*3.1+i)*0.15;
      // the animated flame is one instance inside the shared shrine batch
      this.instUpdate(this.shrineFlames, s.flameIndex,
        s.x, s.y+5.6, s.z, 0, 1.05*f, 1.47*f, 1.05*f);
      s.light.intensity=(s.lit?1.7:0.9)*f;
    }
    for(let i=0;i<this.arenas.length;i++)
      this.arenas[i].glow.material.opacity=0.10+0.09*Math.sin(t*1.3+i);
    // all portal gates share one material, so a single opacity write animates them
    if(this.portalGateMat) this.portalGateMat.opacity=0.12+0.07*Math.sin(t*2);
    if(this.villageFire) this.villageFire.scale.setScalar(0.9+Math.sin(t*2.4)*0.12);
    // Distance-based light culling: shrine lights are the only per-instance
    // lights left in the world, so switching them off when far away keeps the
    // per-frame light count low without ever being visible to the player.
    const px=Player.pos.x, pz=Player.pos.z;
    for(let i=0;i<this.shrines.length;i++){
      const s=this.shrines[i];
      const near=(s.x-px)*(s.x-px)+(s.z-pz)*(s.z-pz)<170*170;
      if(s.light.visible!==near) s.light.visible=near;
    }
    if(this.anvilGlow){
      this.anvilGlow.visible=Math.abs(this.anvilGlow.position.x-px)<220&&Math.abs(this.anvilGlow.position.z-pz)<220;
    }
    this.flushInstanced();
  }
};
