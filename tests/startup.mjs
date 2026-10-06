import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const base = process.env.GAME_URL || 'http://127.0.0.1:5173';
try {
  const loading = await browser.newPage();
  let release;
  const hold = new Promise(resolve => {release = resolve;});
  await loading.route('**/elowen-jump/Elowen-jump-spritesheet.png', async route => {await hold;await route.continue();});
  await loading.goto(base);
  await loading.locator('#loading-status').waitFor();
  assert.match(await loading.locator('#loading-status').textContent(), /Loading/);
  assert.equal(await loading.getByRole('link',{name:'USE BASIC GRAPHICS'}).count(), 1);
  release();
  await loading.getByRole('button',{name:'TAKE YOUR STAND'}).waitFor();
  assert.equal(await loading.locator('#loading-status').count(), 0);
  await loading.close();

  const page = await browser.newPage();
  // Reproduce a graphics startup failure, then recover without the failing GPU path.
  await page.addInitScript(() => {
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (type) type.prototype.compileShader = function() {throw new Error('Graphics startup test failure');};
    }
  });
  await page.goto(base);
  await page.getByText('The game couldn’t start.',{exact:true}).waitFor();
  assert.match(await page.locator('#startup-error').textContent(), /Graphics startup test failure/);
  await page.getByRole('link',{name:'USE BASIC GRAPHICS'}).click();
  await page.getByRole('button',{name:'TAKE YOUR STAND'}).click();
  assert.equal(await page.evaluate(() => window.elowen.game.renderer.type), 1, 'Canvas fallback');
  await page.keyboard.down('D');
  await page.waitForFunction(() => window.elowen.x > 530);
  await page.keyboard.up('D');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.elowen.y < 400);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.elowen.y === 422);
  await page.keyboard.down('J');
  await page.waitForFunction(() => !!window.elowen.heroAnimator.attack);
  await page.keyboard.up('J');
  await page.keyboard.press('Escape');
  await page.getByText('Paused',{exact:true}).waitFor();
  await page.getByRole('button',{name:'RESUME'}).click();
  assert.equal(await page.evaluate(() => window.elowen.paused), false);
  console.log('PASS: visible loading progress, startup error, Canvas recovery, movement, jump, sword and pause.');
} finally {await browser.close();}
