FROM debian:bookworm-slim AS builder
ENV DEBIAN_FRONTEND=noninteractive

ARG NODE_VERSION=22.0.0
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl xz-utils && \
    # Detect architecture and choose correct Node binary
    ARCH="$(dpkg --print-architecture)"; \
    if [ "$ARCH" = "arm64" ]; then \
      NODE_DIST="linux-arm64"; \
    elif [ "$ARCH" = "amd64" ]; then \
      NODE_DIST="linux-x64"; \
    else \
      echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_DIST}.tar.xz" \
      -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner && \
    rm -rf /tmp/node.tar.xz && \
    ln -s /usr/local/bin/node /usr/local/bin/nodejs && \
    apt-get purge -y curl xz-utils && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci                 # install all deps incl. dev
COPY .env.example ./.env.local
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

RUN npm prune --production

FROM debian:bookworm-slim AS runner
WORKDIR /app

COPY --from=builder /usr/local /usr/local
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
ENV PATH=$PATH:/usr/local/bin

EXPOSE 3000
CMD ["npm", "start"]