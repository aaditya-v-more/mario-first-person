import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {newPlayer,stepPlayer,JUMP_SPEED,HEIGHT,type Box} from '../app/game/physics';
import {GameEngine} from '../app/game/engine';
import {makeWorld} from '../app/game/world';
import {enhanceMaterials,graphicsPixelRatio} from '../app/game/graphics';
const ground:Box={x:0,y:-1,z:0,w:30,h:2,d:30};
const step=(p:ReturnType<typeof newPlayer>,boxes:Box[],seconds:number)=>{for(let t=0;t<seconds;t+=1/120)stepPlayer(p,boxes,1/120);};
test('standing player stays grounded and lands after a full jump',()=>{
  const p=newPlayer();step(p,[ground],2);assert.equal(p.y,0);assert.equal(p.grounded,true);
  p.vy=JUMP_SPEED;p.grounded=false;step(p,[ground],.45);assert.ok(p.y>3.7&&p.y<4);step(p,[ground],1);assert.equal(p.y,0);assert.equal(p.vy,0);
});
test('player cannot pass through pipes or the underside of blocks',()=>{
  const p={...newPlayer(),z:0,vx:7};const wall={x:2,y:1.5,z:0,w:2,h:3,d:2};step(p,[ground,wall],1);assert.ok(p.x<=.660001);
  const q={...newPlayer(),x:0,z:0,vy:JUMP_SPEED,grounded:false};const block={x:0,y:3.05,z:0,w:1.35,h:1.35,d:1.35};let hits=0;
  for(let i=0;i<80;i++)stepPlayer(q,[ground,block],1/120,()=>hits++);
  assert.equal(hits,1);assert.ok(q.y+HEIGHT<block.y-block.h/2);
});
test('a normal forward jump clears the four-unit course gaps',()=>{
  const p={...newPlayer(),z:-35.2,vz:-7.1,vy:JUMP_SPEED,grounded:false};
  const a={x:0,y:-1,z:-9,w:26,h:2,d:56},b={x:2,y:-1,z:-65,w:22,h:2,d:48};
  step(p,[a,b],1.25);assert.ok(p.z< -41);assert.equal(p.grounded,true);assert.equal(p.y,0);
});
const fakeContext={fillStyle:'',font:'',textAlign:'',fillRect(){},fillText(){}};
Object.assign(globalThis,{document:{createElement(){return {width:128,height:128,getContext(){return fakeContext;}};},pointerLockElement:null}});
function game(){
  const scene=new THREE.Scene(),world=makeWorld(scene);
  return Object.assign(Object.create(GameEngine.prototype) as GameEngine,{scene,world,renderer:{domElement:{}},player:newPlayer(),state:{status:'playing',coins:0,total:world.coins.length+world.questions.length,lives:3,time:180,score:0,progress:0,notice:''},remaining:180,keys:new Set<string>(),touch:{x:0,y:0},yaw:0,pitch:0,jumpBuffer:0,coyote:.1,invulnerable:0,checkpoint:false,noticeTimer:0,particles:[],spentBlockMaterial:new THREE.MeshStandardMaterial(),audio:{async activate(){},coin(){},jump(){},stomp(){},hurt(){},win(){},tone(){}},onChange(){}});
}
test('coin collision collects each coin exactly once',()=>{
  const g=game();const c=g.world.coins[0];g.player.x=c.x;g.player.z=c.z;g.simulate(1/120);g.simulate(1/120);assert.equal(g.state.coins,1);assert.equal(g.state.score,100);assert.equal(c.taken,true);
});
test('a question block pays out once and becomes a used block',()=>{
  const g=game();const b=g.world.boxes.find(b=>b.kind==='question')!;g.bump(b);g.bump(b);assert.equal(g.state.coins,1);assert.equal(g.world.questions[b.id!].used,true);assert.equal(g.world.questions[b.id!].mesh.material,g.spentBlockMaterial);
});
test('descending onto a Goomba stomps it; walking into one costs a life',()=>{
  const g=game();const e=g.world.enemies[0];g.player.x=e.x;g.player.z=e.z;g.player.y=1.08;g.player.vy=-7;
  for(let i=0;i<4;i++)g.simulate(1/120);assert.equal(e.alive,false);assert.equal(g.state.lives,3);assert.ok(g.player.vy>0);assert.equal(g.state.score,200);
  const h=game();const f=h.world.enemies[0];h.player.x=f.x;h.player.z=f.z;h.simulate(1/120);assert.equal(h.state.lives,2);assert.equal(h.player.z,13);
});
test('checkpoint is retained after falling and time-out renews the timer',()=>{
  const g=game();g.player.z=-66;g.simulate(1/120);assert.equal(g.checkpoint,true);g.player.y=-11;g.simulate(1/120);assert.equal(g.player.z,-65);assert.equal(g.state.lives,2);
  g.remaining=.001;g.simulate(1/120);assert.equal(g.remaining,180);assert.equal(g.state.lives,1);
});
test('losing the last life ends play and reaching the flag wins with bonus',()=>{
  const g=game();g.state.lives=1;g.lose('fall');assert.equal(g.state.status,'over');assert.equal(g.state.lives,0);
  const h=game();h.player.x=1;h.player.z=-121;h.simulate(1/120);assert.equal(h.state.status,'won');assert.ok(h.state.score>=2700);
});

