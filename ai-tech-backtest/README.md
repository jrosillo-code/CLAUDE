# AI & Technology Strategy Research and Backtesting System

A modular Python research platform for systematically developing, testing and
ranking trading/investment strategies on the US technology, semiconductor,
cloud, software, cybersecurity, robotics and AI sectors — and for answering the
harder question underneath: **does any of this trading actually beat simply
owning the leading AI/technology companies?**

> **This is a research tool, not investment advice.** Historical results —
> and *a fortiori* synthetic results — do not predict future performance.

---

## ⚠️ Data reality in this repository

The execution environment in which this project was built **blocks all
market-data hosts** (Stooq, Yahoo, FRED, Tiingo, Polygon, Alpha Vantage, SEC
EDGAR were all tested and denied by the egress policy). Therefore:

* The full provider-adapter data layer is implemented and ready
  (`stooq`, `yahoo`, `fred` adapters), but **could not be exercised here**.
* All shipped results are produced by a **deterministic synthetic provider**
  (`src/aitb/data/synthetic.py`) that generates a regime-realistic stylized
  history (dot-com boom/bust, GFC, QE bull, COVID, 2022 bear, AI rally),
  honors real IPO/delisting dates, and includes delisted names.
* Synthetic results **demonstrate the machinery** — signal timing, accounting,
  cost modeling, validation, reporting. They say nothing about actual markets.

To produce real results, run in a networked environment:

```bash
python scripts/run_all.py --provider stooq     # free, no key, split-adjusted only
python scripts/run_all.py --provider yahoo     # free fallback, total-return series
```

## Installation

```bash
cd ai-tech-backtest
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # Python >= 3.11
cp .env.example .env             # optional: add API keys for paid providers
```

## Reproducing every major result

```bash
python scripts/run_all.py                     # tests -> data -> experiments ->
                                              # robustness -> companies -> report
# or phase by phase:
python -m pytest tests/ -q                    # 34 tests incl. bias regression tests
python scripts/download_data.py               # build/validate/cache dataset
python scripts/run_experiments.py             # full grid × cost scenarios (resumable)
python scripts/run_robustness.py              # walk-forward, bootstrap, DSR, MC
python scripts/run_company_analysis.py        # own-it vs trade-it per company
python scripts/make_report.py                 # HTML report + CSV/MD/parquet exports
```

Outputs: `reports/research_report.html`, `reports/summary.md`,
`results/strategy_ranking.csv`, `results/experiments.jsonl` (append-only
registry), `results/curves/*.parquet` (equity curves),
`results/robustness/*`, `results/company_analysis.csv`.

## Architecture

```
ai-tech-backtest/
  configs/            universe.yaml (PIT universe + baskets), costs.yaml,
                      backtest.yaml (conventions/splits), experiments.yaml (grids)
  src/aitb/
    config.py         typed config loading
    data/
      providers.py    provider adapters (stooq/yahoo/fred) + registry
      synthetic.py    deterministic offline market generator
      store.py        parquet cache, metadata, incremental updates
      validation.py   gap/duplicate/jump/stale/OHLC checks
      loader.py       aligned panels; PIT fundamentals accessor
    universe.py       point-in-time investable mask (IPO/seasoning/liquidity/delist)
    features.py       causal signal building blocks (momentum, RSI, PIT factors…)
    portfolio.py      weighting schemes, caps, vol targeting, schedules
    costs.py          bps + √participation impact + borrow model
    backtest/engine.py  next-open execution engine (see conventions below)
    metrics.py        full performance/risk metric set
    validation.py     walk-forward, block bootstrap, PSR/DSR, MC, sensitivity
    experiments.py    append-only experiment registry + runner (resumable)
    ranking.py        composite score + robust/inconclusive/rejected verdicts
    reporting.py      charts + self-contained HTML report
    strategies/       benchmark, tsmom, xsmom, meanrev, breakout, fundamental,
                      regime, riskmanaged, ml families
  scripts/            phase entry points (run_all.py reproduces everything)
  tests/              unit + integration + bias-regression tests
```

## Methodology and bias prevention

