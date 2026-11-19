# Install And Start Zendocs

请帮我在当前 Zendocs 源码仓库里配置并用 Docker 后台启动 Zendocs。

第一步必须先问我：config.ts 里的 readDirectory 应该设置成哪个本地目录？

如果我没有提供 readDirectory，或者提供的目录不存在，请停止，不要创建配置，也不要启动 Docker。

拿到 readDirectory 后，请执行这些事情：

1. 检查本机是否安装 Docker，并确认 Docker 正在运行。
2. 打开当前 Zendocs 源码仓库。
3. 在仓库根目录创建或更新 `config.ts`，把 `readDirectory` 设置成我提供的绝对路径。
4. 如果我没有特别说明过滤规则，请使用下面这些默认过滤配置：

```ts
filterFiles: [
  /^(readme(?:[._-].*)?|licen[cs]e|licence|changelog|contribut(?:ion|ing)|thanks)(?:[._-].*)?$/i,
],
filterDirectories: [
  '.cache',
  '.claude',
  '.codex',
  '.gradle',
  '.output',
  '.pnpm-store',
  '.tanstack',
  '.vite',
  '.vinxi',
  '.yarn',
  'DerivedData',
  'build',
  'coverage',
  'dist',
  'Library',
  'node_modules',
  'target',
],
```

5. 确认仓库里的 `docker-compose.yml` 使用 `ZENDOCS_READ_DIRECTORY` 挂载 Markdown 目录：

```yaml
services:
  zendocs:
    image: "${ZENDOCS_IMAGE:-zendocs:local}"
    build:
      context: .
    container_name: zendocs
    environment:
      HOST: 0.0.0.0
      PORT: 3000
    ports:
      - "${ZENDOCS_PORT:-3017}:3000"
    volumes:
      - "./config.ts:/app/config.ts:ro"
      - "${ZENDOCS_READ_DIRECTORY:?Set ZENDOCS_READ_DIRECTORY to the same path used by config.ts readDirectory}:${ZENDOCS_READ_DIRECTORY:?Set ZENDOCS_READ_DIRECTORY to the same path used by config.ts readDirectory}:ro"
    restart: unless-stopped
```

6. 运行 `bun run docker:up`。不要创建 `.env`；脚本会从 `config.ts` 读取 `readDirectory` 并注入 Docker Compose。
7. 验证页面可以通过 `http://localhost:3017` 访问。
8. 如果启动失败，请先检查 `config.ts` 的 `readDirectory` 是否存在并且是绝对路径。
