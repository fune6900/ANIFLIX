# ---- 開発用 Dockerfile ----
FROM node:22-alpine AS base

# 依存関係インストール用ステージ
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
# package-lock.json がある場合は npm ci、なければ npm install にフォールバック
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 開発用ステージ
FROM base AS development
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV development

CMD ["npm", "run", "dev"]

# ビルドステージ
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* は next build 時にクライアントバンドルへ焼き込まれる。
# ここで渡さないと本番イメージのサイトキーが undefined で固まり、
# Turnstile のウィジェットが永久に表示されない（= ログイン不能）。
# 実行時に環境変数を足しても後から差し替えられないので必ずビルド引数で渡すこと:
#   docker build --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x... .
# TURNSTILE_SECRET_KEY は実行時変数。イメージに焼き込んではいけない
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

RUN npm run build

# 本番用ステージ
FROM base AS production
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
