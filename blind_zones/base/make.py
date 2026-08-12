# -*- coding: utf-8 -*-
"""
Базовый модуль генерации карточек для @blind_zones.

Визуальные параметры зафиксированы в мастер-документе (раздел 6) и НЕ меняются
без причины: 1080x1920, фон #0a0a0a, белый текст, красная акцентная линия,
серая бренд-метка «СЛЕПЫЕ ЗОНЫ», шрифт Montserrat (Bold/Medium), без нумерации.

Отличие от версии в документе: пути к шрифтам вычисляются относительно этого
файла (папка ./fonts), поэтому модуль работает в любой среде без правки путей.
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
BG = (10, 10, 10)          # #0a0a0a
WHITE = (255, 255, 255)    # #ffffff
RED = (192, 57, 43)        # #c0392b
GRAY = (140, 140, 140)     # #8c8c8c

_HERE = os.path.dirname(os.path.abspath(__file__))
BOLD = os.path.join(_HERE, "fonts", "Montserrat-Bold.ttf")
REG = os.path.join(_HERE, "fonts", "Montserrat-Medium.ttf")
MARGIN = 110


def wrap(d, text, font, max_w):
    lines = []
    for para in text.split("\n"):
        if not para.strip():
            lines.append("")
            continue
        cur = ""
        for w in para.split():
            test = (cur + " " + w).strip()
            if d.textlength(test, font=font) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
    return lines


# Бюджет слов на слайд (см. MASTER.md, раздел 2) — расчёт под то, чтобы
# текст помещался в 3.5с показа как при тихом чтении, так и при будущей
# озвучке (~2.5-2.8 слова/сек). Заголовок не в счёт бюджета озвучки —
# это визуальный якорь, считывается мгновенно.
HEADLINE_WORD_BUDGET = 4
BODY_WORD_BUDGET = 12


def _check_budget(headline, body, out):
    h_words = len(headline.split())
    b_words = len(body.replace("\n", " ").split())
    if h_words > HEADLINE_WORD_BUDGET:
        print(f"  ! бюджет превышен: заголовок {h_words} слов "
              f"(лимит {HEADLINE_WORD_BUDGET}) в {out}")
    if b_words > BODY_WORD_BUDGET:
        print(f"  ! бюджет превышен: тело {b_words} слов "
              f"(лимит {BODY_WORD_BUDGET}) в {out}")


def slide(headline, body, out, head_size=64, body_size=52):
    _check_budget(headline, body, out)
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f_head = ImageFont.truetype(BOLD, head_size)
    f_body = ImageFont.truetype(REG, body_size)
    f_brand = ImageFont.truetype(BOLD, 30)
    max_w = W - 2 * MARGIN
    hl = wrap(d, headline, f_head, max_w)
    bl = wrap(d, body, f_body, max_w)
    lh_h = int(head_size * 1.34)
    lh_b = int(body_size * 1.42)
    total = len(hl) * lh_h + 70 + 5 + 90 + len(bl) * lh_b
    y = (H - total) / 2
    for line in hl:
        w = d.textlength(line, font=f_head)
        d.text(((W - w) / 2, y), line, font=f_head, fill=WHITE)
        y += lh_h
    y += 70
    d.rectangle([(W - 340) / 2, y, (W + 340) / 2, y + 5], fill=RED)
    y += 5 + 90
    for line in bl:
        w = d.textlength(line, font=f_body)
        d.text(((W - w) / 2, y), line, font=f_body, fill=WHITE)
        y += lh_b
    brand = "СЛЕПЫЕ ЗОНЫ"
    bw = d.textlength(brand, font=f_brand)
    d.text(((W - bw) / 2, 130), brand, font=f_brand, fill=GRAY)
    img.save(out, "PNG")
    print("saved", out)
