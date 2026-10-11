'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ChevronDown, ChevronRight, BookOpen, TrendingUp, AlertTriangle,
  BarChart2, GitBranch, Percent, Shield, Zap, Search, ExternalLink,
  Youtube, FileText, Activity, Sparkles, ArrowRight, Gauge, Ruler, Scale, X, ArrowUpRight
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
    summary: 'Stocks, indices, tickers, sectors: the foundation of everything.',
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
        detail: 'There are approximately 252 trading days per year. Weekends and public holidays are excluded. This is important for forecasting: 30 trading days is roughly 6 calendar weeks.',
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
    summary: 'The models used: Naive, Moving Average, Drift, Adaptive Momentum, and Linear Trend.',
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
        detail: 'Calculates the average daily price change over recent history and projects it forward. In MarketPulse, this is kept as a scenario/comparison line, not the main forecast.',
        example: 'Stock at $150, avg daily gain = $0.20 → 30-day drift = $150 + (30 × $0.20) = $156.',
        links: [{ label: 'Random Walk & Drift', url: 'https://www.investopedia.com/terms/r/randomwalktheory.asp', source: 'investopedia' }],
      },
      {
        term: 'Adaptive Blended Momentum', tag: 'Model',
        synonyms: ['adaptive momentum', 'blended momentum', 'multi-timeframe momentum', 'weighted momentum', 'damped momentum', 'main forecast', 'momentum blending'],
        plain: 'The main MarketPulse forecast: blends momentum across multiple timeframes with damping.',
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
    summary: 'MAPE, MAE, RMSE: how we measure forecast accuracy.',
    concepts: [
      {
        term: 'MAPE: Mean Absolute Percentage Error', tag: 'Error Metric',
        synonyms: ['mape', 'mean absolute percentage error', 'percentage error', 'forecast accuracy', 'model accuracy', 'prediction error', 'error percentage', 'forecast error'],
        plain: "On average, how far off was the model's prediction, as a percentage?",
        detail: 'MAPE is the most important error metric in this dashboard because it is scale-independent, allowing comparison across stocks with very different price levels.\n\nFormula: average of |actual − predicted| ÷ actual × 100\n\nIn this dashboard:\n• <2% = Elite / Very Strong\n• 2–3% = Strong\n• 3–5% = Moderate\n• >5% = Higher Error',
        example: 'Stock at $100, model predicted $102 → error = 2%. If this happens every day on average, MAPE = 2%.',
        links: [
          { label: 'MAPE Definition', url: 'https://www.investopedia.com/terms/m/mape.asp', source: 'investopedia' },
          { label: 'MAPE vs other metrics', url: 'https://towardsdatascience.com/forecast-kpi-rmse-mae-mape-bias-cdc5703d242d', source: 'towardsdatascience' },
        ],
      },
      {
        term: 'MAE: Mean Absolute Error', tag: 'Error Metric',
        synonyms: ['mae', 'mean absolute error', 'average error', 'dollar error', 'absolute error', 'average miss'],
        plain: "On average, how many dollars was the model off by?",
        detail: 'Unlike MAPE, MAE is in the same units as the stock price. A MAE of $3.50 means the model was $3.50 away from actual price on average.',
        example: 'Model predicted $100, actual was $103 → error = $3. MAE = $3.',
        links: [{ label: 'Mean Absolute Error', url: 'https://www.investopedia.com/terms/m/mean-absolute-error.asp', source: 'investopedia' }],
      },
      {
        term: 'RMSE: Root Mean Squared Error', tag: 'Error Metric',
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
    summary: 'Revenue, profit margin, EBITDA, EPS: company health metrics.',
    concepts: [
      {
        term: 'Revenue', tag: 'Fundamental',
        synonyms: ['sales', 'top line', 'income', 'gross revenue', 'turnover', 'total sales', 'gross income'],
        plain: 'The total amount of money a company earns from its products or services.',
        detail: "Revenue is the 'top line' of a company's income statement. It does not account for costs, so a company can have high revenue but still be losing money.",
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
        term: 'EPS: Earnings Per Share', tag: 'Fundamental',
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
    summary: "Final signal, forecast signal, risk level: what they mean and how they're calculated.",
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
        detail: 'Some companies have conflicting signals, e.g. positive forecast but very high volatility. The review reason explains the specific conflict.',
        example: '"High risk without positive forecast" = high volatility + non-positive forecast direction.',
      },
    ],
  },
  {
    id: 'portfolio', icon: Activity, title: 'Portfolio Risk Methodology', color: '#c6c0ff',
    summary: 'How the Portfolio page measures risk: formulas, data, and what the numbers cannot tell you.',
    concepts: [
      {
        term: 'Portfolio volatility', tag: 'Portfolio',
        synonyms: ['portfolio risk', 'portfolio standard deviation', 'combined volatility', 'diversification benefit'],
        plain: "How much the whole portfolio's daily returns swing, scaled to a year.",
        detail: 'Each day the portfolio return is the weighted sum of the stocks\' returns. Volatility is the standard deviation of those daily returns (n-1 in the denominator) times the square root of 252 trading days. It is lower than the average of the stocks\' volatilities when the stocks do not move in lockstep.',
        example: 'Two stocks with 30% volatility each and a correlation of 0.3 give a 50/50 portfolio volatility of about 24%.',
      },
      {
        term: 'Value at Risk (VaR)', tag: 'Portfolio',
        synonyms: ['var', 'value at risk', '95% var', 'worst day loss', 'historical simulation', 'daily loss'],
        plain: 'A loss level that was only exceeded on the worst 1 in 20 days (at 95%).',
        detail: 'We use historical simulation: sort the portfolio\'s past daily returns and read the 5th percentile (1st at 99%), with linear interpolation between neighbouring days. It is shown as a positive loss, in percent and in dollars for the portfolio size you enter. It says how often, not how bad: it is silent about the size of losses beyond the cutoff.',
        example: 'A 95% 1-day VaR of 1.5% on $100,000 means that on 19 of 20 past days the loss was under $1,500.',
      },
      {
        term: 'Expected shortfall (ES)', tag: 'Portfolio',
        synonyms: ['expected shortfall', 'cvar', 'conditional var', 'tail loss', 'average loss on bad days'],
        plain: 'The average loss on the worst days, the ones beyond the VaR cutoff.',
        detail: 'ES averages the returns on all days at or below the VaR cutoff. It is always at least as large as VaR. It is reported next to VaR because it describes how bad the bad days were, and because ES, unlike VaR, never makes a combined portfolio look riskier than the sum of its parts would suggest (it is subadditive).',
        example: 'VaR 1.5% with ES 2.3% means the worst 1 in 20 days lost at least 1.5%, and averaged 2.3%.',
      },
      {
        term: 'Small tail samples', tag: 'Limitation',
        synonyms: ['low confidence', '99% var', 'tail observations', 'sample size', 'few bad days'],
        plain: 'At 99% over two years there are only about five bad days to learn from.',
        detail: 'Two years is about 504 trading days, so the worst 1% is about 5 days. Estimates built on so few days jump around. The page shows the tail day count and a "low confidence" badge when it is below 10. A longer window gives more bad days but mixes in older market conditions.',
      },
      {
        term: 'Maximum drawdown', tag: 'Portfolio',
        synonyms: ['drawdown', 'peak to trough', 'underwater', 'biggest fall', 'max drawdown'],
        plain: 'The largest fall from a high point to a later low.',
        detail: 'Track the portfolio\'s value, keep the running high, and measure how far below it the value gets. The page shows the dates of the high and the low, whether the value recovered, and how many trading days it spent below the high. The window start counts as the first high.',
        example: 'A portfolio that rises to 120, falls to 96 and later returns to 120 had a maximum drawdown of -20%.',
      },
      {
        term: 'Beta and R squared', tag: 'Portfolio',
        synonyms: ['beta', 'market sensitivity', 'r2', 'r-squared', 'spy beta', 'market risk'],
        plain: 'How much the portfolio tends to move when the market moves.',
        detail: 'Beta is the covariance of portfolio returns with SPY returns divided by the variance of SPY returns, over the same window. 1.2 means moves about 20% bigger than the market on average. R squared says how much of the portfolio\'s movement SPY explains. The page uses SPY (an ETF that tracks the S&P 500) as the benchmark.',
      },
      {
        term: 'Risk contribution', tag: 'Portfolio',
        synonyms: ['risk share', 'marginal risk', 'euler decomposition', 'where the risk comes from', 'risk budget'],
        plain: "Each stock's share of the portfolio's total volatility.",
        detail: 'A stock\'s share is its weight times its volatility times how closely it moves with the rest of the portfolio. The shares add up to exactly 100%. A stock can be 10% of the money and 25% of the risk. The "bad days" view instead splits the expected shortfall: how much each stock lost on the portfolio\'s worst days.',
      },
      {
        term: 'Correlation and effective holdings', tag: 'Portfolio',
        synonyms: ['correlation', 'diversification', 'effective n', 'hhi', 'concentration', 'herfindahl'],
        plain: 'How closely stocks move together, and how concentrated the weights are.',
        detail: 'Correlation runs from -1 to 1 (Pearson, on daily returns). Effective holdings is 1 divided by the sum of squared weights: how many equal-sized positions would give the same concentration. Ten stocks with one huge weight can behave like three. Correlations tend to rise in sell-offs, so diversification helps least when it is needed most.',
      },
      {
        term: 'Stress tests and survivorship bias', tag: 'Portfolio',
        synonyms: ['stress test', 'scenario', 'covid crash', 'historical replay', 'survivorship bias', 'sell-off'],
        plain: 'What your current mix would have done in real past sell-offs.',
        detail: 'Each replay takes your weights at the start of the window and holds them to the end with no rebalancing, so each stock\'s contribution is its weight times its own return and they add up to the portfolio return. Stocks with no price at the start are left out and the rest scaled up, with coverage shown. The stocks are today\'s S&P 500 members, so companies that were removed or failed are missing, and past sell-offs look milder than they were.',
        example: 'In the 2020 COVID crash window (Feb 19 to Mar 23), SPY fell about 34%.',
      },
      {
        term: 'Hypothetical shocks', tag: 'Portfolio',
        synonyms: ['market shock', 'sector shock', 'reverse stress', 'what if', 'beta approximation'],
        plain: 'Rough what-ifs: if the market or one sector falls by a set amount.',
        detail: 'The market estimate is portfolio beta times the market move. The sector shock applies the fall straight to the stocks in that sector and leaves the rest flat. The reverse stress divides a target loss by beta. All three are approximations that assume betas stay the same, which they often do not in real crises.',
      },
      {
        term: 'Data, windows and method version', tag: 'Method',
        synonyms: ['adjusted close', 'total return', 'window', 'constant weights', 'rebalanced daily', 'methodology version', 'data source'],
        plain: 'Where the numbers come from and the rules behind them.',
        detail: 'Prices are daily closes adjusted for splits and dividends (Yahoo Finance), so returns include dividends. Returns are simple daily returns, and the portfolio is rebalanced to constant weights each day; a buy-and-hold view is offered for the growth chart. The default window is 2 years (504 trading days), with at least 120 usable days required, and a stock must have returns on at least 90% of the window or it is named and left out. A year is 252 trading days. Everything is historical and educational. This is methodology version 1.0.0.',
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
        example: 'A company could have a strong upward trend and "Positive Forecast," then surprise with bad earnings and drop 20% in a day.',
      },
      {
        term: 'Back-testing ≠ future accuracy', tag: 'Limitation',
        synonyms: ['overfitting', 'historical performance', 'past performance', 'backtesting', 'hindsight bias', 'curve fitting'],
        plain: 'The fact that a model performed well in the past does not guarantee future performance.',
        detail: 'Model reliability (MAPE) is measured on a historical test window. Market conditions change. A model that worked well in a calm market may perform poorly in a volatile one.',
        example: "A MAPE of 1.2% on the test window is impressive, but next month's real accuracy could be very different.",
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

// ─── Redesign notes (taste-skill: redesign-skill) ─────────────────────────────
// Audit of the original: centred, symmetric hero; four equal category cards; an accordion
// list; Inter everywhere; uppercase mono labels and pill badges; a bordered card around
// everything; a spinner-free but empty "no results" state; 100vh. This rebuild works in the
// existing stack (Tailwind), keeps the tab's colours, and changes, in priority order:
// font, surfaces, hover/press states, layout and spacing, components (accordion becomes a
// list with a side panel), states, then type polish. Glass is used on the few surfaces that
// need elevation: search, the AI panel, topic tiles and the detail panel.

const TERMS_TRY = ['Volatility', 'MAPE', 'Value at Risk', 'Drawdown', 'Moving average']
const ADVANCED_TAGS = ['Model', 'Error Metric', 'Methodology', 'Signal', 'Portfolio', 'Method']

const CONCEPT_COUNT = (id: string) => {
  const n = SECTIONS.find(sec => sec.id === id)?.concepts.length ?? 0
  return `${n} ${n === 1 ? 'concept' : 'concepts'}`
}

// Tile spans are written out in full so Tailwind can see them. Rows add up to 12 columns each:
// basics (6, two rows tall) + risk 3 + models 3 / metrics 6 / returns 3 + fundamentals 3 + portfolio 6 / signals 7 + limits 5.
const TOPICS = [
  { id: 'basics',       label: 'Basics',         sub: 'Stocks, indices, tickers and sectors. Start here if the terms are new.', color: '#adc6ff', Icon: BookOpen,   span: 'sm:col-span-2 lg:col-span-6 lg:row-span-2', terms: 4, rich: true },
  { id: 'risk',         label: 'Risk',           sub: 'Volatility and risk levels.',          color: '#F59E0B', Icon: Gauge,      span: 'lg:col-span-3', terms: 0 },
  { id: 'forecast',     label: 'Models',         sub: 'Naive, momentum and trend models.',    color: '#d0bcff', Icon: GitBranch,  span: 'lg:col-span-3', terms: 0 },
  { id: 'errors',       label: 'Metrics',        sub: 'How forecast error is measured: MAE, RMSE and MAPE.', color: '#60A5FA', Icon: Ruler, span: 'sm:col-span-2 lg:col-span-6', terms: 3 },
  { id: 'price',        label: 'Returns',        sub: 'Price and return metrics.',            color: '#34D399', Icon: TrendingUp, span: 'lg:col-span-3', terms: 0 },
  { id: 'fundamentals', label: 'Fundamentals',   sub: 'Margins, revenue and income.',         color: '#A78BFA', Icon: Percent,    span: 'lg:col-span-3', terms: 0 },
  { id: 'portfolio',    label: 'Portfolio risk', sub: 'How the Portfolio page measures risk, from VaR to stress tests, and where those numbers stop being reliable.', color: '#c6c0ff', Icon: Activity, span: 'sm:col-span-2 lg:col-span-6', terms: 4 },
  { id: 'signals',      label: 'Signals',        sub: 'What each dashboard label means and what it does not.', color: '#adc6ff', Icon: Zap, span: 'sm:col-span-2 lg:col-span-7', terms: 3 },
  { id: 'limitations',  label: 'Limits',         sub: 'What the models cannot do.',           color: '#F87171', Icon: Scale,      span: 'lg:col-span-5', terms: 0 },
]

// Glass: blur, a 1px inner ring and a lit top edge for the refraction, a shadow tinted to the page colour.
const GLASS =
  'bg-white/[0.04] backdrop-blur-xl ring-1 ring-inset ring-white/[0.08] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_44px_-28px_rgba(4,8,9,0.95)] ' +
  '[@media(prefers-reduced-transparency:reduce)]:bg-[#1e2020] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#adc6ff]'
const PRESS = 'transition-[transform,background-color,box-shadow,opacity,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:transform-none'
const MONO = "[font-family:'JetBrains_Mono',monospace]"
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
const KEYFRAMES =
  '@keyframes lt-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
  '@keyframes lt-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'

type ConceptItem = typeof ALL_CONCEPTS[number]
type Group = { id: string; title: string; color: string; items: ConceptItem[] }

const keyOf = (c: ConceptItem) => `${c.section.id}:${c.term}`
const colorVar = (hex: string) => ({ '--c': hex } as React.CSSProperties)
const stagger = (i: number) => ({ '--i': i } as React.CSSProperties)

// ─── Main component ───────────────────────────────────────────────────────────

export default function LearnTab({ onAskAI }: { onAskAI?: (q: string) => void }) {
  const [query, setQuery] = useState('')
  const [openSection, setOpenSection] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [level, setLevel] = useState<'all' | 'advanced'>('all')
  const searchRef = useRef<HTMLInputElement>(null)
  const conceptsRef = useRef<HTMLDivElement>(null)

  const searchResults = useMemo(() => searchConcepts(query), [query])
  const isSearching = query.trim().length > 0
  const activeSection = openSection ? SECTIONS.find(s => s.id === openSection) ?? null : null

  // "/" jumps to search unless you are already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const groups: Group[] = useMemo(() => {
    const pick = (c: ConceptItem) => (level === 'advanced' ? ADVANCED_TAGS.includes(c.tag) : true)
    return SECTIONS
      .filter(s => !openSection || s.id === openSection)
      .map(s => ({ id: s.id, title: s.title, color: s.color, items: ALL_CONCEPTS.filter(c => c.section.id === s.id && pick(c)) }))
      .filter(g => g.items.length > 0)
  }, [level, openSection])
  const shown = groups.reduce((n, g) => n + g.items.length, 0)

  const searchGroups: Group[] = useMemo(
    () => (searchResults.length ? [{ id: 'results', title: 'Results', color: '#adc6ff', items: searchResults }] : []),
    [searchResults],
  )

  const chooseSection = (id: string) => {
    const next = openSection === id ? '' : id
    setOpenSection(next)
    setSelectedKey(null)
    if (next) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      requestAnimationFrame(() => conceptsRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }))
    }
  }

  return (
    <div className="relative isolate min-h-dvh w-full overflow-hidden bg-[#121414] font-sans text-[#e2e2e2] antialiased">
      <style>{KEYFRAMES}</style>

      {/* Depth for the glass: a faint line grid that fades out, plus grain. Both are static and ignore the pointer. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-x-0 top-0 h-[720px] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(60%_80%_at_28%_0%,#000,transparent)]"
        />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
      </div>

      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-14">
        {/* ── Header: left-aligned, with the AI panel offset down the page ── */}
        <header className="grid gap-x-14 gap-y-12 pb-20 pt-16 sm:pt-20 lg:grid-cols-12 lg:pb-28 lg:pt-28">
          <div className="lg:col-span-7">
            <p className="animate-[lt-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] text-sm text-[#8c909f] motion-reduce:animate-none">Market education hub</p>
            <h1 className="mt-5 animate-[lt-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:60ms] [text-wrap:balance] motion-reduce:animate-none">
              Learn{' '}
              <span className="bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text pb-1 text-transparent">MarketPulse</span>
            </h1>
            <p className="mt-6 max-w-[48ch] animate-[lt-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] text-lg leading-relaxed text-[#8c909f] [animation-delay:120ms] [text-wrap:pretty] motion-reduce:animate-none">
              Every concept used in this dashboard explained in plain English. No jargon, just clear explanations.
            </p>

            <div className="mt-10 max-w-[560px] animate-[lt-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] [animation-delay:180ms] motion-reduce:animate-none">
              <label className={`relative flex h-14 items-center gap-3 rounded-xl px-4 transition-shadow duration-200 focus-within:ring-[#adc6ff]/60 ${GLASS}`}>
                <Search size={18} strokeWidth={1.5} className="shrink-0 text-[#8c909f]" aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelectedKey(null) }}
                  placeholder="Find a term, metric or model"
                  aria-label="Search concepts"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-[#e2e2e2] outline-none placeholder:text-[#8c909f]"
                />
                {query ? (
                  <button onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Clear search"
                    className={`grid size-9 [@media(pointer:coarse)]:size-11 place-items-center rounded-md text-[#c2c6d6] hover:bg-white/10 ${PRESS} ${FOCUS}`}>
                    <X size={16} strokeWidth={1.5} aria-hidden />
                  </button>
                ) : (
                  <kbd className={`${MONO} hidden rounded-[4px] border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#8c909f] sm:block`}>/</kbd>
                )}
              </label>
              <p className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-[#8c909f]">
                <span className="mr-1">Try</span>
                {TERMS_TRY.map((t, i) => (
                  <span key={t}>
                    <button onClick={() => setQuery(t)}
                      className={`rounded-sm px-1 py-1.5 [@media(pointer:coarse)]:min-h-11 text-[#c2c6d6] underline decoration-white/20 underline-offset-4 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:decoration-white/60 ${PRESS} ${FOCUS}`}>{t}</button>
                    {i < TERMS_TRY.length - 1 && <span aria-hidden className="text-white/20">,</span>}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <aside aria-label="Ask MarketPulse AI"
            className={`animate-[lt-rise_0.6s_cubic-bezier(0.16,1,0.3,1)_backwards] self-start rounded-2xl p-6 [animation-delay:240ms] motion-reduce:animate-none sm:p-7 lg:col-span-5 lg:mt-24 ${GLASS}`}>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-[#d0bcff]/10 text-[#d0bcff] ring-1 ring-inset ring-[#d0bcff]/20">
                <Sparkles size={17} strokeWidth={1.5} aria-hidden />
              </span>
              <h2 className="text-lg font-medium tracking-[-0.01em]">Ask MarketPulse AI</h2>
            </div>
            <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-[#8c909f]">
              Pick a question, or ask your own on the AI tab. Answers are built from this dashboard&apos;s own data and definitions.
            </p>
            <ul className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {['Explain MAPE', 'What does Adaptive Momentum mean?', 'How is Risk Matrix weighted?'].map(q => (
                <li key={q}>
                  <button onClick={() => onAskAI?.(q)}
                    className={`group flex min-h-12 w-full items-center justify-between gap-4 py-3 text-left text-sm text-[#c2c6d6] [@media(hover:hover)]:hover:text-white ${PRESS} ${FOCUS}`}>
                    <span>{q}</span>
                    <ArrowRight size={15} strokeWidth={1.5} aria-hidden
                      className="shrink-0 text-[#8c909f] transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </header>

        {/* ── Search results ── */}
        {isSearching && (
          <section aria-live="polite" className="pb-24">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                {searchResults.length === 0 ? 'No results' : `${searchResults.length} ${searchResults.length === 1 ? 'result' : 'results'}`}{' '}
                <span className="font-normal text-[#8c909f]">for &ldquo;{query.trim()}&rdquo;</span>
              </h2>
            </div>
            {searchResults.length === 0 ? (
              <div className="max-w-[520px] border-t border-white/[0.07] pt-8">
                <p className="text-lg font-medium">Nothing matches that yet.</p>
                <p className="mt-2 text-sm leading-relaxed text-[#8c909f]">Try a synonym or a shorter word. These are common starting points:</p>
                <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {TERMS_TRY.map(t => (
                    <button key={t} onClick={() => setQuery(t)}
                      className={`rounded-sm py-1.5 [@media(pointer:coarse)]:min-h-11 text-[#c2c6d6] underline decoration-white/20 underline-offset-4 [@media(hover:hover)]:hover:text-white ${PRESS} ${FOCUS}`}>{t}</button>
                  ))}
                </p>
              </div>
            ) : (
              <ConceptBrowser groups={searchGroups} selectedKey={selectedKey} onSelect={setSelectedKey} onAskAI={onAskAI} showGroupTitles={false} />
            )}
          </section>
        )}

        {/* ── Topics ── */}
        {!isSearching && (
          <section aria-labelledby="lt-topics" className="pb-24 lg:pb-32">
            <h2 id="lt-topics" className="text-2xl font-semibold tracking-[-0.03em]">Browse by topic</h2>
            <p className="mt-2 text-sm text-[#8c909f]">Pick a topic to filter the concepts below.</p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:auto-rows-[minmax(168px,auto)] lg:grid-cols-12">
              {TOPICS.map((t, i) => {
                const sec = SECTIONS.find(s => s.id === t.id)
                const pressed = openSection === t.id
                return (
                  <button key={t.id} aria-pressed={pressed} onClick={() => chooseSection(t.id)} style={{ ...colorVar(t.color), ...stagger(i) }}
                    className={`group relative flex min-h-[168px] animate-[lt-rise_0.55s_cubic-bezier(0.16,1,0.3,1)_backwards] flex-col rounded-2xl p-5 text-left [animation-delay:calc(var(--i)*60ms)] motion-reduce:animate-none sm:p-6
                      ${t.span} ${GLASS} ${PRESS} ${FOCUS}
                      [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:bg-white/[0.065]
                      aria-pressed:bg-white/[0.07] aria-pressed:ring-[color:color-mix(in_srgb,var(--c)_55%,transparent)]
                      motion-reduce:hover:transform-none`}>
                    <span className="grid size-9 place-items-center rounded-lg bg-[color:color-mix(in_srgb,var(--c)_12%,transparent)] text-[color:var(--c)] ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--c)_22%,transparent)]">
                      <t.Icon size={17} strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="mt-5 text-lg font-medium tracking-[-0.015em]">{t.label}</span>
                    <span className="mt-1.5 max-w-[40ch] text-sm leading-relaxed text-[#8c909f] [text-wrap:pretty]">{t.sub}</span>
                    {t.terms > 0 && sec && !('rich' in t && t.rich) && (
                      <span className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#c2c6d6]/80">
                        {sec.concepts.slice(0, t.terms).map(c => <span key={c.term}>{c.term}</span>)}
                      </span>
                    )}
                    {t.terms > 0 && sec && 'rich' in t && t.rich && (
                      <span className="mt-6 block divide-y divide-white/[0.07] border-y border-white/[0.07]">
                        {sec.concepts.slice(0, t.terms).map(c => (
                          <span key={c.term} className="flex items-baseline justify-between gap-6 py-2.5 text-[13px]">
                            <span className="shrink-0 font-medium text-[#e2e2e2]">{c.term}</span>
                            <span className="truncate text-right text-[#8c909f]">{c.plain}</span>
                          </span>
                        ))}
                      </span>
                    )}
                    <span className={`${MONO} mt-auto pt-5 text-[11px] tabular-nums text-[#8c909f]`}>{CONCEPT_COUNT(t.id)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Concepts: a list on the left, the selected concept on the right ── */}
        {!isSearching && (
          <section ref={conceptsRef} aria-labelledby="lt-concepts" className="scroll-mt-24 pb-24">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h2 id="lt-concepts" className="text-2xl font-semibold tracking-[-0.03em]">Concepts</h2>
                <p className="mt-2 text-sm tabular-nums text-[#8c909f]">
                  {shown} {shown === 1 ? 'concept' : 'concepts'}{activeSection ? ` in ${activeSection.title}` : ` across ${groups.length} topics`}
                  {activeSection && (
                    <button onClick={() => { setOpenSection(''); setSelectedKey(null) }}
                      className={`ml-3 inline-flex items-center rounded-sm [@media(pointer:coarse)]:min-h-11 text-[#c2c6d6] underline decoration-white/20 underline-offset-4 [@media(hover:hover)]:hover:text-white ${PRESS} ${FOCUS}`}>Show all topics</button>
                  )}
                </p>
              </div>
              <div role="group" aria-label="Level" className="flex rounded-lg p-0.5 ring-1 ring-inset ring-white/[0.08]">
                {(['all', 'advanced'] as const).map(l => (
                  <button key={l} aria-pressed={level === l} onClick={() => { setLevel(l); setSelectedKey(null) }}
                    className={`min-h-9 [@media(pointer:coarse)]:min-h-11 rounded-md px-4 text-[13px] font-medium text-[#8c909f] [@media(hover:hover)]:hover:text-[#e2e2e2] aria-pressed:bg-[#adc6ff] aria-pressed:text-[#002e6a] ${PRESS} ${FOCUS}`}>
                    {l === 'all' ? 'All levels' : 'Advanced'}
                  </button>
                ))}
              </div>
            </div>
            {groups.length === 0 ? (
              <p className="max-w-[48ch] border-t border-white/[0.07] pt-8 text-sm text-[#8c909f]">No concepts match this level. Switch back to All levels.</p>
            ) : (
              <ConceptBrowser groups={groups} selectedKey={selectedKey} onSelect={setSelectedKey} onAskAI={onAskAI} showGroupTitles />
            )}
          </section>
        )}

        {/* ── Note ── */}
        {!isSearching && (
          <footer className="mb-24 max-w-[68ch] border-t border-white/[0.07] pt-8">
            <h2 className="text-sm font-medium text-[#c2c6d6]">Educational use only</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#8c909f] [text-wrap:pretty]">
              These definitions are for learning. MarketPulse metrics come from historical data and simple models. Past performance does not predict future results, and nothing here is financial advice.
            </p>
          </footer>
        )}
      </div>
    </div>
  )
}

// ─── Concept browser: list + detail panel (inline detail on small screens) ────

function ConceptBrowser({
  groups, selectedKey, onSelect, onAskAI, showGroupTitles,
}: {
  groups: Group[]; selectedKey: string | null; onSelect: (k: string) => void
  onAskAI?: (q: string) => void; showGroupTitles: boolean
}) {
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])
  const selected = flat.find(c => keyOf(c) === selectedKey) ?? flat[0]
  const listRef = useRef<HTMLElement>(null)

  // Up and down move through the list from the keyboard.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const i = flat.findIndex(c => keyOf(c) === keyOf(selected))
    const next = flat[Math.max(0, Math.min(flat.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (!next || next === selected) return
    e.preventDefault()
    onSelect(keyOf(next))
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(keyOf(next))}"]`)?.focus())
  }

  return (
    <div className="grid items-start gap-x-14 gap-y-8 lg:grid-cols-12">
      <nav ref={listRef} aria-label="Concepts" onKeyDown={onKeyDown} className="lg:col-span-5">
        {groups.map(g => (
          <div key={g.id} className="mb-8 last:mb-0" style={colorVar(g.color)}>
            {showGroupTitles && (
              <h3 className="mb-2 flex items-center gap-2.5 px-3 text-[13px] font-medium text-[#c2c6d6]">
                <span aria-hidden className="size-1.5 rounded-full bg-[color:var(--c)]" />
                {g.title}
                <span className="font-normal tabular-nums text-[#8c909f]">{g.items.length}</span>
              </h3>
            )}
            <ul className="border-t border-white/[0.07]">
              {g.items.map(c => {
                const k = keyOf(c)
                const active = selected && k === keyOf(selected)
                return (
                  <li key={k} className="border-b border-white/[0.07]" style={colorVar(c.section.color)}>
                    <button data-key={k} aria-current={active ? 'true' : undefined} onClick={() => onSelect(k)}
                      className={`relative flex w-full items-start justify-between gap-4 px-3 py-3.5 text-left [@media(hover:hover)]:hover:bg-white/[0.035] aria-[current=true]:bg-white/[0.05] ${PRESS} ${FOCUS}`}>
                      <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-[color:var(--c)] opacity-0 transition-opacity duration-200 [[aria-current=true]>&]:opacity-100" />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium tracking-[-0.01em] text-[#e2e2e2]">{c.term}</span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-[#8c909f] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{c.plain}</span>
                      </span>
                      <span className={`${MONO} mt-1 hidden shrink-0 rounded-[4px] border border-white/10 px-1.5 py-0.5 text-[10px] text-[#8c909f] sm:block`}>{c.tag}</span>
                    </button>
                    {/* Small screens: the detail opens under the item. */}
                    {active && (
                      <div className="animate-[lt-fade_0.25s_ease-out_backwards] px-3 pb-5 pt-1 motion-reduce:animate-none lg:hidden">
                        <ConceptDetail c={c} onAskAI={onAskAI} compact />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <article aria-live="polite" key={selected ? keyOf(selected) : 'none'}
        className={`hidden animate-[lt-fade_0.25s_ease-out_backwards] rounded-2xl p-8 motion-reduce:animate-none lg:sticky lg:top-24 lg:col-span-7 lg:block ${GLASS}`}
        style={selected ? colorVar(selected.section.color) : undefined}>
        {selected && <ConceptDetail c={selected} onAskAI={onAskAI} />}
      </article>
    </div>
  )
}

function ConceptDetail({ c, onAskAI, compact }: { c: ConceptItem; onAskAI?: (q: string) => void; compact?: boolean }) {
  return (
    <div style={colorVar(c.section.color)}>
      {!compact && (
        <p className="flex items-center gap-3 text-[13px] text-[#8c909f]">
          <span className="text-[color:var(--c)]">{c.section.title}</span>
          <span className={`${MONO} rounded-[4px] border border-white/10 px-1.5 py-0.5 text-[10px]`}>{c.tag}</span>
        </p>
      )}
      {!compact && <h3 className="mt-4 text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.035em] [text-wrap:balance]">{c.term}</h3>}
      {!compact && <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-[#c2c6d6] [text-wrap:pretty]">{c.plain}</p>}

      <p className={`${compact ? 'mt-1' : 'mt-7'} max-w-[64ch] whitespace-pre-line border-l border-white/10 pl-4 text-[14.5px] leading-7 text-[#8c909f] [text-wrap:pretty]`}>{c.detail}</p>

      {c.example && (
        <p className="mt-5 max-w-[64ch] text-sm leading-relaxed text-[#c2c6d6]">
          <span className="mr-2 font-medium text-[color:var(--c)]">Example</span>
          {c.example}
        </p>
      )}

      <div className={`${compact ? 'mt-5' : 'mt-8'} flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.07] pt-5 text-[13px]`}>
        {c.links?.map(link => {
          const s = SOURCE_STYLES[link.source]
          return (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
              className={`inline-flex min-h-9 [@media(pointer:coarse)]:min-h-11 items-center gap-2 rounded-sm text-[#c2c6d6] [@media(hover:hover)]:hover:text-white ${PRESS} ${FOCUS}`}>
              <span style={{ color: s.color }} className="inline-flex">{link.source === 'youtube' ? <Youtube size={14} strokeWidth={1.5} aria-hidden /> : <FileText size={14} strokeWidth={1.5} aria-hidden />}</span>
              <span className="underline decoration-white/20 underline-offset-4">{link.label}</span>
              <ArrowUpRight size={12} strokeWidth={1.5} className="opacity-60" aria-hidden />
            </a>
          )
        })}
        {onAskAI && (
          <button onClick={() => onAskAI(`Explain "${c.term}" in the context of the MarketPulse dashboard`)}
            className={`inline-flex min-h-9 [@media(pointer:coarse)]:min-h-11 items-center gap-2 rounded-sm text-[#d0bcff] [@media(hover:hover)]:hover:text-white sm:ml-auto ${PRESS} ${FOCUS}`}>
            <Sparkles size={14} strokeWidth={1.5} aria-hidden />
            Ask AI about this
          </button>
        )}
      </div>
    </div>
  )
}
