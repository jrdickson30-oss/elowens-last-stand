const root = new URL('audio/', document.baseURI);
const creature = [
  'creatures-1/grunt_05.ogg', 'creatures-1/misc_05.ogg',
  'creatures-1/roar_02.ogg', 'creatures-1/roar_03.ogg',
  'creatures-1/scream_01.ogg', 'creatures-1/scream_02.ogg',
  'creatures-2/misc_11.ogg', 'creatures-2/roar_05.ogg',
];
const deaths = ['creatures-2/die_02.ogg', 'creatures-2/die_03.ogg'];
const spell = 'fantasy-spells/';
const sword = Array.from({ length: 3 }, (_, i) => `${spell}Single_Fantasy SFX Pack Vol 1_Dagger_Swing_0${i + 1}.wav`);
const heavy = Array.from({ length: 3 }, (_, i) => `${spell}Single_Fantasy SFX Pack Vol 1_Heavy Sword_Swing_0${i + 1}.wav`);
const clash = Array.from({ length: 8 }, (_, i) => `organic-weapons/sword-knife-clash-0${i + 1}.wav`);
const jump = ['organic-weapons/boots-leather-jump-02.wav', 'organic-weapons/boots-leather-jump-03.wav'];
const footsteps = ['carpet', 'concrete', 'grass', 'snow', 'wood'].flatMap(surface =>
  Array.from({ length: 5 }, (_, i) => `kenney-impact/footstep_${surface}_00${i}.ogg`));
const files = [...creature, ...deaths, ...sword, ...heavy, ...clash, ...jump, ...footsteps,
  'creatures-2/human_04.ogg',
  `${spell}Single_Fantasy SFX Pack Vol 1_Fireball Launch_01.wav`,
  `${spell}Single_Fantasy SFX Pack Vol 1_Ice Spell_Buildup.wav`,
  `${spell}Single_Fantasy SFX Pack Vol 1_Ice Shard Projectile_Launch_01.wav`,
  `${spell}Single_Fantasy SFX Pack Vol 1_Ice Shard  Projectile_Impact_01.wav`,
  'kenney-impact/impactMining_004.ogg'];

type Voice = { sound: HTMLAudioElement; timer: number; fade?: number };

class GameAudio {
  enabled = false;
  private last = new Map<string, number>();
  private index = new Map<string, number>();
  private sounds = new Map<string, HTMLAudioElement>();
  private active = new Map<string, Voice>();
  private backgrounded = false;

  constructor() {
    window.addEventListener('blur', () => { this.backgrounded = true; this.stopAll(); });
    window.addEventListener('focus', () => { this.backgrounded = document.hidden; });
    document.addEventListener('visibilitychange', () => {
      this.backgrounded = document.hidden;
      if (this.backgrounded) this.stopAll();
    });
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) { this.stopAll(); return; }
    for (const file of files) {
      if (!this.sounds.has(file)) {
        const sound = new Audio(new URL(file, root).href);
        sound.preload = 'auto';
        this.sounds.set(file, sound);
        sound.load();
      } else if (this.sounds.get(file)!.error) this.sounds.get(file)!.load();
    }
  }
  stop(channel: string) {
    const voice = this.active.get(channel);
    if (!voice) return;
    this.active.delete(channel);
    clearTimeout(voice.timer);
    clearInterval(voice.fade);
    voice.sound.onended = voice.sound.onerror = null;
    voice.sound.pause();
    voice.sound.currentTime = 0;
  }
  stopAll() { for (const channel of this.active.keys()) this.stop(channel); }
  private play(channel: string, file: string, volume: number, seconds: number) {
    if (!this.enabled || this.backgrounded || document.hidden) return;
    // Never queue an interaction behind a download. A later interaction can use it once loaded.
    const sound = this.sounds.get(file);
    if (!sound || sound.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
    this.stop(channel);
    if (this.active.size >= 6) this.stop(this.active.keys().next().value!);
    sound.currentTime = 0;
    sound.volume = volume;
    const voice: Voice = { sound, timer: 0 };
    this.active.set(channel, voice);
    const finish = () => { if (this.active.get(channel) === voice) this.stop(channel); };
    sound.onended = sound.onerror = finish;
    const duration = Math.min(seconds, sound.duration);
    const started = performance.now();
    // Fade the final 25ms of deliberately shortened effect tails.
    voice.timer = window.setTimeout(() => {
      const fadeStart = performance.now();
      voice.fade = window.setInterval(() => { sound.volume = volume * Math.max(0, 1 - (performance.now() - fadeStart) / 25); }, 8);
      voice.timer = window.setTimeout(finish, 25);
    }, Math.max(0, duration * 1000 - 25));
    void sound.play().then(() => {
      // A stalled play/seek must not revive an old interaction later.
      if (this.active.get(channel) === voice && performance.now() - started > 150) finish();
    }).catch(finish);
  }
  private one(group: string, choices: string[], volume: number, seconds: number, channel = group) {
    const next = this.index.get(group) ?? 0;
    this.index.set(group, next + 1);
    this.play(channel, choices[next % choices.length], volume, seconds);
  }
  private limited(key: string, interval: number) {
    const now = performance.now(), previous = this.last.get(key) ?? -Infinity;
    if (now - previous < interval) return false;
    this.last.set(key, now); return true;
  }
  zombie() { if (this.limited('zombie', 1700)) this.one('zombie', creature, .24, .9, 'creature'); }
  zombieDeath() { this.one('death', deaths, .36, .7, 'creature'); }
  heavySwing() { this.one('heavy', heavy, .5, .6); }
  heroHurt() { if (this.limited('heroHurt', 350)) this.play('hurt', 'creatures-2/human_04.ogg', .55, .45); }
  swordSwing() { this.one('sword', sword, .42, .37); }
  swordHit() { if (this.limited('swordHit', 90)) this.one('clash', clash, .42, .28, 'impact'); }
  jump() { this.one('jump', jump, .38, .3); }
  footstep() { if (this.limited('footstep', 260)) this.one('footstep', footsteps, .22, .16); }
  fire() { this.play('fire', `${spell}Single_Fantasy SFX Pack Vol 1_Fireball Launch_01.wav`, .5, .55); }
  iceBuildup() { this.play('ice', `${spell}Single_Fantasy SFX Pack Vol 1_Ice Spell_Buildup.wav`, .44, .4); }
  iceLaunch() { this.play('ice', `${spell}Single_Fantasy SFX Pack Vol 1_Ice Shard Projectile_Launch_01.wav`, .48, .45); }
  iceImpact() { this.play('ice', `${spell}Single_Fantasy SFX Pack Vol 1_Ice Shard  Projectile_Impact_01.wav`, .5, .55); }
  shield() { this.play('impact', 'kenney-impact/impactMining_004.ogg', .45, .28); }
}

export const gameAudio = new GameAudio();
