# ============================================
# Tapnow Studio Docker Image
# 多阶段构建：前端 + Python 本地服务器
# ============================================

# ============================================
# Stage 1: 构建前端 (Node.js)
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm ci --production=false

# 复制源码并构建
COPY . .
RUN npm run build

# ============================================
# Stage 2: Python 运行时
# ============================================
FROM python:3.11-slim

LABEL maintainer="Tapnow Studio"
LABEL description="Tapnow Studio with Local Server"

WORKDIR /app

# 安装 Python 依赖
COPY localserver/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 复制服务器代码和配置
COPY localserver/ ./localserver/

# 复制前端构建产物
COPY --from=frontend-builder /app/dist ./static/

# 创建数据目录
RUN mkdir -p /app/data

# ============================================
# 环境变量配置
# ============================================
# 功能开关
ENV TAPNOW_ENABLE_FILE_SERVER=true
ENV TAPNOW_ENABLE_PROXY=true
ENV TAPNOW_ENABLE_COMFY=false
ENV TAPNOW_ENABLE_LOG=true

# 端口
EXPOSE 9527

# 健康检查（服务提供 /ping 与 /status，根路径会返回 404）
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:9527/ping')" || exit 1

# 启动命令
WORKDIR /app/localserver
CMD ["python", "tapnow-server-full.py", "-d", "/app/data"]
