#!/usr/bin/env bash
# Восстановление рабочей среды @blind_zones после сброса контейнера.
# Системные пакеты (Pillow, ffmpeg) НЕ переживают полный сброс среды —
# этот скрипт ставит их заново. Шрифты и make.py лежат в git, поэтому
# отдельно скачивать их не нужно; скрипт лишь проверяет, что они на месте.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== 1. Python Pillow =="
if python3 -c "import PIL" 2>/dev/null; then
  echo "   Pillow уже установлен: $(python3 -c 'import PIL; print(PIL.__version__)')"
else
  pip3 install pillow --break-system-packages
fi

echo "== 2. ffmpeg =="
if command -v ffmpeg >/dev/null 2>&1; then
  echo "   ffmpeg уже установлен: $(ffmpeg -version | head -1)"
else
  apt-get update -qq
  apt-get install -y --no-install-recommends ffmpeg
fi

echo "== 3. Шрифты Montserrat =="
FB="$HERE/base/fonts/Montserrat-Bold.ttf"
FM="$HERE/base/fonts/Montserrat-Medium.ttf"
for f in "$FB" "$FM"; do
  if [ -f "$f" ]; then
    echo "   OK: $f"
  else
    echo "   ОТСУТСТВУЕТ: $f — качаю из репозитория Montserrat"
    base_url="https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf"
    curl -fsSL -o "$f" "$base_url/$(basename "$f")"
  fi
done

echo "== 4. Проверка пайплайна =="
python3 "$HERE/base/make.py" >/dev/null 2>&1 || true
python3 - "$HERE" <<'PY'
import sys, os
sys.path.insert(0, os.path.join(sys.argv[1], "base"))
from make import slide
tmp = os.path.join(sys.argv[1], "_selftest.png")
slide("ПРОВЕРКА", "Среда собрана корректно.", tmp)
os.remove(tmp)
print("   Пайплайн генерации карточек работает.")
PY

echo ""
echo "Готово. Среда @blind_zones восстановлена."
