import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const THREE=await import(process.env.PLETHORA_THREE_MODULE || 'three');

class Element extends EventTarget {
  hidden=false;disabled=false;textContent='';innerHTML='';width=128;height=128;clientWidth=390;clientHeight=844;
  style={setProperty(){}};nodes=new Map();attributes=new Map();
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
  setAttribute(name,value){this.attributes.set(name,value);}
  removeAttribute(name){this.attributes.delete(name);}
  getBoundingClientRect(){return {left:0,top:0,width:112,height:112};}
  setPointerCapture(){} remove(){} appendChild(){}
  getContext(){return {fillStyle:'',font:'',textAlign:'',fillRect(){},fillText(){}};}
}
const source=await readFile('outputs/plethora/main.js','utf8');
async function fixture({deferred=false,failed=false}={}) {
  const root=new Element(),canvas=new Element(),document=new Element(),window=new Element();
  document.createElement=()=>{throw new Error('Use the Plethora canvas factory');};document.pointerLockElement=null;
  window.matchMedia=()=>({matches:false});
  const sandbox={window,document,performance:{now:()=>0},console};
  vm.runInNewContext(source,sandbox);
  const events=[],frames=[],destroyers=[],listeners=[];
  let resolveLibrary,disposed=0,renders=0,musicPlays=0,canvasCount=0;
  class Renderer {
    constructor(){this.domElement=canvas;this.shadowMap={};}
    setPixelRatio(){}setClearColor(){}setSize(){}render(){renders++;}dispose(){disposed++;}
  }
  const library={...THREE,WebGLRenderer:Renderer};
  const ctx={
    width:390,height:844,dpr:3,safeArea:{top:47,right:0,bottom:34,left:0},capabilities:{backgroundMusic:true},
    createRoot:()=>root,createCanvas:()=>canvasCount++===0?canvas:new Element(),
    listen(target,name,handler){target.addEventListener(name,handler);listeners.push(()=>target.removeEventListener(name,handler));},
    onFrame(fn){frames.push(fn);},onDestroy(fn){destroyers.push(fn);},
    importModule(name,version){assert.equal(name,'three');assert.equal(version,'0.164.1');if(failed)return Promise.reject(new Error('Unavailable'));return deferred?new Promise(resolve=>{resolveLibrary=()=>resolve(library);}):Promise.resolve(library);},
    markVisualReady(){events.push(['visual']);},
    platform:Object.fromEntries(['ready','start','interact','setScore','setProgress','complete','fail','error'].map(name=>[name,(...args)=>events.push([name,...args])])),
    music:{async unlock(){},play(){musicPlays++;},pause(){},resume(){},stop(){},setVolume(){},async sting(){}},
  };
  const pending=window.plethoraBit.init(ctx);
  if(!deferred)await pending;
  return {root,canvas,document,events,frames,pending,resolveLibrary,get disposed(){return disposed;},get renders(){return renders;},get musicPlays(){return musicPlays;},destroy(){destroyers.forEach(fn=>fn());listeners.forEach(fn=>fn());}};
}
function click(f,name){f.root.querySelector(`[data-action="${name}"]`).dispatchEvent(new Event('click'));}

test('Plethora uses one managed loop, starts from a gesture, pauses, replays and releases its renderer',async()=>{
  const f=await fixture();
  assert.deepEqual(f.events.slice(0,2).map(x=>x[0]),['visual','ready']);
  assert.equal(f.frames.length,1);assert.equal(f.renders,1);assert.equal(f.musicPlays,0);
  assert.equal(f.root.querySelector('[data-action="play"]').disabled,false);
  click(f,'play');await Promise.resolve();
  assert.equal(f.events.filter(x=>x[0]==='start').length,1);
  assert.equal(f.root.querySelector('.controls').hidden,false);
  f.frames[0](16,16);click(f,'pause');assert.equal(f.root.querySelector('.controls').hidden,true);
  click(f,'play');click(f,'restart');assert.equal(f.events.filter(x=>x[0]==='start').length,1);
  assert.equal(f.frames.length,1);
  f.destroy();assert.equal(f.disposed,1);const renders=f.renders;f.frames[0](16,32);assert.equal(f.renders,renders);
});
test('Plethora unload during library loading does not create a renderer or frame loop',async()=>{
  const f=await fixture({deferred:true});f.destroy();f.resolveLibrary();await f.pending;
  assert.equal(f.frames.length,0);assert.equal(f.renders,0);
});
test('Plethora failed library load shows a readable error without enabling play',async()=>{
  const f=await fixture({failed:true});assert.match(f.root.querySelector('.description').textContent,/could not load/);
  assert.equal(f.events.filter(x=>x[0]==='error').length,1);assert.equal(f.frames.length,0);f.destroy();
});
