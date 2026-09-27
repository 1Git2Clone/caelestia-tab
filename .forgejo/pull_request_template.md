<!--
See AGENTS.md before opening: KISS, YAGNI, surgical changes, conventional-commit
titles, docs in the same change.
-->

## Summary

What this changes and why.

## Testing

How it was verified: `cargo test`, `node --test tests/*.test.mjs`,
`web-ext lint --source-dir extension`, and which browser it was loaded in.

## Checklist

- [ ] `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings` pass
- [ ] `web-ext lint --source-dir extension --self-hosted` has no errors
- [ ] The handbook (`docs/src/`), README and CHANGELOG match the change
- [ ] Conventional-commit title (`type(scope): ...`)
