# DiceCraft - 基于多Agent的桌游创作与游玩平台

本项目基于 Bun + TypeScript 开发。

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **包管理**: Bun (bun add / bun install)

## 常用命令

```bash
bun install          # 安装依赖
bun run dev          # 运行项目
bun test             # 运行测试
bun run typecheck    # 类型检查
bun run check        # 测试 + 类型检查（每次改完代码必跑）
```

## 项目结构

```
src/
├── model/           # AI SDK 封装
├── tool/            # 工具定义
├── agent/           # Agent 循环
│   └── prompt/      # System prompt 文本文件
├── index.ts         # 入口
tests/
├── helpers/         # 测试工具（mock server 等）
├── model/           # Model 层测试
├── tool/            # Tool 测试
└── agent/           # Agent 循环测试
```

## 开发流程

每次修改源码后，必须运行验证：

```bash
bun run check
```

这会依次执行 `bun test` 和 `bunx tsc --noEmit`，确保：
1. 所有测试通过
2. 没有类型错误

## 代码规范

- 源码中的字符串（错误信息、日志、CLI 提示）使用英文
- 游戏内容（system prompt、游戏规则描述）可以使用中文
- 测试描述使用英文

## 环境变量

在 `.env` 文件中配置：
```bash
OPENAI_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_API_KEY=sk-xxx
MODEL_NAME=mimo-v2.5-pro
```
