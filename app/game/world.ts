import * as THREE from 'three';
import type { Box } from './physics';
export type Coin = { mesh: THREE.Group; x:number; y:number; z:number; taken:boolean };
export type Enemy = { mesh:THREE.Group; x:number; y:number; z:number; home:number; range:number; direction:number; alive:boolean; stompTime:number };
export type Question = { mesh:THREE.Mesh; used:boolean; baseY:number; bump:number; coin:THREE.Group; originalMaterial:THREE.Material };
export type World = { boxes:Box[]; coins:Coin[]; enemies:Enemy[]; questions:Question[]; clouds:THREE.Group[]; flag:THREE.Mesh; flagGroup:THREE.Group; decorations:THREE.Group };
const mat = (color:THREE.ColorRepresentation, roughness=.75) => new THREE.MeshStandardMaterial({color,roughness});
export function makeWorld(scene:THREE.Scene):World {
  const boxes:Box[]=[], coins:Coin[]=[], enemies:Enemy[]=[], questions:Question[]=[], clouds:THREE.Group[]=[];
  const grass=mat('#69bf38'), edge=mat('#86d747'), green=mat('#159341',.35), rim=mat('#24bf55',.3), darkGreen=mat('#0a5735'), brown=mat('#a55730'), cream=mat('#fff7db'), gold=mat('#ffca2d',.28), white=mat('#fffdfa');
  const decorations=new THREE.Group(); scene.add(decorations);
  const cubeGeo=new THREE.BoxGeometry(1,1,1), sphereGeo=new THREE.SphereGeometry(1,16,12);
  function cube(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material, parent:THREE.Object3D=scene,solid=false) {
    const mesh=new THREE.Mesh(cubeGeo,m); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh);
    if(solid) boxes.push({x,y,z,w,h,d}); return mesh;
  }
  function ball(x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material,parent:THREE.Object3D=scene) {
    const mesh=new THREE.Mesh(sphereGeo,m); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  const soilCanvas=document.createElement('canvas'); soilCanvas.width=128;soilCanvas.height=128;
  const ctx=soilCanvas.getContext('2d')!; ctx.fillStyle='#ba7546';ctx.fillRect(0,0,128,128);
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){ctx.fillStyle=(i+j)%2?'#c98750':'#ab683c';ctx.fillRect(i*32+2,j*32+2,28,28);ctx.fillStyle='#d69a60';ctx.fillRect(i*32+3,j*32+3,25,3);}
  const soilTexture=new THREE.CanvasTexture(soilCanvas);soilTexture.colorSpace=THREE.SRGBColorSpace;soilTexture.wrapS=soilTexture.wrapT=THREE.RepeatWrapping;soilTexture.repeat.set(10,2);
  const soil=new THREE.MeshStandardMaterial({map:soilTexture,roughness:1});
  function island(x:number,z:number,w:number,d:number) {
    cube(x,-2.6,z,w,5,d,soil,scene,true);cube(x,-.13,z,w+.12,.26,d+.12,grass,scene,true);
    cube(x,-.4,z,w+.16,.35,d+.16,edge);
    // Mown grass tiles keep the terrain legible from the first-person camera.
    const tiles:THREE.Matrix4[]=[];
    for(let iz=0;iz<d/2;iz++)for(let ix=0;ix<w/2;ix++)if((ix+iz)%2===0)tiles.push(new THREE.Matrix4().compose(new THREE.Vector3(x-w/2+1+ix*2,.005,z-d/2+1+iz*2),new THREE.Quaternion(),new THREE.Vector3(1.97,.012,1.97)));
    const lawn=new THREE.InstancedMesh(cubeGeo,mat('#71c43e'),tiles.length);tiles.forEach((m,i)=>lawn.setMatrixAt(i,m));lawn.receiveShadow=true;scene.add(lawn);
  }
  island(0,-9,26,56);island(2,-65,22,48);island(-1,-112,26,38);
  function pipe(x:number,z:number,h:number) {
    const body=new THREE.Mesh(new THREE.CylinderGeometry(1,1,h,32),green); body.position.set(x,h/2,z);body.castShadow=true;body.receiveShadow=true;scene.add(body);
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,.48,32),rim);collar.position.set(x,h-.08,z);collar.castShadow=true;scene.add(collar);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(.91,32),darkGreen);hole.rotation.x=-Math.PI/2;hole.position.set(x,h+.165,z);scene.add(hole);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.045,.15,8,32),rim);ring.rotation.x=Math.PI/2;ring.position.set(x,h+.16,z);scene.add(ring);
    boxes.push({x,y:(h+.2)/2,z,w:2.25,h:h+.2,d:2.25,kind:'pipe'});
  }
  pipe(-6,3,2.7);pipe(7,-13,3.2);pipe(-8,-26,2.2);pipe(8,-54,2.8);pipe(-5,-71,3.3);pipe(8,-104,2.4);
  function makeCoin(x:number,y:number,z:number,tracked=true) {
    const group=new THREE.Group();group.position.set(x,y,z);
    const outer=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.105,20),gold);outer.rotation.x=Math.PI/2;outer.castShadow=true;group.add(outer);
    const inner=new THREE.Mesh(new THREE.TorusGeometry(.255,.024,6,20),mat('#ffe483',.35));inner.position.z=.065;group.add(inner);
    cube(0,0,.07,.055,.32,.02,mat('#e39c09'),group);
    scene.add(group);if(tracked)coins.push({mesh:group,x,y,z,taken:false});return group;
  }
  for(const z of [8,5,2,-2,-10,-14,-18,-22,-29,-33,-43,-47,-51,-57,-61,-65,-70,-77,-82,-86,-96,-100,-104,-108,-113,-117])makeCoin(Math.sin(z*.14)*3,1.15,z);
  for(let i=0;i<3;i++)makeCoin(3.6+i*1.4,3.8,-21);
  const blockCanvas=document.createElement('canvas');blockCanvas.width=128;blockCanvas.height=128;
  const bc=blockCanvas.getContext('2d')!;bc.fillStyle='#f6b92e';bc.fillRect(0,0,128,128);bc.fillStyle='#ffe379';bc.fillRect(5,5,118,5);bc.fillRect(5,5,5,118);bc.fillStyle='#ce8312';bc.fillRect(5,118,118,5);bc.fillRect(118,5,5,118);
  bc.fillStyle='#a5661a';for(const x of [15,106])for(const y of [15,106])bc.fillRect(x,y,7,7);
  bc.font='900 91px Arial';bc.textAlign='center';bc.fillStyle='#ac6b16';bc.fillText('?',67,103);bc.fillStyle='#fff0a8';bc.fillText('?',63,99);
  const blockTex=new THREE.CanvasTexture(blockCanvas);blockTex.colorSpace=THREE.SRGBColorSpace;const qmat=new THREE.MeshStandardMaterial({map:blockTex,roughness:.65});
  const brickCanvas=document.createElement('canvas');brickCanvas.width=128;brickCanvas.height=128;const br=brickCanvas.getContext('2d')!;br.fillStyle='#75452a';br.fillRect(0,0,128,128);
  for(let j=0;j<4;j++)for(let i=-1;i<3;i++){const x=i*64+(j%2)*32;br.fillStyle='#c37a42';br.fillRect(x+2,j*32+2,60,28);br.fillStyle='#e4a264';br.fillRect(x+3,j*32+3,58,3);}
  const brickTex=new THREE.CanvasTexture(brickCanvas);brickTex.colorSpace=THREE.SRGBColorSpace;const brick=new THREE.MeshStandardMaterial({map:brickTex});
  for(const [x,z] of [[0,-6],[1.45,-6],[-1.45,-6],[4.5,-21],[6,-21],[7.5,-21],[-3,-58],[-1.5,-58],[0,-58]]) {
    const question=x===0||x===4.5||x===-3;
    const mesh=cube(x,3.05,z,1.35,1.35,1.35,question?qmat:brick);
    boxes.push({x,y:3.05,z,w:1.35,h:1.35,d:1.35,kind:question?'question':'brick',id:question?questions.length:undefined});
    if(question){const c=makeCoin(x,4.2,z,false);c.visible=false;questions.push({mesh,used:false,baseY:3.05,bump:0,coin:c,originalMaterial:qmat});}
  }
  // A short staircase leads into the final flagpole clearing.
  for(let i=0;i<4;i++)cube(-6,((i+1)*.6)/2,-110-i*1.5,3,(i+1)*.6,1.5,brick,scene,true);
  function tree(x:number,z:number,s=1) {
    const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(s);decorations.add(group);
    cube(0,1.3,0,.55,2.6,.55,brown,group);ball(0,3,0,1.6,2.1,1.6,grass,group);ball(.4,3.7,.1,1.15,1.35,1.15,edge,group);
  }
  for(const [x,z,s] of [[-10,10,1],[10,3,1.1],[-10,-14,.8],[11,-31,1.1],[-6,-45,.9],[11,-63,.75],[-7,-82,1],[10,-96,.9],[-10,-123,1.2]])tree(x,z,s);
  for(let i=0;i<55;i++) {
    const section=i%3;const z=section===0?14-(i/3)*2.6:section===1?-44-(i/3)*2.3:-97-(i/3)*1.4;
    const x=(i%2?1:-1)*(9+Math.sin(i*8)*1.1);
    const m=i%3===0?mat('#fff5db'):i%3===1?mat('#ffc740'):mat('#fb727a');
    cube(x,.16,z,.045,.3,.045,green,decorations);ball(x,.34,z,.13,.12,.13,m,decorations);
  }
  function goomba(x:number,z:number,range=2.5) {
    const g=new THREE.Group();scene.add(g);g.position.set(x,0,z);
    ball(0,.62,0,.68,.57,.58,mat('#ae622d'),g);ball(0,.31,0,.36,.35,.36,cream,g);
    ball(-.29,.13,.12,.29,.16,.38,mat('#53382a'),g);ball(.29,.13,.12,.29,.16,.38,mat('#53382a'),g);
    for(const s of [-1,1]){ball(s*.23,.73,.47,.18,.22,.1,white,g);ball(s*.2,.72,.55,.07,.13,.035,mat('#272724'),g);const brow=cube(s*.23,.95,.51,.35,.065,.07,mat('#51301d'),g);brow.rotation.z=s*.25;}
    cube(0,.42,.5,.28,.06,.06,mat('#53382a'),g);enemies.push({mesh:g,x,y:0,z,home:x,range,direction:1,alive:true,stompTime:0});
  }
  goomba(1,-17,4);goomba(-3,-30,3);goomba(4,-50,3);goomba(-1,-68,4);goomba(2,-82,3);goomba(0,-103,5);
  // Rounded distant hills frame the course without obstructing the playable path.
  for(let i=0;i<19;i++) {
    const s=8+(i%4)*4;const x=(i%2?1:-1)*(35+(i%3)*15);const z=25-i*11;
    ball(x,-3,z,s,s*(1.4+(i%3)*.35),s,mat(i%2?'#47976c':'#64b985'));
    if(i%3===0){ball(x-1.3,8,z+s*.78,.35,1.3,.2,darkGreen);ball(x+1.3,8,z+s*.78,.35,1.3,.2,darkGreen);}
  }
  for(let i=0;i<19;i++){
    const g=new THREE.Group();g.position.set(Math.sin(i*4.4)*65,18+(i%4)*5,40-i*12);scene.add(g);
    for(let j=0;j<4;j++)ball(j*1.8,Math.sin(j*2)*.4,0,2.1,1.4,1.1,white,g);clouds.push(g);
  }
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,10,12),cream);pole.position.set(0,5,-122);pole.castShadow=true;scene.add(pole);ball(0,10.1,-122,.23,.23,.23,gold);
  const flagShape=new THREE.Shape();flagShape.moveTo(0,0);flagShape.lineTo(2,-.7);flagShape.lineTo(0,-1.4);flagShape.closePath();
  const flag=new THREE.Mesh(new THREE.ShapeGeometry(flagShape),new THREE.MeshStandardMaterial({color:'#ed4042',side:THREE.DoubleSide}));const flagGroup=new THREE.Group();flagGroup.position.set(.08,9.5,-122);flagGroup.add(flag);scene.add(flagGroup);
  const mark=ball(.5,-.5,.03,.24,.24,.03,white,flagGroup);mark.castShadow=false;
  cube(0,.25,-122,1,.5,1,brick,scene,true);
  // Small castle beyond the finish.
  cube(0,2.2,-129,5,4.4,2.5,mat('#f0dfbb'));
  const door=cube(0,.9,-127.73,1.15,1.8,.03,mat('#674431'));door.castShadow=false;
  for(const x of [-2.8,2.8]){cube(x,2.6,-129,1.6,5.2,2,mat('#fff0cf'));const roof=new THREE.Mesh(new THREE.ConeGeometry(1.4,2,4),mat('#e95048'));roof.rotation.y=Math.PI/4;roof.position.set(x,6.2,-129);roof.castShadow=true;scene.add(roof);}
  for(let i=0;i<5;i++)cube(-2+i,4.7,-129,.55,.7,2.5,cream);
  return {boxes,coins,enemies,questions,clouds,flag,flagGroup,decorations};
}
