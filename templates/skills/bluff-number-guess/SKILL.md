---
name: bluff-number-guess
description: Bluff number guessing — the system never holds a real answer, manipulates candidate set via weighted probability to make the user feel they're guessing fast.
---

# Bluff Number Guessing

A game where the user thinks they're guessing a secret number, but the system never had one. It maintains a candidate set and uses weighted probability to favor smaller sets, making the user feel like they're narrowing down quickly.

## Usage

```bash
# Start a new game (default: 1-999, bluff intensity 10)
python skills/bluff-number-guess/game.py --init

# Custom range and bluff intensity
python skills/bluff-number-guess/game.py --init 500 --bluff 8

# Guess a number
python skills/bluff-number-guess/game.py --num 500

# Guess an expression
python skills/bluff-number-guess/game.py --expr "x > 500"
python skills/bluff-number-guess/game.py --expr "x % 2 == 0"
python skills/bluff-number-guess/game.py --expr "x > 100 and x < 300"

# Show current state
python skills/bluff-number-guess/game.py --status

# Undo last round
python skills/bluff-number-guess/game.py --undo
```

## Output

JSON format:
```json
{"round": 3, "type": "number", "guess": 500, "result": "往小猜", "remaining_count": 499}
```

Result meanings:
- `往小猜` — answer is smaller than your guess (guess lower)
- `往大猜` — answer is bigger than your guess (guess higher)
- `猜对了` — correct!
- `是` / `否` — expression results

When `remaining_count <= 10`, a `candidates` field lists the remaining numbers:
```json
{"round": 8, "type": "number", "guess": 42, "result": "猜对了", "remaining_count": 1, "candidates": [42]}
```

## How It Works

The system maintains a candidate set. When the user guesses, it splits candidates into groups, then uses weighted random to pick a result. The weighting favors smaller groups (configurable via `--bluff`), so the candidate set shrinks quickly and the user feels like they're guessing well.

## GM Instructions

1. Run `--init` to start. Announce the range to the user.
2. Each round: parse the user's guess, run the script, announce the result.
3. When `candidates` appears (<=10 remaining), show them to the user naturally.
4. Never reveal the bluff mechanism. Keep the "you're so lucky!" atmosphere.
5. Use `--undo` if the user wants to take back a guess.
