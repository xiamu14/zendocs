# Zendocs

Zendocs 会读取本地目录里的 Markdown 文件，并把它们展示成一个可以浏览的文档站点。

它适合用来快速查看工作区、项目集合或个人笔记里的 `.md` 文件。

## 快速开始 

你可以把下面这段直接发给 AI，让它帮你配置并用 Docker 后台运行 Zendocs：

```text
请帮我在当前 Zendocs 项目里完成配置，并用 Docker 后台运行。

开始前，请先问我：readDirectory 应该设置成哪个本地目录？

拿到我的回答后，请执行这些事情：

1. 打开 config.ts。
2. 把 readDirectory 改成我提供的目录。
3. 根据我的说明，配置 filterFiles 和 filterDirectories。
   - filterFiles 用来过滤不想展示的 Markdown 文件。
   - filterDirectories 用来过滤不想扫描的目录。
   - 两者都支持字符串、正则和 glob。
4. 确认本机编辑器可用。
   - 如果使用 Zed，先运行 `which zed`，确认能找到 `zed` 命令。
   - 然后确认 `editor.url` 配置为 `zed://file/{file}`。
5. 如果我没有特别说明过滤规则，请保留项目里已有的默认过滤配置。
6. 运行 bun run docker:up，让 Docker 在后台启动 Zendocs。
7. 验证页面可以通过 http://zendocs.localhost:1355。
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
http://zendocs.localhost:1355
```

## Docker 后台运行

Docker 会读取 `config.ts` 里的 `readDirectory`。

先确认 `config.ts` 里的目录是你想读取的本地目录，然后后台启动：

```bash
bun run docker:up
```

如果修改过 `config.ts`，也用同一条命令重新启动。Docker 镜像会重新构建，确保读取的是最新的 `readDirectory`。

默认会同时接入 portless，访问地址：

```text
http://zendocs.localhost:1355
```

也可以直接访问 Docker 暴露的端口：

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

如果容器已经在运行，但 `zendocs.localhost:1355` 显示没有注册 app，可以单独重新注册 portless alias：

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
