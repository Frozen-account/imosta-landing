# Style guide

Токены сняты с https://imosta.pl/ru/ (WordPress + Astra + Elementor) 2026-10-15.

| Токен | Значение | Откуда |
|---|---|---|
| Primary | `#D11329` | `--ast-global-color-0`, кнопки и акценты Elementor |
| Secondary | `#151515` | тёмные иконки/поверхности (основной текст — чистый `#000`) |
| Background | `#FFFFFF` / alt `#FBF3F2` | фоны секций в `post-9527.css` |
| Text | `#000000` / muted `#5F5F5F` | `--ast-global-color-1/8` |
| Soft accent | `#F6DFDC` | бордеры карточек |
| Шрифт | **Montserrat** 400/500/600/700, cyrillic | Google Fonts, 22+ использований в Elementor CSS |

Подключённые шрифты: Google Fonts — Montserrat, Inter, Open Sans, Poppins (последние два — дефолты темы Astra, в контенте почти не используются). Typekit и локальных WOFF2 нет.

Глобальные цвета Elementor Kit (`#6EC1E4`, `#61CE70`, `#54595F`, `#7A7A7A`) — заводские значения, на сайте не используются; в токены не включены.

Кнопки: прямоугольные (radius 0), бордер 2px; варианты «заливка primary» и «outline primary».

Файлы: `tokens.css` (CSS-переменные), `tokens.json` (исходник с пояснениями).
