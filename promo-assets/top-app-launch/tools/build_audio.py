"""Builds the promo soundtrack from the app's approved ElevenLabs narration clips.

Reads tools/edit.json, cuts each narration line from assets/voiceovers/*.mp3 (repo root),
places it on the timeline, mixes it over the team's own music bed with ducking and a few
soft synthesised whooshes, and writes:
  build/voiceover.wav   clean narration only (48 kHz)
  build/mix.wav         final mix (narration + music + sfx), loudness-normalised
  build/words.json      every spoken word with its time on the promo timeline
  captions.srt          captions for the narration
Run from promo-assets/top-app-launch:  python3 tools/build_audio.py
"""
import json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(ROOT, '..', '..'))
VO_DIR = os.path.join(REPO, 'assets', 'voiceovers')
BUILD = os.path.join(ROOT, 'build')
os.makedirs(BUILD, exist_ok=True)

edit = json.load(open(os.path.join(HERE, 'edit.json')))
DUR = edit['duration']

# ---------- script text (approved wording) for display casing / punctuation ----------
manifest = open(os.path.join(REPO, 'src', 'voiceover', 'manifest.ts')).read()

def script_for(key):
    if key == 'assistant.response':
        return re.search(r'"(Hello, I\'m Praxiom.*?)"', manifest, re.S).group(1)
    return re.search(r"scripted\('" + re.escape(key) + r"', `(.*?)`", manifest, re.S).group(1)

def norm_parts(tok):
    t = tok.lower().replace('500', 'five hundred')
    t = re.sub(r"[^a-z' -]", ' ', t).replace('-', ' ')
    return t.split()

def words_for(line):
    """Display words of this line with their times (relative to clip start)."""
    if not line['align']:
        toks = line['text'].split()
        span = line['out'] - line['in'] - 0.1
        return [(w, i * span / len(toks), (i + 1) * span / len(toks)) for i, w in enumerate(toks)]
    al = [a for a in json.load(open(os.path.join(BUILD, 'align', line['align'] + '.json'))) if a[0] != '<sil>']
    toks = script_for(line['align']).split()
    out, k = [], 0
    for tok in toks:
        n = len(norm_parts(tok))
        if n == 0:
            continue
        seg = al[k:k + n]
        k += n
        out.append((tok, seg[0][1], seg[-1][2]))
    assert k == len(al), (line['id'], k, len(al))
    return [(w, s, e) for w, s, e in out if s >= line['in'] - 0.05 and e <= line['out'] + 0.05]

words = []
for line in edit['lines']:
    for w, s, e in words_for(line):
        words.append({'line': line['id'], 'w': w, 's': round(line['at'] + s - line['in'], 3),
                      'e': round(line['at'] + e - line['in'], 3)})
json.dump(words, open(os.path.join(BUILD, 'words.json'), 'w'), indent=0)

# ---------- captions ----------
def fmt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'

cues = []
for line in edit['lines']:
    lw = [w for w in words if w['line'] == line['id']]
    cur = []
    for i, w in enumerate(lw):
        cur.append(w)
        text = ' '.join(x['w'] for x in cur)
        nxt = lw[i + 1] if i + 1 < len(lw) else None
        brk = nxt is None or len(text) >= 50 or (re.search(r'[,.!?]$', w['w']) and len(text) >= 22)
        if nxt and len(text + ' ' + nxt['w']) > 62:
            brk = True
        if brk:
            cues.append([cur[0]['s'], cur[-1]['e'], text]); cur = []
for i in range(len(cues) - 1):  # hold each cue until the next one (max 0.6 s gap)
    cues[i][1] = min(cues[i + 1][0] - 0.02, cues[i][1] + 0.6)
cues[-1][1] += 0.4
with open(os.path.join(ROOT, 'captions.srt'), 'w') as f:
    for i, (s, e, t) in enumerate(cues, 1):
        f.write(f'{i}\n{fmt(s)} --> {fmt(e)}\n{t}\n\n')
json.dump([{'s': s, 'e': e, 't': t} for s, e, t in cues], open(os.path.join(BUILD, 'captions.json'), 'w'))

