FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter api build

FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable && npm install -g vercel@latest

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json /app/tsconfig.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3000

CMD ["vercel", "dev", "--listen", "3000", "--yes"]