test('restart resets the whole course, including used blocks and defeated enemies',()=>{
  const g=game();g.world.coins[0].taken=true;g.world.coins[0].mesh.visible=false;g.world.enemies[0].alive=false;
  g.bump(g.world.boxes.find(b=>b.kind==='question')!);g.state.lives=1;g.remaining=5;g.checkpoint=true;g.restart(false);
  assert.equal(g.state.status,'playing');assert.equal(g.state.coins,0);assert.equal(g.state.lives,3);assert.equal(g.remaining,180);assert.equal(g.player.z,13);assert.equal(g.checkpoint,false);
  assert.ok(g.world.coins.every(c=>!c.taken&&c.mesh.visible));assert.ok(g.world.enemies.every(e=>e.alive));assert.ok(g.world.questions.every(q=>!q.used&&q.mesh.material===q.originalMaterial));
});

test('jump height is sufficient to land on floating blocks and the tallest pipe',()=>{
  for(const height of [3.725,3.5]){
    const p={...newPlayer(),x:0,z:0,vx:7.1,vy:JUMP_SPEED,grounded:false};
    const platform={x:4,y:height/2,z:0,w:2,h:height,d:2};let landed=false;
    for(let i=0;i<100;i++){stepPlayer(p,[ground,platform],1/120);if(p.grounded&&p.y===height){landed=true;break;}}
    assert.ok(landed,`Could not reach a ${height}-unit platform`);
  }
});

test('RTX material changes restore exactly without undoing collected coins or used blocks',()=>{
  const g=game();
  const serialize=(m:THREE.MeshStandardMaterial)=>JSON.stringify({color:m.color,roughness:m.roughness,metalness:m.metalness,envMapIntensity:m.envMapIntensity,emissive:m.emissive,emissiveIntensity:m.emissiveIntensity,map:m.map?.uuid});
  const materials=new Map<THREE.MeshStandardMaterial,string>();
  g.scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial)materials.set(m,serialize(m));});
  const restore=enhanceMaterials(g.scene);
  const gold=[...materials.keys()].find(m=>m.color.getHexString()==='ffca2d')!;
  assert.equal(gold.metalness,.82);
  const c=g.world.coins[0];g.player.x=c.x;g.player.z=c.z;g.simulate(1/120);
  g.bump(g.world.boxes.find(b=>b.kind==='question')!);
  const position={...g.player},state={...g.state};
  restore();
  for(const [m,original] of materials)assert.equal(serialize(m),original);
  assert.deepEqual(g.player,position);assert.deepEqual(g.state,state);
  assert.equal(c.taken,true);assert.equal(c.mesh.visible,false);
  assert.equal(g.world.questions[0].mesh.material,g.spentBlockMaterial);
  // A second enable/disable cycle must not accumulate material changes.
  enhanceMaterials(g.scene)();
  for(const [m,original] of materials)assert.equal(serialize(m),original);
});

test('RTX resolution respects device density and the two-million-pixel budget',()=>{
  for(const [w,h,dpr] of [[390,844,3],[1920,1080,2],[3840,2160,2],[1280,720,1]]){
    const ratio=graphicsPixelRatio(w,h,dpr);
    assert.ok(ratio<=dpr&&ratio<=1.5);
    assert.ok(w*h*ratio**2<=2_000_001);
  }
  assert.equal(graphicsPixelRatio(1280,720,1),1);
});

test('turning RTX off disposes effects without resetting a paused course',async()=>{
  const g=game();let disposed=0;
  Object.assign(g,{graphicsRequest:0,rtx:{dispose(){disposed++;}}});
  g.state.status='paused';g.state.coins=7;g.state.lives=2;g.remaining=93;g.player.z=-65;g.checkpoint=true;
  const state={...g.state},player={...g.player};
  assert.equal(await g.setRtx(false),false);assert.equal(disposed,1);assert.equal(g.rtx,null);
  assert.deepEqual(g.state,state);assert.deepEqual(g.player,player);assert.equal(g.remaining,93);assert.equal(g.checkpoint,true);
});

test('a cancelled or destroyed RTX request never initializes the graphics pipeline',async()=>{
  const g=game();Object.assign(g,{graphicsRequest:0,rtx:null,running:true});
  const pending=g.setRtx(true);await g.setRtx(false);
  assert.equal(await pending,false);assert.equal(g.rtx,null);assert.equal(g.state.notice,'');
  const destroyed=g.setRtx(true);g.running=false;
  assert.equal(await destroyed,false);assert.equal(g.rtx,null);assert.equal(g.state.notice,'');
});

test('unsupported enhanced graphics retain the original scene and playable course',async()=>{
  const g=game();Object.assign(g,{graphicsRequest:0,rtx:null,running:true});
  Object.assign(g.renderer,{extensions:{has:()=>false}});
  const player={...g.player},background=g.scene.background,materials=g.world.questions.map(q=>q.mesh.material);
  assert.equal(await g.setRtx(true),false);assert.equal(g.rtx,null);
  assert.deepEqual(g.player,player);assert.equal(g.state.status,'playing');
  assert.equal(g.scene.background,background);
  assert.deepEqual(g.world.questions.map(q=>q.mesh.material),materials);
  assert.match(g.state.notice,/Classic graphics are still on/);
});
