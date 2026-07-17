FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci

COPY apps/api apps/api
COPY packages/shared packages/shared
ENV PATH="/app/node_modules/.bin:/app/apps/api/node_modules/.bin:$PATH"
RUN prisma generate --schema apps/api/prisma/schema.prisma \
    && npm run build -w @fantasy-draft/shared \
    && npm run build -w @fantasy-draft/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:/app/apps/api/node_modules/.bin:$PATH"
COPY --from=build /app /app
EXPOSE 4000
CMD ["sh", "-c", "prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
