// Renders scene/index.html frame by frame with Playwright and encodes it with the soundtrack.
//   node tools/render.cjs                 full render -> top-app-promo-landscape.mp4
//   node tools/render.cjs --stills 3,10   PNG stills at those seconds -> build/stills/
//   node tools/render.cjs --no-captions   render without burned-in captions
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const edit = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/edit.json'), 'utf8'));
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const noCaps = args.includes('--no-captions');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(ROOT, 'scene/index.html'));
  await page.evaluate(async (nc) => { window.NO_CAPTIONS = nc; await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); }, noCaps);
  if (stillsArg) {
    fs.mkdirSync(path.join(ROOT, 'build/stills'), { recursive: true });
    for (const s of stillsArg.split(',').map(Number)) {
      await page.evaluate((t) => window.renderAt(t), s);
      await page.screenshot({ path: path.join(ROOT, `build/stills/t${String(s).padStart(5, '0')}.png`) });
    }
    await browser.close(); return;
  }
  const out = path.join(ROOT, noCaps ? 'top-app-promo-landscape-nocaptions.mp4' : 'top-app-promo-landscape.mp4');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(edit.fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', path.join(ROOT, 'build/mix.wav'), '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(edit.fps),
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(edit.duration * edit.fps);
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.renderAt(t), f / edit.fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('wrote', out);
})();
