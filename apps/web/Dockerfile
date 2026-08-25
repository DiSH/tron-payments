FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci

FROM deps AS development

COPY packages/shared packages/shared
COPY apps/web apps/web

ENV CHOKIDAR_USEPOLLING=true

WORKDIR /app
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "@tron-payments/web"]

FROM deps AS build

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build -w @tron-payments/web

FROM nginx:alpine AS production

RUN mkdir -p /var/www/certbot

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80 443
