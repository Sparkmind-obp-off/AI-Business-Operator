#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run validate
npm audit

if git grep -nEI "(api[_-]?key|access[_-]?token|client[_-]?secret|webhook[_-]?secret)[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_./+=-]{24,}[\"']" -- ':!docs/**' ':!.env.example'; then
  echo 'Potential committed secret detected.' >&2
  exit 1
fi
