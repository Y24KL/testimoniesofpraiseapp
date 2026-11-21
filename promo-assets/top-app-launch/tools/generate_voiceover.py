"""Generate the narration with Kokoro-82M (Apache-2.0) via kokoro-onnx, one WAV per line.
Usage: python3 tools/generate_voiceover.py <model_dir> [voice] [speed]
model_dir must hold kokoro-v1.0.onnx and voices-v1.0.bin
(github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0)."""
import json, sys, os, soundfile as sf
from kokoro_onnx import Kokoro
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_dir = sys.argv[1]; voice = sys.argv[2] if len(sys.argv) > 2 else 'am_michael'; speed = float(sys.argv[3]) if len(sys.argv) > 3 else 0.92
k = Kokoro(os.path.join(model_dir, 'kokoro-v1.0.onnx'), os.path.join(model_dir, 'voices-v1.0.bin'))
out = os.path.join(here, 'audio', 'vo-lines'); os.makedirs(out, exist_ok=True)
for line in json.load(open(os.path.join(here, 'voiceover-lines.json'))):
    samples, sr = k.create(line['say'], voice=voice, speed=speed, lang='en-us')
    sf.write(os.path.join(out, line['id'] + '.wav'), samples, sr)
    print(line['id'], round(len(samples) / sr, 2))
