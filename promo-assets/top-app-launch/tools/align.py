import sys, re, json, subprocess
from pocketsphinx import Decoder
EXTRA={'loveworld':'L AH V W ER L D','praxiom':'P R AE K S IY AH M','lmm':'EH L EH M EH M','xp':'EH K S P IY','tv':'T IY V IY','programme':'P R OW G R AE M','programmes':'P R OW G R AE M Z'}
NUM={'500':'five hundred'}
audio, text = sys.argv[1], open(sys.argv[2]).read()
t=text.lower()
for k,v in NUM.items(): t=t.replace(k,v)
t=re.sub(r"[^a-z' \n-]"," ",t).replace('-',' ')
words=t.split()
raw=subprocess.run(['ffmpeg','-v','error','-i',audio,'-ar','16000','-ac','1','-f','s16le','-'],capture_output=True).stdout
d=Decoder(samprate=16000,bestpath=False)
for w,p in EXTRA.items():
    if d.lookup_word(w) is None: d.add_word(w,p,True)
for w in set(words):
    if d.lookup_word(w) is None: print('OOV',w,file=sys.stderr)
d.set_align_text(' '.join(words))
d.start_utt(); d.process_raw(raw,full_utt=True); d.end_utt()
d.set_alignment(); d.start_utt(); d.process_raw(raw,full_utt=True); d.end_utt()
out=[(s.name,round(s.start/100,2),round((s.start+s.duration)/100,2)) for s in d.get_alignment()]
json.dump(out,sys.stdout)
