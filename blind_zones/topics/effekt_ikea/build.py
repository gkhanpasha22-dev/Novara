# -*- coding: utf-8 -*-
# Тема: effekt_ikea — «Эффект IKEA» (новая тема, не из списка 30)
# Первый пост полностью в новом сжатом стиле (бюджет слов) + анимация.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "base"))
from make import slide
from animate import animated_slide

D = os.path.dirname(os.path.abspath(__file__)) + os.sep

slide("ЭФФЕКТ IKEA", "Сделанное своими руками ценится в разы больше.",
      D + "cover.png", head_size=60, body_size=42)

animated_slide("Сделал сам? Дороже ценишь",
                "Люди платят за свою поделку впятеро больше, чем за чужую.",
                D + "s1.mp4")

animated_slide("Мастерство роли не играет",
                "Свою кривую оригами ты оценишь как работу мастера.",
                D + "s2.mp4")

animated_slide("Эксперимент с оригами, 2012",
                "Свою поделку оценили в 23 цента, чужую в 5.",
                D + "s3.mp4")

animated_slide("Дело не в качестве",
                "Ты ценишь не результат, а вложенный труд.",
                D + "s4.mp4")
