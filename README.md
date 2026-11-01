# Zendocs

Zendocs 会读取本地目录里的 Markdown 文件，并把它们展示成一个可以浏览的文档站点。

它适合用来快速查看工作区、项目集合或个人笔记里的 `.md` 文件。

## 快速开始

Zendocs 推荐使用发布好的 Docker 镜像运行。使用者不需要下载源码，也不需要在本机安装 Bun 或项目依赖。

你可以把下面这段直接发给 AI Agent，让它帮你一键安装并启动 Zendocs：

```text
请帮我安装并用 Docker 后台启动 Zendocs。

第一步必须先问我：config.ts 里的 readDirectory 应该设置成哪个本地目录？

如果我没有提供 readDirectory，或者提供的目录不存在，请停止，不要创建配置，也不要启动 Docker。

拿到 readDirectory 后，请执行这些事情：

1. 检查本机是否安装 Docker，并确认 Docker 正在运行。
2. 创建一个用于运行 Zendocs 的目录，例如 ~/zendocs。
3. 在该目录创建 config.ts，把 readDirectory 设置成我提供的绝对路径。
4. 如果我没有特别说明过滤规则，请使用下面这些默认过滤配置：

   filterFiles:
   - /^(readme(?:[._-].*)?|licen[cs]e|licence|changelog|contribut(?:ion|ing)|thanks)(?:[._-].*)?$/i

   filterDirectories:
   - ".cache"
   - ".claude"
   - ".codex"
   - ".gradle"
   - ".output"
   - ".pnpm-store"
   - ".tanstack"
   - ".vite"
   - ".vinxi"
   - ".yarn"
   - "DerivedData"
   - "build"
   - "coverage"
   - "dist"
   - "Library"
   - "node_modules"
   - "target"

5. 在同一目录创建 docker-compose.yml。
6. 运行 bun run docker:up，让脚本从 config.ts 读取 readDirectory 并注入 Docker Compose。
7. 验证页面可以通过 http://localhost:1356 访问。
8. 如果启动失败，请先检查 config.ts 的 readDirectory 是否存在并且是绝对路径。
```

同样的 prompt 也放在 `prompts/install-and-start.md`，方便复制到其他 Agent。

最小运行目录通常只需要两个文件：

```text
zendocs/
  config.ts
  docker-compose.yml
```

`docker-compose.yml` 示例：

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
      - "${ZENDOCS_PORT:-1356}:3000"
    volumes:
      - "./config.ts:/app/config.ts:ro"
      - "${ZENDOCS_READ_DIRECTORY:?Set ZENDOCS_READ_DIRECTORY to the same path used by config.ts readDirectory}:${ZENDOCS_READ_DIRECTORY:?Set ZENDOCS_READ_DIRECTORY to the same path used by config.ts readDirectory}:ro"
    restart: unless-stopped
```

`config.ts` 示例：

```ts
const config = {
  readDirectory: '/Users/ben/Documents/workspace',
  editor: {
    command: 'open',
    args: ['-a', 'Zed'],
    url: 'zed://file/{file}',
  },
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
  maxFileSizeBytes: 1024 * 1024,
}

export default config
```

## 本地开发

先安装依赖：

```bash
bun install
```

然后编辑 `config.ts`，至少确认 `readDirectory` 是你想读取的目录：

```ts
const config = {
  readDirectory: '',
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
  maxFileSizeBytes: 1024 * 1024,
}
```

启动：

```bash
bun run dev
```

默认会通过 `portless` 启动，访问地址：

```text
http://zendocs.local:1355
```

## Docker 后台运行

`bun run docker:up` 会读取 `config.ts` 里的 `readDirectory`，并把这个目录只读挂载进容器。不需要创建 `.env`。

启动：

```bash
bun run docker:up
```

如果修改过 `config.ts`，也用同一条命令重新启动。Docker 镜像会重新构建，确保读取的是最新的 `readDirectory`。

直接访问 Docker 暴露的端口：

```text
http://localhost:1356
```

如果要换端口：

```bash
ZENDOCS_PORT=8080 bun run docker:up
```

停止：

```bash
bun run docker:down
```

也可以通过 portless 访问：

```text
http://zendocs.local:1355
```

如果容器已经在运行，但 portless 没有注册 app，可以单独重新注册 alias：

```bash
bun run docker:alias
```
Docker 运行时，`Open` 按钮会通过浏览器打开 `config.ts` 里配置的编辑器 URL，例如：

```ts
editor: {
  command: 'open',
  args: ['-a', 'Zed'],
  url: 'zed://file/{file}',
}
```

这样编辑器会在宿主机打开文件。保存后，Docker 容器会监听到 Markdown 文件变化，并自动刷新页面。

## 本地图片尺寸

Markdown 本地图片可以通过 `sw`、`sh` 参数声明原图宽高（单位为像素）：

```md
![示例](./images/demo.png?sw=1200&sh=800)
```

这张图片会按原图半宽显示为 600 × 400，正文宽度不足时等比例缩小。提供准确的原图宽高，可以在图片加载前预留空间，避免布局跳动。

只提供 `sw` 时，也会按半宽显示，高度在加载后自动确定。没有提供有效的 `sw` 时，保持原有显示方式，不自动读取原图尺寸或缩小。尺寸参数仅对本地图片生效。

## config.ts 说明

`config.ts` 是 Zendocs 的主要配置文件。

### readDirectory

要读取的本地目录。

Zendocs 会从这个目录开始向下查找 Markdown 文件。

```ts
readDirectory: '/Users/ben/Documents/workspace'
```

Docker 运行时会把这个目录按相同路径挂载进容器，所以容器内外使用同一个 `readDirectory`。

### filterFiles

要过滤掉的 Markdown 文件。

每条规则会同时匹配文件名和相对路径。支持三种写法：

```ts
filterFiles: [
  'README',
  /draft/i,
  { type: 'glob', pattern: '**/archive/*.md' },
]
```

含义分别是：

- 字符串：只要文件名或路径里包含这段文字，就会被过滤。
- 正则：可以写更灵活的匹配规则。
- glob：适合写路径规则，比如过滤某个目录下的一批文件。

### filterDirectories

要过滤掉的目录。

目录一旦被过滤，里面的 Markdown 文件也不会再被读取。支持字符串、正则和 glob。

```ts
filterDirectories: [
  'node_modules',
  /(^|\/)\.cache$/i,
  { type: 'glob', pattern: '**/fixtures/**' },
]
```

### maxFileSizeBytes

单个 Markdown 文件允许读取的最大大小。

默认示例里是 `1024 * 1024`，也就是 1MB。

```ts
maxFileSizeBytes: 1024 * 1024
```

## 示例配置

可以参考 `config.example.ts`。它展示了字符串、正则和 glob 三种过滤方式的写法。
