"""Shared pytest setup: isolate session persistence from the real user dir."""

import os
import tempfile

# Point persistence at a throwaway dir before any backend module is imported,
# so tests never read or write the developer's real app-data directory.
os.environ.setdefault("FYF_DATA_DIR", tempfile.mkdtemp(prefix="fyf-test-data-"))
