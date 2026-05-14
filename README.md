# Zendocs

Zendocs 会读取一个本地目录里的 Markdown 文件，并把它们展示成一个可以浏览的文档站点。

它适合用来快速查看工作区、项目集合或个人笔记里的 `.md` 文件。

## 快速开始 

你可以把下面这段直接发给 AI，让它帮你配置并运行 Zendocs：

```text
请帮我在当前 Zendocs 项目里完成配置并运行。

开始前，请先问我：readDirectory 应该设置成哪个本地目录？

拿到我的回答后，请执行这些事情：

1. 打开 config.ts。
2. 把 readDirectory 改成我提供的目录。
3. 根据我的说明，配置 filterFiles 和 filterDirectories。
   - filterFiles 用来过滤不想展示的 Markdown 文件。
   - filterDirectories 用来过滤不想扫描的目录。
   - 两者都支持字符串、正则和 glob。
4. 如果我没有特别说明过滤规则，请保留项目里已有的默认过滤配置。
5. 运行 bun install，确保依赖可用。
6. 运行 bun run dev 启动项目。
7. 告诉我最终打开哪个本地地址可以访问。
8. 如果启动失败，请根据报错修复后重新运行，直到项目可以访问，或者明确告诉我还缺少什么信息。
```

## 手动安装

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

## config.ts 说明

`config.ts` 是 Zendocs 的主要配置文件。

### readDirectory

要读取的本地目录。

Zendocs 会从这个目录开始向下查找 Markdown 文件。

```ts
readDirectory: '/Users/ben/Documents/workspace'
```

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
