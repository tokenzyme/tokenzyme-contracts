# Tokenzyme Contracts

Smart contracts for **Tokenzyme**, a permissionless token launchpad for EVM chains.
Anyone can launch an ERC-20 token that trades immediately against a bonding curve;
once the curve sells out, the contract automatically migrates the token to a
concentrated-liquidity DEX pool.

Deployed and tested on [Sonic](https://soniclabs.com). Nothing in the design is
Sonic-specific — it works on any EVM chain that has a Chainlink-compatible price
feed and a Uniswap V3-style DEX.

> [!WARNING]
> **These contracts have not been audited.** They handle user funds and are
> upgradeable by a privileged owner. Do not deploy them to a production network
> or send them real value without an independent security review. See
> [SECURITY.md](./SECURITY.md) for the full list of known risks and trust
> assumptions.

## Table of contents

- [How it works](#how-it-works)
- [Contract architecture](#contract-architecture)
- [Protocol parameters](#protocol-parameters)
- [Network requirements](#network-requirements)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Deploying](#deploying)
- [Verifying](#verifying)
- [Related repositories](#related-repositories)
- [Contributing](#contributing)
- [Security](#security)
- [Donations](#donations)
- [License](#license)

## How it works

A token goes through two phases.

### Phase 1 — Bonding curve

`launchToken` deploys a fresh `Token` (ERC-20) with a fixed total supply. The
entire supply is minted to the launchpad; a slice of it (the *bonding curve
supply*) is put up for sale and the remainder is held back to seed DEX liquidity
at migration.

Pricing follows a constant-product invariant `x * y = k` over **virtual reserves**.
The market opens with no real liquidity — the virtual reserves alone define the
opening price. As buyers add native currency and remove tokens, the ratio moves
and the price rises along the curve.

```
price = (ethReserve + ethVirtualReserve) / (tokenReserve + tokenVirtualReserve)
```

The virtual reserves are not fixed constants. `MarketUtils.calculateVirtualReserves`
reads a Chainlink price feed and scales the virtual native-currency reserve inversely
with the native token's USD price, benchmarked against a configured base price. The
effect is that **every token launches at roughly the same USD-denominated price**,
regardless of what the chain's native token is worth that day.

During this phase the token is **transfer-locked**: `Token._update` rejects any
transfer that does not have the launchpad as sender or recipient. Holders can buy
and sell against the curve but cannot move tokens peer-to-peer or list them
elsewhere. This is what prevents a parallel market from forming before migration.

Buys and sells each pay a trade fee, split between the token creator and the
protocol fee recipient.

### Phase 2 — Migration

When the bonding curve supply is exhausted (the token reserve drops below 1 token),
the buy that consumed it also triggers migration, atomically, in the same
transaction:

1. `DexUtils.migrateToken` creates a concentrated-liquidity pool pairing the token
   with the chain's wrapped native token, initialized at the final curve price.
2. The accumulated native currency is wrapped and paired with the held-back token
   supply into a **full-range** liquidity position, minted to the protocol fee
   recipient.
3. Native currency left over beyond what the position consumed is split between
   the creator and the fee recipient.
4. Any token surplus beyond what the position consumed is **burned**.
5. `Token.unlock()` is called — transfers are now unrestricted and the token
   trades freely on the DEX.

A buy that would overshoot the remaining curve supply is capped at the remaining
supply and the excess native currency is refunded to the buyer in the same call.

After migration the launchpad refuses further `buyTokens` / `sellTokens` for that
token — it lives on the DEX from then on.

## Contract architecture

```
                        ERC1967Proxy (UUPS)
                                │
                                ▼
                          Launchpad.sol ──────── implements ILaunchpad
                                │                  launchToken / buyTokens
                                │                  sellTokens / estimate*
                                │
                       extends  ▼
                        LaunchpadAdmin.sol ────── Ownable + UUPSUpgradeable
                                │                 + ReentrancyGuard
                                │                 initialize / setters
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
    MarketUtils.sol        DexUtils.sol         TokenUtils.sol
    bonding curve math     pool creation        metadata validation
    virtual reserves       + LP minting
    Chainlink feed
          │                     │
          └──────── LaunchpadStorage.sol ────────┘
                    namespaced storage (ERC-7201 style)

                          Token.sol
                          ERC-20 + transfer lock + burn
```

| File | Responsibility |
| --- | --- |
| `contracts/Launchpad.sol` | Entry point. Launch, buy, sell, price estimation, fee distribution, migration trigger. |
| `contracts/LaunchpadAdmin.sol` | Ownership, UUPS upgrade authorization, reentrancy guard, and every owner-only parameter setter. |
| `contracts/Token.sol` | The launched ERC-20. Fixed supply minted at construction, transfer-locked until migration, burnable. |
| `contracts/storages/LaunchpadStorage.sol` | All protocol state in a single struct at a fixed namespaced storage slot, so upgrades cannot collide. |
| `contracts/libs/MarketUtils.sol` | Constant-product math, virtual reserve derivation from the Chainlink feed, buy/sell estimation. |
| `contracts/libs/DexUtils.sol` | Pool creation, wrapping native currency, minting the full-range LP position. |
| `contracts/libs/TokenUtils.sol` | Length and URL-prefix validation for token name, symbol, description and social links. |
| `contracts/structs/TokenInfo.sol` | Token metadata carried in the `TokenLaunched` event. |
| `contracts/interfaces/` | `ILaunchpad` plus minimal interfaces for the external DEX and wrapped-native contracts. |

### Upgradeability

`Launchpad` sits behind an `ERC1967Proxy` and uses the **UUPS** pattern.
`_authorizeUpgrade` is `onlyOwner`, so the owner can replace the implementation at
any time. State lives at a namespaced slot derived from `keccak256("launchpad.storage")`
(masked to the ERC-7201 convention), which keeps storage layout stable across
upgrades. See [SECURITY.md](./SECURITY.md) for what this implies for users.

### Events

The indexer ([`tokenzyme-indexer`](https://github.com/tokenzyme/tokenzyme-indexer))
is built entirely on these events — they are the protocol's public data model.

| Event | Emitted when |
| --- | --- |
| `TokenLaunched` | A new token is created, carrying all its metadata. |
| `MarketDataCreated` | The bonding curve for a new token is initialized. |
| `MarketDataUpdated` | Reserves or price change after any trade. |
| `TokensBought` / `TokensSold` | A trade settles against the curve. |
| `TokenMigrated` | The curve sells out and the DEX pool is created. |

## Protocol parameters

Defaults are set in `LaunchpadAdmin.initialize`. Every one of them is mutable by
the owner afterwards. Percentages are in basis points (`100_00` = 100%).

| Parameter | Default | Meaning |
| --- | --- | --- |
| `tokenTotalSupply` | 1,000,000,000 | Total supply minted per launched token. |
| `bondingCurveSupply` | 800,000,000 | Portion sold on the curve. The remaining 200,000,000 seeds DEX liquidity. |
| `tradeFee` | `1_00` (1%) | Fee taken on every buy and sell. |
| `tradeFeeShare` | `50` (0.5%) | Share of the trade fee routed to the token creator; the rest goes to `feeRecipient`. |
| `migrationRemainingEthShare` | `50_00` (50%) | Share of leftover native currency at migration routed to the token creator. |
| `baseEthVirtualReserve` | 9,065 | Virtual native-currency reserve at the base USD price. |
| `baseTokenVirtualReserve` | 273,000,000 | Virtual token reserve. |
| `baseEthPriceInUsd` | 0.5 | USD price the virtual reserves are calibrated against. |
| `tickSpacing` | 50 | Tick spacing of the DEX pool created at migration. |

Owner-only setters: `setIsMarketPaused`, `setPriceFeed`, `setWrappedEth`,
`setFeeParams`, `setRewardParams`, `setSupplyParams`, `setReserveParams`,
`setDexParams`.

## Network requirements

This repository ships **no deployment**. There is no canonical instance to point at —
you deploy your own, on whatever chain you choose, and hold your own owner key.

The protocol needs three things from the target chain:

| Dependency | Used for |
| --- | --- |
| A Chainlink-compatible price feed for the native token | Pegging the launch price to a stable USD value |
| The canonical wrapped native token | Pairing liquidity at migration |
| A Uniswap V3-style DEX (pool factory + nonfungible position manager) | The pool created at migration |

Fill these into `ignition/modules/m2025061201_Init.ts` for your network before
deploying. The values currently there target Sonic; on a chain without a deployed DEX,
set the factory and position manager to the zero address — everything works except
migration, which will revert when a curve sells out.


## Getting started

Requirements: Node.js 24+ and Corepack.

```bash
# Enable Corepack to use the Yarn version configured in the project
corepack enable

# Install all dependencies
yarn

# Copy the environment template
cp .env.template .env
```

`.env` variables:

| Variable | Required for | Notes |
| --- | --- | --- |
| `DEPLOYER_PRIVATE_KEY` | Deploying, running a fork | Not needed to compile or run unit tests. **Never commit this.** |
| `ETHERSCAN_API_KEY` | Contract verification | A [Sonicscan](https://sonicscan.org) API key when targeting Sonic. |

Compile:

```bash
yarn contracts:compile
```

> [!NOTE]
> `contracts:compile` does more than compile. It generates TypeChain bindings and
> **copies them into the sibling `tokenzyme-core` and `tokenzyme-app` checkouts**
> (`../tokenzyme-core/src/generated/typechain`, `../tokenzyme-app/src/generated/typechain`).
> If those directories do not exist on your machine the copy step fails. Working on
> the contracts alone? Use `yarn hardhat compile` instead.

Check contract sizes against the EIP-170 limit:

```bash
yarn contracts:size
```

## Testing

```bash
yarn test
```

The suite covers the bonding curve math, launch validation, buy/sell flows,
slippage, fee distribution, migration, and the token transfer lock. Mocks for the
Chainlink feed, DEX factory, position manager and wrapped native token live in
`test/contracts/`, and `LaunchpadHarness.sol` exposes internals for assertion.

Tests compile with `optimizer.runs = 50` (via the `TEST` env var) to keep
compilation fast; production builds use `6000`.

To exercise migration against real DEX contracts, run a mainnet fork in one
terminal and point the tests at it:

```bash
yarn test:fork:startNode
```

## Deploying

Deployments use [Hardhat Ignition](https://hardhat.org/ignition). Modules are
sequential and named by date, starting at `m2025061201_Init`, so a deployment replays
only the modules it has not applied yet. Later upgrades go in new modules appended to
`ignition/modules/index.ts`.

```bash
yarn contracts:deploy:testnet        # Sonic testnet (14601)
yarn contracts:deploy:testnetLegacy  # Sonic Blaze testnet (57054)
yarn contracts:deploy:fork           # local fork (1337)
yarn contracts:deploy                # Sonic mainnet (146)
```

Before your first deployment:

- Set **`FEE_RECIPIENT`** in `.env`. There is no default — it is the account that
  receives protocol trade fees *and* the liquidity position minted when a token
  migrates to the DEX. The deploy task refuses to run without it.
- Set **`DEPLOYER_PRIVATE_KEY`**. The account it belongs to becomes the contract
  **owner**, which is fully privileged — read
  [SECURITY.md](./SECURITY.md#the-owner-is-fully-privileged) before using an EOA you
  control personally. Transfer ownership to a multisig for anything real.
- Fill in the per-network addresses in `ignition/modules/m2025061201_Init.ts` for your
  chain — see [Network requirements](#network-requirements).

Ignition writes the resulting addresses, artifacts and journal to
`ignition/deployments/chain-<id>/`. That directory is **git-ignored**: this repository
publishes no deployment, and yours is yours. Back it up somewhere — it is the state
Ignition needs to apply later upgrade modules.

To resume a partially applied deployment from a specific module:

```bash
yarn hardhat deployContracts --network testnet --from m2025061201_Init
```

## Verifying

Pass the deployment ID, which is `chain-<id>` matching the directory Ignition wrote:

```bash
yarn contracts:verify chain-146
```

Requires `ETHERSCAN_API_KEY` in `.env` — a Sonicscan key when targeting Sonic.

## Related repositories

Tokenzyme is split across five repositories. A full description of how they fit
together lives in
**[tokenzyme-core / ARCHITECTURE.md](https://github.com/tokenzyme/tokenzyme-core/blob/main/ARCHITECTURE.md)**.

| Repository | Role |
| --- | --- |
| [tokenzyme-contracts](https://github.com/tokenzyme/tokenzyme-contracts) | This repository — the on-chain protocol. |
| [tokenzyme-core](https://github.com/tokenzyme/tokenzyme-core) | GraphQL API: off-chain metadata, accounts, comments, moderation. |
| [tokenzyme-indexer](https://github.com/tokenzyme/tokenzyme-indexer) | Indexes the events above into Postgres and streams updates over WebSocket. |
| [tokenzyme-app](https://github.com/tokenzyme/tokenzyme-app) | React web front end. |
| [tokenzyme-mobile](https://github.com/tokenzyme/tokenzyme-mobile) | Flutter mobile app. |

Contract changes ripple outward: after modifying an interface or event you need to
recompile here, refresh the TypeChain bindings in `tokenzyme-core` and
`tokenzyme-app`, and regenerate `abi/launchpad.json` in `tokenzyme-indexer`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Contributions are welcome —
please open an issue before starting on anything substantial.

## Security

Do **not** open a public issue for a vulnerability. Follow the disclosure process
in [SECURITY.md](./SECURITY.md), which also documents the protocol's trust
assumptions and known limitations.

## Donations

If this project helped you in any way, consider making a donation. It is not
expected and nothing here is gated behind it.

![EVM](https://img.shields.io/badge/EVM-Ethereum%20%C2%B7%20Sonic%20%C2%B7%20Base%20%C2%B7%20Arbitrum-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)

```
0x31c8EDeD9D516a7BD854457710B9629F13BBA4FD
```

![Solana](https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white)

```
HsgFMPqjzUwbsd7dyFp2vjfLLLN6eG2Et2H9qmCBEBng
```

> [!WARNING]
> Send only on a network shown above, and check the address against this page on
> GitHub rather than a copy elsewhere. Transfers cannot be reversed.

## License

Licensed under the [MIT License](./LICENSE), except for the vendored third-party
interfaces listed in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md), which
retain their original licenses.

### Trademarks

The MIT license covers the source code. It does **not** grant rights to the
"Tokenzyme" name, logo, or other brand assets. You are free to fork and deploy
this protocol, but please do so under your own name and branding.
