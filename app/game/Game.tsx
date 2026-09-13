'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Volume2, VolumeX, Maximize, Minimize, Pause, RotateCcw, Flag, Mouse, MoveUp, Heart, Trophy, Play } from 'lucide-react';
import type { GameEngine, Snapshot } from './engine';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { registerGameTools } from './webmcp';
import { FullscreenSession, type FullscreenState } from './fullscreen';
function CreatorLinks(){return <nav className="creator-links" data-creator-links aria-label="Created by Aaditya More"><span>By Aaditya More</span><div><a href="https://aadityamore.com/">Website</a><a href="https://github.com/aaditya-v-more">GitHub</a><a href="https://www.linkedin.com/in/aadityavmore/">LinkedIn</a></div></nav>;}
const initial:Snapshot={status:'ready',coins:0,total:32,lives:3,time:180,score:0,progress:0,notice:''};
export default function Game(){
  const scene=useRef<HTMLDivElement>(null),engine=useRef<GameEngine|null>(null),shell=useRef<HTMLElement>(null),display=useRef<FullscreenSession|null>(null),touchPointer=useRef<number|null>(null);
  const [displayState,setDisplayState]=useState<FullscreenState>({active:false,supported:false,message:''});
  const [state,setState]=useState(initial),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[muted,setMuted]=useState(false);
  const [rtx,setRtx]=useState(false),[graphicsBusy,setGraphicsBusy]=useState(false),[graphicsError,setGraphicsError]=useState('');
  useEffect(()=>{let dead=false;import('./engine').then(({GameEngine})=>{if(dead||!scene.current)return;try{engine.current=new GameEngine(scene.current,setState);setLoaded(true);}catch{setError('This game needs WebGL. Enable hardware acceleration in your browser, then reload.');}}).catch(()=>setError('The game could not load. Reload the page to try again.'));return()=>{dead=true;engine.current?.destroy();};},[]);
  useEffect(()=>{if(!loaded||!engine.current)return;return registerGameTools(engine.current);},[loaded]);
  useEffect(()=>{if(!shell.current)return;const session=new FullscreenSession(document,shell.current,setDisplayState,()=>engine.current?.pause());display.current=session;return()=>{session.destroy();display.current=null;};},[]);
  useEffect(()=>{if(!loaded||!scene.current)return;const resize=()=>engine.current?.resize();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);observer?.observe(scene.current);return()=>observer?.disconnect();},[loaded]);
  const start=(restart=false)=>{const game=engine.current;if(!game)return;touchPointer.current=null;
    // Pointer lock must be requested before fullscreen consumes user activation.
    if(restart)game.restart();else game.start();void display.current?.enter(true);
  };
  const stopTouch=(pointerId:number)=>{if(touchPointer.current===pointerId){touchPointer.current=null;engine.current?.setTouch(0,0);}};
  const toggleSound=()=>{setMuted(!muted);engine.current?.setMuted(!muted);};
  const toggleRtx=async(enabled:boolean)=>{
    const game=engine.current;if(!game||graphicsBusy)return;
    setGraphicsBusy(true);setGraphicsError('');
    try{const active=await game.setRtx(enabled);if(engine.current===game){setRtx(active);if(enabled&&!active)setGraphicsError('RTX is unavailable on this device. Classic graphics are still on.');}}
    finally{setGraphicsBusy(false);}
  };
  const fullscreen=()=>{void display.current?.toggle();};
  const ready=state.status==='ready',playing=state.status==='playing';
  return <main ref={shell} className={`game-shell ${playing?'is-playing':''}`}>
    <div ref={scene} className="world-canvas" role="img" aria-label="3D Mushroom Kingdom with green pipes, gold coins, question blocks, and Goombas" />
    <div className="scene-shade" />
    <header className="topbar">
      <button className="brand" onClick={()=>window.location.reload()} aria-label="Mario First Person home"><span className="brand-mark">M</span><span>MARIO<span className="brand-slash">/</span><span className="brand-sub">FIRST PERSON</span></span></button>
      <div className="world-label"><span className="status-dot"/> WORLD 1–1 <span className="label-divider"/> MUSHROOM KINGDOM</div>
      <div className="toolbar" role="toolbar" aria-label="Game controls" onKeyDown={e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();}}><label htmlFor="graphics-toggle" className={`graphics-control ${rtx?'graphics-on':''}`} title="Enhanced lighting, reflections and glow. More demanding on your device."><span>RTX <small aria-hidden="true">{graphicsBusy?'…':rtx?'ON':'OFF'}</small></span><Switch id="graphics-toggle" className="graphics-switch" checked={rtx} onCheckedChange={toggleRtx} disabled={!loaded||!!error||graphicsBusy} aria-label="RTX enhanced graphics" aria-describedby="graphics-description" aria-busy={graphicsBusy} onKeyDown={e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();}}/></label><button className="icon-button" onClick={toggleSound} aria-label={muted?'Turn sound on':'Mute sound'} title={muted?'Sound off':'Sound on'}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button><button className="icon-button fullscreen-button" onClick={fullscreen} disabled={!displayState.supported} aria-label={displayState.active?'Exit fullscreen':'Enter fullscreen'} aria-pressed={displayState.active} title={displayState.supported?(displayState.active?'Exit fullscreen':'Enter fullscreen'):'Fullscreen unavailable in this browser'}>{displayState.active?<Minimize size={18}/>:<Maximize size={18}/>}</button>{playing&&<button className="icon-button" onClick={()=>engine.current?.pause()} aria-label="Pause game"><Pause size={18}/></button>}</div>
    </header>
    <span id="graphics-description" className="graphics-description">Enhanced lighting, reflections and glow; not hardware ray tracing. Off by default. Pause to change graphics while using mouse look.</span>
    {graphicsError&&<div className="graphics-error" role="status">{graphicsError}</div>}
    {ready&&<>
      <div className="level-stamp"><span>01</span><div>THE OVERWORLD<small>A familiar world. A whole new view.</small></div></div>
      <section className="intro">
        <div className="eyebrow"><span className="little-line"/> LET’S-A GO!</div>
        <h1>SUPER<br/><span>MARIO</span><span className="title-dot">.</span></h1>
        <div className="perspective-label">A FIRST-PERSON ADVENTURE</div>
        <p>Step into the red cap. Collect coins, stomp Goombas,<br className="desktop-break"/> and make your way to the flag.</p>
        <button className="play-button" onClick={()=>start()} disabled={!loaded||!!error}><span>{error?'Unable to load':loaded?'Let’s play':'Loading world…'}</span><ArrowUpRight size={24}/></button>
        {error&&<p className="load-error" role="alert">{error}</p>}
        <div className="play-meta"><span className="status-dot"/> FREE TO ROAM <span>•</span> 3 LIVES <span>•</span> ONE ADVENTURE</div>
        <CreatorLinks/>
        {displayState.message&&<output className="display-note">{displayState.message}</output>}
      </section>
      <aside className="mission-card"><div className="mission-icon"><Flag size={23}/></div><span>YOUR MISSION</span><h2>See you at the flag.</h2><p>Find your footing. Every great<br/>adventure starts with a jump.</p><div className="mission-line"><span>WORLD 1–1</span><ArrowRight size={17}/></div></aside>
      <footer className="start-footer"><div className="control-item"><div className="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><span>Move</span></div><div className="control-item"><Mouse size={20}/><span>Look around</span></div><div className="control-item"><kbd className="space-key">SPACE</kbd><span>Jump</span></div><div className="control-item"><kbd>⇧</kbd><span>Sprint</span></div><div className="footer-note">MADE FOR A LITTLE ADVENTURE <span>↗</span></div></footer>
    </>}
    {!ready&&<>
      <div className="hud"><div className="hud-stat"><span className="coin-icon"/><div><small>COINS</small><strong>{String(state.coins).padStart(2,'0')}<span> / {state.total}</span></strong></div></div><div className="hud-stat lives"><Heart size={21} fill="#ff655d" stroke="#ff655d"/><div><small>LIVES</small><strong>{state.lives}</strong></div></div><div className="hud-stat"><div><small>TIME</small><strong className={state.time<30?'time-low':''}>{Math.floor(state.time/60)}:{String(Math.ceil(state.time)%60).padStart(2,'0')}</strong></div></div><div className="hud-stat score"><div><small>SCORE</small><strong>{String(state.score).padStart(6,'0')}</strong></div></div></div>
      {playing&&<><div className="crosshair"/><div className="goal-pill"><Flag size={16}/><span>Reach the flag</span><Progress className="goal-track" value={Math.round(state.progress*100)} aria-label="Progress to flag"/></div><div className="playing-hint"><kbd>SPACE</kbd> Jump <span>·</span> <kbd>ESC</kbd> Pause <span>·</span> Jump on Goombas to stomp</div><div className="touch-controls"><div className="touch-pad" onPointerDown={e=>{if(touchPointer.current!==null)return;e.preventDefault();touchPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();engine.current?.setTouch((e.clientX-r.left-r.width/2)/(r.width/2),(e.clientY-r.top-r.height/2)/(r.height/2));}} onPointerMove={e=>{if(touchPointer.current===e.pointerId){const r=e.currentTarget.getBoundingClientRect();engine.current?.setTouch((e.clientX-r.left-r.width/2)/(r.width/2),(e.clientY-r.top-r.height/2)/(r.height/2));}}} onPointerUp={e=>stopTouch(e.pointerId)} onPointerCancel={e=>stopTouch(e.pointerId)} onLostPointerCapture={e=>stopTouch(e.pointerId)} aria-label="Movement joystick"><span>✣</span></div><button onPointerDown={e=>{e.preventDefault();engine.current?.jump();}} onClick={e=>{if(e.detail===0)engine.current?.jump();}} className="touch-jump" aria-label="Jump"><MoveUp size={24}/>JUMP</button></div></>}
      {playing&&state.notice&&<div className="game-notice" role="status">{state.notice}</div>}
      {!playing&&<div className="state-overlay"><section className="state-card"><div className="state-icon">{state.status==='won'?<Trophy size={34}/>:state.status==='paused'?<Pause size={32}/>:<Heart size={32}/>}</div><div className="eyebrow">WORLD 1–1</div><h2>{state.status==='won'?'Course clear!':state.status==='paused'?'Take a breather.':'One more try?'}</h2><p>{state.status==='won'?`You made it! ${state.coins} coins collected · ${state.score.toLocaleString()} points.`:state.status==='paused'?'The Mushroom Kingdom will be right here.':'Every adventure takes a little practice.'}</p><button className="play-button" onClick={()=>start(state.status!=='paused')}><span>{state.status==='paused'?'Keep playing':'Play again'}</span>{state.status==='paused'?<Play size={20}/>:<RotateCcw size={20}/>}</button>{state.status==='paused'&&<button className="text-button" onClick={()=>start(true)}>Restart course</button>}<CreatorLinks/>{displayState.message&&<output className="display-note">{displayState.message}</output>}</section></div>}
    </>}
  </main>;
}
