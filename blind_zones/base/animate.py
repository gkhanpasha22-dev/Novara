# -*- coding: utf-8 -*-
"""
Анимированные карточки для @blind_zones — тот же визуальный стиль, что
и в make.py (фон/шрифты/цвета/раскладка), но текст появляется постепенно
вместо мгновенного показа. Используется для s1-s4 (cover.png остаётся
статичной картинкой — раздел 8 MASTER.md).

animated_slide() — СТАНДАРТ, утверждённый владельцем 2026-08-08: слова
тела появляются по одному и остаются (накопление), заголовок и красная
линия проявляются один раз в начале. Используется в шаблоне new_topic.py.

animated_slide_phrases() — альтернативный стиль "смена фраз" (слова
группами по 2-3, каждая группа гаснет перед следующей), рассмотрен
и отклонён владельцем в пользу первого варианта — оставлен в коде
на случай, если понадобится для отдельной темы.

Рендерит последовательность PNG-кадров во временную папку и склеивает
их в mp4 через ffmpeg. Раскладка (перенос строк, центрирование) —
идентична статичной версии, поэтому кадр в момент "всё показано"
пиксель-в-пиксель совпадает со статичной карточкой из make.py.

Использование:
    from animate import animated_slide
    animated_slide("Заголовок", "Короткое тело.", "s1.mp4")
    # ... затем bash ../../base/render_animated.sh . склеит s1-s4 в reel.mp4
"""
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

from make import (W, H, BG, WHITE, RED, GRAY, BOLD, REG, MARGIN, wrap,
                   _check_budget)

FPS = 30


def _layout(d, headline, body, head_size, body_size):
    f_head = ImageFont.truetype(BOLD, head_size)
    f_body = ImageFont.truetype(REG, body_size)
    f_brand = ImageFont.truetype(BOLD, 30)
    max_w = W - 2 * MARGIN
    hl = wrap(d, headline, f_head, max_w)
    bl = wrap(d, body, f_body, max_w)
    lh_h = int(head_size * 1.34)
    lh_b = int(body_size * 1.42)
    total = len(hl) * lh_h + 70 + 5 + 90 + len(bl) * lh_b
    y0 = (H - total) / 2
    return f_head, f_body, f_brand, hl, bl, lh_h, lh_b, y0


def _word_positions(d, line, font, x0):
    """Возвращает [(word, x), ...] для слов строки, уже отцентрованной."""
    words = line.split(" ")
    line_w = d.textlength(line, font=font)
    x = x0 - line_w / 2 + W / 2
    out = []
    for w in words:
        out.append((w, x))
        x += d.textlength(w + " ", font=font)
    return out


def _frame(headline, body, head_size, body_size,
           head_alpha, line_progress, n_words_shown):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f_head, f_body, f_brand, hl, bl, lh_h, lh_b, y0 = _layout(
        d, headline, body, head_size, body_size)

    # заголовок — фейд-ин (отдельный RGBA-слой ради альфы)
    y = y0
    if head_alpha > 0:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        yy = y
        for line in hl:
            w = ld.textlength(line, font=f_head)
            ld.text(((W - w) / 2, yy), line, font=f_head,
                     fill=WHITE + (int(255 * head_alpha),))
            yy += lh_h
        img.paste(layer.convert("RGB"), (0, 0), mask=layer.split()[3])
    y += len(hl) * lh_h

    # красная линия — "рисуется" слева направо
    y += 70
    full_w = 340
    cur_w = int(full_w * line_progress)
    if cur_w > 0:
        x0 = (W - full_w) / 2
        d.rectangle([x0, y, x0 + cur_w, y + 5], fill=RED)
    y += 5 + 90

    # тело — слова появляются по одному, позиции фиксированы заранее
    word_i = 0
    for line in bl:
        for word, x in _word_positions(d, line, f_body, 0):
            if word_i < n_words_shown:
                d.text((x, y), word, font=f_body, fill=WHITE)
            word_i += 1
        y += lh_b

    brand = "СЛЕПЫЕ ЗОНЫ"
    bw = d.textlength(brand, font=f_brand)
    d.text(((W - bw) / 2, 130), brand, font=f_brand, fill=GRAY)
    return img


def _split_chunks(body, chunk_size=3):
    """Делит тело на группы слов (словосочетания) фиксированного размера."""
    words = body.replace("\n", " ").split()
    return [" ".join(words[i:i + chunk_size])
            for i in range(0, len(words), chunk_size)]


