"""Where the uploaded profile photos live.

Both the upload endpoint and the static route have to agree on this
directory, otherwise the upload succeeds and the photo 404s. The files
that ship with the repository sit in the repository root, so that is the
canonical location.
"""

from pathlib import Path

_MODULE_PATH = Path(__file__).resolve()


def _find_repo_root() -> Path:
    """Walk up until the directory that holds package.json shows up."""
    for candidate in _MODULE_PATH.parents:
        if (candidate / "package.json").exists():
            return candidate
    return _MODULE_PATH.parents[3]


REPO_ROOT = _find_repo_root()
AVATAR_STORAGE_ROOT = REPO_ROOT / "storage" / "uploads" / "avatars"


def ensure_avatar_dir() -> Path:
    """Create the directory if it is missing and return it."""
    AVATAR_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return AVATAR_STORAGE_ROOT
