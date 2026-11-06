FROM node:22-alpine

WORKDIR /app

# S8543: pnpm FIJADO (misma versión que lockfile/prod) — sin浮动 por "latest"
RUN npm install -g pnpm@11.8.0 --ignore-scripts

# S6470: copia EXACTA (sin glob) de los manifiestos de dependencias
COPY package.json pnpm-lock.yaml ./

# S8543: lockfile respetado — el dev usa el MISMO lock que genera el host
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5000
