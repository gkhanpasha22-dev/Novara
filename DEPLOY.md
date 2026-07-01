# Как опубликовать сайт и включить онлайн-редактирование (CMS)

Ниже — путь для новичка. Всё бесплатно. Нужны два аккаунта: **GitHub** (хранит код) и **Netlify** (публикует сайт).

Итоговая схема:

```
Вы редактируете текст в браузере  →  /admin  →  правка сохраняется в GitHub
      →  Netlify пересобирает сайт  →  через ~минуту это уже онлайн
```

---

## Шаг 1. GitHub — залить код

1. Зарегистрируйтесь на https://github.com (если ещё нет аккаунта).
2. Нажмите **New repository**, назовите его, например, `novara`, оставьте **Public**, создайте.
3. В терминале в папке проекта выполните (подставьте свой логин вместо `USERNAME`):

```bash
git init
git add .
git commit -m "NOVARA site"
git branch -M main
git remote add origin https://github.com/USERNAME/novara.git
git push -u origin main
```

> Ветка должна называться `main` — это же значение стоит в `public/admin/config.yml` (`branch: main`).

---

## Шаг 2. Netlify — опубликовать

1. Зарегистрируйтесь на https://netlify.com через ваш GitHub-аккаунт.
2. **Add new site → Import an existing project → GitHub**, выберите репозиторий `novara`.
3. Настройки сборки Netlify подхватит автоматически из `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Нажмите **Deploy**. Через минуту сайт будет доступен по адресу вида
   `https://ваше-имя.netlify.app` — **это и есть публичная ссылка, которую можно давать людям.**

---

## Шаг 3. Включить онлайн-редактирование через CMS

Чтобы заходить на `ваш-сайт.netlify.app/admin/` и менять контент из браузера:

1. В панели Netlify откройте сайт → **Integrations / Identity** → **Enable Identity**.
2. **Identity → Registration preferences → Invite only** (чтобы никто чужой не зарегистрировался).
3. **Identity → Services → Git Gateway → Enable Git Gateway.**
4. **Identity → Invite users** → впишите свой email → примите письмо-приглашение, задайте пароль.
5. Готово. Заходите на `https://ваш-сайт.netlify.app/admin/`, входите по своему email/паролю —
   и редактируете статьи блога визуально. Каждое сохранение автоматически публикуется.

---

## Локальное редактирование (без интернета и деплоя)

Хотите править контент у себя на компьютере:

1. Терминал 1: `npm run dev` (запускает сайт на http://localhost:4321).
2. Терминал 2: `npm run cms` (локальный сервер CMS).
3. Откройте **http://localhost:4321/admin/** — правки сохраняются прямо в файлы `src/content/blog/`.

---

## Форма обратной связи

Сейчас форма работает в демо-режиме. Чтобы заявки реально приходили:

1. Заведите бесплатный приёмник, например на https://formspree.io — получите URL вида
   `https://formspree.io/f/xxxxxxxx`.
2. В Netlify: **Site settings → Environment variables → Add** переменную
   `PUBLIC_FORM_ENDPOINT` со значением этого URL. Пересоберите сайт (**Deploys → Trigger deploy**).
   Локально — скопируйте `.env.example` в `.env` и впишите туда же.

---

## Свой домен (по желанию)

1. Netlify → **Domain settings → Add a domain** — привяжите купленный домен или используйте бесплатный `*.netlify.app`.
2. После смены домена обновите строку `site: 'https://...'` в `astro.config.mjs`
   (влияет на канонические ссылки и sitemap) и адреса в `public/robots.txt`.

---

## Чек-лист перед публикацией

- [ ] Заменить тексты, контакты и кейсы на реальные.
- [ ] `site` в `astro.config.mjs` — на ваш домен.
- [ ] `PUBLIC_FORM_ENDPOINT` — задан.
- [ ] `og-image.svg` → сделать растровый `og-image.png` 1200×630 (часть соцсетей не читает SVG-превью).
