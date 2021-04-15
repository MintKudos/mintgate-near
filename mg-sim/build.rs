#![deny(warnings)]

use std::process::Command;

fn main() {
    Command::new("cargo")
        .args(&["build", "--target", "wasm32-unknown-unknown", "--release"])
        .status()
        .unwrap();
}
