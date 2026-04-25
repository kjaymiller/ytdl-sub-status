default: test

sync:
    uv sync

test: sync
    uv run python -m unittest discover -s tests -v

build: sync
    uv run python scripts/build.py

all: test build

# Splice the next release's section into CHANGELOG.md (after the header,
# before existing entries). Pass the new version:
#   just changelog 2026.2.6
# Only commits since the last v* tag are pulled in, so the existing history
# (including the hand-written backfill) is preserved. Run AFTER bumping
# manifest.json and BEFORE creating the release commit.
# Requires git-cliff (https://git-cliff.org); install via `cargo install
# git-cliff` or your distro's package, and ensure it is on PATH.
changelog VERSION:
    uv run python scripts/changelog.py {{VERSION}}

# Preview the unreleased section without writing the file.
changelog-preview VERSION:
    git-cliff --unreleased --tag v{{VERSION}}
