default: test

sync:
    uv sync

test: sync
    uv run python -m unittest discover -s tests -v

build: sync
    uv run python scripts/build.py

all: test build

# Regenerate CHANGELOG.md from tagged commits. Pass the next version, e.g.
#   just changelog 2026.2.6
# Requires git-cliff (https://git-cliff.org). The recipe assumes it is on PATH.
changelog VERSION:
    git cliff --tag v{{VERSION}} -o CHANGELOG.md

# Preview the unreleased section without writing the file.
changelog-preview VERSION:
    git cliff --unreleased --tag v{{VERSION}}
