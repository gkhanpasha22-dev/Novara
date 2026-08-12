#!/usr/bin/env bash
# Сборка Reels-видео из АНИМИРОВАННЫХ сегментов (постепенное появление
# слов — стиль утверждён владельцем как стандарт). Каждый сегмент уже
# закодирован на 3.5с через animate.py — здесь только склейка без
# повторного кодирования (быстро, без потери качества).
# Использование: render_animated.sh <папка_темы>  (внутри s1.mp4..s4.mp4)
set -euo pipefail

DIR="${1:?Укажите папку темы, где лежат s1.mp4..s4.mp4}"
cd "$DIR"

for f in s1.mp4 s2.mp4 s3.mp4 s4.mp4; do
  [ -f "$f" ] || { echo "Нет файла: $DIR/$f"; exit 1; }
done

LIST=$(mktemp)
trap 'rm -f "$LIST"' EXIT
for f in s1.mp4 s2.mp4 s3.mp4 s4.mp4; do
  echo "file '$(pwd)/$f'" >> "$LIST"
done

ffmpeg -y -f concat -safe 0 -i "$LIST" -c copy -movflags +faststart reel.mp4

echo "Готово: $DIR/reel.mp4"
