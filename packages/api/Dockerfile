FROM node:20-alpine

RUN npm install -g pnpm@9.15.4

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

RUN pnpm --filter @family-hub/web build

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "packages/web/dist", "-l", "3000"]
