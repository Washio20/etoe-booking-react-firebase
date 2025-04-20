# Build stage
FROM node:21-alpine AS builder

WORKDIR /app

# Copy source code
COPY . .

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Production stage
FROM node:21-alpine AS runner

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
