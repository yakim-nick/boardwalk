# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING_LIBC=1

RUN apk add --no-cache openssl \
    && addgroup -S app && adduser -S app -G app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN npx prisma generate

USER app

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
