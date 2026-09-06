export class GameAudio {
  context:AudioContext|null=null;
  muted=false;
  nextNote=0;
  noteIndex=0;
  async activate(){
    try{this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();}catch{/* The game remains playable when audio is unavailable. */}
  }
  tone(frequency:number,duration=.1,type:OscillatorType='square',volume=.045,delay=0){
    if(this.muted||!this.context||this.context.state!=='running')return;
    const c=this.context,osc=c.createOscillator(),gain=c.createGain(),now=c.currentTime+delay;
    osc.type=type;osc.frequency.setValueAtTime(frequency,now);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(c.destination);osc.start(now);osc.stop(now+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  coin(){this.tone(987,.09);this.tone(1480,.19,'square',.04,.08);}
  jump(){this.tone(260,.08,'triangle',.07);this.tone(430,.12,'triangle',.055,.05);}
  stomp(){this.tone(140,.13,'triangle',.13);}
  hurt(){[310,260,195].forEach((n,i)=>this.tone(n,.16,'sawtooth',.035,i*.1));}
  win(){[523,659,784,1047,784,1047].forEach((n,i)=>this.tone(n,.25,'triangle',.1,i*.16));}
  music(dt:number){
    this.nextNote-=dt;if(this.nextNote>0)return;this.nextNote=.26;
    const melody=[392,0,523,659,587,523,0,330,349,440,523,0,440,349,294,0,330,392,523,0,659,587,523,440,392,0,330,294,262,0,0,0];
    const n=melody[this.noteIndex++%melody.length];if(n)this.tone(n,.17,'triangle',.015);
    if(this.noteIndex%4===0)this.tone([131,175,147,131][Math.floor(this.noteIndex/8)%4],.25,'sine',.025);
  }
  destroy(){void this.context?.close();}
}
