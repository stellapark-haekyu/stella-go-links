# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy application source.
COPY server.js ./
COPY public ./public

ENV PORT=3000
EXPOSE 3000

# Mount links.json as a volume to persist data:
#   -v $(pwd)/links.json:/app/links.json
CMD ["node", "server.js"]
