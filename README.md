# DiceCraft

基于多Agent的桌游创作与游玩平台。

## 配置

复制 `.env.example` 为 `.env`，填入 API Key：

```bash
cp .env.example .env
# 编辑 .env，填入 MIMO_API_KEY
```

## 安装

```bash
uv sync
```

## 运行

```bash
uv run dice-craft
```

## 开发

```bash
# 格式化
uv run ruff format src/

# 检查
uv run ruff check src/
```
