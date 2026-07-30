## What does this change?

<!-- Describe the change and why it is needed. Link the issue it addresses. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Gas optimization
- [ ] Documentation
- [ ] Tests only
- [ ] Tooling / CI

## Impact on the on-chain interface

- [ ] No change to events, function signatures or storage layout
- [ ] Changes event or function signatures — downstream repos need regenerated bindings
- [ ] Changes storage layout — **describe the upgrade path below**

<!-- If either box above is checked, explain what needs to happen in
     tokenzyme-core, tokenzyme-app and tokenzyme-indexer. -->

## Checklist

- [ ] `yarn test` passes
- [ ] `yarn lint` passes
- [ ] `yarn format` has been run
- [ ] `yarn contracts:size` still fits within the EIP-170 limit
- [ ] Tests were added or updated for the changed behaviour
- [ ] New state was added to `LaunchpadStorage.State`, appended at the end — not to `Launchpad` or `LaunchpadAdmin` directly
- [ ] No changes to `ignition/deployments/`
- [ ] This is not a security fix (those go through private disclosure — see SECURITY.md)
