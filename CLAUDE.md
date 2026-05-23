# DiceCraft - 基于多Agent的桌游创作与游玩平台

## uv

uv is an extremely fast Python package and project manager. It replaces pip, pip-tools, pipx, pyenv, virtualenv, poetry, etc.

For detailed information, read the official documentation: https://docs.astral.sh/uv/llms.txt

### When to use uv

**Default to uv whenever a `pyproject.toml` exists** (with or without `uv.lock`).

If you encounter any other scenario that seems to require `pip`, ask the user before proceeding — prefer migrating with `uv init` + `uv add -r requirements.txt`. Don't introduce new `requirements.txt` files.

### Python version

Pin a single Python minor version across all projects and follow all patch updates within that minor. As of 2026-04 the unified version is 3.12 (this will be bumped when the standard changes):

```toml
# pyproject.toml
requires-python = "==3.12.*"
```

When creating new projects, always set this constraint. When running commands, default to the current version.

Prefer installing a recent patch release of Python via uv (e.g., `uv python install 3.12.13`). This binary may differ from the system default and is typically already installed and set as uv's default.

### Project types

For **library** projects, use `uv_build` as the build backend and the standard **src layout**. The minimum `uv_build` version should match the uv version:

```toml
[build-system]
requires = ["uv_build>=0.11.6,<0.12.0"]
build-backend = "uv_build"
```

For **application** projects with a `__main__.py` entry point, add a script entry point:

```toml
[project.scripts]
package-name = "package_name.__main__:main"
```

Replace `package-name` (hyphenated), `package_name` (underscored), `__main__` (runnable module), and `main` (callable function) as appropriate for your project.

If the project does not use **src layout**, just run `uv run main.py`.

### Common patterns

```bash
uv init                   # Create new project
uv add requests           # Add dependency
uv remove requests        # Remove dependency
uv sync                   # Install from lockfile
uv run COMMAND            # Run commands in environment
uv run script.py          # Run a script
uv run python -c ""       # Run Python in project environment
uvx TOOL ARGS                # Run a tool without installation
uvx TOOL@VERSION ARGS        # Run a specific version of a tool
```

- Don't use pip in uv projects.
- `uvx` runs tools from PyPI by package name. This can be unsafe - only run well-known tools.
- `uv pip list` and `uv pip freeze` are the only `uv pip` subcommands to use.
- Don't run python directly `python script.py` or `python -c ""` — always use `uv run script.py` or `uv run python -c ""` to ensure the correct environment is used.
- Don't manually manage environments in uv projects with `python -m venv` or `source .venv/bin/activate` — uv handles this for you. Just use `uv run` to execute commands in the project environment.

## ruff

Ruff is an extremely fast Python linter and code formatter. It replaces Flake8, isort, Black, pyupgrade, autoflake, and dozens of other tools.

For detailed information, read the official documentation: https://docs.astral.sh/ruff/

### When to use ruff

Always use ruff for Python linting and formatting.

Prefer `uv run ruff` when ruff is a dev dependency. Otherwise, fall back to `uvx ruff`.

### Configuration

Ruff settings typically go in `pyproject.toml`. At minimum, run `uv run ruff check && uv run ruff check --select I`. For new internal projects, also add pyupgrade to keep syntax modern:

```toml
[tool.ruff.lint]
future-annotations = true
extend-select = [
    "UP",  # pyupgrade
    "I",   # isort
]
extend-safe-fixes = [
    "UP037",  # Add `from __future__ import annotations`
]
```

### Post-edit workflow

After modifying Python code, always run through this checklist:

```bash
# format
uv run ruff format path/to/changed_file.py
# isort
uv run ruff check --select I --fix path/to/changed_file.py
# lint
uv run ruff check --fix path/to/changed_file.py
```

Use `ruff check --diff` (or `ruff format --diff`) to preview changes without applying. Only run `--fix` after confirming the diff is acceptable. For forked or secondary-development projects, format/isort/fix may all touch a large number of unrelated lines — in that case, ask the user before applying.

## pyright

Pyright is a fast type checker for Python. Only use it when the project lists it as a dev dependency or mentions it in the README.

