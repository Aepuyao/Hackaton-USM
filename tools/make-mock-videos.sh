#!/usr/bin/env bash
# Genera videos de relleno (4 s, 360p) para cada arista de graph.json que
# todavía no tenga su clip. No sobrescribe los videos reales.
# Uso: bash tools/make-mock-videos.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p videos

# Cada clip lleva un tono distinto para distinguirlos (el nombre del tramo
# lo muestra el overlay HTML; no se usa drawtext porque no todos los ffmpeg lo traen).
node -e '
  const g = require("./graph.json");
  g.edges.forEach((e, i) => console.log(`${e.video}\t${(i * 67) % 360}`));
' | while IFS=$'\t' read -r video hue; do
  if [[ -f "$video" ]]; then continue; fi
  echo "Generando $video"
  ffmpeg -loglevel error -nostdin -f lavfi -i "testsrc2=size=640x360:rate=24:duration=4" \
    -vf "hue=h=${hue}" \
    -c:v libx264 -preset veryfast -crf 35 -pix_fmt yuv420p -movflags +faststart -an "$video"
done
