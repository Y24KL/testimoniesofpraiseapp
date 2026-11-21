"""Builds audio/voiceover.wav (narration on the timeline), audio/sfx.wav (original synthesized effects) and
audio/final-mix.wav (VO + ducked music bed + SFX, -14 LUFS). Requires ffmpeg. Reads timeline.json."""
import json, os, subprocess
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(here, *p)
tl = json.load(open(A('timeline.json'))); D = tl['duration']
MUSIC = os.path.join(here, '..', '..', 'assets', 'audio', 'tutorial-bed.mp3')  # team's own recording (docs/VOICEOVERS.md)
MUSIC_OFFSET = 14.0
def ff(*args): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)

# 1) narration on the timeline
ins, f = [], []
for i, v in enumerate(tl['vo']):
    ins += ['-i', A('audio', 'vo-lines', v['id'] + '.wav')]
    f.append(f"[{i}:a]aresample=48000,adelay={int(v['start']*1000)}:all=1[v{i}]")
n = len(tl['vo'])
f.append(''.join(f'[v{i}]' for i in range(n)) + f"amix=inputs={n}:normalize=0,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,"
         f"equalizer=f=3200:t=q:w=1.2:g=2,apad,atrim=0:{D}[vo]")
ff(*ins, '-filter_complex', ';'.join(f), '-map', '[vo]', '-ac', '1', '-ar', '48000', A('audio', 'voiceover.wav'))

# 2) original sound design: soft whooshes on transitions, a gold shimmer on the logo reveals
whoosh = [8.7, 28.8, 54.6, 67.0]; shimmer = [9.6, 68.3]
ins, f = [], []
for i, t in enumerate(whoosh):
    ins += ['-f', 'lavfi', '-i', 'anoisesrc=color=pink:duration=1.6:sample_rate=48000:seed=%d' % (i + 3)]
    f.append(f"[{i}:a]highpass=f=350,lowpass=f=3800,afade=t=in:d=0.9:curve=exp,afade=t=out:st=0.9:d=0.7,volume=0.32,adelay={int(t*1000)}:all=1[w{i}]")
for j, t in enumerate(shimmer):
    k = len(whoosh) + j
    expr = '+'.join(f"{a}*sin(2*PI*{fr}*t)*exp(-{dk}*t)" for a, fr, dk in [(0.22, 659.25, 1.6), (0.18, 987.77, 2.0), (0.14, 1318.5, 2.4), (0.10, 1975.5, 3.0), (0.12, 329.63, 1.2)])
    ins += ['-f', 'lavfi', '-i', f"aevalsrc='{expr}':s=48000:d=3.5"]
    f.append(f"[{k}:a]afade=t=in:d=0.03,aecho=0.8:0.6:120|240:0.35|0.2,volume=0.55,adelay={int(t*1000)}:all=1[s{j}]")
labels = ''.join(f'[w{i}]' for i in range(len(whoosh))) + ''.join(f'[s{j}]' for j in range(len(shimmer)))
f.append(f"{labels}amix=inputs={len(whoosh)+len(shimmer)}:normalize=0,apad,atrim=0:{D}[fx]")
ff(*ins, '-filter_complex', ';'.join(f), '-map', '[fx]', '-ac', '2', '-ar', '48000', A('audio', 'sfx.wav'))

# 3) final mix: music ducked under the narration (sidechain), effects on top, broadcast-style loudness
fc = (f"[1:a]atrim={MUSIC_OFFSET}:{MUSIC_OFFSET+D},asetpts=PTS-STARTPTS,aresample=48000,volume=0.45,"
      f"afade=t=in:d=1.5,afade=t=out:st={D-3.5}:d=3.5[mus];"
      "[0:a]asplit=2[vo1][vo2];[vo2]aformat=channel_layouts=stereo[sc];"
      "[mus][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450:makeup=1[duck];"
      "[vo1]aformat=channel_layouts=stereo,volume=1.0[vos];"
      f"[duck][vos][2:a]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:{D}[out]")
ff('-i', A('audio', 'voiceover.wav'), '-i', MUSIC, '-i', A('audio', 'sfx.wav'), '-filter_complex', fc, '-map', '[out]', '-ar', '48000', A('audio', 'final-mix.wav'))
print('ok')
