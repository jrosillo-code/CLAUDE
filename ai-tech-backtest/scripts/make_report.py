#!/usr/bin/env python3
"""Phase 6: build the HTML research report + CSV/Parquet/Markdown exports.

Reads the experiment registry, robustness outputs and company analysis;
writes reports/research_report.html and reports/summary.md plus CSV exports.

Usage: python scripts/make_report.py [--provider synthetic]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from aitb.config import REPORTS_DIR, RESULTS_DIR, load_backtest_config
from aitb.data.loader import load_market_data
from aitb.experiments import ExperimentRegistry, _git_commit
from aitb.metrics import summary as metric_summary
from aitb.ranking import rank_experiments
from aitb.reporting import (annual_returns_heatmap, correlation_heatmap,
                            df_to_html, drawdown_chart, equity_chart, img_tag,
                            render_report, rolling_sharpe_chart,
                            sensitivity_heatmap)
from aitb.utils import get_logger
from aitb.validation import strategy_correlation, subperiod_table

log = get_logger("make_report")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="synthetic")
    args = ap.parse_args()

    md = load_market_data(args.provider)
    registry = ExperimentRegistry()
    df = registry.load()
    if df.empty:
        log.error("registry empty — run experiments first")
        return 1
    bt_cfg = load_backtest_config()

    ranking = rank_experiments(df)
    ranking.to_csv(RESULTS_DIR / "strategy_ranking.csv", index=False)
    ranking.to_parquet(RESULTS_DIR / "strategy_ranking.parquet")

    ok = df[(df["status"] == "ok") & (df["scenario"] == "base")]
    curves: dict[str, pd.Series] = {}
    for rec in ok.to_dict("records"):
        c = registry.load_curve(rec["id"])
        if c is not None:
            curves[rec["strategy"]] = c["returns"]

    sections: list[dict] = []
    warnings = []
    if args.provider == "synthetic":
        warnings.append(
            "SYNTHETIC DATA: this environment blocks all market-data hosts, so every "
            "result below is computed on a deterministic, regime-realistic SYNTHETIC "
            "dataset. Numbers demonstrate the research machinery — they are NOT "
            "historical market results and must not inform investment decisions. "
            "Re-run with --provider stooq/yahoo in a networked environment for real data.")
    warnings.append(
        "Historical results — real or synthetic — are not predictive of future "
        "performance. This is a research tool, not investment advice.")

    # ---- 1. Executive summary -------------------------------------------
    n_variants = ok["strategy"].nunique()
    n_robust = int((ranking["verdict"] == "robust_candidate").sum())
    n_rej = int((ranking["verdict"] == "rejected").sum())
    top = ranking.head(5)[["strategy", "score", "holdout_sharpe", "max_drawdown", "verdict"]]
    sections.append({"title": "1. Executive summary", "html": f"""
<p>{n_variants} strategy variants were evaluated across {ok['family'].nunique()} families
under {df['scenario'].nunique()} cost scenarios, with a chronological development /
holdout split at <b>{ok.iloc[0]['split']['holdout_start']}</b> (holdout never used for
selection). Composite ranking yields <b>{n_robust} robust candidates</b>,
{int((ranking['verdict'] == 'inconclusive').sum())} inconclusive strategies, and
{n_rej} rejected strategies.</p>{df_to_html(top)}
<p class="note">Score blends holdout Sharpe, stability across subperiods, PSR,
drawdown, turnover, concentration and complexity penalties — never CAGR alone.</p>"""})

    # ---- 2. Data coverage ------------------------------------------------
    px = md.adj_close
    cov_rows = []
    for sec in md.universe.securities:
        if sec.ticker in px.columns:
            s = px[sec.ticker].dropna()
            cov_rows.append({"ticker": sec.ticker, "sector": sec.sector,
                             "first": s.index[0].date(), "last": s.index[-1].date(),
                             "days": len(s),
                             "status": "delisted" if sec.delisted else "active"})
    cov = pd.DataFrame(cov_rows)
    n_iss = len(md.issues)
    sections.append({"title": "2. Data coverage and limitations", "html": f"""
