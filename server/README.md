# Webster Backend

## Getting started

Поки що буду писати змішано. Тож, для того щоб запустити бек потрібно:

1. Створити PostgreSQL БД

2. Перейти в папку серверу

```bash
cd server
```

3. Налаштувати env файл у папці server. Ось його патерн:

```
NODE_ENV=development

BACKEND_PORT=3000
FRONTEND_URL=http://localhost:5173

DATABASE_URL=postgresql://користувач_постгре:ваш_пароль_від_постгре@localhost:порт_постгре/назва_бд

JWT_ACCESS_SECRET=super_secret
JWT_REFRESH_SECRET=super_puper_secret

SMTP_SERVICE=gmail
SMTP_USER=пошта_для_nodemailer
SMTP_PASS=код_для_nodemailer
HOST_FOR_EMAIL=localhost для посилання на листах
PORT_FOR_EMAIL=5173 для посилання на листах

GOOGLE_CLIENT_ID=id_для_авторизації_з_гугл
GOOGLE_CLIENT_SECRET=секрет_для_авторизації_гугл
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

CLOUDINARY_CLOUD_NAME=твоє_імя
CLOUDINARY_API_KEY=твій_ключ
CLOUDINARY_API_SECRET=твій_секрет
```

4. Встановити залежності та налаштувати бд:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:push
```

5. Запустити сервер

```bash
npm run start
```
