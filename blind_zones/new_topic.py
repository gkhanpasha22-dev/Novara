# -*- coding: utf-8 -*-
"""
Создаёт папку новой темы в topics/<slug>/ с заготовками:
  - build.py    — заполнить текстами карточек и запустить: python3 build.py
  - report.md   — доклад владельцу по обязательной структуре (7 разделов)

Использование:
    python3 new_topic.py <slug>
Например:
    python3 new_topic.py izvineniya
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

BUILD_TEMPLATE = '''# -*- coding: utf-8 -*-
# Тема: {slug}
# Заполни заголовки и тексты, затем: python3 build.py
#
# БЮДЖЕТ СЛОВ (MASTER.md, раздел 2, под озвучку и лёгкое чтение):
#   заголовок — 3-4 слова (визуальный якорь, вне бюджета озвучки)
#   тело — ОДНО короткое предложение, максимум 10-12 слов
# Слайд показывается 5с (было 3.5с до 2026-08-08 — увеличено, чтобы
# озвучке не приходилось сжиматься/ускоряться и звучать монотонно).
# make.py и animate.py печатают предупреждение, если лимит слов превышен.
#
# После генерации собери финальный ролик:
#   bash ../../base/render_animated.sh .
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "base"))
from make import slide
from animate import animated_slide

D = os.path.dirname(os.path.abspath(__file__)) + os.sep

# Обложка — статичная картинка (Instagram требует её отдельным файлом
# при загрузке, раздел 8 MASTER.md) — крупный заголовок + подзаголовок
slide("ЗАГОЛОВОК ОБЛОЖКИ", "Короткий подзаголовок.", D + "cover.png", head_size=64, body_size=46)

# 4 слайда по структуре: Удар / Разрыв / Механизм-данные / Приземление —
# теперь видео-сегменты со стилем "постепенное появление слов"
# (утверждён владельцем как стандарт, а не "смена фраз")
animated_slide("Удар", "Дерзкое утверждение.", D + "s1.mp4")
animated_slide("Разрыв", "Где мнение расходится с реальностью.", D + "s2.mp4")
animated_slide("Механизм", "Конкретный эксперимент и цифры.", D + "s3.mp4")
animated_slide("Приземление", "Один практический вывод.", D + "s4.mp4")
'''

REPORT_TEMPLATE = '''# Доклад к посту: {slug}

*Доклад для владельца: понять тему глубже карточек и уметь защитить каждый тезис в комментариях.*

---

## 1. Суть заблуждения


## 2. Что показали исследования — и как они устроены


## 3. Механизм


## 4. Границы честности: что НЕ утверждаем


## 5. Совместимость с принципами


## 6. Вероятные вопросы в комментариях — и ответы


## 7. Источники

'''


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    slug = sys.argv[1].strip()
    topic_dir = os.path.join(HERE, "topics", slug)
    if os.path.exists(topic_dir):
        print("Папка уже существует:", topic_dir)
        sys.exit(1)
    os.makedirs(topic_dir)
    with open(os.path.join(topic_dir, "build.py"), "w", encoding="utf-8") as f:
        f.write(BUILD_TEMPLATE.format(slug=slug))
    with open(os.path.join(topic_dir, "report.md"), "w", encoding="utf-8") as f:
        f.write(REPORT_TEMPLATE.format(slug=slug))
    print("Создано:", topic_dir)
    print("  build.py  — заполни тексты и запусти: python3 build.py")
    print("  report.md — заполни доклад (7 разделов)")


if __name__ == "__main__":
    main()