<p>Provider: <b>{args.provider}</b>. {len(cov)} securities
({int((cov['status'] == 'delisted').sum())} delisted names retained for
survivorship-bias awareness), span {md.calendar[0].date()} – {md.calendar[-1].date()}.
Validation issues: {n_iss}.</p>{df_to_html(cov)}
<p class="note">Known limitations: business-day calendar without exchange holidays;
{('synthetic fundamentals with 40–60 day publication lags; stylized macro paths;'
  ' no intraday data.') if args.provider == 'synthetic' else
 ('Stooq lacks dividends (split-adjusted only); Yahoo total-return series'
  ' used where available; no delisted-name coverage from free providers —'
  ' delisted history requires a paid source (documented in README).')}</p>"""})

    # ---- 3. Methodology --------------------------------------------------
    sections.append({"title": "3. Methodology", "html": """
<ul>
<li><b>Execution convention:</b> signals use data through the close of day T;
orders fill at the open of T+1. The engine structurally cannot fill on the
signal bar (regression-tested).</li>
<li><b>Survivorship:</b> the universe is point-in-time — IPO + 126-day
seasoning before entry, delisted names traded until their delisting date.</li>
<li><b>Fundamentals:</b> quarterly data enters only at its publication date.</li>
<li><b>Costs:</b> four scenarios (zero / low / base / stressed): commissions +
half-spread + slippage + √participation market impact against trailing ADV,
borrow on shorts, participation capped at 5% of ADV per day.</li>
<li><b>Validation:</b> development vs untouched holdout; walk-forward parameter
selection inside development; moving-block bootstrap CIs; probabilistic and
deflated Sharpe (full trial battery per family); Monte Carlo sequence tests;
subperiod/regime tables.</li>
<li><b>Registry:</b> every variant (including failures) is recorded append-only
with spec, data version, git commit and timestamp.</li>
</ul>"""})

    # ---- 4. Benchmarks ---------------------------------------------------
    bench_names = [n for n in curves if "BuyAndHold" in n and any(
        b in n for b in ("SPY", "QQQ", "XLK", "SOXX", "IGV", "SMH"))]
    bench_curves = {n.replace("BuyAndHold(ticker=", "").rstrip(")"): (1 + curves[n]).cumprod()
                    for n in bench_names}
    bench_rets = {n.replace("BuyAndHold(ticker=", "").rstrip(")"): curves[n] for n in bench_names}
    bench_tbl = pd.DataFrame({k: metric_summary(v) for k, v in bench_rets.items()}).T
    bench_tbl = bench_tbl[["cagr", "ann_vol", "sharpe", "max_drawdown", "calmar", "best_year", "worst_year"]]
    bench_tbl.insert(0, "benchmark", bench_tbl.index)
    sections.append({"title": "4. Benchmark results (base costs)", "html":
                     img_tag(equity_chart(bench_curves, "Benchmark ETFs — growth of $1"))
                     + df_to_html(bench_tbl, pct_cols=("cagr", "ann_vol", "max_drawdown",
                                                       "best_year", "worst_year"))})

    # ---- 5. Ranking table ------------------------------------------------
    sections.append({"title": "5. Strategy ranking (all families, base costs)",
                     "html": df_to_html(ranking.drop(columns=["cost_fragile"], errors="ignore"),
                                        pct_cols=("dev_cagr", "holdout_cagr", "max_drawdown"))
                     + """<p class="note">Verdicts: <span class="robust">robust_candidate</span>
