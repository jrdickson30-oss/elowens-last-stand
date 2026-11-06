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

class GameAudio {
  enabled = false;
  private last = new Map<string, number>();
  private index = new Map<string, number>();
  private active = new Set<HTMLAudioElement>();

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) { for (const voice of this.active) voice.pause(); this.active.clear(); }
    else for (const file of files) { const sound = new Audio(new URL(file, root).href); sound.preload = 'auto'; sound.load(); }
  }
  private play(file: string, volume: number, rate = 1) {
    if (!this.enabled) return;
    const voice = new Audio(new URL(file, root).href);
    voice.volume = volume;
    voice.playbackRate = rate;
    this.active.add(voice);
    voice.onended = voice.onerror = () => this.active.delete(voice);
    void voice.play().catch(() => this.active.delete(voice));
  }
  private one(group: string, choices: string[], volume: number, rate = 1) {
    const next = this.index.get(group) ?? 0;
    this.index.set(group, next + 1);
    this.play(choices[next % choices.length], volume, rate);
  }
  private limited(key: string, interval: number) {
    const now = performance.now(), previous = this.last.get(key) ?? -Infinity;
    if (now - previous < interval) return false;
    this.last.set(key, now); return true;
  }
  zombie() { if (this.limited('zombie', 1700)) this.one('zombie', creature, .24); }
  zombieDeath() { this.one('death', deaths, .36); }
  heavySwing() { this.one('heavy', heavy, .5); }
  heroHurt() { if (this.limited('heroHurt', 350)) this.play('creatures-2/human_04.ogg', .55); }
  swordSwing() { this.one('sword', sword, .42); }
  swordHit() { if (this.limited('swordHit', 90)) this.one('clash', clash, .42); }
  jump() { this.one('jump', jump, .38); }
  footstep() { if (this.limited('footstep', 260)) this.one('footstep', footsteps, .22); }
  fire() { this.play(`${spell}Single_Fantasy SFX Pack Vol 1_Fireball Launch_01.wav`, .5); }
  iceBuildup() { this.play(`${spell}Single_Fantasy SFX Pack Vol 1_Ice Spell_Buildup.wav`, .44); }
  iceLaunch() { this.play(`${spell}Single_Fantasy SFX Pack Vol 1_Ice Shard Projectile_Launch_01.wav`, .48); }
  iceImpact() { this.play(`${spell}Single_Fantasy SFX Pack Vol 1_Ice Shard  Projectile_Impact_01.wav`, .5); }
  shield() { this.play('kenney-impact/impactMining_004.ogg', .45); }
}

export const gameAudio = new GameAudio();
