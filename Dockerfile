# Use the official Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy application source code
COPY . .

# Build the application (this runs prebuild which builds CSS, then next build)
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production && npm cache clean --force

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port 8080 (Cloud Run compatible)
EXPOSE 8080

# Set default environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=8080

# Environment variables for Next.js app (can be overridden at runtime)
# These should be set via docker run -e or docker-compose
ARG NEXT_PUBLIC_AUTH_DOMAIN
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SUBSCRIPTION_TYPE
ARG COPILOT_BACKEND_URL

ENV NEXT_PUBLIC_AUTH_DOMAIN=$NEXT_PUBLIC_AUTH_DOMAIN
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_SUBSCRIPTION_TYPE=$NEXT_PUBLIC_SUBSCRIPTION_TYPE
ENV COPILOT_BACKEND_URL=$COPILOT_BACKEND_URL

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/ || exit 1

# Start the application
# Note: Next.js start command uses -p flag, but PORT env var takes precedence
CMD ["npm", "run", "start"]

