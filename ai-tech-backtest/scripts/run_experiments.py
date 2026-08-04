#!/usr/bin/env python3
"""Phase 2-3: run the full experiment grid from configs/experiments.yaml.

Every (strategy variant × cost scenario) is backtested and appended to the
registry with development/holdout metrics. Already-run experiment IDs are
skipped, so the pipeline is resumable and incremental.

Usage:
    python scripts/run_experiments.py [--provider synthetic] [--families xsmom,tsmom]
"""
from __future__ import annotations

import argparse
import itertools
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from aitb.config import load_cost_scenarios, load_yaml
from aitb.data.loader import load_market_data
from aitb.experiments import ExperimentRegistry, run_experiment
from aitb.strategies import (benchmarks, breakout, fundamental, meanrev, ml,
                             regime, riskmanaged, tsmom, xsmom)
from aitb.utils import get_logger

log = get_logger("run_experiments")

CLASSES = {}
for mod in (benchmarks, tsmom, xsmom, meanrev, breakout, fundamental, regime,
            riskmanaged, ml):
    for name in dir(mod):
        obj = getattr(mod, name)
        if isinstance(obj, type) and hasattr(obj, "build") and name != "Strategy":
            CLASSES[name] = obj


def expand_grid(entry: dict):
    cls = CLASSES[entry["class"]]
    grid = entry.get("grid", {})
    keys = sorted(grid)
    for combo in itertools.product(*(grid[k] for k in keys)):
        params = {k: v for k, v in zip(keys, combo) if v is not None}
        yield cls(**params)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="synthetic")
    ap.add_argument("--families", default="",
                    help="comma-separated subset of families to run")
    ap.add_argument("--scenarios", default="zero,base,stressed")
    args = ap.parse_args()

    md = load_market_data(args.provider)
    scens = load_cost_scenarios()
    scens = {k: v for k, v in scens.items() if k in args.scenarios.split(",")}
    registry = ExperimentRegistry()
    spec = load_yaml("experiments.yaml")

    families = args.families.split(",") if args.families else list(spec)
    n = 0
    for family in families:
        for entry in spec.get(family, []):
            for strat in expand_grid(entry):
                run_experiment(md, strat, scens, registry,
                               notes=f"family_group={family}")
                n += 1
    log.info("completed %d strategy variants × %d scenarios", n, len(scens))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
