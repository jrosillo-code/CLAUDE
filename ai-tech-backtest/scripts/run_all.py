#!/usr/bin/env python3
"""Reproduce every major result end-to-end.

    python scripts/run_all.py [--provider synthetic] [--skip-tests]

Phases: tests -> data -> experiments -> robustness -> company analysis -> report.
Each phase is an ordinary script that can also be run alone; the experiment
registry makes re-runs incremental (already-run IDs are skipped).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]


def run(cmd: list[str]) -> None:
    print(f"\n=== {' '.join(cmd)} ===", flush=True)
    res = subprocess.run(cmd, cwd=ROOT)
    if res.returncode != 0:
        print(f"FAILED: {' '.join(cmd)} (exit {res.returncode})", file=sys.stderr)
        raise SystemExit(res.returncode)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="synthetic")
    ap.add_argument("--skip-tests", action="store_true")
    args = ap.parse_args()
    py = sys.executable

    if not args.skip_tests:
        run([py, "-m", "pytest", "tests/", "-q"])
    run([py, "scripts/download_data.py", "--provider", args.provider])
    run([py, "scripts/run_experiments.py", "--provider", args.provider])
    run([py, "scripts/run_robustness.py"])
    run([py, "scripts/run_company_analysis.py", "--provider", args.provider])
    run([py, "scripts/make_report.py", "--provider", args.provider])
    print("\nAll phases complete. Report: reports/research_report.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