(score &gt; 2, positive holdout Sharpe, survives stressed costs) ·
<span class="inconclusive">inconclusive</span> ·
<span class="rejected">rejected</span>. Development metrics are in-sample for
grid-selected variants; holdout is the untouched final window.</p>"""})

    # ---- 6. Equity / drawdown / rolling charts for the top strategies ----
    top_names = ranking[ranking["family"] != "benchmark"].head(6)["strategy"].tolist()
    qqq_name = next((n for n in curves if n == "BuyAndHold(ticker=QQQ)"), None)
    chart_rets = {n[:45]: curves[n] for n in top_names if n in curves}
    if qqq_name:
        chart_rets["QQQ buy&hold"] = curves[qqq_name]
    chart_eq = {k: (1 + v).cumprod() for k, v in chart_rets.items()}
    sections.append({"title": "6. Top strategies vs QQQ (base costs)", "html":
                     img_tag(equity_chart(chart_eq, "Top-ranked strategies — growth of $1"))
                     + img_tag(drawdown_chart(chart_rets, "Drawdowns"))
                     + img_tag(rolling_sharpe_chart(chart_rets, "Top strategies"))
                     + img_tag(annual_returns_heatmap(chart_rets, "Calendar-year returns"))})

    # ---- 7. Cost sensitivity --------------------------------------------
    cost_rows = []
    all_ok = df[df["status"] == "ok"]
    for strat in top_names:
        for scen in ("zero", "base", "stressed"):
            rec = all_ok[(all_ok["strategy"] == strat) & (all_ok["scenario"] == scen)]
            if len(rec):
                m = rec.iloc[0]["metrics_dev"]
                cost_rows.append({"strategy": strat[:45], "scenario": scen,
                                  "cagr": m.get("cagr"), "sharpe": m.get("sharpe"),
                                  "turnover": rec.iloc[0].get("annual_turnover")})
    cost_tbl = pd.DataFrame(cost_rows)
    sections.append({"title": "7. Cost sensitivity", "html":
                     df_to_html(cost_tbl, pct_cols=("cagr",)) +
                     "<p class='note'>Strategies whose edge disappears between "
                     "zero and stressed scenarios are flagged cost-fragile in the "
                     "ranking and penalized.</p>"})

    # ---- 8. Parameter sensitivity (momentum family example) --------------
    sens_html = ""
    xs = ok[ok["family"] == "xsmom"]
    grid_rows = []
    for rec in xs.to_dict("records"):
        p = rec["spec"]["params"]
        if rec["spec"]["class"] == "XSMomentumTopN" and p.get("weighting") == "equal":
            grid_rows.append({"lookback": p["lookback_days"], "top_n": p["top_n"],
                              "sharpe": (rec["metrics_dev"] or {}).get("sharpe")})
    if grid_rows:
        gdf = pd.DataFrame(grid_rows)
        sens_html += img_tag(sensitivity_heatmap(
            gdf, "lookback", "top_n", "sharpe",
            "XSMomentumTopN — development Sharpe by parameter"))
    rob_dir = RESULTS_DIR / "robustness"
    fam_path = rob_dir / "family_summary.csv"
    if fam_path.exists():
        fam = pd.read_csv(fam_path)
        sens_html += "<h3>Family-level robustness</h3>" + df_to_html(fam)
        sens_html += ("<p class='note'>deflated_sharpe_prob is P(true Sharpe &gt; 0) "
                      "after correcting for the number of variants tried in the family "
                      "— the multiple-testing control. walkforward_oos_sharpe selects "
                      "parameters on trailing data only.</p>")
    sections.append({"title": "8. Parameter sensitivity & multiple-testing control",
                     "html": sens_html or "<p>No sensitivity data.</p>"})

    # ---- 9. Regime analysis ---------------------------------------------
    reg_html = ""
    if top_names and top_names[0] in curves:
        qqq_r = bench_rets.get("QQQ")
        st = subperiod_table(curves[top_names[0]], bt_cfg.subperiods, qqq_r)
        reg_html = (f"<p>Subperiod behavior of the top-ranked strategy "
                    f"<b>{top_names[0][:60]}</b> vs QQQ:</p>"
                    + df_to_html(st, pct_cols=("cagr", "max_dd", "bench_cagr", "excess_cagr")))
    sections.append({"title": "9. Regime / subperiod analysis", "html": reg_html})

    # ---- 10. Strategy correlation ---------------------------------------
    corr_pool = {n[:40]: curves[n] for n in top_names if n in curves}
    if qqq_name:
        corr_pool["QQQ"] = curves[qqq_name]
    if len(corr_pool) >= 3:
        corr = strategy_correlation(corr_pool)
        corr_html = img_tag(correlation_heatmap(corr, "Daily-return correlation"))
    else:
        corr_html = "<p>Too few strategies for a correlation matrix.</p>"
    sections.append({"title": "10. Strategy correlation / redundancy", "html": corr_html})

    # ---- 11. Company analysis -------------------------------------------
    comp_path = RESULTS_DIR / "company_analysis.csv"
    comp_html = ""
    if comp_path.exists():
        comp = pd.read_csv(comp_path)
        show = comp[["ticker", "sector", "first_data", "bh_cagr_since_ipo", "bh_vol",
                     "bh_sharpe", "bh_max_dd", "corr_qqq",
                     "overlay_cagr_base", "overlay_sharpe_base", "overlay_max_dd_base",
                     "timing_adds_value_after_costs"]].copy()
        n_helped = int(comp["timing_adds_value_after_costs"].fillna(False).sum())
        comp_html = (f"<p>Per-company buy &amp; hold vs a 200-day SMA timing overlay "
                     f"(stock when trending, IEF otherwise, base costs). The overlay "
                     f"improved risk-adjusted results for <b>{n_helped} of {len(comp)}</b> "
                     f"names — mostly by cutting drawdowns, usually at the cost of CAGR.</p>"
                     + df_to_html(show, pct_cols=("bh_cagr_since_ipo", "bh_vol", "bh_max_dd",
                                                  "overlay_cagr_base", "overlay_max_dd_base")))
    sections.append({"title": "11. Individual companies: own it vs trade it",
                     "html": comp_html or "<p>Run scripts/run_company_analysis.py first.</p>"})

    # ---- 12. Failure analysis -------------------------------------------
    rejected = ranking[ranking["verdict"] == "rejected"]
    fail_html = df_to_html(rejected[["strategy", "family", "score", "dev_sharpe",
                                     "holdout_sharpe", "annual_turnover", "top_name_share"]])
    failed_runs = df[df["status"] == "failed"]
    if len(failed_runs):
        fail_html += "<h3>Errored runs</h3>" + df_to_html(
            failed_runs[["strategy", "scenario", "error"]]
            if "strategy" in failed_runs.columns else failed_runs[["scenario", "error"]])
    fail_html += """<p class="note">Common failure modes observed: mean-reversion
