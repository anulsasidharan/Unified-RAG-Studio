#!/usr/bin/env bash
# Run Alembic migrations from the project root.
# Usage:
#   ./scripts/migrate.sh             # upgrade to head
#   ./scripts/migrate.sh downgrade   # downgrade one step
#   ./scripts/migrate.sh history     # show migration history

set -euo pipefail

COMMAND="${1:-upgrade head}"

cd "$(dirname "$0")/../apps/api"

echo "[migrate] Running: alembic $COMMAND"
alembic $COMMAND
echo "[migrate] Done."
