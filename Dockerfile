# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for font loading
RUN apk add --no-cache ca-certificates

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and env file
COPY . .
COPY .env .env

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Install dependencies for font loading
RUN apk add --no-cache ca-certificates

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.env .env

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "server.js"] 