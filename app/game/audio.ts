export class GameAudio {
  context: AudioContext | null = null;
  muted = false;
  nextNote = 0;
  noteIndex = 0;
  theme = 'meadow';
  setTheme(theme: string) {
    this.theme = theme;
    this.noteIndex = 0;
    this.nextNote = 0;
  }
  async activate() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* The game remains playable when audio is unavailable. */
    }
  }
  tone(
    frequency: number,
    duration = 0.1,
    type: OscillatorType = 'square',
    volume = 0.045,
    delay = 0,
  ) {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const c = this.context,
      osc = c.createOscillator(),
      gain = c.createGain(),
      now = c.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  coin() {
    this.tone(987, 0.09);
    this.tone(1480, 0.19, 'square', 0.04, 0.08);
  }
  jump() {
    this.tone(260, 0.08, 'triangle', 0.07);
    this.tone(430, 0.12, 'triangle', 0.055, 0.05);
  }
  stomp() {
    this.tone(140, 0.13, 'triangle', 0.13);
  }
  hurt() {
    [310, 260, 195].forEach((n, i) =>
      this.tone(n, 0.16, 'sawtooth', 0.035, i * 0.1),
    );
  }
  win() {
    [523, 659, 784, 1047, 784, 1047].forEach((n, i) =>
      this.tone(n, 0.25, 'triangle', 0.1, i * 0.16),
    );
  }
  music(dt: number) {
    this.nextNote -= dt;
    if (this.nextNote > 0) return;
    this.nextNote =
      this.theme === 'sky'
        ? 0.3
        : this.theme === 'lava' || this.theme === 'castle'
          ? 0.22
          : 0.26;
    const melodies: Record<string, number[]> = {
      meadow: [
        392, 0, 523, 659, 587, 523, 0, 330, 349, 440, 523, 0, 440, 349, 294, 0,
        330, 392, 523, 0, 659, 587, 523, 440, 392, 0, 330, 294, 262, 0, 0, 0,
      ],
      cave: [
        220, 0, 262, 0, 294, 330, 0, 220, 196, 0, 247, 0, 294, 262, 247, 0, 220,
        330, 392, 0, 330, 294, 262, 0, 247, 0, 196, 220, 0, 0, 0, 0,
      ],
      sky: [
        523, 659, 784, 0, 880, 0, 784, 659, 587, 0, 740, 880, 0, 740, 587, 0,
        659, 784, 988, 0, 1047, 988, 784, 659, 587, 659, 784, 0, 523, 0, 0, 0,
      ],
      lava: [
        165, 220, 0, 262, 247, 220, 165, 0, 175, 233, 0, 294, 262, 233, 175, 0,
        196, 262, 0, 330, 294, 262, 220, 0, 165, 196, 220, 0, 165, 0, 165, 0,
      ],
      night: [
        294, 0, 349, 440, 0, 523, 440, 349, 262, 0, 330, 392, 0, 494, 392, 330,
        247, 0, 294, 370, 440, 0, 370, 294, 262, 330, 392, 0, 294, 0, 0, 0,
      ],
      castle: [
        147, 147, 220, 0, 175, 147, 262, 220, 165, 165, 247, 0, 196, 165, 294,
        247, 147, 220, 294, 349, 330, 294, 262, 220, 196, 175, 165, 0, 147, 0,
        147, 0,
      ],
    };
    const melody = melodies[this.theme] ?? melodies.meadow;
    const n = melody[this.noteIndex++ % melody.length];
    if (n) this.tone(n, 0.17, 'triangle', 0.015);
    if (this.noteIndex % 4 === 0)
      this.tone(
        [131, 175, 147, 131][Math.floor(this.noteIndex / 8) % 4],
        0.25,
        'sine',
        0.025,
      );
  }
  destroy() {
    void this.context?.close();
  }
}
