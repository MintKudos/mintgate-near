use std::{
    env,
    fmt::Debug,
    fs::{self, File},
    io::Write,
    path::Path,
};

use mg_core::nft::ContractMetadata;
use serde_json::Result;

fn open(file_name: &str) -> File {
    let out_dir = env::var("OUT_DIR").expect("Output dir not defined");
    let dest_path = Path::new(&out_dir).join(file_name);
    File::create(&dest_path).expect("Could not create file")
}

fn write_val<T: Debug>(path: &str, val: T) {
    writeln!(&mut open(path), "{:?}", val).expect("Could not write");
}

/// Reads the configuration for the contract located in `metadata.json`.
/// This allows us to share configuration with the client of the contract.
fn main() -> Result<()> {
    let data = fs::read_to_string("metadata.json").expect("Unable to read config file");
    let metadata: ContractMetadata = serde_json::from_str(data.as_ref())?;

    write_val("spec.val", metadata.spec);
    write_val("name.val", metadata.name);
    write_val("symbol.val", metadata.symbol);
    write_val("icon.val", metadata.icon);
    write_val("base_uri.val", metadata.base_uri);
    write_val("reference.val", metadata.reference);
    write_val("reference_hash.val", metadata.reference_hash);

    println!("cargo:rerun-if-changed=config.json");
    println!("cargo:rerun-if-changed=build.rs");

    Ok(())
}
