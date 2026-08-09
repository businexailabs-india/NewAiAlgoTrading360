# IBKR ORB Paper Bot

> **PAPER TRADING / RESEARCH ONLY.** This package refuses live IBKR accounts (`U*` IDs). There is **no option to enable live trading**.

Paper results do **not** predict live results.

## Requirements

- Python **3.12+** (repository workspace standard; 3.11+ compatible patterns)
- Official Interactive Brokers TWS API (`ibapi`) for real TWS/Gateway sessions
- TWS or IB Gateway **paper** account

## Install

From the repository root (uv workspace):

```bash
uv sync --package ibkr-orb-paper
# optional real IBKR API:
uv sync --package ibkr-orb-paper --extra ibkr
```

Or locally:

```bash
cd libs/ibkr-orb-paper
pip install -e ".[dev]"
# optional:
pip install ibapi
```

### Official IBKR API

1. Download the [IBKR API](https://interactivebrokers.github.io/tws-api/) for Python, **or** `pip install ibapi`.
2. Do **not** use unofficial wrappers for this package unless already present elsewhere in the monorepo (this bot uses `ibapi` only).

## Configure TWS / IB Gateway (paper)

1. Log into **IBKR paper** (account ID starts with `DU`).
2. TWS: **Edit → Global Configuration → API → Settings**
   - Enable **ActiveX and Socket Clients**
   - Allow connections from `127.0.0.1`
   - Note the **Socket port**:
     - TWS paper: **7497**
     - IB Gateway paper: **4002**
   - Live ports (7496 / 4001) are rejected by this app.
3. Identify your paper account ID in Account Window (must start with `DU`). Set `IBKR_PAPER_ACCOUNT_ID` in your local `.env` (never commit `.env`).
4. Copy `.env.example` → `.env` and fill values. Defaults keep `DRY_RUN=true` and `ENABLE_PAPER_ORDERS=NO`.

## Modes

| Mode | Behavior |
|------|----------|
| `signal` | Read-only connect, compute signals, persist proposals — **no orders** |
| `dry-run` | Build/validate bracket, persist — **does not call placeOrder** |
| `paper` | Submit brackets only after **all** safety gates pass |

```bash
# Demo without TWS (synthetic bars + FakeIBKRAdapter)
python -m ibkr_orb_paper --fake-ibkr run --mode signal
python -m ibkr_orb_paper --fake-ibkr run --mode dry-run

# Against local TWS paper (requires .env)
python -m ibkr_orb_paper run --mode signal
python -m ibkr_orb_paper run --mode dry-run
python -m ibkr_orb_paper run --mode paper   # only after checklist + gates

python -m ibkr_orb_paper status
python -m ibkr_orb_paper reconcile
python -m ibkr_orb_paper report --date YYYY-MM-DD
python -m ibkr_orb_paper kill-switch
```

Progression: **signal → dry-run → (manual validation) → paper**.

## Safety gates (mandatory)

Orders are submitted only when **all** are true:

1. `DRY_RUN=false`
2. Account ID equals configured `IBKR_PAPER_ACCOUNT_ID`
3. Account ID begins with `DU` (live `U*` rejected)
4. Port is paper-only (`7497` or `4002`)
5. Market data is fresh and not delayed
6. `ENABLE_PAPER_ORDERS=YES`

Also enforced:

- Never auto-select the first managed account
- No live-trading switch exists
- Halt on disconnect, stale data, duplicate orders, unknown order state, reconcile failure
- Restart idempotency via SQLite breakout keys + reconciliation
- Kill switch cancels **only** this strategy’s unfilled entries (does not auto-liquidate)

## Strategy (long-only ORB)

Regular trading hours, 15-minute bars, 30-minute opening range, EMA(50)+slope, session VWAP, ATR(14), volume filter. Limit entry near breakout; ATR/structural stop; RR target. Position sizing uses monthly equity when configured, with drawdown and daily/weekly loss limits.

## Tests

```bash
cd libs/ibkr-orb-paper
pytest -q
```

Tests use `FakeIBKRAdapter` only — they never connect to TWS or submit real orders.

## Logs, reports, SQLite

- Structured logs to stdout
- SQLite path: `SQLITE_PATH` (default `data/ibkr_orb_paper.db`)
- Tables: `signals`, `risk_gates`, `orders`, `executions`, `portfolio_snapshots`, `events`, `traded_breakouts`
- Reports: `python -m ibkr_orb_paper report --date YYYY-MM-DD --csv out.csv`

## Known IBKR paper limitations

- Paper fills/liquidity can differ from live
- Market data subscriptions may be delayed without a real-time entitlement
- Historical pacing limits apply; the adapter uses bounded backoff where implemented
- Paper P&amp;L is **not** a forecast of live performance

## Pre-automation checklist (minimum 20 sessions)

Before enabling automated paper orders (`DRY_RUN=false` + `ENABLE_PAPER_ORDERS=YES`):

- [ ] ≥20 sessions in **signal** mode reviewed manually
- [ ] Bracket prices/qty match discretionary intent
- [ ] Risk gates and sizing verified on paper account NetLiquidation
- [ ] Restart/reconcile verified (no duplicate entries)
- [ ] Kill switch tested (entries cancelled; positions not auto-flattened)
- [ ] Confirmed account is `DU…` and port is 7497/4002
- [ ] Understood: paper ≠ live

## Manual TWS steps still required

1. Start TWS/Gateway logged into paper
2. Enable API socket clients; set paper port
3. Create local `.env` from `.env.example` (not committed)
4. Set `IBKR_PAPER_ACCOUNT_ID` to your `DU…` id
5. Run signal/dry-run for validation sessions
6. Only then set paper flags — `placeOrder` runs only after every safety gate passes on a verified `DU` paper account

## Architecture

Broker-specific code lives under `broker/`. Strategy, indicators, sizing, and risk are pure Python and fully unit-tested without network access.
