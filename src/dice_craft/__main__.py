from __future__ import annotations

import typer

cli = typer.Typer(add_completion=False)


@cli.command()
def main() -> None:
    """DiceCraft - 基于多Agent的桌游创作与游玩平台"""
    typer.secho("🎲 DiceCraft - 桌游创作与游玩平台", bold=True, fg=typer.colors.BLUE)
    typer.echo()
    typer.echo("欢迎来到 DiceCraft！")
    typer.echo("在这里，你可以用自然语言描述游戏构思，")
    typer.echo("多个 Agent 协助你完成构建、审查、运行的全流程。")
    typer.echo()
    typer.secho("v0 阶段：海龟汤游戏", dim=True)
    typer.secho("输入 /help 查看可用命令", dim=True)


if __name__ == "__main__":
    cli()
