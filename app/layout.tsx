import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MarketPulse — S&P 500 Forecasting & Risk Dashboard',
  description:
    'An interactive financial analytics dashboard combining historical stock performance, explainable forecasting models, model reliability, volatility risk, and profitability fundamentals across S&P 500 companies.',
  keywords: 'S&P 500, stock forecasting, financial analytics, risk dashboard, volatility, MAPE',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
