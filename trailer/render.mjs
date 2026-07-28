import pw from '/home/user/draw-the-chart/node_modules/playwright/index.js';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
const { chromium } = pw;
const DUR = Number(process.argv[2] ?? 32), FPS = Number(process.argv[3] ?? 30);
const OUT = '/tmp/claude-0/-home-user-draw-the-chart/5803a1bd-822f-5458-8c80-c632946161ab/scratchpad/frames';
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });

const round = JSON.parse(readFileSync('/tmp/claude-0/-home-user-draw-the-chart/5803a1bd-822f-5458-8c80-c632946161ab/scratchpad/round.json','utf8'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files','--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.addInitScript((r) => { window.__ROUND__ = r; }, round);
await page.goto('file:///tmp/claude-0/-home-user-draw-the-chart/5803a1bd-822f-5458-8c80-c632946161ab/scratchpad/trailer.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, { timeout: 30000 });
await page.waitForTimeout(600);

const total = Math.round(DUR * FPS);
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.__seek(t), f / FPS);
  await page.screenshot({ path: `${OUT}/f${String(f).padStart(5,'0')}.jpg`, type: 'jpeg', quality: 94, animations: 'disabled' });
  if (f % 120 === 0) process.stdout.write(`  ${f}/${total} (${((Date.now()-t0)/1000).toFixed(0)}s)\n`);
}
console.log(`captured ${total} frames in ${((Date.now()-t0)/1000).toFixed(0)}s`);
await browser.close();
