
# mg-sim -- MintGate Simulation tests

Provides simulation tests using `near-sdk-sim`.
Refer to
<https://github.com/near/near-sdk-rs/tree/master/near-sdk-sim>
for detailed information on how it works.

## To Explore

- `tests/main.rs` tests cases for cross-contract calls.
- `tests/sim.rs` contains wrapper around both `mg-nft` and `mg-market` contracts.

Notice that this package does not provide a library nor a binary.
Its only purposes it to provide simulation tests.
