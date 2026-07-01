# NOVARA — лендинг студии цифровых продуктов

Кастомный лендинг (демо-проект для портфолио) на **Astro**. Упор на SEO, скорость загрузки
и лёгкие анимации. Архитектура готова к росту до полноценного корпоративного сайта.

## Стек

- **[Astro](https://astro.build)** — островная архитектура, статическая генерация (SSG), zero-JS по умолчанию.
- **CSS** — один файл с дизайн-токенами (custom properties), **светлая и тёмная темы**, fluid-типографика на `clamp()`.
- **TypeScript** — типизированные клиентские скрипты; «тяжёлый» модуль анимаций вынесен в отдельный чанк и грузится лениво.
- **@astrojs/sitemap** — автогенерация `sitemap-index.xml` при сборке.
- **Блог на контент-коллекциях Astro** + **Decap CMS** для редактирования без кода.
- Без внешних CDN и шрифтов на публичных страницах → минимум сетевых запросов.

## Структура

```
.
├── astro.config.mjs            # site, sitemap, compressHTML, dev-хост
├── src/
│   ├── layouts/Layout.astro    # <head>: SEO, OG/Twitter, JSON-LD, инициализация темы
│   ├── pages/
│   │   ├── index.astro         # главная: сборка секций + ленивая загрузка анимаций
│   │   └── blog/               # index.astro (список) + [...slug].astro (статья)
│   ├── content/blog/           # статьи блога (Markdown) — их редактирует CMS
│   ├── content.config.ts       # схема контент-коллекции блога
│   ├── components/             # Header, Hero, Clients, Services, Work, Process,
│   │   │                       #   Stats, Team, Testimonials, FAQ, Contact, Footer
│   ├── scripts/motion.ts       # scroll-reveal + счётчики (ленивый чанк)
│   └── styles/global.css       # дизайн-система: токены (dark/light) + компоненты
├── public/
│   ├── admin/                  # Decap CMS: index.html + config.yml (панель /admin)
│   └── ...                     # favicon, og-image, robots.txt, site.webmanifest
├── netlify.toml                # конфиг деплоя на Netlify
├── .env.example                # PUBLIC_FORM_ENDPOINT для реальной отправки формы
├── DEPLOY.md                   # пошаговая публикация сайта + включение онлайн-CMS
└── dist/                       # результат `npm run build` (в .gitignore)
```

## Команды

```bash
npm install       # установка зависимостей
npm run dev       # http://localhost:4321 (dev-сервер)
npm run build     # прод-сборка в dist/ (+ генерация sitemap)
npm run preview   # локальный предпросмотр собранного dist/
npm run cms       # локальный сервер Decap CMS (для правки контента через /admin)
```

## Ключевые возможности

### Светлая / тёмная тема
- Кнопка-переключатель в шапке (иконки солнце/луна).
- При первой загрузке тема берётся из `localStorage`, иначе — из системной настройки
  (`prefers-color-scheme`). Инлайн-скрипт в `<head>` ставит тему **до первой отрисовки** — нет мигания (FOUC).
- Выбор сохраняется в `localStorage`. Переключение — с мягким кросс-фейдом (отключается при `prefers-reduced-motion`).

### Реальная отправка формы
- Форма шлёт `POST` через `fetch` на эндпоинт из `PUBLIC_FORM_ENDPOINT` (см. `.env.example`).
- Состояния: валидация → «Отправляем…» (кнопка заблокирована) → успех / ошибка.
- Honeypot-поле для защиты от ботов.
- Без заданного эндпоинта форма работает в **демо-режиме** (симуляция успеха) — удобно для превью.

### Блог и CMS (редактирование без кода)
- Статьи — Markdown-файлы в `src/content/blog/`, описаны типобезопасной схемой (`content.config.ts`).
- Страницы `/blog` (список) и `/blog/[slug]` (статья) со своим SEO и разметкой `BlogPosting`.
- **Decap CMS** — визуальная админка на `/admin/`: добавляйте и правьте статьи из браузера.
  Публичные страницы при этом остаются статичными (админка грузится с CDN, вес на сайт не идёт).
- Локально: `npm run cms` + `npm run dev` → http://localhost:4321/admin/. Онлайн-режим — см. `DEPLOY.md`.

### SEO
- Иерархия заголовков `h1 → h2 → h3`, семантические лендмарки.
- `title`, `description`, `canonical` (строится из `site`), Open Graph, Twitter Card.
- **JSON-LD**: `Organization`, `WebSite`, `FAQPage` (rich-результаты для FAQ).
- `sitemap-index.xml` (автогенерация), `robots.txt`, `lang="ru"`.

### Производительность
- SSG: страница — статический HTML, интерактив только там, где нужен (islands).
- **Code splitting**: `motion.ts` грузится динамическим `import()` в `requestIdleCallback`
  и только если не включён `prefers-reduced-motion`.
- `compressHTML`, инлайн критического CSS (`inlineStylesheets: 'auto'`), системные шрифты.
- Анимации на `transform/opacity`, `scroll`-слушатели `passive`.

## Смысловые блоки (12)

Header · Hero · Клиенты · Услуги · Кейсы · Процесс · Цифры · Команда · Отзывы · FAQ · CTA/Контакты · Footer.

## Публикация

Сайт готов к деплою на Netlify (конфиг в `netlify.toml`). Пошаговая инструкция для новичка —
как залить на GitHub, опубликовать и включить онлайн-редактирование через CMS — в **[DEPLOY.md](./DEPLOY.md)**.

## Путь масштабирования до корпоративного сайта

1. **Блог уже на контент-коллекциях** — по тому же шаблону добавляются кейсы, услуги, вакансии
   (`src/content/…` + новые роуты `/cases/[slug]`, `/services/[slug]`, `/careers`).
2. **Sitemap** подхватит новые страницы автоматически.
3. **CMS** уже подключён (Decap); при росте можно перейти на headless CMS (Directus / Strapi / Payload) без переписывания вёрстки.
4. Форма — уже готова к продакшену: задайте `PUBLIC_FORM_ENDPOINT`.

## Что заменить перед продакшеном

- `site` в `astro.config.mjs` — сейчас `https://novarabuild.netlify.app`; поменяйте, если подключите свой домен (влияет на canonical и sitemap). Не забудьте и `Sitemap:` в `public/robots.txt`.
- Реальные тексты, контакты, кейсы, ссылки на соцсети.
- `PUBLIC_FORM_ENDPOINT` в `.env`.
- `public/assets/og-image.svg` → растровый `og-image.png` 1200×630 (часть соцсетей не читает SVG-превью).
