FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/src/prisma.config.ts ./src/prisma.config.ts

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --config src/prisma.config.ts && node dist/main"]
