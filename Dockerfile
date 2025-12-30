# Stage 1: Build Frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY client/package*.json ./
RUN npm install
RUN npm config set registry https://registry.npmmirror.com
COPY client ./
RUN npm run build

# Stage 2: Build Backend (including native modules)
FROM node:22-slim AS backend-builder
WORKDIR /app
# Install build dependencies ONLY for building native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN npm install --production

# Stage 3: Final Production Image
FROM node:22-slim
WORKDIR /app

# Install only essential runtime dependencies (tzdata)
RUN apt-get update && \
    apt-get install -y tzdata && \
    ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# Copy backend dependencies
COPY --from=backend-builder /app/node_modules ./node_modules
# Copy server code
COPY server ./

# Copy built frontend assets to the location expected by the server
# Original server logic expects ../../client/dist relative to server/src
# In this container:
# Server is at /app, index.js at /app/src/index.js
# ../../client/dist points to /client/dist
COPY --from=frontend-builder /app/dist /client/dist

EXPOSE 3000

# Use tini or a simple node command
CMD ["node", "src/index.js"]
