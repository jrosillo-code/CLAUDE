"""Holdout-lock discipline.

The final holdout window may be evaluated ONCE, after the selected strategy
specifications are frozen. This module enforces the paper trail:

  * ``freeze_selection`` hashes the frozen specs into a manifest BEFORE any
    holdout numbers are computed;
  * ``record_holdout_access`` appends to an access log; a second access flips
    ``compromised`` to True and every later report must display that;
  * changing the frozen specs after an access is recorded as a violation.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .config import results_dir
from .utils import stable_hash

LOCK_FILENAME = "holdout_lock.json"


def _path(mode: str) -> Path:
    d = results_dir(mode)
    d.mkdir(parents=True, exist_ok=True)
    return d / LOCK_FILENAME


def _load(mode: str) -> dict:
    p = _path(mode)
    return json.loads(p.read_text()) if p.exists() else {
        "frozen_specs_hash": None, "frozen_at": None, "specs": None,
        "access_log": [], "compromised": False, "violations": []}


def _save(mode: str, state: dict) -> None:
    _path(mode).write_text(json.dumps(state, indent=2, default=str))


def freeze_selection(specs: list[dict], mode: str, holdout_start: str) -> str:
    """Freeze the chosen strategy specs before looking at the holdout."""
    state = _load(mode)
    new_hash = stable_hash(specs, 16)
    if state["access_log"] and state["frozen_specs_hash"] not in (None, new_hash):
        state["violations"].append({
            "at": datetime.now(timezone.utc).isoformat(),
            "kind": "respecified_after_holdout_access",
            "detail": "selection changed after holdout was already viewed"})
        state["compromised"] = True
    state.update({"frozen_specs_hash": new_hash, "specs": specs,
                  "holdout_start": holdout_start,
                  "frozen_at": datetime.now(timezone.utc).isoformat()})
    _save(mode, state)
    return new_hash


def record_holdout_access(mode: str, purpose: str) -> dict:
    """Log a holdout evaluation. Returns state; caller must surface
    `compromised` in every report."""
    state = _load(mode)
    if state["frozen_specs_hash"] is None:
        state["violations"].append({
            "at": datetime.now(timezone.utc).isoformat(),
            "kind": "access_before_freeze",
            "detail": purpose})
        state["compromised"] = True
    state["access_log"].append({
        "at": datetime.now(timezone.utc).isoformat(), "purpose": purpose})
    if len(state["access_log"]) > 1:
        state["compromised"] = True
    _save(mode, state)
    return state


def holdout_status(mode: str) -> dict:
    return _load(mode)
