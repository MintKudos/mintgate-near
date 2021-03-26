
.PHONY: mg-core mg-market metadata

all: mg-core mg-market metadata

mg-core:
	cargo build --package mg-core --target wasm32-unknown-unknown --release

mg-market:
	cargo build --package mg-market --target wasm32-unknown-unknown --release

metadata:
	cargo metadata --no-deps --format-version 1 > target/wasm32-unknown-unknown/release/metadata.json