### How to invoke pyright

```bash
uv run pyright path/to/changed_file.py              # check changed files only
uv run pyright src/                                   # check all code after broad changes
uv run pyright --stats .                              # include timing stats for slow projects
```

Usually only check the files you modified. For changes that may have side effects (e.g., modifying a base class, changing a shared type), check the full code tree (`src/` or `.` depending on the project). If pyright takes a long time, add `--stats` on subsequent runs to identify bottlenecks.

### Prerequisites

Pyright requires a `node` binary (typically pre-installed in Docker images). If `node` or `pyright` is not available, skip this step and leave a brief note to the user. You may also suggest enabling type checking in the VS Code Python extension as an alternative.

## pytest

```bash
uv run pytest                    # run all tests
uv run pytest tests/test_foo.py  # run specific file
uv run pytest -x                 # stop on first failure
uv run pytest -v                 # verbose output
```

## Coding Style

### Type annotations

Use modern Python 3.12+ type syntax everywhere. Avoid legacy `typing` imports when the builtin form exists (e.g., `list[str]` instead of `List[str]`, `dict[str, int]` instead of `Dict[str, int]`, `tuple[str, ...]` instead of `Tuple[str, ...]`, and `str | None` instead of `Optional[str]`).

Use `type` statement for type aliases. When you encounter forward-reference ordering issues, add `from __future__ import annotations` rather than quoting types as strings.

Always annotate function parameters. For local variables where the type is obvious from context (e.g., `x = some_api()`), inference is fine. But annotate explicitly when the type cannot be inferred — empty literals, empty containers, or other ambiguous initializations:

```python
# Parameters — always annotate
def fetch(url: str, timeout: float = 30.0) -> Response:
    ...

# Locals — annotate when type is not inferrable
items: list[tuple[str, int]] = []
config: dict[str, Any] = {}
result: set[int] = set()
```

Prefer `Annotated` style in pydantic and typer for metadata annotations (e.g., `Annotated[str, Argument(help="...")]`, `Annotated[int, Field(gt=0)]`).

### String formatting

Always use f-strings. Do not use `.format()`, `%` formatting, or `Template` unless interfacing with an API that requires a template string.

### pydantic v2

Use pydantic v2 with the modern class-based API for all serialization models.

- Use `model_config = ConfigDict(...)` at class body level, not `class Config`.
- Use `RootModel` with `root: SomeType` for single-root schemas.

### typer

Typer is recommended for CLI entry points over `argparse`. Use `cli = typer.Typer(add_completion=False)` with `@cli.command()` to define commands. Pass `add_completion=False` to suppress the hidden `--install-completion` / `--show-completion` arguments:

```python
import typer

cli = typer.Typer(add_completion=False)

@cli.command()
def main(name: Annotated[str, typer.Argument(help="Your name")]) -> None:
    typer.echo(f"Hello {name}")

if __name__ == "__main__":
    cli()
```

When using typer, the `[project.scripts]` entry point should point to the `package_name.__main__:cli` instance rather than a `main` function.

## MiMo API 配置

本项目使用小米 MiMo API（兼容 Anthropic 接口）。

**环境变量**（在 `.env` 文件中配置）：
```bash
ANTHROPIC_BASE_URL=https://api.xiaomimimo.com/anthropic
MIMO_API_KEY=sk-xxx
```

**使用方式**：
```python
import anthropic
import os

client = anthropic.Anthropic(
    base_url=os.getenv("ANTHROPIC_BASE_URL"),
    api_key=os.getenv("MIMO_API_KEY"),
)

message = client.messages.create(
    model="mimo-v2.5-pro",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
```

## 项目结构

```
src/dice_craft/
├── __init__.py
├── __main__.py        # CLI 入口
├── agent/             # Agent 相关代码
├── skill/             # 游戏技能系统
└── utils/             # 工具函数
```

## 运行命令

```bash
# 运行 CLI
uv run dice-craft

# 格式化代码
uv run ruff format src/

# 检查代码
uv run ruff check src/

# 类型检查
uv run pyright src/

# 运行测试
uv run pytest
```
