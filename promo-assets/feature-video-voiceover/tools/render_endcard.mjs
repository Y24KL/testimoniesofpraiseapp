// Renders endcard/endcard.html (848x478 at 2x) frame by frame to an MP4 scaled to 848x478, or stills.
// Usage (serve endcard/ on :8766 first): node tools/render_endcard.mjs <out.mp4> <seconds>  |  --stills <dir> t1 t2 ...
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const a = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 848, height: 478 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:8766/endcard.html'); await page.evaluate(() => window.ready);
if (a[0] === '--stills') { for (const t of a.slice(2)) { await page.evaluate((t) => window.seek(t), +t); await page.screenshot({ path: `${a[1]}/end_${t}.png` }); } }
else {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
    '-vf', 'scale=848:478:flags=lanczos', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', '30', a[0]], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < Math.round(+a[1] * 30); f++) {
    await page.evaluate((t) => window.seek(t), f / 30);
    const b = await page.screenshot({ type: 'png' }); if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
}
await browser.close();
