import Phaser from 'phaser';
import { chapterForLevel } from './campaign';

const W = 1280, H = 720, G = 422;

// Functional scenery for the campaign; combat always uses the same ground.
export function buildEnvironment(scene: Phaser.Scene, level: number) {
  const chapter = chapterForLevel(level);
  const root = scene.add.container(0, 0).setDepth(0).setData('environment', chapter.environment);
  const g = scene.add.graphics();
  root.add(g);
  if (chapter.environment === 'bridge' && scene.textures.exists('forest')) {
    root.addAt(scene.add.image(W / 2, H / 2, 'forest').setDisplaySize(W, H), 0);
  } else {
    const town = chapter.environment === 'town';
    const road = chapter.environment === 'road';
    g.fillGradientStyle(town ? 0x392c3b : road ? 0x233b4b : 0x5b8391, town ? 0x685046 : road ? 0x637d81 : 0x97a393, 0xafa078, 0xbba681, 1);
    g.fillRect(0, 0, W, G);
    g.fillStyle(town ? 0xd7895d : 0xe2ca91, .6);
    g.fillCircle(980, 150, 45);
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle([0x738477, 0x536e60, 0x344f43][layer]);
      for (let i = 0; i < 10; i++) {
        const x = i * 160 - 100 + layer * 40;
        g.fillTriangle(x - 120, G, x + 240, G, x + 70, 220 + layer * 48 + Math.sin(i * 3) * 35);
      }
    }
    if (town) {
      // Stone-and-timber homes, windows, smoke, and a refuge gate.
      for (let i = 0; i < 9; i++) {
        const x = i * 166 - 25, top = 238 + (i % 3) * 20;
        g.fillStyle(i % 2 ? 0x695c50 : 0x81715a);g.fillRect(x, top, 145, G - top);
        g.fillStyle(0x3c3540);g.fillTriangle(x - 12, top + 5, x + 157, top + 5, x + 72, top - 72);
        g.fillStyle(0x3d3834);g.fillRect(x + 68, top, 8, G - top);
        for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
          g.fillStyle(0x292a30);g.fillRect(x + 18 + col * 42, top + 22 + row * 61, 23, 30);
          g.fillStyle(level === 2 ? 0xf0a357 : 0xc4aa72, .8);g.fillRect(x + 22 + col * 42, top + 26 + row * 61, 15, 21);
        }
        if (i % 3 === 0 || level === 2) {
          for (let puff = 0; puff < 6; puff++) {g.fillStyle(0x28252b, .28);g.fillRect(x + 56 - puff * 5, top - 95 - puff * 22, 35 + puff * 9, 28);}
          g.fillStyle(0xb95b37);g.fillTriangle(x + 35, top + 3, x + 82, top + 3, x + 64, top - 45);
          g.fillStyle(0xeda448);g.fillTriangle(x + 47, top + 3, x + 75, top + 3, x + 62, top - 30);
        }
      }
      g.fillStyle(0x424347);g.fillRect(52, 196, 45, G - 196);g.fillRect(196, 196, 45, G - 196);g.fillRect(52, 183, 189, 34);
      g.fillStyle(0x1f2d30);g.fillRect(97, 217, 99, G - 217);
    } else if (road) {
      g.fillStyle(0x547f87);g.fillRect(0, 350, W, 38);
      for (let i = 0; i < 13; i++) {
        const x = i * 109 + 16, top = 140 + (i % 3) * 28;
        g.fillStyle(0x293e36);g.fillRect(x, top, 17, G - top);
        g.fillStyle(i % 2 ? 0x304e3e : 0x3d5c46);g.fillTriangle(x - 60, top + 120, x + 76, top + 120, x + 8, top - 65);
        g.fillTriangle(x - 80, top + 180, x + 96, top + 180, x + 8, top - 10);
      }
      g.fillStyle(0x777a6d);g.fillRect(85, 343, 17, 79);g.fillRect(53, 337, 82, 23);
    } else {
      for (let i = 0; i < 7; i++) {
        const x = 60 + i * 188;
        g.fillStyle(0x546b49);g.fillRect(x, G - 58, 5, 58);
        g.lineStyle(3, 0x7f8754);g.lineBetween(x - 65, G - 43, x + 120, G - 43);
      }
      g.fillStyle(0x66533e);g.fillRect(100, G - 35, 89, 25);g.fillStyle(0x9b9570);g.fillTriangle(94, G - 35, 196, G - 35, 142, G - 83);
      g.fillStyle(0x302e28);g.fillCircle(117, G - 10, 12);g.fillCircle(172, G - 10, 12);
    }
    const ground = town ? 0x5b5b52 : road ? 0x827359 : 0x68774c;
    g.fillStyle(ground);g.fillRect(0, G, W, H - G);
    g.fillStyle(town ? 0xaaa18c : road ? 0xa49373 : 0xa5b06a);g.fillRect(0, G, W, 9);
    for (let row = 0; row < 12; row++) for (let col = 0; col < 55; col++) {
      const x = col * 24 + (row % 2) * 10, y = G + 15 + row * 24;
      g.fillStyle(town ? (col % 3 ? 0x6f6a5d : 0x777164) : road ? (col % 3 ? 0x8b7b60 : 0x6f674f) : (col % 3 ? 0x738050 : 0x7f8b59));
      g.fillRect(x, y, town ? 21 : 9, town ? 19 : 4);
    }
  }
  g.fillStyle(0x061619, .25);g.fillRect(0, 0, W, 100);
  g.fillGradientStyle(0x081519, 0x081519, 0x081519, 0x081519, 0, 0, .8, .8);g.fillRect(0, 630, W, 90);
  g.fillStyle(0x817d58);g.fillRect(351, G - 100, 8, 100);g.fillStyle(0xae5942);g.fillTriangle(359, G - 98, 401, G - 87, 359, G - 64);
  // Bake static geometry once, preserving WebGL gradients and transparency.
  const scenery = scene.add.renderTexture(0, 0, W, H);
  scenery.draw(g);
  g.destroy();
  root.add(scenery);
  root.add(scene.add.text(290, G + 25, `← ${chapter.escape}`, {fontFamily:'Arial',fontSize:'10px',color:'#c7c7aa',letterSpacing:2}));
  return root;
}
