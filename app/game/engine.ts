import * as THREE from 'three';
import { makeWorld, type World } from './world';
import { newPlayer, stepPlayer, JUMP_SPEED, HEIGHT, type Box } from './physics';
import { GameAudio } from './audio';
import type { RtxGraphics } from './rtx';
export type GameState='ready'|'playing'|'paused'|'won'|'over';
export type Snapshot={status:GameState;coins:number;total:number;lives:number;time:number;score:number;progress:number;notice:string};
type Particle={mesh:THREE.Mesh;velocity:THREE.Vector3;life:number};
export class GameEngine {
  renderer:THREE.WebGLRenderer;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(68,1,.05,260);
  world:World;
  sun:THREE.DirectionalLight;
  hemisphere:THREE.HemisphereLight;
  rtx:RtxGraphics|null=null;
  private graphicsRequest=0;
  player=newPlayer();
  audio=new GameAudio();
  state:Snapshot={status:'ready',coins:0,total:32,lives:3,time:180,score:0,progress:0,notice:''};
  raf=0;running=true;elapsed=0;lastFrame=0;accumulator=0;emitTime=0;remaining=180;
  yaw=0;pitch=0;keys=new Set<string>();touch={x:0,y:0};drag: {id:number;x:number;y:number}|null=null;
  jumpBuffer=0;coyote=.1;invulnerable=0;noticeTimer=0;checkpoint=false;pointerLocked=false;
  particles:Particle[]=[];
  spentBlockMaterial=new THREE.MeshStandardMaterial({color:'#bba079',roughness:.9});
  hands=new THREE.Group();
  leftHand=new THREE.Group();rightHand=new THREE.Group();
  reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(public container:HTMLElement,public onChange:(s:Snapshot)=>void){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.setClearColor('#91d8ed');this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.renderer.domElement.setAttribute('aria-label','Game view. Use WASD to move, mouse or arrow keys to look, and Space to jump.');
    container.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color('#91d8ed');this.scene.fog=new THREE.Fog('#b6e4e7',55,185);
    this.hemisphere=new THREE.HemisphereLight('#e8faff','#658342',2.7);this.scene.add(this.hemisphere);
    this.sun=new THREE.DirectionalLight('#fff2cc',3.1);this.sun.position.set(-20,35,18);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-28,right:28,top:32,bottom:-32,far:110});this.sun.shadow.normalBias=.035;
    this.scene.add(this.sun,this.sun.target);
    this.world=makeWorld(this.scene);this.state.total=this.world.coins.length+this.world.questions.length;
    this.makeHands();this.scene.add(this.camera);this.camera.add(this.hands);this.hands.visible=false;
    this.resize();this.bind();this.emit();this.raf=requestAnimationFrame(this.loop);
  }
  makeHands(){
    const sleeve=new THREE.MeshStandardMaterial({color:'#ed4436',roughness:.8});const glove=new THREE.MeshStandardMaterial({color:'#fffbea',roughness:.65});
    for(const [g,side] of [[this.leftHand,-1],[this.rightHand,1]] as const){
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.075,.12,.48,12),sleeve);arm.rotation.x=-.6;arm.position.set(0,-.13,.12);g.add(arm);
      const palm=new THREE.Mesh(new THREE.SphereGeometry(.115,14,10),glove);palm.scale.set(1,1.08,1.15);g.add(palm);
      const thumb=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),glove);thumb.position.set(-side*.08,.0,-.04);g.add(thumb);
      g.position.set(side*.31,-.32,-.54);g.rotation.z=-side*.18;this.hands.add(g);
    }
  }
  bind(){
    window.addEventListener('resize',this.resize);document.addEventListener('keydown',this.keyDown);document.addEventListener('keyup',this.keyUp);document.addEventListener('mousemove',this.mouseMove);document.addEventListener('pointerlockchange',this.lockChange);window.addEventListener('blur',this.onBlur);document.addEventListener('visibilitychange',this.onVisibility);
    const c=this.renderer.domElement;c.addEventListener('pointerdown',this.pointerDown);c.addEventListener('pointermove',this.pointerMove);c.addEventListener('pointerup',this.pointerUp);c.addEventListener('pointercancel',this.pointerUp);c.addEventListener('webglcontextlost',this.contextLost);
  }
  resize=()=>{const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.rtx?.resize(w,h);};
  async setRtx(enabled:boolean):Promise<boolean>{
    const request=++this.graphicsRequest;
    if(!enabled){this.rtx?.dispose();this.rtx=null;return false;}
    if(this.rtx)return true;
    try{
      const {RtxGraphics}=await import('./rtx');
      if(!this.running||request!==this.graphicsRequest)return false;
      const graphics=new RtxGraphics(this.renderer,this.scene,this.camera,this.sun,this.hemisphere);
      graphics.enable(this.container.clientWidth,this.container.clientHeight);
      this.rtx=graphics;
      // Shader setup time must not advance the gameplay clock or physics.
      this.lastFrame=performance.now();
      return true;
    }catch{
      if(this.running&&request===this.graphicsRequest)this.notify('RTX is unavailable on this device. Classic graphics are still on.',5);
      return false;
    }
  }
  emit(){this.state.time=Math.ceil(this.remaining);this.state.progress=THREE.MathUtils.clamp((13-this.player.z)/135,0,1);this.onChange({...this.state});}
  notify(text:string,duration=2.5){this.state.notice=text;this.noticeTimer=duration;this.emit();}
  start(requestLock=true){
    if(this.state.status==='won'||this.state.status==='over')return;
    const first=this.state.status==='ready';this.state.status='playing';this.keys.clear();this.touch={x:0,y:0};this.accumulator=0;
    void this.audio.activate();this.emit();
    if(first)this.notify('Follow the coins. Jump on Goombas to stomp them.',4.5);
    if(requestLock&&!window.matchMedia('(pointer: coarse)').matches){
      try{const lock=this.renderer.domElement.requestPointerLock?.();if(lock&&typeof lock.catch==='function')void lock.catch(()=>{if(this.state.status==='playing')this.notify('Drag to look, or use ← → to turn.',4);});}catch{this.notify('Drag to look, or use ← → to turn.',4);}
    }
  }
  pause(){if(this.state.status!=='playing')return;this.state.status='paused';this.keys.clear();this.touch={x:0,y:0};this.jumpBuffer=0;this.drag=null;if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.emit();}
  restart(requestLock=true){
    this.player=newPlayer();this.yaw=0;this.pitch=0;this.remaining=180;this.checkpoint=false;this.invulnerable=0;this.jumpBuffer=0;this.coyote=.1;this.audio.noteIndex=0;
    this.state={status:'ready',coins:0,total:this.state.total,lives:3,time:180,score:0,progress:0,notice:''};
    this.world.coins.forEach(c=>{c.taken=false;c.mesh.visible=true;});
    this.world.enemies.forEach(e=>{e.alive=true;e.x=e.home;e.direction=1;e.stompTime=0;e.mesh.visible=true;e.mesh.scale.set(1,1,1);});
    this.world.questions.forEach(q=>{q.used=false;q.bump=0;q.mesh.position.y=q.baseY;q.coin.visible=false;q.mesh.material=q.originalMaterial;});
    this.world.flagGroup.position.y=9.5;this.clearParticles();this.start(requestLock);
  }
  setMuted(muted:boolean){this.audio.muted=muted;}
  jump(){if(this.state.status==='playing')this.jumpBuffer=.15;}
  setTouch(x:number,y:number){const length=Math.max(1,Math.hypot(x,y));this.touch={x:x/length,y:y/length};}
  look(x:number,y:number){if(this.state.status!=='playing')return;this.yaw-=x*.0024;this.pitch=THREE.MathUtils.clamp(this.pitch-y*.0024,-1.38,1.38);}
  keyDown=(e:KeyboardEvent)=>{
    if(e.code==='Escape'||e.code==='KeyP'){if(this.state.status==='playing'){e.preventDefault();this.pause();}return;}
    if(this.state.status!=='playing')return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
    this.keys.add(e.code);if(e.code==='Space'&&!e.repeat)this.jump();
  };
  keyUp=(e:KeyboardEvent)=>{this.keys.delete(e.code);};
  mouseMove=(e:MouseEvent)=>{if(document.pointerLockElement===this.renderer.domElement)this.look(e.movementX,e.movementY);};
  lockChange=()=>{const locked=document.pointerLockElement===this.renderer.domElement;if(this.pointerLocked&&!locked&&this.state.status==='playing')this.pause();this.pointerLocked=locked;};
  pointerDown=(e:PointerEvent)=>{if(this.state.status!=='playing'||document.pointerLockElement===this.renderer.domElement)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.renderer.domElement.setPointerCapture(e.pointerId);};
  pointerMove=(e:PointerEvent)=>{if(this.drag?.id!==e.pointerId)return;this.look((e.clientX-this.drag.x)*1.6,(e.clientY-this.drag.y)*1.6);this.drag.x=e.clientX;this.drag.y=e.clientY;};
  pointerUp=(e:PointerEvent)=>{if(this.drag?.id===e.pointerId)this.drag=null;};
  onBlur=()=>{this.pause();};
  onVisibility=()=>{if(document.hidden)this.pause();};
  contextLost=(event:Event)=>{event.preventDefault();this.pause();this.notify('Graphics were interrupted. Reload the page to continue.',999);};
  bump(b:Box){
    if(b.kind!=='question'||b.id===undefined)return;
    const q=this.world.questions[b.id];if(q.used)return;q.used=true;q.mesh.material=this.spentBlockMaterial;q.bump=.34;q.coin.visible=true;q.coin.position.set(b.x,b.y+1.2,b.z);this.collect();
  };
  collect(){this.state.coins++;this.state.score+=100;this.audio.coin();this.emit();}
  lose(reason:'fall'|'goomba'|'time'){
    if(this.invulnerable>0&&reason==='goomba')return;
    this.state.lives--;this.audio.hurt();this.invulnerable=2;this.keys.clear();this.touch={x:0,y:0};
    if(this.state.lives<=0){this.state.status='over';this.state.notice='';if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();this.emit();return;}
    this.player=this.checkpoint?{...newPlayer(),x:2,z:-65}:newPlayer();this.yaw=0;this.pitch=0;this.jumpBuffer=0;
    if(reason==='time')this.remaining=180;
    this.notify(reason==='goomba'?'Ouch! Land on top of Goombas.':reason==='fall'?'Mind the gap! Sprint + jump to cross.':'Time’s up! Make this life count.',3);
  }
  win(){
    if(this.state.status!=='playing')return;this.state.status='won';this.state.score+=Math.ceil(this.remaining)*10+1000;this.state.notice='';this.audio.win();
    if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();
    for(let i=0;i<55;i++)this.burst(this.player.x,this.player.y+2,this.player.z-4,1);this.emit();
  }
  burst(x:number,y:number,z:number,count=6){
    const colors=['#ffca32','#f85545','#f4fcdb','#79da63'];
    for(let i=0;i<count;i++){
      const m=new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.035),new THREE.MeshStandardMaterial({color:colors[i%4]}));m.position.set(x,y,z);this.scene.add(m);
      this.particles.push({mesh:m,velocity:new THREE.Vector3((Math.random()-.5)*5,2+Math.random()*5,(Math.random()-.5)*5),life:1+Math.random()*1.2});
    }
  }
  clearParticles(){this.particles.forEach(p=>{this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();});this.particles=[];}
  simulate(dt:number){
    const p=this.player;this.remaining=Math.max(0,this.remaining-dt);this.invulnerable=Math.max(0,this.invulnerable-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    if(p.grounded)this.coyote=.1;else this.coyote=Math.max(0,this.coyote-dt);
    if(this.jumpBuffer>0&&this.coyote>0){p.vy=JUMP_SPEED;p.grounded=false;this.coyote=0;this.jumpBuffer=0;this.audio.jump();}
    if(this.keys.has('ArrowLeft'))this.yaw+=1.8*dt;if(this.keys.has('ArrowRight'))this.yaw-=1.8*dt;
    let forward=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-this.touch.y;
    let strafe=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0)+this.touch.x;
    const length=Math.max(1,Math.hypot(forward,strafe));forward/=length;strafe/=length;
    const speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?10.8:7.1;
    const targetX=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*strafe)*speed,targetZ=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*strafe)*speed;
    const smoothing=1-Math.exp(-(p.grounded?20:9)*dt);p.vx=THREE.MathUtils.lerp(p.vx,targetX,smoothing);p.vz=THREE.MathUtils.lerp(p.vz,targetZ,smoothing);
    const oldY=p.y;stepPlayer(p,this.world.boxes,dt,b=>this.bump(b));
    if(p.y < -10){this.lose('fall');return;}if(this.remaining<=0){this.lose('time');return;}
    for(const coin of this.world.coins){
      if(coin.taken)continue;
      if(Math.hypot(p.x-coin.x,p.z-coin.z)<.78&&p.y+HEIGHT>coin.y-.38&&p.y<coin.y+.38){coin.taken=true;coin.mesh.visible=false;this.collect();this.burst(coin.x,coin.y,coin.z,5);}
    }
    for(const enemy of this.world.enemies){
      if(!enemy.alive)continue;
      enemy.x+=enemy.direction*1.05*dt;if(Math.abs(enemy.x-enemy.home)>enemy.range)enemy.direction*=-1;
      if(Math.hypot(p.x-enemy.x,p.z-enemy.z)<.87&&p.y<1.05&&p.y+HEIGHT>.2){
        if(p.vy<0&&oldY>=.7){enemy.alive=false;enemy.stompTime=.35;p.y=1.02;p.vy=9;this.state.score+=200;this.audio.stomp();this.burst(enemy.x,.7,enemy.z);this.notify('+200 · Nice stomp!',1.15);}
        else if(this.invulnerable<=0){this.lose('goomba');return;}
      }
    }
    if(!this.checkpoint&&p.z< -63&&p.z> -86&&p.grounded){this.checkpoint=true;this.notify('Checkpoint! You’re halfway there.',2.5);this.audio.tone(784,.2,'triangle',.08);}
    if(Math.hypot(p.x,p.z+122)<1.7&&p.y<6)this.win();
  }
  animate(dt:number){
    this.elapsed+=dt;
    for(const [i,c] of this.world.coins.entries())if(!c.taken){c.mesh.rotation.y=this.elapsed*1.7+i*.2;c.mesh.position.y=c.y+Math.sin(this.elapsed*2.4+i)*.075;}
    for(const q of this.world.questions){if(q.bump>0){q.bump-=dt;q.mesh.position.y=q.baseY+Math.sin(Math.max(0,q.bump)/.34*Math.PI)*.22;q.coin.position.y+=dt*3;q.coin.rotation.y+=dt*7;if(q.bump<=0){q.coin.visible=false;q.mesh.position.y=q.baseY;}}}
    for(const e of this.world.enemies){e.mesh.position.set(e.x,e.y,e.z);if(e.alive){e.mesh.rotation.z=Math.sin(this.elapsed*7+e.z)*.06;e.mesh.rotation.y=.15*e.direction;}else if(e.stompTime>0){e.stompTime-=dt;e.mesh.scale.y=.22;if(e.stompTime<=0)e.mesh.visible=false;}}
    this.world.clouds.forEach((c,i)=>{if(!this.reducedMotion)c.position.x+=Math.sin(i+1)*dt*.16;});
    this.world.flag.rotation.y=Math.sin(this.elapsed*2)*.15;
    if(this.state.status==='won')this.world.flagGroup.position.y=THREE.MathUtils.lerp(this.world.flagGroup.position.y,2,dt*.8);
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.velocity.y-=dt*7;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=dt*4;p.mesh.rotation.z+=dt*3;if(p.life<=0){this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();this.particles.splice(i,1);}}
  }
  loop=(now:number)=>{
    if(!this.running)return;this.raf=requestAnimationFrame(this.loop);const dt=this.lastFrame?Math.min((now-this.lastFrame)/1000,.08):1/60;this.lastFrame=now;
    const playing=this.state.status==='playing';
    if(playing){
      this.accumulator+=dt;
      while(this.accumulator>=1/120){this.simulate(1/120);this.accumulator-=1/120;if(this.state.status!=='playing')break;}
      this.audio.music(dt);
      if(this.noticeTimer>0){this.noticeTimer-=dt;if(this.noticeTimer<=0){this.state.notice='';this.emit();}}
    }
    if(this.state.status!=='paused'&&this.state.status!=='over')this.animate(dt);
    if(this.state.status==='ready'){
      this.camera.position.set(17+(this.reducedMotion?0:Math.sin(this.elapsed*.08)*1.3),11.5,24);this.camera.lookAt(-1,1,-15);this.hands.visible=false;
    }else{
      const speed=Math.hypot(this.player.vx,this.player.vz);const bob=playing&&this.player.grounded&&!this.reducedMotion?Math.sin(this.elapsed*12)*Math.min(speed/160,.045):0;
      this.camera.position.set(this.player.x,this.player.y+HEIGHT-.12+bob,this.player.z);this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);
      this.hands.visible=playing&&(this.invulnerable<=0||Math.floor(this.invulnerable*10)%2===0);
      this.leftHand.position.y=-.34+Math.sin(this.elapsed*11)*Math.min(speed*.005,.04);this.rightHand.position.y=-.34-Math.sin(this.elapsed*11)*Math.min(speed*.005,.04);
      const fov=playing&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'))?74:68;this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov,dt*4);this.camera.updateProjectionMatrix();
      this.sun.position.set(this.player.x-20,35,this.player.z+18);this.sun.target.position.set(this.player.x,0,this.player.z-5);
    }
    this.emitTime+=dt;if(playing&&this.emitTime>.15){this.emitTime=0;this.emit();}
    if(this.rtx)this.rtx.render();else this.renderer.render(this.scene,this.camera);
  };
  destroy(){
    this.running=false;cancelAnimationFrame(this.raf);if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();
    this.graphicsRequest++;this.rtx?.dispose();this.rtx=null;
    window.removeEventListener('resize',this.resize);document.removeEventListener('keydown',this.keyDown);document.removeEventListener('keyup',this.keyUp);document.removeEventListener('mousemove',this.mouseMove);document.removeEventListener('pointerlockchange',this.lockChange);window.removeEventListener('blur',this.onBlur);document.removeEventListener('visibilitychange',this.onVisibility);
    const c=this.renderer.domElement;c.removeEventListener('pointerdown',this.pointerDown);c.removeEventListener('pointermove',this.pointerMove);c.removeEventListener('pointerup',this.pointerUp);c.removeEventListener('pointercancel',this.pointerUp);c.removeEventListener('webglcontextlost',this.contextLost);
    this.audio.destroy();this.clearParticles();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
    materials.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});m.dispose();});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());this.spentBlockMaterial.dispose();this.renderer.dispose();c.remove();
  }
}
