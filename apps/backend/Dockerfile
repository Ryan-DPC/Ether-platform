# Utiliser l'image officielle Bun
FROM oven/bun:1

WORKDIR /app

# COPY root package files for workspace install
COPY package.json bun.lock ./
COPY packages ./packages

# COPY app specific files
COPY apps/backend/package.json ./apps/backend/

# Install dependencies from root
RUN bun install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend

# Work in the app directory
WORKDIR /app/apps/backend

# Build/Expose
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
