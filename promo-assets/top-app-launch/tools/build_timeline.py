"""Builds timeline.json (VO cue times + caption cues) and captions.srt from voiceover-lines.json and the
generated line WAVs. Edit VO_START to re-time the edit; the composition and the audio mix both read timeline.json.

Captions use the script text exactly as it is spoken. Each line is split into readable chunks at punctuation, and
each chunk boundary is snapped to a real pause detected in that line's audio, so captions change when the voice does."""
import json, os, re
import numpy as np, soundfile as sf
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO_START = {'L01': 1.0, 'L02': 3.75, 'L03': 8.8, 'L04': 12.3, 'L05': 23.5, 'L06': 27.6, 'L07': 35.4,
            'L08': 40.55, 'L09': 45.9, 'L10': 50.0, 'L11': 57.4, 'L12': 61.8, 'L13': 66.6, 'L14': 70.6}
DURATION = 74.5
MAX_CHARS = 50

def chunks_of(text):
    out = []
    for sentence in re.split(r'(?<=[.?!])\s+', text):  # a caption never spans two sentences
        cur = ''
        for p in re.split(r'(?<=,)\s+', sentence):
            if cur and len(cur) + 1 + len(p) > MAX_CHARS: out.append(cur); cur = p
            else: cur = (cur + ' ' + p).strip()
        if cur: out.append(cur)
    res = []
    for c in out:  # anything still too long: split at the space nearest the middle
        while len(c) > MAX_CHARS:
            mid = len(c) // 2; cut = min((i for i, ch in enumerate(c) if ch == ' '), key=lambda i: abs(i - mid))
            res.append(c[:cut]); c = c[cut + 1:]
        res.append(c)
    return res

def pauses(path):
    """Speech start/end and the midpoints of internal pauses (>=90 ms below -38 dBFS), in seconds."""
    x, sr = sf.read(path); x = x if x.ndim == 1 else x.mean(1); hop = int(sr * .01)
    rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    loud = 20 * np.log10(rms) > -38; idx = np.where(loud)[0]
    s0, s1 = idx[0] * .01, (idx[-1] + 1) * .01; mids, run = [], 0
    for i in range(idx[0], idx[-1] + 1):
        if not loud[i]: run += 1
        else:
            if run >= 9: mids.append((i - run / 2) * .01)
            run = 0
    return s0, s1, mids

lines = json.load(open(os.path.join(here, 'voiceover-lines.json')))
vo, caps = [], []
for l in lines:
    path = os.path.join(here, 'audio', 'vo-lines', l['id'] + '.wav'); info = sf.info(path)
    start, dur = VO_START[l['id']], info.frames / info.samplerate
    vo.append({'id': l['id'], 'start': start, 'dur': round(dur, 3), 'text': l['text']})
    s0, s1, mids = pauses(path); ch = chunks_of(l['text'])
    total = sum(len(c) for c in ch); bounds = [s0]; acc = 0
    for c in ch[:-1]:  # proportional guess, then snap to the nearest real pause
        acc += len(c); guess = s0 + (s1 - s0) * acc / total
        bounds.append(min(mids, key=lambda m: abs(m - guess)) if mids and min(abs(m - guess) for m in mids) < .8 else guess)
    bounds.append(s1)
    for i, c in enumerate(ch):
        caps.append({'start': round(start + bounds[i], 3), 'end': round(start + bounds[i + 1], 3), 'text': c})
for i, c in enumerate(caps):  # hold each caption a little after the voice, never past the next one
    nxt = caps[i + 1]['start'] if i + 1 < len(caps) else DURATION
    c['end'] = round(min(nxt, c['end'] + 0.45), 3)
json.dump({'fps': 30, 'width': 1920, 'height': 1080, 'duration': DURATION, 'vo': vo, 'captions': caps},
          open(os.path.join(here, 'timeline.json'), 'w'), indent=1)
def ts(s):
    ms = int(round(s * 1000)); return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
with open(os.path.join(here, 'captions.srt'), 'w') as f:
    for i, c in enumerate(caps, 1): f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
print(len(caps), 'captions; last VO ends', round(max(v['start'] + v['dur'] for v in vo), 2))