edges vanish under realistic costs (turnover ≫ edge); breakout variants without a
regime filter whipsaw in bear markets; concentration in a single mega-winner
drives apparent alpha (top_name_share near 1).</p>"""
    sections.append({"title": "12. Failure analysis (rejected strategies)", "html": fail_html})

    # ---- 13. Conclusions -------------------------------------------------
    sections.append({"title": "13. Conclusions and next steps", "html": """
<ul>
<li>Simple, low-turnover risk management (trend filters, drawdown de-risking,
vol targeting) is where robustness concentrates; high-turnover signal trading
rarely survives stressed costs.</li>
<li>Any strategy whose edge is concentrated in one name or one regime
(especially the post-2023 window) should be treated as unproven.</li>
<li>Next steps: real-data run (Stooq/Tiingo) in a networked environment;
point-in-time fundamentals from SEC EDGAR; earnings-event strategies with
actual announcement timestamps; capacity analysis at larger AUM; tax-aware
after-tax comparison of active vs buy-and-hold.</li>
</ul>
<p class="note">Nothing in this report is investment advice. Historical (and
synthetic) performance does not predict future results.</p>"""})

    # ---- render ----------------------------------------------------------
    out = render_report(
        "AI & Technology Strategy Research Report", sections,
        provider=args.provider,
        span=f"{md.calendar[0].date()} – {md.calendar[-1].date()}",
        git=_git_commit(), warnings=warnings)

    # Markdown summary export
    md_lines = ["# Strategy research summary\n",
                f"Provider: {args.provider} (synthetic = demonstration data)\n",
                "## Top strategies\n",
                ranking.head(10).to_markdown(index=False), "\n"]
    (REPORTS_DIR / "summary.md").write_text("\n".join(md_lines))
    ok_export = ok.copy()
    for col in ("metrics_dev", "metrics_holdout", "spec", "split", "concentration", "subperiods"):
        if col in ok_export.columns:
            ok_export[col] = ok_export[col].map(str)
    ok_export.to_csv(RESULTS_DIR / "experiments_export.csv", index=False)
    log.info("report: %s", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
