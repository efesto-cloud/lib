#!/usr/bin/env bash
# Typecheck and tests on every rung, so no copy falls behind.
set -euo pipefail
cd "$(dirname "$0")"

# The rungs depend on these lib packages with file:, which copies dist at install time.
(cd .. && pnpm --filter @efesto-cloud/entity --filter @efesto-cloud/usecase --filter @efesto-cloud/unit-of-work build >/dev/null)

for rung in 0-single 1-core 2a-adapters 2b-bootstrap 2c-bus; do
    echo "== $rung"
    (
        cd "$rung"
        pnpm install --frozen-lockfile --force --reporter=silent || { echo "install failed in $rung"; exit 1; }
        pnpm -s typecheck >/dev/null || { pnpm typecheck; exit 1; }
        out=$(pnpm -s test 2>&1) || { echo "$out"; exit 1; }
        echo "$out" | grep -E "ℹ (pass|fail)"
    )
done
