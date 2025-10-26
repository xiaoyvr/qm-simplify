# qm-simplify

A generic boolean expression simplifier using the Quine-McCluskey algorithm. Works with any AST representation through a configurable interface.

## Installation

```bash
npm install qm-simplify
```

## Quick Start

Reference the [test](./tests/qm.test.ts) for the babel configuration.


## How It Works

1. **Convert to SOP**: Converts the input boolean expression into Sum of Products (SOP) form
2. **Quine-McCluskey**: Applies the QM algorithm to find prime implicants
3. **Cover Selection**: Selects a minimal set of prime implicants that cover all minterms
4. **Reconstruct**: Converts the minimized SOP back to your expression type

This implementation uses the **Quine-McCluskey algorithm**, also known as the method of prime implicants. It's a systematic method for simplifying boolean expressions that guarantees finding a minimal form.

The algorithm:
1. Generates all prime implicants through iterative combination
2. Constructs a prime implicant chart
3. Selects essential prime implicants
4. Uses a greedy heuristic for the remaining cover problem

## Simplification Examples

| Input | Output | Explanation |
|-------|--------|-------------|
| `A && A` | `A` | Idempotence |
| `A \|\| A` | `A` | Idempotence |
| `A && !A` | `false` | Contradiction |
| `A \|\| !A` | `true` | Tautology |
| `A && B \|\| !A` | `!A \|\| B` | Absorption |
| `(A \|\| B) && !A` | `B && !A` | Distribution + simplification |
| `!!A` | `A` | Double negation |

## Limitations

- **Boolean expressions only**: The algorithm works on boolean logic. Non-boolean values in expressions (e.g., ternary results) are treated as atomic identifiers.
- **Exponential worst-case**: The QM algorithm can be exponential in the number of variables, though it's efficient for typical use cases.

## License

MIT
