'use client'

import { useState, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, BookOpen, TrendingUp, AlertTriangle,
  BarChart2, GitBranch, Percent, Shield, Zap, Search, ExternalLink,
  Youtube, FileText, Activity, Sparkles, ArrowRight
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExternalLink { label: string; url: string; source: 'investopedia' | 'youtube' | 'khan' | 'towardsdatascience' }
interface Concept { term: string; plain: string; detail: string; example?: string; tag: string; links?: ExternalLink[]; synonyms?: string[] }
interface Section { id: string; icon: any; title: string; color: string; summary: string; concepts: Concept[] }

const SOURCE_STYLES = {
  investopedia:       { label: 'Investopedia',          color: '#60A5FA', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)'  },
  youtube:            { label: 'YouTube',                color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
  khan:               { label: 'Khan Academy',           color: '#34D399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)'  },
  towardsdatascience: { label: 'Towards Data Science',   color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
}

// ─── Concepts data ─────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'basics', icon: BookOpen, title: 'Stock Market Basics', color: '#60A5FA',
    summary: 'Stocks, indices, tickers, sectors — the foundation of everything.',
    concepts: [
      {
        term: 'Stock / Share', tag: 'Fundamental',
        synonyms: ['equity', 'shares', 'ownership stake', 'securities', 'common stock', 'stock unit', 'company share', 'investment unit'],
        plain: 'A small piece of ownership in a company.',
        detail: 'When you buy a share of Apple (AAPL), you own a tiny fraction of Apple Inc. If the company does well, your share becomes more valuable.',
        example: 'If Apple has 1 billion shares and you own 1 share, you own 1/1,000,000,000th of Apple.',
        links: [
          { label: 'What is a Stock?', url: 'https://www.investopedia.com/terms/s/stock.asp', source: 'investopedia' },
          { label: 'Stocks & the Stock Market', url: 'https://www.khanacademy.org/economics-finance-domain/core-finance/stock-and-bonds', source: 'khan' },
        ],
      },
      {
        term: 'S&P 500', tag: 'Index',
        synonyms: ['s&p', 'sp500', 'standard and poors', 'large cap index', 'us market index', 'benchmark index', 'market index', 'spx', 'us stock index', '500 companies'],
        plain: 'A list of the 500 largest public companies in the United States.',
        detail: 'The S&P 500 is widely used as a benchmark to measure how well the overall US stock market is doing. If the S&P 500 goes up, most big US companies are doing well that day.',
        example: 'Companies like Apple, Microsoft, and Amazon are all in the S&P 500.',
        links: [
          { label: 'S&P 500 Index Explained', url: 'https://www.investopedia.com/terms/s/sp500.asp', source: 'investopedia' },
          { label: 'What is the S&P 500?', url: 'https://www.youtube.com/watch?v=f0zMqJLREEE', source: 'youtube' },
        ],
      },
      {
        term: 'Ticker / Symbol', tag: 'Fundamental',
        synonyms: ['stock symbol', 'ticker symbol', 'stock code', 'company code', 'trading symbol', 'identifier', 'abbreviation', 'stock abbreviation'],
        plain: 'A short code that identifies a stock.',
        detail: 'Every publicly traded company has a unique ticker symbol used on stock exchanges. They are usually 1–5 capital letters.',
        example: 'AAPL = Apple, MSFT = Microsoft, TSLA = Tesla.',
        links: [{ label: 'Stock Ticker Symbol', url: 'https://www.investopedia.com/terms/t/tickersymbol.asp', source: 'investopedia' }],
      },
      {
        term: 'Close Price', tag: 'Price',
        synonyms: ['closing price', 'end of day price', 'eod price', 'last price', 'market close', 'daily close', 'settlement price', 'final price'],
        plain: 'The last price a stock was traded at when the market closed for the day.',
        detail: 'The US stock market is open Monday–Friday, 9:30am–4pm Eastern. The close price is the final transaction price of the day and is what most dashboards display as the "current price."',
        example: 'If AAPL closed at $215.32 yesterday, that is its latest close price.',
        links: [{ label: 'Closing Price Definition', url: 'https://www.investopedia.com/terms/c/closingprice.asp', source: 'investopedia' }],
      },
      {
        term: 'Trading Day', tag: 'Time',
        synonyms: ['market day', 'trading session', 'business day', 'market session', 'open market day', 'exchange day'],
        plain: 'A day when the stock market is open for buying and selling.',
        detail: 'There are approximately 252 trading days per year. Weekends and public holidays are excluded. This is important for forecasting — 30 trading days is roughly 6 calendar weeks.',
        example: '30 trading days ≈ 6 calendar weeks. 252 trading days ≈ 1 calendar year.',
      },
      {
        term: 'Sector', tag: 'Classification',
        synonyms: ['industry', 'market sector', 'industry group', 'gics sector', 'business category', 'industry classification', 'market segment'],
        plain: 'A group of companies that are in the same type of business.',
        detail: 'The S&P 500 is divided into 11 official sectors. Grouping companies by sector helps compare them fairly.',
        example: 'Apple and NVIDIA are in Technology. JPMorgan and Visa are in Financial Services.',
        links: [{ label: 'Stock Market Sectors', url: 'https://www.investopedia.com/terms/s/sector.asp', source: 'investopedia' }],
      },
    ],
  },
  {
    id: 'price', icon: TrendingUp, title: 'Price & Return Metrics', color: '#34D399',
    summary: 'Daily returns, total return, upside, and moving averages.',
    concepts: [
      {
        term: 'Daily Return', tag: 'Return',
        synonyms: ['daily gain', 'day change', 'single day return', 'daily performance', 'one day return', 'price change percentage', 'daily change', 'intraday return'],
        plain: "How much a stock's price changed in a single day, as a percentage.",
        detail: "Calculated as: (today's close − yesterday's close) ÷ yesterday's close × 100.",
        example: 'Stock goes from $100 to $102 → daily return = +2%.',
        links: [{ label: 'Rate of Return', url: 'https://www.investopedia.com/terms/r/rateofreturn.asp', source: 'investopedia' }],
      },
      {
        term: 'Total Return %', tag: 'Return',
        synonyms: ['overall return', 'cumulative return', 'total gain', 'overall performance', 'portfolio return', 'long term return', 'total gain loss'],
        plain: 'How much your investment has grown (or shrunk) over the entire period tracked.',
        detail: 'This shows the overall performance from the first available price to the latest price.',
        example: 'If a stock went from $50 to $150, total return = +200%.',
        links: [{ label: 'Total Return Definition', url: 'https://www.investopedia.com/terms/t/totalreturn.asp', source: 'investopedia' }],
      },
      {
        term: 'Forecast Upside %', tag: 'Forecast',
        synonyms: ['upside potential', 'predicted gain', 'price upside', 'forecast gain', 'expected return', 'predicted return', 'projected upside', 'target upside'],
        plain: 'How much the forecast price is above or below the current price.',
        detail: 'Calculated as: (forecast price − latest close) ÷ latest close × 100. A positive upside means the model predicts the stock will be higher in 30 trading days.\n\nImportant: always check model reliability (MAPE) and volatility alongside it.',
        example: 'Stock at $100, forecast at $103 → upside = +3%.',
      },
      {
        term: 'Moving Average', tag: 'Indicator',
        synonyms: ['ma', 'sma', 'simple moving average', 'rolling average', 'price average', 'smoothing', 'trend line', 'average price'],
        plain: 'The average price over a set number of recent days.',
        detail: 'A 30-day moving average takes the average closing price over the last 30 trading days. It smooths out noisy day-to-day price swings.',
        example: '30-day MA tells you what the "typical" price has been over the past month.',
        links: [
          { label: 'Moving Average Explained', url: 'https://www.investopedia.com/terms/m/movingaverage.asp', source: 'investopedia' },
          { label: 'Moving Averages (StatQuest)', url: 'https://www.youtube.com/watch?v=0bBJ2oXQBmo', source: 'youtube' },
        ],
      },
    ],
  },
  {
    id: 'risk', icon: AlertTriangle, title: 'Risk & Volatility', color: '#F59E0B',
    summary: 'Annualized volatility, risk levels, and sector comparisons.',
    concepts: [
      {
        term: 'Volatility', tag: 'Risk',
        synonyms: ['price swings', 'market swings', 'fluctuation', 'instability', 'price variance', 'market turbulence', 'risk level', 'price movement', 'choppiness'],
        plain: "How wildly a stock's price moves up and down.",
        detail: 'High volatility means the stock swings a lot in price. Low volatility means the price is relatively stable. Measured as the standard deviation of daily returns.',
        example: 'A calm utility company might have 15% volatility. A speculative tech stock might have 60%.',
        links: [
          { label: 'Volatility Definition', url: 'https://www.investopedia.com/terms/v/volatility.asp', source: 'investopedia' },
          { label: 'Understanding Volatility', url: 'https://www.youtube.com/watch?v=TfNEXCNIBCc', source: 'youtube' },
        ],
      },
      {
        term: 'Annualized Volatility %', tag: 'Risk',
        synonyms: ['yearly volatility', 'annual volatility', 'annualized standard deviation', 'yearly price swings', 'annual risk', 'historical volatility'],
        plain: 'Volatility scaled up to represent an entire year of price swings.',
        detail: 'We calculate daily return volatility and multiply by √252 (trading days per year). This allows fair comparison across companies.',
        example: 'If daily volatility is 1.5%, annualized volatility ≈ 1.5% × √252 ≈ 23.8%.',
        links: [{ label: 'Annualized Volatility', url: 'https://www.investopedia.com/terms/a/annual-volatility.asp', source: 'investopedia' }],
      },
      {
        term: 'Risk Level', tag: 'Classification',
        synonyms: ['risk tier', 'risk category', 'risk label', 'risk rating', 'volatility category', 'danger level', 'risk band'],
        plain: "A simplified label for how risky a stock's price behavior is.",
        detail: 'In this dashboard: Lower Risk = annualized volatility under ~20%. Moderate Risk = 20–35%. High Risk = above 35%.',
        example: 'A volatility of 18% → Lower Risk. A volatility of 55% → High Risk.',
      },
      {
        term: 'Standard Deviation', tag: 'Math',
        synonyms: ['std dev', 'dispersion', 'spread', 'variance', 'deviation', 'statistical spread', 'data spread'],
        plain: 'A measure of how spread out a set of numbers are from their average.',
        detail: 'In finance, standard deviation of daily returns is used to measure volatility. A higher standard deviation means more unpredictable price swings.',
        example: 'If a stock usually moves ±0.5%/day, it has a lower std dev than one that moves ±3%/day.',
        links: [
          { label: 'Standard Deviation in Finance', url: 'https://www.investopedia.com/terms/s/standarddeviation.asp', source: 'investopedia' },
          { label: 'Standard Deviation Explained', url: 'https://www.youtube.com/watch?v=SzZ6GpcfoQY', source: 'youtube' },
        ],
      },
    ],
  },
  {
    id: 'forecast', icon: GitBranch, title: 'Forecasting Models', color: '#A78BFA',
    summary: 'The models used — Naive, Moving Average, Drift, Adaptive Momentum, and Linear Trend.',
    concepts: [
      {
        term: 'Naive Forecast', tag: 'Model',
        synonyms: ['baseline forecast', 'simple forecast', 'no change forecast', 'persistence model', 'zero drift forecast'],
        plain: "Predicts tomorrow's price will be the same as today's price.",
        detail: 'The simplest possible forecast. Despite its simplicity, it is surprisingly hard to beat in financial time series. It serves as the baseline.',
        example: 'Stock closes at $150 today → naive forecast for next 30 days = $150.',
        links: [{ label: 'Naive Forecasting', url: 'https://www.investopedia.com/terms/n/naive-approach-forecasting.asp', source: 'investopedia' }],
      },
      {
        term: 'Moving Average Forecast', tag: 'Model',
        synonyms: ['ma forecast', 'average forecast', 'smoothed forecast', 'rolling forecast', '30 day average forecast'],
        plain: 'Predicts future price using the average of the last 30 days.',
        detail: 'Uses the average closing price of the most recent 30 trading days as the forecast. Smooths out recent noise.',
        example: 'If average close over the last 30 days is $148, the forecast = $148.',
      },
      {
        term: 'Drift Forecast', tag: 'Model',
        synonyms: ['trend extrapolation', 'historical drift', 'price drift', 'momentum drift', 'random walk drift'],
        plain: 'Predicts future price by extrapolating the recent average daily change.',
        detail: 'Calculates the average daily price change over recent history and projects it forward. In MarketPulse, this is kept as a scenario/comparison line — not the main forecast.',
        example: 'Stock at $150, avg daily gain = $0.20 → 30-day drift = $150 + (30 × $0.20) = $156.',
        links: [{ label: 'Random Walk & Drift', url: 'https://www.investopedia.com/terms/r/randomwalktheory.asp', source: 'investopedia' }],
      },
      {
        term: 'Adaptive Blended Momentum', tag: 'Model',
        synonyms: ['adaptive momentum', 'blended momentum', 'multi-timeframe momentum', 'weighted momentum', 'damped momentum', 'main forecast', 'momentum blending'],
        plain: 'The main MarketPulse forecast — blends momentum across multiple timeframes with damping.',
        detail: 'Combines 5D, 10D, 21D, 63D, and 252D momentum signals with weights and a damping factor. This means it reacts to recent trends without overreacting to short-term noise.',
        example: 'If a stock dropped sharply in the last 10 days, the adaptive model will reflect that downward pressure.',
      },
      {
        term: 'Linear Trend Forecast (252D)', tag: 'Model',
        synonyms: ['linear regression forecast', 'trend line forecast', 'regression model', 'yearly trend', 'linear model', 'straight line forecast'],
        plain: 'Fits a straight trend line through the last year of prices and extends it.',
        detail: 'Uses approximately the most recent 252 trading days to fit a linear regression. Treat it as a scenario comparison, not a primary signal.',
        example: 'If a stock has been rising $0.50/day on average over the past year, the linear trend projects that forward.',
        links: [
          { label: 'Linear Regression Explained', url: 'https://www.investopedia.com/terms/r/regression.asp', source: 'investopedia' },
          { label: 'Linear Regression (StatQuest)', url: 'https://www.youtube.com/watch?v=nk2CQITm_eo', source: 'youtube' },
        ],
      },
      {
        term: 'Train / Test Split', tag: 'Methodology',
        synonyms: ['training set', 'test set', 'back-testing', 'holdout set', 'validation set', 'model evaluation', 'out of sample'],
        plain: "How we check if a model works before trusting it on new data.",
        detail: 'We hold back the most recent 90 trading days as a "test set." The model never sees this data during training. We then measure accuracy on those 90 days.',
        example: '5 years of data → train on first 4.5 years, test on last 90 days.',
        links: [{ label: 'Train/Test Split', url: 'https://towardsdatascience.com/train-test-split-and-cross-validation-in-python-80b61beca4b6', source: 'towardsdatascience' }],
      },
    ],
  },
  {
    id: 'errors', icon: BarChart2, title: 'Model Error Metrics', color: '#F87171',
    summary: 'MAPE, MAE, RMSE — how we measure forecast accuracy.',
    concepts: [
      {
        term: 'MAPE — Mean Absolute Percentage Error', tag: 'Error Metric',
        synonyms: ['mape', 'mean absolute percentage error', 'percentage error', 'forecast accuracy', 'model accuracy', 'prediction error', 'error percentage', 'forecast error'],
        plain: "On average, how far off was the model's prediction, as a percentage?",
        detail: 'MAPE is the most important error metric in this dashboard because it is scale-independent — it allows comparison across stocks with very different price levels.\n\nFormula: average of |actual − predicted| ÷ actual × 100\n\nIn this dashboard:\n• <2% = Elite / Very Strong\n• 2–3% = Strong\n• 3–5% = Moderate\n• >5% = Higher Error',
        example: 'Stock at $100, model predicted $102 → error = 2%. If this happens every day on average, MAPE = 2%.',
        links: [
          { label: 'MAPE Definition', url: 'https://www.investopedia.com/terms/m/mape.asp', source: 'investopedia' },
          { label: 'MAPE vs other metrics', url: 'https://towardsdatascience.com/forecast-kpi-rmse-mae-mape-bias-cdc5703d242d', source: 'towardsdatascience' },
        ],
      },
      {
        term: 'MAE — Mean Absolute Error', tag: 'Error Metric',
        synonyms: ['mae', 'mean absolute error', 'average error', 'dollar error', 'absolute error', 'average miss'],
        plain: "On average, how many dollars was the model off by?",
        detail: 'Unlike MAPE, MAE is in the same units as the stock price. A MAE of $3.50 means the model was $3.50 away from actual price on average.',
        example: 'Model predicted $100, actual was $103 → error = $3. MAE = $3.',
        links: [{ label: 'Mean Absolute Error', url: 'https://www.investopedia.com/terms/m/mean-absolute-error.asp', source: 'investopedia' }],
      },
      {
        term: 'RMSE — Root Mean Squared Error', tag: 'Error Metric',
        synonyms: ['rmse', 'root mean squared error', 'squared error', 'penalized error', 'large error penalty'],
        plain: 'Like MAE, but it punishes large errors more harshly.',
        detail: 'RMSE squares each error before averaging, then takes the square root. One large miss hurts the score more than several small misses.',
        example: 'Errors of $1, $1, $10 → MAE = $4, but RMSE ≈ $5.86 (the big error is penalized more).',
        links: [
          { label: 'RMSE vs MAE', url: 'https://towardsdatascience.com/what-does-rmse-really-mean-806b65f2e48e', source: 'towardsdatascience' },
          { label: 'MAE and RMSE (StatQuest)', url: 'https://www.youtube.com/watch?v=SzZ6GpcfoQY', source: 'youtube' },
        ],
      },
    ],
  },
  {
    id: 'fundamentals', icon: Percent, title: 'Financial Fundamentals', color: '#34D399',
    summary: 'Revenue, profit margin, EBITDA, EPS — company health metrics.',
    concepts: [
      {
        term: 'Revenue', tag: 'Fundamental',
        synonyms: ['sales', 'top line', 'income', 'gross revenue', 'turnover', 'total sales', 'gross income'],
        plain: 'The total amount of money a company earns from its products or services.',
        detail: "Revenue is the 'top line' of a company's income statement. It does not account for costs — a company can have high revenue but still be losing money.",
        example: 'Apple earns hundreds of billions in revenue each year from iPhone, Mac, services, etc.',
        links: [{ label: 'Revenue Definition', url: 'https://www.investopedia.com/terms/r/revenue.asp', source: 'investopedia' }],
      },
      {
        term: 'Net Income', tag: 'Fundamental',
        synonyms: ['profit', 'earnings', 'net profit', 'bottom line', 'net earnings', 'after tax profit', 'take home profit'],
        plain: 'The profit left after a company pays all its costs and taxes.',
        detail: "Net income is the 'bottom line.' It is revenue minus all expenses including operating costs, interest, and taxes.",
        example: 'Revenue = $100B, Costs = $80B → Net Income = $20B.',
        links: [{ label: 'Net Income Explained', url: 'https://www.investopedia.com/terms/n/netincome.asp', source: 'investopedia' }],
      },
      {
        term: 'Profit Margin %', tag: 'Profitability',
        synonyms: ['margin', 'net margin', 'profit rate', 'profitability ratio', 'margin percentage', 'profit percentage'],
        plain: 'What percentage of every dollar in sales the company keeps as profit.',
        detail: 'Calculated as Net Income ÷ Revenue × 100. Higher is better.',
        example: 'Revenue $100B, Net Income $15B → Profit Margin = 15%.',
        links: [{ label: 'Profit Margin', url: 'https://www.investopedia.com/terms/p/profitmargin.asp', source: 'investopedia' }],
      },
      {
        term: 'EBITDA', tag: 'Profitability',
        synonyms: ['ebitda', 'operating income', 'operating earnings', 'earnings before interest', 'core earnings', 'cash profit'],
        plain: 'Earnings Before Interest, Taxes, Depreciation, and Amortization.',
        detail: "EBITDA strips out financing and accounting decisions to show how much cash a company generates from its core business. Often used to compare companies across industries.",
        example: 'A company with EBITDA of $5B is generating $5B from operations before financial engineering.',
        links: [
          { label: 'EBITDA Definition', url: 'https://www.investopedia.com/terms/e/ebitda.asp', source: 'investopedia' },
          { label: 'EBITDA Explained Simply', url: 'https://www.youtube.com/watch?v=qJiNKiMPRWo', source: 'youtube' },
        ],
      },
      {
        term: 'EPS — Earnings Per Share', tag: 'Fundamental',
        synonyms: ['eps', 'earnings per share', 'per share profit', 'share earnings', 'per share earnings'],
        plain: 'How much profit the company made per share of stock.',
        detail: 'EPS = Net Income ÷ number of shares. Lets investors compare profitability across companies of different sizes.',
        example: 'Net Income $10B, 5B shares → EPS = $2.00 per share.',
        links: [{ label: 'Earnings Per Share', url: 'https://www.investopedia.com/terms/e/eps.asp', source: 'investopedia' }],
      },
    ],
  },
  {
    id: 'signals', icon: Zap, title: 'Dashboard Signals & Labels', color: '#F59E0B',
    summary: "Final signal, forecast signal, risk level — what they mean and how they're calculated.",
    concepts: [
      {
        term: 'Forecast Signal', tag: 'Signal',
        synonyms: ['directional signal', 'price direction', 'bullish bearish', 'up down signal', 'market signal', 'forecast direction', 'trend signal'],
        plain: 'Whether the model predicts the stock will go up, stay flat, or go down.',
        detail: "Based on the adaptive blended momentum model's 30-day forecast upside: Positive Forecast = predicted upside > threshold. Neutral Forecast = near flat. Negative Forecast = predicted decline.",
        example: '"Positive Forecast" means the adaptive model predicts a price higher than today in 30 trading days.',
      },
      {
        term: 'Final Signal', tag: 'Signal',
        synonyms: ['overall signal', 'composite signal', 'combined signal', 'system signal', 'screening label', 'opportunity signal', 'summary signal'],
        plain: 'A combined screening label that summarises forecast, risk, and fundamentals.',
        detail: 'Not a buy or sell recommendation. Combines:\n• Forecast direction (positive/neutral/negative)\n• Model reliability (MAPE)\n• Volatility risk level\n• Profitability vs sector\n\nLabels:\n• Potential Opportunity\n• Stable Watchlist\n• High Volatility Speculative\n• Weak Fundamentals / Negative Forecast\n• Needs Further Review',
        example: 'A stock with positive adaptive forecast, 1.5% MAPE, moderate volatility, and above-sector margins → "Potential Opportunity."',
      },
      {
        term: 'Model Reliability', tag: 'Classification',
        synonyms: ['reliability score', 'model confidence', 'accuracy rating', 'model quality', 'prediction quality', 'forecast reliability', 'how accurate'],
        plain: "A simplified label for how accurate a model has been in back-testing.",
        detail: 'Based on MAPE: Elite (<1%), Very Strong (1–2%), Strong (2–3%), Moderate (3–5%), Higher Error (>5%).',
        example: 'A model with MAPE of 1.3% → "Very Strong Reliability."',
      },
      {
        term: 'Review Reason', tag: 'Label',
        synonyms: ['review flag', 'flag reason', 'warning reason', 'needs review', 'conflict reason', 'review explanation'],
        plain: 'Why a company was placed in the "Needs Further Review" category.',
        detail: 'Some companies have conflicting signals — e.g. positive forecast but very high volatility. The review reason explains the specific conflict.',
        example: '"High risk without positive forecast" = high volatility + non-positive forecast direction.',
      },
    ],
  },
  {
    id: 'limitations', icon: Shield, title: 'Important Limitations', color: '#8b949e',
    summary: 'What these models cannot predict and why this is educational only.',
    concepts: [
      {
        term: 'Why these forecasts are not buy/sell signals', tag: 'Limitation',
        synonyms: ['disclaimer', 'not financial advice', 'model limitations', 'forecast limits', 'prediction caveats', 'not a recommendation'],
        plain: 'Stock prices are affected by thousands of factors these models cannot see.',
        detail: 'These models only use historical price data. They do not account for earnings reports, news, interest rates, company management changes, geopolitical events, or market sentiment.',
        example: 'A company could have a strong upward trend and "Positive Forecast," then surprise with bad earnings — and drop 20% in a day.',
      },
      {
        term: 'Back-testing ≠ future accuracy', tag: 'Limitation',
        synonyms: ['overfitting', 'historical performance', 'past performance', 'backtesting', 'hindsight bias', 'curve fitting'],
        plain: 'The fact that a model performed well in the past does not guarantee future performance.',
        detail: 'Model reliability (MAPE) is measured on a historical test window. Market conditions change. A model that worked well in a calm market may perform poorly in a volatile one.',
        example: "A MAPE of 1.2% on the test window is impressive — but next month's real accuracy could be very different.",
        links: [{ label: 'Overfitting in Finance', url: 'https://www.investopedia.com/terms/o/overfitting.asp', source: 'investopedia' }],
      },
      {
        term: 'Fundamental data limitations', tag: 'Limitation',
        synonyms: ['data gaps', 'missing data', 'incomplete data', 'data quality', 'stale data', 'outdated data'],
        plain: "Some companies' financial data may be incomplete or outdated.",
        detail: 'Financial data was sourced from a Kaggle dataset and may not reflect the most recent filings. Some companies have null values for certain metrics.',
      },
    ],
  },
]

// ─── All searchable content flattened ─────────────────────────────────────────

const ALL_CONCEPTS = SECTIONS.flatMap(s => s.concepts.map(c => ({ ...c, section: s })))

// ─── Global query alias expansion ─────────────────────────────────────────────
// Maps a user's search word → terms that will match relevant concepts

const QUERY_ALIASES: Record<string, string[]> = {
  // Economy / macro
  economic:         ['revenue', 'sector', 'profit', 'market', 'fundamental', 'income'],
  economy:          ['revenue', 'sector', 'profit', 'market', 'fundamental'],
  macro:            ['sector', 's&p', 'market index', 'fundamental'],
  macroeconomic:    ['sector', 's&p', 'market index', 'fundamental'],
  gdp:              ['revenue', 'sector', 'market', 'fundamental'],
  recession:        ['risk', 'volatility', 'limitation', 'negative'],
  inflation:        ['risk', 'volatility', 'limitation', 'interest'],
  market:           ['s&p 500', 'sector', 'trading day', 'close price'],
  financial:        ['revenue', 'profit', 'margin', 'ebitda', 'fundamental'],

  // Investing basics
  invest:           ['stock', 'share', 'return', 'upside', 'signal'],
  investment:       ['stock', 'share', 'return', 'upside', 'signal'],
  investing:        ['stock', 'share', 'return', 'upside'],
  portfolio:        ['stock', 'return', 'total return', 'diversify'],
  buy:              ['signal', 'opportunity', 'limitation', 'upside'],
  sell:             ['signal', 'limitation', 'risk', 'negative'],
  trade:            ['trading day', 'stock', 'ticker'],
  trading:          ['trading day', 'close price', 'stock'],
  stock:            ['share', 'equity', 'ticker', 'close price'],
  equity:           ['stock', 'share', 'ownership'],
  ownership:        ['stock', 'share', 'equity'],
  dividend:         ['net income', 'fundamental', 'limitation', 'eps'],
  etf:              ['s&p 500', 'index', 'sector'],
  index:            ['s&p 500', 'benchmark', 'market index'],
  indices:          ['s&p 500', 'benchmark', 'market index'],

  // Company financials
  earnings:         ['eps', 'net income', 'ebitda', 'profit', 'revenue'],
  earn:             ['eps', 'net income', 'profit', 'revenue'],
  profit:           ['profit margin', 'net income', 'ebitda', 'revenue'],
  profitable:       ['profit margin', 'net income', 'ebitda'],
  income:           ['net income', 'revenue', 'profit', 'eps'],
  revenue:          ['sales', 'top line', 'turnover', 'income'],
  sales:            ['revenue', 'top line', 'income'],
  'balance sheet':  ['revenue', 'net income', 'ebitda', 'fundamental'],
  'income statement': ['revenue', 'net income', 'profit margin'],
  'financial health': ['profit margin', 'ebitda', 'revenue', 'fundamental'],
  growth:           ['total return', 'upside', 'revenue', 'trend'],
  'market cap':     ['stock', 'share', 'fundamental', 'equity'],
  'pe ratio':       ['eps', 'earnings per share', 'valuation'],
  valuation:        ['eps', 'ebitda', 'fundamental', 'profit'],
  company:          ['stock', 'sector', 'ticker', 'revenue', 'fundamental'],
  business:         ['revenue', 'profit', 'sector', 'fundamental'],

  // Forecasting / models
  predict:          ['forecast', 'model', 'naive', 'drift', 'adaptive'],
  prediction:       ['forecast', 'model', 'naive', 'drift', 'adaptive'],
  predicting:       ['forecast', 'model', 'adaptive', 'drift'],
  future:           ['forecast', 'upside', 'model', 'prediction'],
  projection:       ['forecast', 'upside', 'model'],
  estimate:         ['forecast', 'mape', 'model', 'upside'],
  'machine learning': ['xgboost', 'model', 'adaptive', 'forecast'],
  ml:               ['xgboost', 'model', 'adaptive', 'forecast'],
  algorithm:        ['model', 'adaptive', 'xgboost', 'drift'],
  neural:           ['model', 'adaptive', 'xgboost'],
  ensemble:         ['adaptive', 'weighted', 'blended', 'model'],
  weighted:         ['adaptive', 'ensemble', 'blended momentum'],
  blended:          ['adaptive momentum', 'ensemble', 'weighted'],
  momentum:         ['adaptive momentum', 'drift', 'trend', 'moving'],
  trend:            ['moving average', 'drift', 'linear trend', 'momentum'],
  extrapolate:      ['drift', 'linear trend', 'forecast', 'momentum'],
  seasonal:         ['trading day', 'limitation', 'time'],
  timeframe:        ['adaptive momentum', 'trading day', 'forecast'],
  xgboost:          ['model', 'forecast', 'machine learning', 'adaptive'],

  // Moving averages / price smoothing
  smooth:           ['moving average', 'ma', 'rolling average'],
  average:          ['moving average', 'daily return', 'mape', 'mae'],
  rolling:          ['moving average', 'rolling average', 'ma'],
  'moving average': ['ma', 'sma', 'rolling', 'smooth', 'price average'],

  // Error / accuracy
  accurate:         ['mape', 'rmse', 'mae', 'error', 'reliability'],
  accuracy:         ['mape', 'rmse', 'mae', 'error', 'reliability'],
  error:            ['mape', 'rmse', 'mae', 'error metric'],
  performance:      ['mape', 'return', 'total return', 'accuracy'],
  confidence:       ['mape', 'reliability', 'limitation', 'forecast'],
  reliable:         ['mape', 'reliability', 'model', 'accuracy'],
  reliability:      ['mape', 'model reliability', 'accuracy', 'error'],
  benchmark:        ['s&p 500', 'mape', 'sector', 'index'],
  precision:        ['mape', 'mae', 'rmse', 'accuracy'],
  measure:          ['mape', 'mae', 'rmse', 'standard deviation'],

  // Risk & volatility
  volatile:         ['volatility', 'risk', 'standard deviation', 'swing'],
  dangerous:        ['risk', 'volatility', 'high risk'],
  safe:             ['low risk', 'stable', 'volatility', 'watchlist'],
  uncertain:        ['volatility', 'risk', 'standard deviation'],
  crash:            ['risk', 'volatility', 'limitation'],
  bear:             ['risk', 'negative', 'volatility', 'downside'],
  bearish:          ['risk', 'negative', 'volatility', 'downside'],
  bull:             ['opportunity', 'positive', 'upside', 'return'],
  bullish:          ['opportunity', 'positive', 'upside', 'return'],
  beta:             ['volatility', 'risk', 'standard deviation'],
  spread:           ['standard deviation', 'volatility', 'band'],
  swing:            ['volatility', 'risk', 'daily return'],
  fluctuation:      ['volatility', 'risk', 'daily return', 'swing'],
  unstable:         ['volatility', 'high risk', 'speculative'],
  speculative:      ['high volatility', 'risk', 'volatility speculative'],
  deviation:        ['standard deviation', 'volatility', 'error'],
  variance:         ['standard deviation', 'volatility', 'spread'],
  dispersion:       ['standard deviation', 'volatility'],

  // Signals
  recommendation:   ['signal', 'limitation', 'final signal'],
  advice:           ['limitation', 'signal', 'disclaimer'],
  signal:           ['final signal', 'forecast signal', 'system signal'],
  alert:            ['signal', 'review', 'risk'],
  flag:             ['review reason', 'signal', 'risk'],
  screen:           ['final signal', 'signal'],
  label:            ['final signal', 'risk level', 'signal'],
  indicator:        ['signal', 'forecast signal', 'moving average', 'mape'],
  opportunity:      ['potential opportunity', 'final signal', 'upside'],
  watchlist:        ['stable watchlist', 'signal', 'final signal'],

  // Limitations / disclaimer
  disclaimer:       ['limitation', 'educational', 'not financial advice'],
  warning:          ['limitation', 'risk', 'disclaimer'],
  caution:          ['limitation', 'risk', 'volatility'],
  'past performance': ['backtest', 'limitation', 'historical'],
  overfitting:      ['back-testing', 'limitation', 'train test'],
  bias:             ['backtest', 'limitation', 'overfitting'],
  'not advice':     ['limitation', 'disclaimer'],
  educational:      ['limitation', 'disclaimer', 'educational'],

  // Data / methodology
  backtest:         ['back-testing', 'train test', 'historical', 'out of sample'],
  historical:       ['backtest', 'total return', 'training', 'close price'],
  data:             ['trading day', 'close price', 'historical', 'fundamental'],
  sample:           ['train test', 'backtest', 'out of sample'],
  training:         ['train test', 'backtest', 'model'],
  validation:       ['train test', 'backtest', 'mape'],

  // Time
  daily:            ['daily return', 'trading day', 'close price'],
  yearly:           ['annualized', 'trading day', 'linear trend 252'],
  annual:           ['annualized', 'trading day', 'linear trend'],
  monthly:          ['30 day', 'forecast', 'moving average'],

  // Charts / visuals
  chart:            ['forecast', 'upside', 'moving average', 'price'],
  graph:            ['forecast', 'upside', 'price', 'moving average'],
  plot:             ['forecast', 'price', 'upside'],
  candlestick:      ['close price', 'trading day', 'price'],

  // Money / price
  money:            ['revenue', 'profit', 'price', 'return'],
  dollar:           ['revenue', 'profit', 'mae', 'price'],
  price:            ['close price', 'latest price', 'forecast price'],
  cost:             ['revenue', 'profit', 'margin', 'net income'],
  gain:             ['return', 'upside', 'profit', 'total return'],
  loss:             ['risk', 'volatility', 'negative', 'limitation'],
  upside:           ['forecast upside', 'potential', 'return'],
  downside:         ['risk', 'volatility', 'negative forecast', 'limitation'],

  // Sectors / classification
  sector:           ['gics', 'industry', 'classification', 'sector'],
  industry:         ['sector', 'gics', 'classification'],
  technology:       ['sector', 'classification', 'industry'],
  healthcare:       ['sector', 'classification', 'industry'],
  energy:           ['sector', 'classification', 'industry'],

  // Options / derivatives (out of scope but redirect)
  options:          ['limitation', 'disclaimer'],
  derivatives:      ['limitation', 'disclaimer'],
  short:            ['risk', 'limitation', 'volatility'],
  leverage:         ['risk', 'volatility', 'limitation'],
  margin:           ['profit margin', 'fundamental', 'profitability'],
}

// ─── Synonym-aware search with alias expansion ────────────────────────────────

function searchConcepts(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return []

  // Build expanded search terms
  const words = q.split(/\s+/)
  const searchTerms = new Set<string>([q])
  for (const word of words) {
    const aliases = QUERY_ALIASES[word]
    if (aliases) aliases.forEach(t => searchTerms.add(t))
  }
  // Also check the full phrase as an alias key
  const phraseAliases = QUERY_ALIASES[q]
  if (phraseAliases) phraseAliases.forEach(t => searchTerms.add(t))

  return ALL_CONCEPTS.filter(c => {
    const haystack = [
      c.term, c.plain, c.detail, c.tag,
      ...(c.synonyms ?? []),
      c.section.title,
    ].join(' ').toLowerCase()
    return Array.from(searchTerms).some(term => haystack.includes(term))
  })
}

// ─── Stitch colour palette ────────────────────────────────────────────────────

const D = {
  bg:        '#121414',
  surface:   '#1a1c1c',
  container: '#1e2020',
  lowest:    '#0c0f0f',
  border:    'rgba(66,71,84,0.3)',
  text:      '#e2e2e2',
  textSec:   '#c2c6d6',
  textMuted: '#8c909f',
  primary:   '#adc6ff',
  secondary: '#d0bcff',
  tertiary:  '#4edea3',
  mono:      'JetBrains Mono, monospace',
  body:      'Inter, system-ui, sans-serif',
}

// ─── Category cards config (mirrors Stitch bento grid) ────────────────────────

const CATEGORY_CARDS = [
  { id: 'basics',       label: 'Basics',       sub: 'Core terminal mechanics.',       count: '12 Concepts',  icon: '⬡',  color: '#adc6ff' },
  { id: 'risk',         label: 'Risk',          sub: 'Volatility and downside.',       count: '8 Concepts',   icon: '△',  color: '#F59E0B' },
  { id: 'forecast',     label: 'Models',        sub: 'Neural & Bayesian paths.',       count: '15 Concepts',  icon: '⬖',  color: '#d0bcff' },
  { id: 'errors',       label: 'Metrics',       sub: 'Accuracy & Signal error.',       count: '21 Concepts',  icon: '▦',  color: '#60A5FA' },
  { id: 'price',        label: 'Sectors',       sub: 'Taxonomy and clusters.',         count: '6 Concepts',   icon: '⬡',  color: '#34D399' },
  { id: 'fundamentals', label: 'Forecasting',   sub: 'Temporal logic & Drift.',        count: '10 Concepts',  icon: '∿',  color: '#A78BFA' },
  { id: 'limitations',  label: 'Compliance',    sub: 'Guardrails & Ethics.',           count: '4 Concepts',   icon: '◎',  color: '#F87171' },
  { id: 'signals',      label: 'Guides',        sub: 'Step-by-step flows.',            count: '5 Tutorials',  icon: '◫',  color: '#adc6ff', highlighted: true },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function LearnTab({ onAskAI }: { onAskAI?: (q: string) => void }) {
  const [query, setQuery] = useState('')
  const [openSection, setOpenSection] = useState('')
  const [openConcept, setOpenConcept] = useState<string | null>(null)
  const [deepDiveFilter, setDeepDiveFilter] = useState<'all' | 'institutional'>('all')

  const searchResults = useMemo(() => searchConcepts(query), [query])
  const isSearching = query.trim().length > 0

  const activeSection = openSection ? SECTIONS.find(s => s.id === openSection) ?? null : null

  // All concepts for deep dive list (filtered by section tile + institutional toggle)
  const deepDiveConcepts = useMemo(() => {
    let concepts = ALL_CONCEPTS
    if (openSection) {
      concepts = concepts.filter(c => c.section.id === openSection)
    }
    if (deepDiveFilter === 'institutional') {
      concepts = concepts.filter(c => ['Model', 'Error Metric', 'Methodology', 'Signal'].includes(c.tag))
    }
    return concepts
  }, [deepDiveFilter, openSection])

  return (
    <div style={{ fontFamily: D.body, background: D.bg, minHeight: '100vh', width: '100%' }}>
      
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: '64px 64px 48px', maxWidth: 1440, margin: '0 auto' }}>
        
        {/* Pill badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 16px',
            background: D.container,
            border: `1px solid ${D.border}`,
            borderRadius: 999,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.primary, display: 'inline-block' }} />
            <span style={{ fontFamily: D.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: D.textMuted }}>
              Market Education Hub
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          textAlign: 'center', margin: '0 0 16px',
          fontSize: 'clamp(2.5rem,6vw,4rem)',
          fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1,
          color: D.text,
        }}>
          Learn{' '}
          <span style={{
            background: 'linear-gradient(135deg, #d0bcff 0%, #4edea3 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            MarketPulse
          </span>
        </h1>

        <p style={{
          textAlign: 'center', color: D.textMuted,
          fontSize: 16, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 40px',
        }}>
          Every concept used in this dashboard explained in plain English. No jargon, just institutional-grade clarity.
        </p>

        {/* Search bar */}
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: D.textMuted, pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find financial terms, metrics, or models..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '14px 16px 14px 44px',
              background: D.lowest,
              border: `1px solid ${query ? D.primary : D.border}`,
              borderRadius: 12,
              color: D.text, fontSize: 15,
              fontFamily: D.body, outline: 'none',
              transition: 'border-color 0.2s',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: D.textMuted, fontSize: 18, lineHeight: 1,
            }}>×</button>
          )}
        </div>

        {/* Search results */}
        {isSearching && (
          <div style={{ maxWidth: 720, margin: '12px auto 0' }}>
            {searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: D.textMuted, fontSize: 13, fontFamily: D.mono }}>
                No results for "{query}" — try a synonym or related term.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted, marginBottom: 8, letterSpacing: '0.08em' }}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map(c => (
                  <div key={`${c.section.id}-${c.term}`}
                    style={{
                      background: D.surface,
                      border: `1px solid ${D.border}`,
                      borderRadius: 8, overflow: 'hidden',
                    }}>
                    <ConceptRow
                      concept={c}
                      section={c.section}
                      isOpen={openConcept === `search-${c.term}`}
                      onToggle={() => setOpenConcept(openConcept === `search-${c.term}` ? null : `search-${c.term}`)}
                      onAskAI={onAskAI}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bento grid + AI card ────────────────────────────────────────────── */}
      {!isSearching && (
        <div style={{ padding: '0 64px 48px', maxWidth: 1440, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'start' }}>

            {/* Ask AI card */}
            <div style={{
              background: '#111113', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: 24,
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(208,188,255,0.15)', border: '1px solid rgba(208,188,255,0.2)',
                }}>
                  <Sparkles size={18} style={{ color: '#d0bcff' }} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: D.text, margin: 0 }}>Ask MarketPulse AI</h2>
              </div>
              <p style={{ fontSize: 14, color: D.textMuted, margin: 0, lineHeight: 1.6 }}>
                Query our technical methodology using natural language for instant deep-dives.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Explain MAPE',
                  'What does Adaptive Momentum mean?',
                  'How is Risk Matrix weighted?',
                ].map(q => (
                  <button key={q} onClick={() => onAskAI?.(q)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '10px 14px',
                      background: D.container, border: `1px solid ${D.border}`,
                      borderRadius: 6, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      color: D.textSec, fontSize: 12, fontFamily: D.mono,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = D.primary}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}>
                    <span>{q}</span>
                    <ArrowRight size={12} style={{ color: D.textMuted }} />
                  </button>
                ))}
              </div>
            </div>

            {/* 2×4 bento grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {CATEGORY_CARDS.map(card => {
                const isActive = openSection === card.id
                const idleBg = card.highlighted ? 'rgba(173,198,255,0.05)' : '#111113'
                const idleBorder = card.highlighted ? 'rgba(173,198,255,0.2)' : 'rgba(255,255,255,0.08)'
                return (
                  <button key={card.id}
                    onClick={() => setOpenSection(openSection === card.id ? '' : card.id)}
                    style={{
                      textAlign: 'left', padding: 20,
                      background: isActive ? `${card.color}15` : idleBg,
                      border: `1px solid ${isActive ? card.color : idleBorder}`,
                      borderRadius: 12, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      transition: 'all 0.2s ease',
                      opacity: openSection && !isActive ? 0.55 : 1,
                    }}
                    onMouseEnter={e => {
                      if (isActive) return
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = `${card.color}60`
                      el.style.background = `${card.color}08`
                      el.style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      if (isActive) return
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = idleBorder
                      el.style.background = idleBg
                      el.style.opacity = openSection ? '0.55' : '1'
                    }}>
                    <span style={{ fontSize: 20, color: card.color }}>{card.icon}</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? card.color : D.text }}>{card.label}</div>
                    <div style={{ fontSize: 12, color: D.textMuted, lineHeight: 1.5 }}>{card.sub}</div>
                    <div style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted, marginTop: 4 }}>{card.count}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Deep Dive section ──────────────────────────────────────────────── */}
      {!isSearching && (
        <div style={{
          padding: '0 64px 64px', maxWidth: 1440, margin: '0 auto',
          borderTop: `1px solid rgba(66,71,84,0.2)`,
          paddingTop: 48,
        }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: activeSection ? 16 : 28, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: D.text, margin: 0, letterSpacing: '-0.02em' }}>
              Deep Dive: Methodology &amp; Metrics
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all', 'institutional'] as const).map(f => (
                <button key={f} onClick={() => setDeepDiveFilter(f)}
                  style={{
                    padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
                    fontFamily: D.mono, fontSize: 11, letterSpacing: '0.06em',
                    textTransform: 'capitalize',
                    background: deepDiveFilter === f ? D.primary : D.container,
                    color: deepDiveFilter === f ? '#002e6a' : D.textMuted,
                    border: `1px solid ${deepDiveFilter === f ? D.primary : D.border}`,
                    fontWeight: deepDiveFilter === f ? 700 : 400,
                  }}>
                  {f === 'all' ? 'All Levels' : 'Institutional'}
                </button>
              ))}
            </div>
          </div>

          {/* Active section filter banner */}
          {activeSection && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
              padding: '10px 16px',
              background: `${activeSection.color}10`,
              border: `1px solid ${activeSection.color}30`,
              borderRadius: 8,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: activeSection.color }}>{activeSection.title}</span>
              <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>
                — {deepDiveConcepts.length} concept{deepDiveConcepts.length !== 1 ? 's' : ''}
              </span>
              <button onClick={() => setOpenSection('')}
                style={{
                  marginLeft: 'auto', fontSize: 10, fontFamily: D.mono,
                  color: D.textMuted, background: D.container,
                  border: `1px solid ${D.border}`, padding: '3px 10px',
                  borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
                }}>
                SHOW ALL ×
              </button>
            </div>
          )}

          {/* Accordion list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deepDiveConcepts.map((c, idx) => (
              <div key={`${c.section.id}-${c.term}`}
                style={{
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  borderRadius: 8, overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(173,198,255,0.25)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = D.border}>

                <button
                  onClick={() => setOpenConcept(openConcept === `deep-${idx}` ? null : `deep-${idx}`)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 24,
                    padding: '18px 24px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                  {/* Number */}
                  <span style={{ fontFamily: D.mono, fontSize: 11, color: D.primary, minWidth: 28, letterSpacing: '0.04em' }}>
                    {String(idx + 1).padStart(3, '0')}
                  </span>
                  {/* Term */}
                  <span style={{ fontSize: 14, fontWeight: 700, color: D.text, flex: 1 }}>{c.term}</span>
                  {/* Tags */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      padding: '2px 8px', fontSize: 9, fontFamily: D.mono,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: `${c.section.color}18`, color: c.section.color,
                      border: `1px solid ${c.section.color}35`, borderRadius: 3,
                    }}>{c.tag}</span>
                    <span style={{
                      padding: '2px 8px', fontSize: 9, fontFamily: D.mono,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: 'rgba(66,71,84,0.3)', color: D.textMuted,
                      border: `1px solid ${D.border}`, borderRadius: 3,
                    }}>{c.section.title.split(' ')[0]}</span>
                  </div>
                  {/* Chevron */}
                  <div style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openConcept === `deep-${idx}` ? 'rotate(180deg)' : 'none' }}>
                    <ChevronDown size={16} style={{ color: D.textMuted }} />
                  </div>
                </button>

                {openConcept === `deep-${idx}` && (
                  <div style={{ borderTop: `1px solid ${D.border}`, padding: '16px 24px 20px' }}>
                    <ConceptRow
                      concept={c}
                      section={c.section}
                      isOpen={true}
                      onToggle={() => {}}
                      onAskAI={onAskAI}
                      inlineExpanded
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
      {!isSearching && (
        <div style={{ padding: '0 64px 80px', maxWidth: 1440, margin: '0 auto' }}>
          <div style={{
            background: D.lowest,
            border: `1px solid ${D.border}`,
            borderRadius: 12, padding: 24,
            display: 'flex', alignItems: 'flex-start', gap: 20,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(66,71,84,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={16} style={{ color: D.textMuted }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.text, marginBottom: 6 }}>Educational Integrity Disclaimer</div>
              <p style={{ fontSize: 13, color: D.textMuted, lineHeight: 1.65, margin: 0 }}>
                These definitions are provided for technical transparency and educational purposes only. MarketPulse metrics represent mathematical outputs from historical and predictive models. Past performance is not indicative of future results. No material in this Hub constitutes financial advice.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Concept Row ───────────────────────────────────────────────────────────────

function ConceptRow({
  concept, section, isOpen, onToggle, onAskAI, inlineExpanded,
}: {
  concept: Concept; section: Section; isOpen: boolean
  onToggle: () => void; onAskAI?: (q: string) => void; inlineExpanded?: boolean
}) {
  const D_local = {
    text: '#e2e2e2', textSec: '#c2c6d6', textMuted: '#8c909f',
    border: 'rgba(66,71,84,0.3)', surface: '#1a1c1c', elevated: '#1e2020',
    mono: 'JetBrains Mono, monospace', body: 'Inter, system-ui, sans-serif',
  }

  if (inlineExpanded) {
    return (
      <div>
        <p style={{ fontSize: 14, color: D_local.textSec, lineHeight: 1.7, marginBottom: 12 }}>{concept.plain}</p>
        <div style={{ background: '#0c0f0f', border: `1px solid ${D_local.border}`, borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: D_local.textMuted, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{concept.detail}</p>
        </div>
        {concept.example && (
          <div style={{ background: `${section.color}08`, border: `1px solid ${section.color}25`, borderRadius: 6, padding: '10px 16px', marginBottom: 12, display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: section.color, flexShrink: 0 }}>Example:</span>
            <span style={{ fontSize: 12, color: D_local.textSec }}>{concept.example}</span>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {concept.links?.map(link => {
            const s = SOURCE_STYLES[link.source]
            return (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '5px 10px', borderRadius: 6, textDecoration: 'none', background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                {link.source === 'youtube' ? <Youtube size={11} /> : <FileText size={11} />}
                {link.label}
                <ExternalLink size={9} style={{ opacity: 0.6 }} />
              </a>
            )
          })}
          {onAskAI && (
            <button onClick={() => onAskAI(`Explain "${concept.term}" in the context of the MarketPulse dashboard`)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'rgba(208,188,255,0.08)', border: '1px solid rgba(208,188,255,0.2)', color: '#d0bcff', cursor: 'pointer', marginLeft: 'auto' }}>
              <Sparkles size={10} />
              Ask AI about this
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onToggle}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ flex: 1, paddingRight: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: D_local.text }}>{concept.term}</span>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, fontFamily: D_local.mono, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: `${section.color}18`, color: section.color, border: `1px solid ${section.color}35` }}>
              {concept.tag}
            </span>
          </div>
          <p style={{ fontSize: 12, color: D_local.textSec, margin: 0, lineHeight: 1.55 }}>{concept.plain}</p>
        </div>
        <div style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', marginTop: 2 }}>
          <ChevronDown size={14} style={{ color: D_local.textMuted }} />
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#0c0f0f', border: `1px solid ${D_local.border}`, borderRadius: 6, padding: '10px 14px' }}>
            <p style={{ fontSize: 12, color: D_local.textMuted, margin: 0, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{concept.detail}</p>
          </div>
          {concept.example && (
            <div style={{ display: 'flex', gap: 8, padding: '9px 14px', borderRadius: 6, background: `${section.color}08`, border: `1px solid ${section.color}25` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: section.color, flexShrink: 0 }}>Example:</span>
              <span style={{ fontSize: 11, color: D_local.textSec }}>{concept.example}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingTop: 4 }}>
            {concept.links?.map(link => {
              const s = SOURCE_STYLES[link.source]
              return (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 9px', borderRadius: 6, textDecoration: 'none', background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                  {link.source === 'youtube' ? <Youtube size={10} /> : <FileText size={10} />}
                  {link.label}
                  <ExternalLink size={8} style={{ opacity: 0.6 }} />
                </a>
              )
            })}
            {onAskAI && (
              <button onClick={() => onAskAI(`Explain "${concept.term}" in the context of the MarketPulse dashboard`)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 9px', borderRadius: 6, background: 'rgba(208,188,255,0.08)', border: '1px solid rgba(208,188,255,0.2)', color: '#d0bcff', cursor: 'pointer', marginLeft: 'auto' }}>
                <Sparkles size={9} />
                Ask AI
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
