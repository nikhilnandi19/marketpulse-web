# Portfolio Risk Lab: explainer

This is the doc to read before talking about the Portfolio page out loud. It walks through one real three-stock example with every number shown, gives a one-page glossary, and answers the questions a finance person is likely to ask.

Everything on the page is historical and educational. It describes what happened, it does not predict, and it is not advice.

## The 30-second version

The Portfolio page takes a set of S&P 500 stocks and weights, and answers four questions from past prices:

1. How bumpy is this mix? (volatility, VaR, expected shortfall, drawdown, beta)
2. Where does the risk come from? (risk contribution)
3. How diversified is it really? (correlation, effective holdings)
4. How would it have done in real sell-offs? (stress replays)

All the math lives in `lib/risk/` as plain TypeScript with no React in it. It is checked against an independent pandas calculation to 1e-8. Nothing is a black box: every number maps to one short function (table in the last section).

## Worked example

**Portfolio:** AAPL 50%, JPM 30%, XOM 20%. Size $100,000.
**Window:** 2 years, 504 trading days, 7 Oct 2024 to 9 Oct 2026 (first return measured from the 4 Oct 2024 close).
**Prices:** daily closes adjusted for splits and dividends, from Yahoo Finance. Prices run through 9 Oct 2026.
**Benchmark:** SPY, an ETF that tracks the S&P 500.

These numbers will drift as prices refresh. To regenerate them, run `.venv/bin/python scripts/risk_explainer_example.py`.

### Step 1: simple daily returns

For each day, return = today's price divided by yesterday's price, minus 1. A stock that goes from 100 to 102 has a return of 2%. The portfolio return for a day is the weighted sum of the stocks' returns:

> portfolio return = 0.50 × AAPL + 0.30 × JPM + 0.20 × XOM

This assumes the weights are reset to 50/30/20 every day ("rebalanced daily"). That is the standard convention for risk measurement and the one the page uses. The growth chart also offers a buy-and-hold view.

### Step 2: each stock on its own

| Stock | Weight | Annualized volatility | Beta vs SPY |
|---|---|---|---|
| AAPL | 50% | 28.7% | 1.07 |
| JPM | 30% | 24.7% | 0.93 |
| XOM | 20% | 24.7% | 0.18 |

Annualized volatility = standard deviation of daily returns (n-1 in the denominator) × √252.

Correlation of daily returns over the window:

| | AAPL | JPM | XOM |
|---|---|---|---|
| AAPL | 1.00 | 0.34 | 0.15 |
| JPM | 0.34 | 1.00 | 0.14 |
| XOM | 0.15 | 0.14 | 1.00 |

### Step 3: portfolio volatility

Portfolio variance = the sum over every pair of (weight × weight × covariance), using the annualized covariance matrix:

| Term | Value |
|---|---|
| 0.50² × var(AAPL) = 0.25 × 0.082499 | 0.020625 |
| 0.30² × var(JPM) = 0.09 × 0.060802 | 0.005472 |
| 0.20² × var(XOM) = 0.04 × 0.061144 | 0.002446 |
| 2 × 0.50 × 0.30 × cov(AAPL, JPM) = 0.30 × 0.024108 | 0.007232 |
| 2 × 0.50 × 0.20 × cov(AAPL, XOM) = 0.20 × 0.010434 | 0.002087 |
| 2 × 0.30 × 0.20 × cov(JPM, XOM) = 0.12 × 0.008716 | 0.001046 |
| **Variance** | **0.038908** |

Portfolio volatility = √0.038908 = **19.7%** a year (about 1.24% on a typical day). SPY over the same window: 16.5%.

The weighted average of the three stocks' volatilities is 26.7%. The portfolio is much calmer than that average because the stocks do not move in lockstep. The ratio, 26.7 / 19.7 = **1.35**, is the diversification ratio. If every pair had a correlation of 1 it would be exactly 1.0.

Other concentration numbers: the sum of squared weights is 0.38, so **effective holdings = 1 / 0.38 = 2.6** (three stocks, but weighted like two and a half). Weighted average pairwise correlation is **0.24**.

Beta of the portfolio = 0.50 × 1.07 + 0.30 × 0.93 + 0.20 × 0.18 = **0.85**. Over this window the portfolio's annualized return was 25.6% against 17.9% for SPY. That is a historical fact, not a forecast.

### Step 4: where the risk comes from

Marginal contribution of a stock = (covariance matrix × weights) for that stock ÷ portfolio volatility. A stock's risk contribution = its weight × its marginal contribution. These add up exactly to the portfolio volatility.

