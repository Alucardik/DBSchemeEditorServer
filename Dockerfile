# Builder Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (dev + prod)
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY ./src ./src
RUN npm run build

# Runner stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install only prod dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/app.js"]