"""Places the narration lines on the video's timeline, ducks the video's own music under the voice, and muxes:
  audio/voiceover.wav, captions.srt, feature-video-with-voiceover.mp4 (video stream copied untouched)."""
import json, os, subprocess
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(here, *p)
SRC = A('source', 'feature-video-original.mp4')
D = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SRC]))
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
fc = ("[1:a]aresample=48000,volume=0.28[mus];[0:a]asplit=2[vo1][vo2];[vo2]aformat=channel_layouts=stereo[sc];"
      "[mus][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450[duck];"
      "[vo1]aformat=channel_layouts=stereo[vos];"
      f"[duck][vos]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:{D}[out]")
ff('-i', A('audio', 'voiceover.wav'), '-i', SRC, '-filter_complex', fc, '-map', '[out]', '-ar', '48000', A('audio', 'final-mix.wav'))
ff('-i', SRC, '-i', A('audio', 'final-mix.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
   '-movflags', '+faststart', '-shortest', A('feature-video-with-voiceover.mp4'))
import soundfile as sf
def ts(s):
    ms = int(round(s * 1000)); return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
with open(A('captions.srt'), 'w') as o:
    for i, l in enumerate(L, 1):
        info = sf.info(A('audio', 'vo-lines', l['id'] + '.wav'))
        o.write(f"{i}\n{ts(l['start'])} --> {ts(min(D, l['start'] + info.frames / info.samplerate + .3))}\n{l['text']}\n\n")
print('ok')
