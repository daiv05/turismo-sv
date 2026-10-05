FROM mcr.microsoft.com/playwright:v1.56.0-noble

RUN corepack enable
WORKDIR /repo
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @turismo/builder-service start"]