| Bias | Countermeasure |
|---|---|
| Look-ahead | Signals dated T fill at the **open of T+1**; the engine lags all weights by one bar structurally. Regression test: a perfect-foresight signal cannot beat buy & hold. |
| Data leakage in features | All features are trailing; test asserts truncated-data signals equal full-data signals on the overlap. |
| Fundamental leakage | Quarterly rows enter panels only at their **publication date** (40–60 day lags), never the fiscal period end. |
| Survivorship | Universe config keeps delisted names (SUNW, EMC, YHOO, MXIM, XLNX); the investable mask trades them until delisting; IPOs enter after a 126-day seasoning window. |
| Unrealistic fills | Cost scenarios (zero/low/base/stressed): commission + half-spread + slippage + √participation impact vs trailing ADV; 5%-of-ADV participation cap; borrow on shorts; delisting liquidation at doubled cost. |
| Overfitting / multiple testing | Untouched chronological holdout; walk-forward parameter selection on trailing data only; moving-block bootstrap CIs; probabilistic Sharpe; **deflated Sharpe over each family's full trial battery**; parameter-sensitivity tables; every failed variant stays in the registry. |
| Cherry-picking | Composite ranking penalizes turnover, single-name P&L concentration, complexity, regime concentration and IS→OOS degradation; verdicts are three-way (robust / inconclusive / rejected) and the report has a mandatory failure-analysis section. |

### Execution convention

Signals are computed from data through the close of day **T**; orders execute
at the open of **T+1**. Prices used for fills and marks are ratio-adjusted
(dividends embedded), with raw close retained separately — adjusted and
unadjusted series are never mixed silently.

## Data sources

| Source | Status | Licensing notes |
|---|---|---|
| Synthetic | default here | n/a — deterministic, seeded, clearly labeled |
| Stooq | adapter ready | free EOD CSV; split-adjusted, **no dividends**; personal/research use |
| Yahoo Finance | adapter ready | unofficial endpoint; fallback only; no redistribution |
| FRED | adapter ready | public-domain macro (fed funds, yields, CPI, VIX, spreads) |
| Tiingo / Polygon / Alpha Vantage / FMP / EODHD / Nasdaq Data Link | keys in `.env` | paid tiers for dividends, delistings, fundamentals, intraday |
| SEC EDGAR | planned module | free; point-in-time filings for real PIT fundamentals |

Free sources cannot supply delisted-name history or point-in-time
fundamentals; those require a paid provider (add an adapter by subclassing
`PriceProvider` — nothing else changes).

## Strategy families implemented

* **Benchmarks** — ETF buy & hold; equal-weight and cap-weight universes;
  QQQ 200-day SMA; 12-1 momentum baseline; per-company buy & hold.
* **Time-series momentum** — per-name SMA trend w/ Treasury fallback,
  absolute momentum vs cash hurdle, dual momentum across tech ETFs.
* **Cross-sectional momentum** — top-N total/risk-adjusted/relative-vs-QQQ,
  multiple weightings and rebalance frequencies.
* **Mean reversion** — RSI(2), 5-day reversal, Bollinger reversion, all with
  uptrend + liquidity filters (evaluated skeptically under stressed costs).
* **Breakout** — Donchian with/without regime filter, vol-compression breakout.
* **Fundamental (PIT)** — quality/growth composite; valuation-aware growth
  using each stock's own P/S history.
* **Regime allocation** — stacked risk flags (trend, VIX, rates, breadth,
  credit), semis-leadership rotation.
* **Risk-managed buy & hold** — vol targeting, drawdown de-risking,
  inverse-vol weighting on AI baskets.
* **ML** — walk-forward ridge cross-sectional ranker with purge gap,
  train-only scaling, fixed seeds (kept deliberately simple/explainable).

## Limitations (read before believing any number)

* Synthetic data in this environment — see the warning above.
* Business-day calendar without exchange holidays.
* No intraday data; no options data; borrow costs are scenario constants.
* Free providers lack dividends (Stooq) or delistings (all of them).
* Regime windows in `backtest.yaml` are descriptive labels, not tradable
  signals.
* Tax analysis is not implemented (flagged as next step); active strategies'
  after-tax hurdle vs buy & hold is materially higher than the pre-tax one.