| Stock | Weight | Marginal | Risk contribution | Share of risk |
|---|---|---|---|---|
| AAPL | 50% | 0.2564 | 0.1282 | **65.0%** |
| JPM | 30% | 0.1624 | 0.0487 | **24.7%** |
| XOM | 20% | 0.1017 | 0.0203 | **10.3%** |
| Total | 100% | | 0.1973 | 100% |

AAPL is half the money and about two thirds of the risk. That gap is the whole point of the panel: a stock's share of risk is its weight times its volatility times how closely it moves with the rest of the portfolio. AAPL is the most volatile stock and the most correlated with the others.

### Step 5: VaR and expected shortfall

Sort the 504 daily portfolio returns from worst to best.

**95% VaR.** The cutoff is the 5th percentile. With linear interpolation (the numpy default), the position is (504 − 1) × 0.05 = 25.15, so it sits just past the 26th worst day, between the 26th (-1.647%) and the 27th (-1.645%) worst days.

- **1-day VaR (95%) = 1.65%**, or **$1,647** on $100,000. On 19 of 20 past days the portfolio lost less than this.
- **Expected shortfall (95%) = 2.78%**, or **$2,781**. This is the average loss across the 26 days at or below the cutoff.
- For comparison, a normal-distribution VaR using the same mean and standard deviation gives 1.95%. At 95% the normal model overstates the cutoff here.

**99% VaR.** Position (504 − 1) × 0.01 = 5.03, so the cutoff sits between the 6th and 7th worst days.

- **VaR (99%) = 3.15%** ($3,149). **Expected shortfall (99%) = 5.01%** ($5,014).
- Only **6 days** are in the tail, so the page shows a "low confidence" badge.
- Two days dominate: -7.77% on 3 Apr 2025 and -7.33% the day after. Average of the six worst days = (7.77 + 7.33 + 4.16 + 3.88 + 3.79 + 3.16) / 6 = 5.01%.
- The normal-model 99% VaR is 2.79%, which understates the historical 3.15%. This is the fat-tail effect: extreme days are more extreme than a bell curve suggests.

**Who hurts you on the bad days.** Each stock's share of the 95% expected shortfall is its weight × its average loss across those 26 days:

| Stock | Contribution to ES | Share |
|---|---|---|
| AAPL | 1.91 points | 68.7% |
| JPM | 0.56 points | 20.2% |
| XOM | 0.31 points | 11.2% |

These add up to the 2.78% expected shortfall. Note it differs slightly from the volatility shares (65 / 25 / 10): bad days and typical days are not the same thing.

### Step 6: drawdown

Track the portfolio's value (starting at 1), keep a running high, and measure how far below the high it gets.

- **Max drawdown = -23.3%.** High on 19 Feb 2025, low on 8 Apr 2025.
- Back to the high on 26 Aug 2025. That is 130 trading days from the high to the recovery.
- SPY's own max drawdown over the same window was -18.8%, so this mix fell further than the market.

### Step 7: how the window changes the answer

Same portfolio, different lookbacks:

| Window | Volatility | VaR 95% | ES 95% | Tail days (95%) | VaR 99% | Tail days (99%) | Max drawdown |
|---|---|---|---|---|---|---|---|
| 1 year | 15.4% | 1.38% | 2.21% | 13 | 2.69% | 3 | -7.6% |
| **2 years** | **19.7%** | **1.65%** | **2.78%** | **26** | **3.15%** | **6** | **-23.3%** |
| 3 years | 18.0% | 1.54% | 2.51% | 38 | 2.68% | 8 | -23.3% |
| 5 years | 19.9% | 1.83% | 2.78% | 63 | 3.26% | 13 | -23.3% |

The 1-year window drops the spring 2025 sell-off, so the drawdown shrinks from -23.3% to -7.6% and the 99% estimate rests on only 3 days. The longer windows have more bad days to learn from but mix in older market conditions.

### Step 8: a real stress replay

COVID crash, 19 Feb 2020 to 23 Mar 2020. Start with 50/30/20, buy and hold, no rebalancing:

| Stock | Return in the window | Contribution (weight × return) |
|---|---|---|
| AAPL | -30.7% | -15.3 points |
| JPM | -42.5% | -12.8 points |
| XOM | -47.9% | -9.6 points |
| **Portfolio** | | **-37.7%** |

SPY fell 33.7% over the same dates. Over the last two years the three stocks' correlations were only 0.14 to 0.34, yet in the COVID crash they all fell between 31% and 48%. That is the point of a stress test: diversification measured in normal times did not protect much when it was needed.

Caveat: this uses today's S&P 500 members, which flatters past sell-offs (see the survivorship bias question below).

## Glossary