def _frame_phrases(headline, head_size, body_size, chunk, chunk_alpha,
                    head_alpha, line_progress):
    """Кадр для стиля 'смена фраз' — headline статичен, тело показывает
    только одно текущее словосочетание, которое гаснет и сменяется
    следующим (не накапливается)."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f_head = ImageFont.truetype(BOLD, head_size)
    f_body = ImageFont.truetype(REG, body_size)
    f_brand = ImageFont.truetype(BOLD, 30)
    max_w = W - 2 * MARGIN
    hl = wrap(d, headline, f_head, max_w)
    lh_h = int(head_size * 1.34)
    lh_b = int(body_size * 1.42)
    # тело всегда занимает одну строку (одно словосочетание за раз)
    total = len(hl) * lh_h + 70 + 5 + 90 + lh_b
    y = (H - total) / 2

    if head_alpha > 0:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        yy = y
        for line in hl:
            w = ld.textlength(line, font=f_head)
            ld.text(((W - w) / 2, yy), line, font=f_head,
                     fill=WHITE + (int(255 * head_alpha),))
            yy += lh_h
        # paste с маской-альфой самого слоя — докладывается НА текущий
        # img, а не заменяет его целиком (иначе стирает то, что уже
        # нарисовано в этом кадре: линию, предыдущий слой и т.д.)
        img.paste(layer.convert("RGB"), (0, 0), mask=layer.split()[3])
    y += len(hl) * lh_h

    y += 70
    full_w = 340
    cur_w = int(full_w * line_progress)
    if cur_w > 0:
        x0 = (W - full_w) / 2
        d.rectangle([x0, y, x0 + cur_w, y + 5], fill=RED)
    y += 5 + 90

    if chunk and chunk_alpha > 0:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        w = ld.textlength(chunk, font=f_body)
        ld.text(((W - w) / 2, y), chunk, font=f_body,
                 fill=WHITE + (int(255 * chunk_alpha),))
        img.paste(layer.convert("RGB"), (0, 0), mask=layer.split()[3])

    brand = "СЛЕПЫЕ ЗОНЫ"
    bw = d.textlength(brand, font=f_brand)
    d.text(((W - bw) / 2, 130), brand, font=f_brand, fill=GRAY)
    return img


def animated_slide_phrases(headline, body, out_mp4, duration=3.5,
                            head_size=64, body_size=52,
                            chunk_size=3, hold_tail=0.3):
    """Стиль 'смена фраз' (kinetic typography / RSVP по словосочетаниям):
    headline проявляется и остаётся, тело показывает по одному
    словосочетанию за раз — оно гаснет, вместо него появляется
    следующее (без накопления)."""
    _check_budget(headline, body, out_mp4)
    chunks = _split_chunks(body, chunk_size)
    n_frames = int(FPS * duration)
    head_end = int(FPS * 0.3)
    line_end = int(FPS * 0.7)
    hold_frames = int(FPS * hold_tail)
    cycle_start, cycle_end = line_end, n_frames - hold_frames
    cycle_len = max(cycle_end - cycle_start, 1)
    n_chunks = max(len(chunks), 1)
    per_chunk = cycle_len / n_chunks
    fade = max(int(per_chunk * 0.18), 2)  # доля окна на фейд ин/аут

    tmp = tempfile.mkdtemp(prefix="bz_anim_")
    try:
        for i in range(n_frames):
            head_alpha = min(1.0, i / max(head_end, 1))
            line_progress = 0.0 if i < head_end else min(
                1.0, (i - head_end) / max(line_end - head_end, 1))

            chunk, chunk_alpha = "", 0.0
            if cycle_start <= i < cycle_end:
                local = i - cycle_start
                idx = min(int(local / per_chunk), n_chunks - 1)
                chunk = chunks[idx]
                pos = local - idx * per_chunk
                if pos < fade:
                    chunk_alpha = pos / fade
                elif pos > per_chunk - fade:
                    chunk_alpha = max(0.0, (per_chunk - pos) / fade)
                else:
                    chunk_alpha = 1.0
            elif i >= cycle_end and chunks:
                # финальный хвост держит последнее словосочетание видимым
                chunk, chunk_alpha = chunks[-1], 1.0

            img = _frame_phrases(headline, head_size, body_size,
                                 chunk, chunk_alpha, head_alpha, line_progress)
            img.save(os.path.join(tmp, f"f{i:04d}.png"))

        subprocess.run([
            "ffmpeg", "-y", "-framerate", str(FPS),
            "-i", os.path.join(tmp, "f%04d.png"),
            "-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", out_mp4,
        ], check=True, capture_output=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("saved", out_mp4, f"({len(chunks)} фраз, {duration}с)")


def animated_slide(headline, body, out_mp4, duration=3.5,
                    head_size=64, body_size=52, hold=0.5):
    """Собирает mp4 одной карточки с постепенным появлением текста."""
    _check_budget(headline, body, out_mp4)
    total_words = len(body.replace("\n", " ").split())
    n_frames = int(FPS * duration)
    head_end = int(FPS * 0.3)      # заголовок проявляется 0.3с
    line_end = int(FPS * 0.7)      # линия дорисовывается к 0.7с
    hold_frames = int(FPS * hold)
    reveal_start, reveal_end = line_end, n_frames - hold_frames

    tmp = tempfile.mkdtemp(prefix="bz_anim_")
    try:
        for i in range(n_frames):
            head_alpha = min(1.0, i / max(head_end, 1))
            line_progress = 0.0 if i < head_end else min(
                1.0, (i - head_end) / max(line_end - head_end, 1))
            if i < reveal_start:
                n_words_shown = 0
            elif i >= reveal_end:
                n_words_shown = total_words
            else:
                frac = (i - reveal_start) / max(reveal_end - reveal_start, 1)
                n_words_shown = int(frac * total_words)
            img = _frame(headline, body, head_size, body_size,
                         head_alpha, line_progress, n_words_shown)
            img.save(os.path.join(tmp, f"f{i:04d}.png"))

        subprocess.run([
            "ffmpeg", "-y", "-framerate", str(FPS),
            "-i", os.path.join(tmp, "f%04d.png"),
            "-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", out_mp4,
        ], check=True, capture_output=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("saved", out_mp4, f"({total_words} слов в теле, {duration}с)")
