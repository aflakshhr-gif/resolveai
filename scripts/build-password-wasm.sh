#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="scripts/password-wasm-src"
OUTPUT_DIR="lib/cf-hash-wasm/wasm"
mkdir -p "$OUTPUT_DIR"

command -v clang >/dev/null 2>&1 || { echo "clang is required." >&2; exit 1; }
command -v wasm-ld >/dev/null 2>&1 || { echo "wasm-ld is required." >&2; exit 1; }

# Match hash-wasm v4.12.0 scripts/Makefile-clang.
CFLAGS="-flto -O3 -nostdlib -fno-builtin -ffreestanding -mexec-model=reactor --target=wasm32"
LDFLAGS="-Wl,--strip-all -Wl,--initial-memory=131072 -Wl,--max-memory=131072 -Wl,--no-entry -Wl,--allow-undefined -Wl,--compress-relocations -Wl,--export-dynamic"

clang $CFLAGS $LDFLAGS -Wl,--max-memory=2147483648 \
  -I "$SOURCE_DIR" -o "$OUTPUT_DIR/argon2.wasm" "$SOURCE_DIR/argon2.c"

clang $CFLAGS $LDFLAGS \
  -I "$SOURCE_DIR" -o "$OUTPUT_DIR/blake2b.wasm" "$SOURCE_DIR/blake2b.c"

for name in argon2 blake2b; do
  gzip -n -9 -c "$OUTPUT_DIR/$name.wasm" > "$OUTPUT_DIR/$name.wasm.gz"
  echo "Built $name.wasm ($(wc -c < "$OUTPUT_DIR/$name.wasm") bytes)"
  sha256sum "$OUTPUT_DIR/$name.wasm"
done
