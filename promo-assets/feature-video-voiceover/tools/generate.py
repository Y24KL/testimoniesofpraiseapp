"""Generates each narration line with Kokoro (am_michael) and speeds a line up (max 1.2x) only if it would overrun
its scene window. Usage: python3 tools/generate.py <kokoro_model_dir>"""
import json, os, sys, soundfile as sf
from kokoro_onnx import Kokoro
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
k = Kokoro(os.path.join(sys.argv[1], 'kokoro-v1.0.onnx'), os.path.join(sys.argv[1], 'voices-v1.0.bin'))
SAY = {'Praxiom': 'Praxium'}
for l in json.load(open(os.path.join(here, 'vo-lines.json'))):
    text = l['text']
    for a, b in SAY.items(): text = text.replace(a, b)
    room = l['end'] - l['start']; speed = 0.96
    while True:
        x, sr = k.create(text, voice='am_michael', speed=speed, lang='en-us')
        if len(x) / sr <= room or speed >= 1.2: break
        speed = min(1.2, speed * (len(x) / sr) / room + 0.01)
    sf.write(os.path.join(here, 'audio', 'vo-lines', l['id'] + '.wav'), x, sr)
    print(l['id'], f'{len(x)/sr:.2f}s of {room:.1f}s window, speed {speed:.2f}')
