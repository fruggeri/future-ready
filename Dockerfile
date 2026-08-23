FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

EXPOSE 3000 4318

CMD ["npm", "run", "start", "--", "--port", "3000"]