# ---------- narration track ----------
inputs, chains, labels = [], [], []
for i, line in enumerate(edit['lines']):
    inputs += ['-i', os.path.join(VO_DIR, line['clip'] + '.mp3')]
    d = line['out'] - line['in']
    ms = int(line['at'] * 1000)
    chains.append(f"[{i}:a]atrim={line['in']}:{line['out']},asetpts=N/SR/TB,aresample=48000,"
                  f"afade=t=in:d=0.02,afade=t=out:st={d - 0.06:.3f}:d=0.06,adelay={ms}|{ms}[v{i}]")
    labels.append(f'[v{i}]')
fc = ';'.join(chains) + f";anullsrc=r=48000:cl=stereo,atrim=0:{DUR}[base];[base]{''.join(labels)}amix=inputs={len(labels) + 1}:normalize=0:duration=first,pan=stereo|c0=c0|c1=c0[vo]"
vo = os.path.join(BUILD, 'voiceover.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', fc, '-map', '[vo]', '-ar', '48000', vo], check=True)

# ---------- soft whooshes at scene changes (synthesised: original, no licensing issue) ----------
WHOOSH = [12.85, 22.75, 27.05, 36.25, 44.95, 52.05, 63.35, 69.75]
sfx = os.path.join(BUILD, 'sfx.wav')
parts = []
for i, t in enumerate(WHOOSH):
    ms = int((t - 0.55) * 1000)
    parts.append(f"anoisesrc=d=1.1:c=pink:a=0.5:r=48000:seed={i + 3},highpass=f=500,lowpass=f=5200,"
                 f"afade=t=in:d=0.6:curve=exp,afade=t=out:st=0.6:d=0.5:curve=exp,volume=0.16,adelay={ms}|{ms}[w{i}]")
# a gentle low swell + shimmer under the logo reveal
parts.append("sine=f=82:d=3.2:r=48000,afade=t=in:d=0.25,afade=t=out:st=0.6:d=2.6,volume=0.35,adelay=23000|23000[b0]")
parts.append("sine=f=1318:d=2.4:r=48000,tremolo=f=7:d=0.4,afade=t=in:d=0.05,afade=t=out:st=0.1:d=2.3,volume=0.05,adelay=23050|23050[b1]")
parts.append("sine=f=82:d=3.2:r=48000,afade=t=in:d=0.25,afade=t=out:st=0.6:d=2.6,volume=0.3,adelay=69800|69800[b2]")
labs = ''.join(f'[w{i}]' for i in range(len(WHOOSH))) + '[b0][b1][b2]'
fc = ';'.join(parts) + f";anullsrc=r=48000:cl=mono,atrim=0:{DUR}[base];[base]{labs}amix=inputs={len(WHOOSH) + 4}:normalize=0:duration=first,pan=stereo|c0=c0|c1=c0[s]"
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-filter_complex', fc, '-map', '[s]', '-ar', '48000', sfx], check=True)

# ---------- final mix ----------
m = edit['music']
music = os.path.abspath(os.path.join(HERE, m['file']))
mix = os.path.join(BUILD, 'mix.wav')
fc = (f"[1:a]atrim={m['start']}:{m['start'] + DUR},asetpts=N/SR/TB,aresample=48000,volume={m['gainDb']}dB,"
      f"afade=t=in:d={m['fadeIn']},afade=t=out:st={DUR - m['fadeOut']}:d={m['fadeOut']}[mu];"
      f"[0:a]asplit=2[vo][sc];"
      f"[mu][sc]sidechaincompress=threshold=0.02:ratio=6:attack=80:release=600:makeup=1[duck];"
      f"[vo]equalizer=f=180:t=q:w=1:g=-1.5,equalizer=f=3500:t=q:w=1.2:g=1.5[vo2];"
      f"[vo2][duck][2:a]amix=inputs=3:normalize=0:duration=longest,atrim=0:{DUR},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[out]")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vo, '-i', music, '-i', sfx,
                '-filter_complex', fc, '-map', '[out]', '-ar', '48000', mix], check=True)
print('words', len(words), 'cues', len(cues))

# data for the HTML timeline
with open(os.path.join(BUILD, 'timeline-data.js'), 'w') as f:
    f.write('window.CAPTIONS = ' + json.dumps([{'s': s, 'e': e, 't': t} for s, e, t in cues]) + ';\n')
    f.write('window.WORDS = ' + json.dumps(words) + ';\n')
