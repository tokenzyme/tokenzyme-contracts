# Third-Party Notices

Tokenzyme Contracts is distributed under the [MIT License](./LICENSE). It bundles
or derives from third-party source files that carry their own licenses. Those
licenses are listed below and the corresponding SPDX headers are preserved in the
files themselves.

## Vendored interface files

The following files under `contracts/interfaces/external/` are minimal interface
declarations for third-party protocols. They are reduced copies of the upstream
sources and keep the upstream SPDX identifier.

| File | Upstream | License |
| --- | --- | --- |
| `IPoolFactory.sol` | Uniswap V3 style concentrated-liquidity pool factory (Shadow Exchange on Sonic) | `GPL-2.0-or-later` |
| `INonfungiblePositionManager.sol` | Uniswap V3 style nonfungible position manager (Shadow Exchange on Sonic) | `GPL-2.0-or-later` |
| `IWrappedEth.sol` | Canonical wrapped-native-token interface (WETH9) | `MIT` |

`GPL-2.0-or-later` is a copyleft license. These files are interface declarations
only — they contain no implementation — and are kept under their original terms.
Do not remove or alter their SPDX headers. If you redistribute this repository,
these three files remain governed by `GPL-2.0-or-later` rather than by the MIT
license that covers the rest of the project.

## Compile-time dependencies

These are consumed from npm and are **not** vendored into this repository. They
are listed for attribution only.

| Package | License |
| --- | --- |
| `@openzeppelin/contracts` | MIT |
| `@openzeppelin/contracts-upgradeable` | MIT |
| `@chainlink/contracts` | MIT |
| `hardhat` and `@nomicfoundation/*` | MIT |

## Trademarks

"Tokenzyme", the Tokenzyme name, and the Tokenzyme logo are not covered by the
MIT license. See the [Trademarks](./README.md#trademarks) section of the README.
