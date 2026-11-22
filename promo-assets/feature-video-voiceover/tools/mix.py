"""Places the narration lines on the video's timeline, ducks the video's own music under the voice, and muxes:
  audio/voiceover.wav, captions.srt, feature-video-with-voiceover.mp4 (video stream copied untouched)."""
import json, os, subprocess
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(here, *p)
SRC = A('source', 'feature-video-original.mp4')
# The original fades to black from 59.5 s. We cut there, crossfade (0.5 s) into the LoveWorld AppStore end card
# (endcard/endcard.html, rendered to build/endcard.mp4 by tools/render_endcard.mjs), which holds to the last frame.
CUT, XF, CARD = 59.5, 0.5, 7.0
D = CUT - XF + CARD  # 66.0 s
# Music under the end card: the original track's own closing section (52.1–59.4 s) crossfaded on after the cut.
MUS_A, MUS_B, MUS_XF = 52.1, 59.4, 0.8
L = json.load(open(A('vo-lines.json')))
def ff(*a): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *a], check=True)
ins, f = [], []
for i, l in enumerate(L):
    ins += ['-i', A('audio', 'vo-lines', l['id'] + '.wav')]
    f.append(f"[{i}:a]aresample=48000,adelay={int(l['start']*1000)}:all=1[v{i}]")
f.append(''.join(f'[v{i}]' for i in range(len(L))) + f"amix=inputs={len(L)}:normalize=0,highpass=f=70,"
         "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,equalizer=f=3200:t=q:w=1.2:g=2,"
         f"apad,atrim=0:{D}[vo]")
ff(*ins, '-filter_complex', ';'.join(f), '-map', '[vo]', '-ac', '1', '-ar', '48000', A('audio', 'voiceover.wav'))
fc = (f"[1:a]atrim=0:{CUT},asetpts=PTS-STARTPTS,aresample=48000[a1];[2:a]atrim={MUS_A}:{MUS_B},asetpts=PTS-STARTPTS,aresample=48000[a2];"
      f"[a1][a2]acrossfade=d={MUS_XF},afade=t=out:st={D-1.6}:d=1.6,volume=0.28[mus];"
      "[0:a]asplit=2[vo1][vo2];[vo2]aformat=channel_layouts=stereo[sc];"
      "[mus][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450[duck];"
      "[vo1]aformat=channel_layouts=stereo[vos];"
      f"[duck][vos]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:{D}[out]")
ff('-i', A('audio', 'voiceover.wav'), '-i', SRC, '-i', SRC, '-filter_complex', fc, '-map', '[out]', '-ar', '48000', A('audio', 'final-mix.wav'))
vf = (f"[0:v]trim=0:{CUT},setpts=PTS-STARTPTS,fps=30,format=yuv420p[v0];[1:v]fps=30,format=yuv420p,setsar=1[v1];"
      f"[v0][v1]xfade=transition=fade:duration={XF}:offset={CUT-XF}[v]")  # ends on the end card, no fade to black
ff('-i', SRC, '-i', A('build', 'endcard.mp4'), '-i', A('audio', 'final-mix.wav'), '-filter_complex', vf, '-map', '[v]', '-map', '2:a',
   '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
   '-movflags', '+faststart', '-t', str(D), A('feature-video-with-voiceover.mp4'))
import soundfile as sf
def ts(s):
    ms = int(round(s * 1000)); return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
with open(A('captions.srt'), 'w') as o:
    for i, l in enumerate(L, 1):
        info = sf.info(A('audio', 'vo-lines', l['id'] + '.wav'))
        o.write(f"{i}\n{ts(l['start'])} --> {ts(min(D, l['start'] + info.frames / info.samplerate + .3))}\n{l['text']}\n\n")
print('ok')
