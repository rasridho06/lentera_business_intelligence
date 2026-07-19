#!/bin/bash
cd "$(dirname "$0")"
exec npx next start -p "${PORT:-3000}"