| Term | Plain meaning |
|---|---|
| Simple return | Price today divided by price yesterday, minus 1. |
| Adjusted close | Closing price corrected for splits and dividends, so returns include dividends. |
| Volatility | Standard deviation of daily returns × √252. Higher means a bumpier ride. |
| Trading days (252) | Roughly the number of US market days in a year. |
| Covariance / correlation | How two stocks move together. Correlation is covariance scaled to between -1 and 1. |
| Beta | Covariance with SPY divided by SPY's variance. 1.2 means moves about 20% bigger than the market. |
| R squared | How much of the portfolio's movement SPY explains. |
| VaR (value at risk) | A loss level only exceeded on the worst 1 in 20 (or 1 in 100) days. Says how often, not how bad. |
| Expected shortfall (ES) | Average loss on the days beyond the VaR cutoff. Always at least as big as VaR. |
| Tail days | The number of days used to estimate VaR and ES. Few tail days means a shaky estimate. |
| Drawdown | Fall from a running high point. Max drawdown is the worst one. |
| Risk contribution | A stock's share of the portfolio's total volatility. Adds up to 100%. |
| Effective holdings | 1 divided by the sum of squared weights. How many equal positions would give the same concentration. |
| Diversification ratio | Weighted average of the stocks' volatilities divided by the portfolio's. 1.0 means no benefit from mixing. |
| Rebalanced daily | Weights are reset to their targets each day. The standard risk-measurement convention. |
| Buy and hold | Weights drift as prices move. Used in the growth chart's alternate view and the stress replays. |
| Stress replay | Applying today's weights to a real past sell-off. |
| Survivorship bias | Looking only at companies that exist today, which hides the ones that failed or were removed. |
| Coverage | Share of your weights that had price data on the scenario dates. |

## Questions you may be asked

**Why 252 trading days?**
It is the standard approximation for the number of US trading days in a year, so a daily number can be scaled to a yearly one: daily volatility × √252. The square-root rule assumes daily returns are independent with similar volatility, which is a simplification. Real returns cluster (calm periods and wild periods), so annualized figures are a summary, not a promise.

**Why a 2-year window, and what changes with a shorter one?**
Two years (504 days) is a compromise. It is long enough to give about 26 bad days at the 95% level, and recent enough to reflect current conditions. A shorter window reacts faster but has fewer bad days and can leave out a crisis entirely. In the example, the 1-year window gives a -7.6% max drawdown against -23.3% for the 2-year window, simply because the spring 2025 sell-off falls outside it. A longer window is steadier but weights old conditions as much as recent ones. The page lets you switch between 1, 2, 3, and 5 years and shows the exact dates used.

**Why show expected shortfall next to VaR?**
VaR is a cutoff: "on 19 of 20 days the loss was smaller than this". It says nothing about the 1 in 20 days beyond it. Expected shortfall is the average loss on those days, so it describes how bad the bad days were. In the example, 95% VaR is 1.65% but the average loss on the worst days is 2.78%. A second reason is that expected shortfall is subadditive: combining two portfolios never makes it look riskier than the sum of the parts, which is a sensible property for a risk measure. VaR does not always satisfy this.

**Why simple returns and not log returns for the portfolio?**
A portfolio's one-day return is the weighted sum of its stocks' simple returns. That is exactly right. Log returns add up across time but not across stocks. Illustration (made-up numbers): a 50/50 portfolio where one stock rises 10% and the other falls 10% has a true return of 0%. Averaging the log returns gives (ln 1.10 + ln 0.90) / 2 = -0.51%, which is wrong. So the page uses simple returns for anything that aggregates across holdings.

**What are the limits of historical VaR, and what does a 99% VaR over 504 days really tell you?**
Historical VaR assumes the next period looks like the window. If the window has no crisis, VaR looks small; if it has one, VaR looks large. It cannot show a loss worse than anything in the window. At 99% over 504 days there are only about five bad days, so the figure rests on a handful of observations (6 in the example, with two of them near -7.5%). That is why the page shows the tail-day count and a "low confidence" badge below 10. In the example the 99% figure changes from 2.68% to 3.26% across the four windows, and each one rests on only 3 to 13 tail days (the 95% figure rests on 13 to 63).

**Why can risk contribution differ so much from weight?**
Because risk is not proportional to money. A stock's share of risk is its weight times its own volatility times how closely it moves with the rest of the portfolio. In the example AAPL is 50% of the money but 65% of the risk (it is the most volatile and the most correlated), while XOM is 20% of the money but 10% of the risk (its correlation with the others is low).

**What does the stress test miss?**
- Survivorship bias. The stocks are today's S&P 500 members. Companies that failed or were dropped are not there, so past sell-offs look milder than they were for someone holding the index then.
- Changing correlations. Stocks that look unrelated in calm times can fall together in a crisis, as in the COVID example.
- Liquidity. Replays assume you can trade at the closing price. In a panic you often cannot.
- Fixed weights. It replays today's weights, not what you actually held.
- Coverage. Stocks that did not exist yet are left out and the rest scaled up. The page shows the coverage and marks a scenario "partial" below 80%.

