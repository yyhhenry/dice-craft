# PLAN: 聊天消息 Markdown 渲染

## 实现方式

Agent / NPC 发送的消息内容使用 `react-markdown` + `highlight.js` 渲染为 Markdown。

### 组件

`src/components/Markdown.tsx`：

- 使用 `react-markdown` 解析 Markdown 语法
- 代码块通过 `highlight.js/lib/common` 做语法高亮
- 外层 `.markdown-content` class 控制排版样式

### 样式

在 `index.css` 中为 `.markdown-content` 编写轻量 CSS：

- 段落、列表、引用、标题等基本排版
- 行内 `code` 背景色
- 代码块使用 `github-dark` 主题
- 间距紧凑，适配聊天气泡

### 渲染范围

- Agent / NPC 消息：Markdown 渲染
- 用户消息：纯文本（不渲染）
- 系统消息：纯文本

### 依赖

- `react-markdown` ^10
- `highlight.js` ^11
