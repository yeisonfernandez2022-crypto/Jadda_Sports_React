FROM node:22-alpine

WORKDIR /app

# S8543: pnpm FIJADO (misma versión que lockfile/prod)
RUN npm install -g pnpm@11.8.0 --ignore-scripts

# S6470: copia EXACTA (sin glob) de los manifiestos de dependencias;
# pnpm-workspace.yaml VA con el lock (overrides de seguridad) — sin él el
# --frozen aborta (ERR_PNPM_LOCKFILE_CONFIG_MISMATCH).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 🔥 Desactiva la política problemática
RUN pnpm config set minimum-release-age 0

# S8543: lockfile respetado (la imagen dev instala EXACTO como el host)
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173
