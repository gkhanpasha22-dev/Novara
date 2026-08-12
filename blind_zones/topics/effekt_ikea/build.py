# -*- coding: utf-8 -*-
# Тема: effekt_ikea — «Эффект IKEA» (новая тема, не из списка 30)
# Первый пост полностью в новом сжатом стиле (бюджет слов) + анимация.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "base"))
from make import slide
from animate import animated_slide, write_voiceover_script

D = os.path.dirname(os.path.abspath(__file__)) + os.sep

slide("ЭФФЕКТ IKEA", "Сделанное своими руками ценится в разы больше.",
      D + "cover.png", head_size=60, body_size=42)

SLIDES = [
    ("Сделал сам? Дороже ценишь",
     "Люди платят за свою поделку впятеро больше, чем за чужую."),
    ("Мастерство роли не играет",
     "Свою кривую оригами ты оценишь как работу мастера."),
    ("Эксперимент с оригами, 2012",
     "Свою поделку оценили в 23 цента, чужую в 5."),
    ("Дело не в качестве",
     "Ты ценишь не результат, а вложенный труд."),
]

for i, (headline, body) in enumerate(SLIDES, start=1):
    animated_slide(headline, body, D + f"s{i}.mp4")

write_voiceover_script(SLIDES, D + "voiceover.txt")
