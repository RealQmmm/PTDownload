# Build Stage
FROM node:22-slim AS build

WORKDIR /app
COPY client/package*.json ./
RUN npm install

COPY client ./
RUN npm run build

# Production Stage
FROM node:22-slim

WORKDIR /app

# Install build dependencies and tzdata
RUN apt-get update && \
    apt-get install -y python3 make g++ tzdata && \
    ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata && \
    rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Shanghai

COPY server/package*.json ./
RUN npm install --production

# Copy server code
COPY server ./

# Copy built frontend assets
# The server expects ../../client/dist relative to server/src/index.js
# Since server/ is at /app, index.js is at /app/src/index.js
# ../../client/dist becomes /client/dist
COPY --from=build /app/dist /client/dist

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
