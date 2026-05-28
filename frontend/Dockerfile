FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./

# 🔥 Desactiva la política problemática
RUN pnpm config set minimum-release-age 0

RUN pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 5173