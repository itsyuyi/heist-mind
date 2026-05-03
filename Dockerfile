FROM node:22-alpine

# SQLite 编译依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制依赖文件
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# 安装依赖
RUN cd frontend && npm ci && \
    cd ../backend && npm ci && \
    cd .. && npm ci

# 复制源码
COPY frontend/ ./frontend/
COPY backend/ ./backend/
COPY scripts/ ./scripts/

# 构建
RUN npm run build

# 数据持久化目录
RUN mkdir -p /app/backend/data

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["node", "backend/dist/main.js"]
