FROM node:20-alpine

RUN npm install -g pnpm@9.15.4

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/api/prisma ./packages/api/prisma

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

RUN pnpm --filter @family-hub/api build

EXPOSE 8080

CMD ["node", "packages/api/dist/index.js"]