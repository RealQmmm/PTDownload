# Build Stage
FROM node:22-alpine AS build

WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm install

COPY client ./
RUN npm run build

# Production Stage
FROM node:22-alpine

WORKDIR /app

# Install build dependencies with retry logic
COPY server/package.json server/package-lock.json ./
RUN apk update && \
    apk add --no-cache python3 make g++ || \
    (sleep 5 && apk update && apk add --no-cache python3 make g++) || \
    (sleep 10 && apk update && apk add --no-cache python3 make g++)
RUN npm install --production

# Copy server code
COPY server ./

# Copy built frontend assets
COPY --from=build /app/dist ../client/dist

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