**How were the numbers validated?**
Three ways. First, golden fixtures: a separate Python script (pandas and numpy) computes every metric from real data, and the TypeScript tests must match it to within 1e-8. Second, property tests on random portfolios check things that must always hold, for example risk contributions add up to portfolio volatility, expected shortfall is at least VaR, and correlations stay between -1 and 1. Third, the scenario dates are checked against SPY's own peaks and troughs. Honest limit: the Python reference follows the same formulas, so these checks catch implementation bugs, not a wrong choice of method. That is why the method is written out on the Learn page.

**Why SPY and not the index itself?**
SPY's adjusted close includes dividends, matching how the stock prices are adjusted. The index itself is price-only, which would make beta and comparisons inconsistent. The cost is that SPY's numbers differ slightly from the index (for example the 2018 fall is -19.3% for SPY against about -19.8% for the index). Every label says SPY.

**How would you extend this to bonds, credit spreads, or private assets?**
This is the natural next conversation.
- Bonds: the main risk driver is interest rates, so instead of stock returns you would model risk through duration and key-rate sensitivities, then express a rate shock as a price change. Convexity matters for big moves.
- Credit: add spread duration and spread shocks, and treat defaults and rating migrations as separate risks, since daily price history understates them.
- Private assets: prices are appraisal-based and smoothed, which makes volatility and correlations look artificially low. You would un-smooth the series or map the asset to a listed proxy, and treat liquidity (how long and how costly it is to exit) as a first-class risk.
- Across all of them: the same ideas carry over (contribution to risk, tail measures, stress tests), but the input data and the shock definitions change. The current page does none of this and says so.

**Is this financial advice?**
No. The page says so, everything is historical, forecasts are shown separately and are not combined with risk into a score, and the "worth noticing" flags only describe the portfolio.

**What would you build next?**
Exponentially weighted volatility (reacts faster to recent days), filtered historical simulation for VaR, hierarchical clustering for the heatmap order, and a Playwright end-to-end test suite. None of these are in version 1.

## Known data issues (so nothing surprises you)

- Some tickers in the dashboard have no usable prices: BK has no data on Yahoo, and AVB, EA, EQR, LEG, and QRVO show no trading after August or September 2026. The page names them and leaves them out of the numbers.
- 75 of the 522 stocks (14%) have no sector in the dashboard's data. They are grouped as "Sector not in data" and are not counted in the sector flag or sector shock.
- A few stocks have one-day moves over 50% in the price data. Most match real events (for example the 9 Mar 2020 oil crash). Two I could not confirm: CLSK's 2018 moves look like an illiquid pre-listing stock, and MRNA's +177% on 19 Aug 2026 is unverified.
- The one-line descriptions of each stress scenario are commonly cited background, not something computed from the data.

## Where each number lives

| Number | File | Function |
|---|---|---|
| Simple returns, gap rule, window | `lib/risk/returns.ts` | `simpleReturns`, `buildReturnPanel` |
| Std, quantile, covariance, beta | `lib/risk/stats.ts` | `std`, `quantile`, `covMatrix`, `beta` |
| Weights and portfolio return | `lib/risk/portfolio.ts` | `normalizeHoldings`, `portfolioReturns` |
| Drawdown and worst periods | `lib/risk/drawdown.ts` | `drawdownFromReturns`, `worstRolling` |
| VaR, ES, normal VaR | `lib/risk/varES.ts` | `historicalVaR`, `expectedShortfall`, `normalVaR` |
| Risk contribution (volatility and bad days) | `lib/risk/contribution.ts` | `riskContributions`, `tailContributions` |
| Effective holdings, diversification | `lib/risk/concentration.ts` | `effectiveHoldings`, `diversificationRatio` |
| Rolling volatility and correlation | `lib/risk/rolling.ts` | `rollingVol`, `rollingAvgCorrelation` |
| Stress replays and shocks | `lib/risk/stress.ts`, `scenarios.ts` | `scenarioReplay`, `marketShock`, `reverseStress` |
| Flags and thresholds | `lib/risk/flags.ts`, `config.ts` | `computeFlags`, `FLAGS` |
| Share link and CSV | `lib/risk/share.ts`, `csv.ts` | `encodeShare`, `decodeShare`, `metricsCsv` |
| All constants (252, windows, thresholds) | `lib/risk/config.ts` | |

Tests live in `tests/risk/`. Run them with `npm test`. Regenerate the pandas fixtures with `.venv/bin/python tests/risk/fixtures/generate_golden.py`.
