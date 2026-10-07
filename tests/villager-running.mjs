import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(pathToFileURL(resolve('public/villagers/running/index.html')).href);
 await page.waitForFunction(()=>items.length===34&&items.every(i=>i.img.complete&&i.img.naturalWidth>0));
 assert.equal(await page.locator('canvas').count(),34);
 const samples=await page.evaluate(async()=>{const frames=new Set();for(let i=0;i<16;i++){frames.add(items[0].canvas.dataset.frame);await new Promise(r=>setTimeout(r,50));}return [...frames];});
 assert.equal(samples.length,6,'all six animation frames play');
 await page.locator('#pause').click();
 const stopped=await page.evaluate(()=>elapsed);
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>elapsed),stopped,'pause freezes animation and travel');
 await page.locator('#filter').selectOption('human');
 assert.equal(await page.locator('article:visible').count(),2);
 await page.locator('#travel').uncheck();
 await page.locator('#speed').fill('2');
 assert.equal(await page.locator('#rate').textContent(),'2×');
 await page.locator('#pause').click();
 await page.waitForTimeout(150);
 assert(await page.evaluate(()=>elapsed)>stopped,'resume advances animation');
 assert(await page.evaluate(()=>items.every(i=>i.meta.travelDirection==='left')),'all clips specify leftward travel');
 assert.deepEqual(errors,[]);
 await page.locator('#filter').selectOption('all');
 await page.screenshot({path:'../sprites/villagers/running/preview.png',fullPage:true});
 console.log('PASS: all 34 sheets load; six frames, pause/resume, speed, Kin filter and leftward direction verified.');
} finally {await browser.close();}
