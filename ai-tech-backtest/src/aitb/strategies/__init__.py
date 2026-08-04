"""Strategy registry: every runnable strategy family lives here."""
from .base import Strategy
from . import benchmarks, tsmom, xsmom, meanrev, breakout, fundamental, regime, riskmanaged, ml

__all__ = ["Strategy", "benchmarks", "tsmom", "xsmom", "meanrev", "breakout",
           "fundamental", "regime", "riskmanaged", "ml"]
