# MarketPulse — S&P 500 Forecasting & Risk Dashboard

A polished, dark-mode financial analytics web app built as the public-facing portfolio version of a Databricks internship project. It combines historical stock price analysis, explainable forecasting models, model reliability scoring, volatility risk assessment, and profitability fundamentals across 528 S&P 500 companies.

> **Disclaimer:** This dashboard is for educational and analytical purposes only. It is not financial advice. Forecasts are based on simplified statistical models and historical data.

---

## Dashboard Sections

| Section | Description |
|---|---|
| **Executive Overview** | KPI cards, signal distribution chart, aggregate metrics with filters |
| **Company Explorer** | Sortable, filterable table of all companies with forecast/risk badges |
| **Forecast Performance** | Actual vs. predicted charts and 30-day forward forecasts per company |
| **Sector Comparison** | Bar charts comparing sectors by upside, volatility, MAPE, profit margin, and signal composition |
| **Risk / Opportunity Matrix** | Interactive scatter plot: forecast upside vs. annualized volatility, colored by signal |
| **AI Analyst** | Gemini-powered chatbot that explains company and sector data in plain English |

---

## Data & Analytics

### Dataset
- **Source:** [S&P 500 stock data along with financials and news (Kaggle)](https://www.kaggle.com/)
- **Coverage:** S&P 500 companies from January 2000 onward
- **Original workflow:** Databricks (PySpark, Delta Lake, SQL Views, Dashboards)

### Forecasting Models

| Model | Description |
|---|---|
| **Naive** | Future price = last observed close. Key financial time series baseline. |
| **Moving Average 30D** | Future price = average of last 30 trading day closes. Smooths short-term noise. |
| **Drift** | Naive forecast adjusted by average historical daily price change. |
| **Linear Trend 252D** | Trend line fitted on the most recent 252 trading days (~1 year). Replaces full-history trend which was too distorted for short-term forecasting. |

### Evaluation Metrics

| Metric | Description |
|---|---|
| **MAE** | Mean Absolute Error — average absolute dollar miss |
| **RMSE** | Root Mean Squared Error — penalizes large misses more |
| **MAPE** | Mean Absolute Percentage Error — allows comparison across price levels. Used to select the best model per stock. |

Train/test split: **latest 90 trading days = test**; older history = training. No random shuffling (time series data).

### Signal Labels

- **Forecast Signal:** Positive / Neutral / Negative (based on 30D upside threshold)
- **Model Reliability:** Strong (<2% MAPE) / Acceptable (2–5%) / High Error (5–10%) / Very High Error (>10%)
- **Risk Level:** Lower / Moderate / High (based on annualized volatility)
- **Fundamental Label:** Above/Below/Mixed sector profitability
- **Final Signal:** Combination of all above — screening label, not investment advice

---

## AI Analyst (Gemini)

The AI Analyst uses the **Gemini API** via a secure Next.js server-side route. It explains dashboard data in plain English:
- Explains individual company forecast, risk, and fundamentals
- Compares companies on key metrics
- Explains why a company received its signal label
- Summarizes sector-level trends
- Always caveats limitations and never gives buy/sell advice

### Security
- API key stored in `GEMINI_API_KEY` environment variable (server-side only)
- Key is **never** exposed to the browser
- Only selected company/sector rows are sent per request — not the full dataset

---

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Recharts** — all charts
- **PapaParse** — CSV parsing
- **Lucide React** — icons
- **Gemini API** (Google AI Studio) — AI Analyst

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/your-username/marketpulse-web.git
cd marketpulse-web

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local and add your Gemini API key

# 4. Add data files (optional — demo data loads automatically if missing)
# Copy your CSV exports to public/data/
# - marketpulse_dashboard_company_summary.csv
# - marketpulse_dashboard_sector_summary.csv
# - marketpulse_dashboard_actual_vs_predicted_wide.csv
# - marketpulse_dashboard_future_forecast_wide.csv
# - marketpulse_dashboard_kpis.csv

# 5. Run dev server
npm run dev
# → http://localhost:3000
```

---

## Adding Your Data

Place your Databricks CSV exports in `/public/data/`. The app automatically detects and loads them. If any file is missing, the app falls back to representative sample data so the dashboard remains fully functional for demonstration.

Expected files and schemas are documented in detail in the project brief.

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In Vercel **Settings → Environment Variables**, add:
   ```
   GEMINI_API_KEY = your_key_here
   ```
4. Click **Deploy**

The app is fully static-friendly. No database required.

---

## Limitations

- Forecasting models are simple and explainable by design — not production trading models
- The linear trend model uses only the most recent 252 trading days to avoid historical distortion
- Fundamental data (profit margin, EBITDA) may be incomplete for some companies due to long-format financials CSV structure
- Debt/cash balance sheet metrics excluded due to high null rates
- Model errors reflect test-period backtest performance, not guaranteed future accuracy
- AI Analyst responses are generated from dashboard data — not live market data

## Future Improvements

- Add more sophisticated models (ARIMA, Prophet, LSTM) for comparison
- Real-time price feed integration
- User watchlists (localStorage or Supabase)
- PDF report export per company
- Mobile-optimized chart views
- CI/CD with automated data refresh from Databricks

---

*Built during Datacrew data science internship — Week 1 project combining Databricks finance workflow and forecasting workflow.*
