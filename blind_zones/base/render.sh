#!/usr/bin/env bash
# Сборка Reels-видео из готовых карточек.
# Каждый слайд 3.5 c, итого 14 c, без звука (раздел 6 мастер-документа).
# Использование: render.sh <папка_темы>  (внутри должны быть s1..s4.png)
set -euo pipefail

DIR="${1:?Укажите папку темы, где лежат s1.png..s4.png}"
cd "$DIR"

for f in s1.png s2.png s3.png s4.png; do
  [ -f "$f" ] || { echo "Нет файла: $DIR/$f"; exit 1; }
done

ffmpeg -y -loop 1 -t 3.5 -i s1.png -loop 1 -t 3.5 -i s2.png \
 -loop 1 -t 3.5 -i s3.png -loop 1 -t 3.5 -i s4.png \
 -filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0,format=yuv420p,fps=30[v]" \
 -map "[v]" -c:v libx264 -preset slow -crf 18 -movflags +faststart reel.mp4

echo "Готово: $DIR/reel.mp4"
