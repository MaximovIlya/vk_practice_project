# Quiz Platform

Веб-приложение для проведения квизов в реальном времени. Организаторы создают квизы и управляют сессиями, участники подключаются по коду комнаты и отвечают на вопросы вживую.

**Демо:** https://vk-practice-project.vercel.app/login

## Стек технологий

| Слой | Технология |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Next.js API Routes, Socket.IO |
| База данных | PostgreSQL + Prisma ORM |
| Аутентификация | NextAuth.js (JWT, Google OAuth) |
| Хранилище файлов | Vercel Blob |

## Возможности

**Организатор**
- Регистрация и вход (email/пароль или Google)
- Создание квиза: название, категория, сложность, теги, обложка
- Добавление вопросов: текст или изображение, одиночный / множественный выбор, таймер и баллы на вопрос
- Запуск сессии — генерация 6-значного кода комнаты
- Управление ходом квиза в реальном времени: переключение вопросов, просмотр лидерборда
- Личный кабинет: список квизов, история сессий, результаты

**Участник**
- Регистрация и вход
- Подключение к активному квизу по коду комнаты
- Ответы на вопросы в режиме реального времени (ответ принимается только пока вопрос активен)
- Просмотр лидерборда по завершении квиза
- Личный кабинет: история участия и набранные баллы

## Запуск

### Требования
- Node.js 18+
- PostgreSQL

### Установка

```bash
git clone <repo-url>
cd vk_practice
npm install
```

Создайте файл `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/quiz_db
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (опционально)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Vercel Blob (для загрузки изображений)
BLOB_READ_WRITE_TOKEN=...
```

Применить миграции и запустить:

```bash
npx prisma migrate dev
npm run dev
```

Приложение будет доступно по адресу [http://localhost:3000](http://localhost:3000).

## Структура проекта

```
vk_practice/
├── prisma/
│   └── schema.prisma          # Модели БД
├── public/
│   └── uploads/               # Загруженные изображения
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/login/      # Вход
│   │   ├── (auth)/register/   # Регистрация
│   │   ├── dashboard/         # Личный кабинет
│   │   ├── quiz/create/       # Создание квиза
│   │   ├── quiz/[id]/edit/    # Редактирование квиза
│   │   ├── quiz/[id]/run/     # Проведение квиза (организатор)
│   │   ├── play/[code]/       # Участие в квизе
│   │   └── results/[sessionId]/ # Результаты сессии
│   ├── components/            # UI-компоненты
│   ├── lib/                   # Prisma client, NextAuth config, Socket.IO helper
│   └── server/                # Socket.IO сервер
├── server.ts                  # Кастомный Node-сервер (Next.js + Socket.IO)
└── .env                       # Переменные окружения (не коммитится)
```

## WebSocket события

| Событие | Направление | Описание |
|---|---|---|
| `join-room` | клиент → сервер | Участник входит в сессию по коду |
| `start-quiz` | организатор → сервер | Начало квиза |
| `next-question` | организатор → сервер | Следующий вопрос |
| `submit-answer` | участник → сервер | Отправка ответа |
| `question-ended` | сервер → всем | Время вышло, показ правильных ответов |
| `score-update` | сервер → всем | Обновление лидерборда |
| `quiz-finished` | сервер → всем | Квиз завершён, финальные результаты |

## Скрипты

```bash
npm run dev    # Запуск в режиме разработки (tsx server.ts)
npm run build  # Сборка (migrate deploy + prisma generate + next build)
npm run start  # Запуск production-сборки
npm run lint   # ESLint
```
