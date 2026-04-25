default: test

sync:
    uv sync

test: sync
    uv run python -m unittest discover -s tests -v

build: sync
    uv run python scripts/build.py

all: test build

# Bump the extension version, regenerate CHANGELOG.md, commit, and tag.
# LEVEL is one of: patch, minor, major. Commitizen reads commits since the
# last v* tag (Conventional Commits format) and infers what changed.
#   just bump patch
# Use `--dry-run` semantics with `just bump-preview LEVEL` first.
bump LEVEL:
    uv run cz bump --increment {{LEVEL}}

# Show what `cz bump LEVEL` would do without writing anything.
bump-preview LEVEL:
    uv run cz bump --increment {{LEVEL}} --dry-run

# Regenerate CHANGELOG.md from existing commits without bumping the version.
changelog:
    uv run cz changelog --incremental

# Print the latest release section from CHANGELOG.md to stdout. Useful for
# release-note copy/paste (GitHub Release body, AMO submission notes, etc.).
# Pipe to a clipboard tool if you want: `just latest-changelog | wl-copy`.
latest-changelog:
    @awk '/^## / { if (++n == 2) exit } n == 1 { print }' CHANGELOG.md
