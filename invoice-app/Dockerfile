# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Build argument for API URL (defaults to relative path for nginx proxy)
ARG VITE_API_URL=/api/
ENV VITE_API_URL=$VITE_API_URL

# Copy package.json first
COPY package.json ./

# Copy package-lock.json if it exists, otherwise use npm install
COPY package-lock.json* ./

# Install dependencies
# Use npm ci if package-lock.json exists (faster, more reliable)
# Otherwise use npm install (will generate package-lock.json)
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit; else npm install --legacy-peer-deps; fi

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine AS final

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
