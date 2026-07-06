# Stage 1: Build the frontend React app
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package config files
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy application sources
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build the frontend assets to apps/web/dist
RUN npm run build

# Stage 2: Production runtime image
FROM node:22-alpine AS runner
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4180

# Copy configs
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install only production dependencies
RUN npm install --omit=dev

# Copy server code and the built frontend static assets
COPY apps/api/src ./apps/api/src
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Expose port 4180 (combines frontend and backend API)
EXPOSE 4180

# Start server
CMD ["npm", "run", "start"]
