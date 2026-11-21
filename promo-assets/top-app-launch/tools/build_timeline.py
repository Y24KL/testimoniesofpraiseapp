"""Builds timeline.json (VO cue times + caption cues) and captions.srt from voiceover-lines.json and the
generated line WAVs. Edit VO_START to re-time the edit; the composition and the audio mix both read timeline.json."""
import json, os, re, soundfile as sf
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO_START = {'L01': 1.2, 'L02': 4.0, 'L03': 9.5, 'L04': 13.3, 'L05': 24.8, 'L06': 29.3, 'L07': 37.5,
            'L08': 43.0, 'L09': 50.4, 'L10': 55.0, 'L11': 62.9, 'L12': 67.6}
DURATION = 74.5
MAX_CHARS = 58
lines = json.load(open(os.path.join(here, 'voiceover-lines.json')))
vo, caps = [], []
for l in lines:
    info = sf.info(os.path.join(here, 'audio', 'vo-lines', l['id'] + '.wav'))
    start, dur = VO_START[l['id']], info.frames / info.samplerate
    vo.append({'id': l['id'], 'start': start, 'dur': round(dur, 3), 'text': l['text']})
    # split into caption chunks at sentence/clause boundaries, max MAX_CHARS each
    parts = re.split(r'(?<=[.?!:,])\s+', l['text']); chunks, cur = [], ''
    for p in parts:
        if cur and len(cur) + 1 + len(p) > MAX_CHARS: chunks.append(cur); cur = p
        else: cur = (cur + ' ' + p).strip()
    if cur: chunks.append(cur)
    out = []
    for c in chunks:  # word-wrap anything still too long, splitting near the middle
        while len(c) > MAX_CHARS:
            mid = len(c) // 2; cut = min((i for i, ch in enumerate(c) if ch == ' '), key=lambda i: abs(i - mid))
            out.append(c[:cut]); c = c[cut + 1:]
        out.append(c)
    chunks = out
    total = sum(len(c) for c in chunks); t = start
    for c in chunks:
        d = dur * len(c) / total
        caps.append({'start': round(t, 3), 'end': round(t + d, 3), 'text': c}); t += d
for i, c in enumerate(caps):  # hold each caption until the next one (max 0.6 s gap fill)
    nxt = caps[i + 1]['start'] if i + 1 < len(caps) else DURATION
    c['end'] = round(min(nxt, c['end'] + 0.6), 3)
json.dump({'fps': 30, 'width': 1920, 'height': 1080, 'duration': DURATION, 'vo': vo, 'captions': caps},
          open(os.path.join(here, 'timeline.json'), 'w'), indent=1)
def ts(s):
    ms = int(round(s * 1000)); return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
with open(os.path.join(here, 'captions.srt'), 'w') as f:
    for i, c in enumerate(caps, 1): f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
print(len(caps), 'captions; last VO ends', max(v['start'] + v['dur'] for v in vo))
