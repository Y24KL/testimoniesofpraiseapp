#!/usr/bin/env bash
# Joins the rendered video parts and muxes the final audio mix -> top-app-promo-landscape.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/part_*.mp4 | sort -t_ -k2 -g | sed "s#^#file '$PWD/#; s#\$#'#" > build/parts.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i build/parts.txt -i audio/final-mix.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest \
  -metadata title="Testimonies of Praise — App Promo" top-app-promo-landscape.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate -of compact top-app-promo-landscape.mp4
