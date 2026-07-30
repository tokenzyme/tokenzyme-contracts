# Contributing to Tokenzyme Contracts

Thanks for taking the time to contribute. This document covers how to get set up,
what we expect from a change, and how to get it merged.

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before you start

**Open an issue first** for anything beyond a typo or an obvious bug fix. These
contracts hold user funds and are deployed to mainnet, so changes to protocol
mechanics need a design discussion before code. A PR that arrives with no prior
issue and changes the curve math, the fee model, or the migration path is likely to
be asked to slow down and start with an issue.

Good first contributions:

- test coverage for paths the suite does not exercise yet;
- NatSpec documentation on public and external functions;
- gas optimizations backed by before/after measurements;
- fixes for anything listed under *Known limitations* in [SECURITY.md](./SECURITY.md).

**Found a vulnerability?** Do not open an issue or a PR. Follow the private
disclosure process in [SECURITY.md](./SECURITY.md).

## Development setup

Requirements: Node.js 24+ and Corepack.

```bash
corepack enable
yarn
cp .env.template .env
```

You do **not** need to fill in `.env` to compile or run the unit tests. It is only
needed for deployment and forking.

```bash
yarn hardhat compile   # compile only
yarn test              # run the test suite
yarn lint              # ESLint over the TypeScript sources
yarn format            # Prettier
yarn contracts:size    # check contract sizes against the EIP-170 limit
```

> [!NOTE]
> Do not use `yarn contracts:compile` unless you also have `tokenzyme-core` and
> `tokenzyme-app` checked out as siblings — it copies the generated TypeChain
> bindings into those directories and fails if they are missing. `yarn hardhat compile`
> is the right command when working on the contracts alone.

## Making a change

1. Fork the repository and branch off `main`.
2. Make your change. Keep it focused — one concern per pull request.
3. **Add or update tests.** Any change to contract behaviour needs test coverage;
   PRs that change Solidity without touching `test/` will be sent back.
4. Run `yarn test`, `yarn lint` and `yarn format` before pushing.
5. Open a pull request describing what changed and why.

### Coding conventions

Solidity:

- Solidity `0.8.28`, matching `hardhat.config.ts`. Do not widen the pragma.
- Two-space indentation, matching the existing files.
- Custom errors, not `require` strings.
- New state goes in `LaunchpadStorage.State`. **Never add state variables directly
  to `Launchpad` or `LaunchpadAdmin`** — the contract is upgradeable and the
  namespaced storage struct is what keeps layouts safe. When adding fields to an
  existing struct, append them at the end; never reorder or remove.
- Emit an event for every state change that off-chain consumers care about. The
  indexer is built entirely on events.
- Keep `Launchpad` under the EIP-170 size limit; push logic into libraries when it
  grows. Verify with `yarn contracts:size`.

TypeScript:

- ESLint (Airbnb + strict type-checked) and Prettier are enforced. Run them.
- No default exports — `import/no-default-export` is on, with `hardhat.config.ts`
  as the deliberate exception.

Commit messages:

- Write in the imperative mood and explain the *why* in the body when it is not
  obvious. [Conventional Commits](https://www.conventionalcommits.org) is
  encouraged for new contributions but not enforced.

### Changes that affect other repositories

The contract ABI is a public interface consumed by three other repositories. If you
change an event signature, a function signature, or the storage layout, say so
explicitly in your PR description. Downstream, these need to be regenerated:

- `tokenzyme-core` and `tokenzyme-app` — TypeChain bindings under `src/generated/typechain`;
- `tokenzyme-indexer` — `abi/launchpad.json`, plus the affected handlers.

### Deployments and upgrades

Do not include changes under `ignition/deployments/` in a pull request. That
directory is written by the deployment process and is only updated by a maintainer
who actually ran the deployment.

New Ignition modules follow the `mYYYYMMDDNN_Description` naming pattern and must
be appended — never edit a module that has already been applied to a live network.

## Review

A maintainer will review your PR. Expect scrutiny proportional to the risk of the
change: a documentation fix is quick, a change to the curve math is not. Please be
patient, and be prepared to justify design decisions.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE) that covers this project.
