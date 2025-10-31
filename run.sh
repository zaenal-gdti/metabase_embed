#!/usr/bin/env bash
set -euo pipefail

# Ensure the locally installed Node.js binaries are available
PATH="$HOME/.local/node-v20.11.1/bin:$PATH"

exec npm start
