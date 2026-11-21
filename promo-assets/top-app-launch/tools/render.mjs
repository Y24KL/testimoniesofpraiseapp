// Renders compose.html frame by frame with Playwright's Chromium and pipes JPEG frames into ffmpeg.
// Usage: node tools/render.mjs <out.mp4> [startSec] [endSec]      (serve dir on :8765 first)
//        node tools/render.mjs --stills <dir> t1 t2 ...
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // resolves via NODE_PATH=$(npm root -g) if not installed locally
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:8765/compose.html?t=0');
await page.evaluate(() => window.ready);
if (args[0] === '--stills') {
  for (const t of args.slice(2)) { await page.evaluate((t) => window.seek(t), +t); await page.screenshot({ path: `${args[1]}/f_${t}.png` }); }
} else {
  const [out, a = '0', b] = args; const fps = 30;
  const end = b ? +b : await page.evaluate(() => fetch('timeline.json').then((r) => r.json()).then((j) => j.duration));
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const f0 = Math.round(+a * fps), f1 = Math.round(end * fps);
  for (let f = f0; f < f1; f++) {
    await page.evaluate((t) => window.seek(t), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(out, 'frame', f, '/', f1);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
}
await browser.close();
