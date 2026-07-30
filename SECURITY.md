# Security Policy

## Audit status

**These contracts have not undergone an independent security audit.**

They are published so the protocol can be inspected, forked and learned from — not as
a warranty of correctness, and not as a service anyone operates.

## There is no deployment

This repository publishes **no contract addresses and no deployment**. There is no
canonical instance, nothing operated by anyone, and nothing to interact with. It is
source you deploy yourself.

That is deliberate. A published address on unaudited, upgradeable code is an invitation
to trust an operator, and there is no operator here.

If you deploy your own instance, you do so entirely at your own risk. Read
[Trust assumptions and known limitations](#trust-assumptions-and-known-limitations)
first — the owner of a deployment is fully privileged, and that owner will be you.

If you are considering an audit or a formal review and want context on the design,
open a discussion — help is welcome.

## Reporting a vulnerability

**Do not open a public issue, pull request or discussion for a security
vulnerability.**

Report it through GitHub's [private vulnerability reporting](https://github.com/tokenzyme/tokenzyme-contracts/security/advisories/new)
— the **Security** tab, then **Report a vulnerability**. That opens a private
advisory only you and the maintainers can see.

Please include:

- a description of the issue and the impact you believe it has;
- the affected contract, function and — if known — the deployment;
- steps to reproduce, ideally a failing test or a Hardhat script;
- any suggested mitigation.

### What to expect

| Stage                                        | Target       |
| -------------------------------------------- | ------------ |
| Acknowledgement of your report               | 72 hours     |
| Initial assessment and severity triage       | 7 days       |
| Status update cadence while we work on a fix | every 7 days |

We will credit you in the advisory unless you ask us not to. There is no formal
bug bounty program at this time.

Please give us reasonable time to ship a fix before disclosing publicly.

Note that a report here can only ever result in a fix to **the source**. This project
operates no deployment, so there is nothing anyone here can pause or patch on your
behalf — see [There is no deployment](#there-is-no-deployment). If you find a live
instance under attack, contact whoever deployed and operates it.

## Supported versions

Security fixes land on `main` and nowhere else. There are no long-term support
branches, and no deployed instance is maintained or updated.

## Trust assumptions and known limitations

These are properties of the current design, not undisclosed bugs. Read them before
deploying or interacting with this protocol.

### The owner is fully privileged

`Launchpad` is a UUPS proxy whose `_authorizeUpgrade` is guarded only by
`onlyOwner`. The owner can:

- **replace the implementation with arbitrary code**, which means the owner can
  unilaterally take control of every token, curve and balance held by the contract;
- pause all trading (`setIsMarketPaused`);
- change the fee recipient and the fee rate up to 100% (`setFeeParams`);
- change the creator reward shares (`setRewardParams`);
- change the price feed, the wrapped-native address and the DEX addresses;
- change the supply and reserve parameters that determine launch pricing.

There is **no timelock and no on-chain enforcement of a multisig owner**. Ownership
is whatever address called `initialize`. Anyone deploying this protocol for real
use should transfer ownership to a multisig behind a timelock. Users should treat
any deployment as fully trusted-owner until proven otherwise, and verify who the
owner actually is before depositing funds.

### Migrated liquidity is not locked

At migration the full-range LP position is minted to `feeParams.feeRecipient`, not
burned and not locked. **The fee recipient can withdraw the migrated liquidity at
any time.** This is a deliberate design decision, not an oversight, but it is the
single most important thing for a token buyer to understand: post-migration
liquidity is custodial to the protocol operator.

### Price feed dependency

Launch pricing is derived from a Chainlink-compatible feed via
`MarketUtils.calculateVirtualReserves`. The current implementation reverts only on
a zero answer — it does **not** check `updatedAt` for staleness or validate
`answeredInRound`. A stale or misconfigured feed would skew the opening price of
newly launched tokens. It does not affect tokens whose curve is already
initialized, since virtual reserves are snapshotted at launch.

### Native currency transfers use `transfer()`

Payouts, refunds, and fee and reward distributions use `payable(...).transfer()`,
which forwards a 2300 gas stipend. If the token creator or the fee recipient is a
contract whose `receive()` costs more than that, the corresponding trade reverts.
Use externally owned accounts, or simple forwarders, for those roles.

### Migration is unprotected against slippage and pays no gas subsidy

`DexUtils.migrateToken` mints the position with `amount0Min` and `amount1Min` set
to zero, and creates the pool at a price derived from the final curve price. The
buyer whose transaction happens to exhaust the bonding curve pays the gas for the
entire migration.

### The launched token is transfer-locked until migration

`Token.isLocked` blocks all peer-to-peer transfers during the bonding-curve phase.
Only the launchpad can be a counterparty. If a token never sells out its curve, it
stays locked indefinitely — holders can still sell back to the curve, but the token
will never trade anywhere else.

### Token metadata is not verified

`TokenUtils.validateTokenInfo` checks lengths and URL prefixes only. Names,
symbols, descriptions, logos and social links are attacker-controlled strings.
Anything consuming `TokenLaunched` must treat them as untrusted input — impersonation
of an existing project is trivial and is not prevented on-chain.

### Launching is permissionless

There is no allowlist, no KYC and no review step. Any address can launch any token
at any time. Moderation, if any, happens off-chain in
[`tokenzyme-core`](https://github.com/tokenzyme/tokenzyme-core) and does not affect
on-chain state.
