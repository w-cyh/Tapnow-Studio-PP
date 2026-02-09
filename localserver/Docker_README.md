# Tapnow Local Server Docker 部署说明

## 适用范围
- 本文档仅针对本地接收器服务 `localserver/tapnow-server-full.py` 的容器化部署。
- 容器默认暴露 `9527` 端口，提供 `/ping`、`/status`、`/proxy`、`/file/*` 等接口。
- 该容器不负责托管完整前端应用访问入口，主要用于本地缓存/代理/ComfyUI 中间件。

## 前置条件
- 已安装 Docker / Docker Compose（Compose V2）。

## 快速启动（推荐）
在仓库根目录执行：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

## 健康检查
- 容器健康检查使用 `http://localhost:9527/ping`。
- 手动检查：

```bash
curl http://127.0.0.1:9527/ping
curl http://127.0.0.1:9527/status
```

## 数据持久化
- Compose 默认挂载命名卷：`tapnow_data:/app/data`
- 容器启动参数已固定为：

```text
python tapnow-server-full.py -d /app/data
```

因此资源会写入卷中并持久化。

## 可选配置（自定义白名单/代理域名）
若需要自定义 `allowed_roots`、`proxy_allowed_hosts` 等，可挂载配置文件：

```yaml
services:
  tapnow:
    volumes:
      - tapnow_data:/app/data
      - ./localserver/tapnow-local-config.json:/app/localserver/tapnow-local-config.json:ro
```

修改后执行：

```bash
docker compose up -d --build
```

## 常见问题
1. 健康检查失败  
原因：服务未启动完成或端口占用。  
处理：检查 `docker compose logs -f`，确认 `9527` 是否可监听。

2. 宿主机无法访问  
原因：端口映射冲突。  
处理：修改 `docker-compose.yml` 端口映射，例如 `19527:9527`。

3. 文件未持久化  
原因：服务保存目录不在卷路径。  
处理：确保启动参数包含 `-d /app/data`，且卷挂载存在。
