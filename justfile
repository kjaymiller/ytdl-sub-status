default: test

sync:
    uv sync

test: sync
    uv run python -m unittest discover -s tests -v

build: sync
    uv run python scripts/build.py

all: test build
