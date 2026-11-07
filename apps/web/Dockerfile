FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_API_BASE_URL=https://api.topamath.com
ARG NEXT_PUBLIC_APP_URL=https://topamath.com
ARG INTERNAL_API_BASE_URL=http://4craft-api:8001

ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    INTERNAL_API_BASE_URL=${INTERNAL_API_BASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ARG RELEASE_REVISION=unversioned
LABEL org.opencontainers.image.revision=$RELEASE_REVISION
ENV RELEASE_REVISION=$RELEASE_REVISION
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_ENV=production \
    NEXT_PUBLIC_API_BASE_URL=https://api.topamath.com \
    NEXT_PUBLIC_APP_URL=https://topamath.com \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
