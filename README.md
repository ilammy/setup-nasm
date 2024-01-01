<a href="https://github.com/ilammy/setup-nasm"><img alt="GitHub Actions status" src="https://github.com/ilammy/setup-nasm/workflows/setup-nasm/badge.svg"></a>

# setup-nasm

[GitHub Action](https://github.com/features/actions) for installing [NASM](https://www.nasm.us)
into PATH for the job.

This downloads official binaries if possible, falling back to compilation from source code.

Supports Linux, macOS, and Windows.

## Inputs

- `version` – version of NASM to install (default: 2.16.01)
- `from-source` – set to `true` to always build from source, or `false` to never
- `platform` – set binary platform to something non-standard
- `destination` – target directory for download and installation (default: `$HOME/nasm`)

## Example usage

```yaml
jobs:
  test:
    - uses: ilammy/setup-nasm@v1
    - uses: actions/checkout@v1
    - name: Build something requiring NASM
      run: |
        cd third_party/boringssl
        cmake -G Ninja . && ninja
    # ...
```

## License

MIT, see [LICENSE](LICENSE).
