export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function formatPercentPlain(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '—'
  return value.toFixed(decimals)
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—'
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return value }
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case 'Potential Opportunity': return '#34D399'
    case 'High Volatility Speculative': return '#F59E0B'
    case 'Weak Fundamentals / Negative Forecast': return '#F87171'
    case 'Weak Negative': return '#F87171'
    case 'Stable Watchlist': return '#60A5FA'
    case 'Needs Further Review': return '#697386'
    default: return '#697386'
  }
}

export function getSignalBgClass(signal: string): string {
  switch (signal) {
    case 'Potential Opportunity': return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
    case 'High Volatility Speculative': return 'bg-amber-950/60 text-amber-400 border-amber-800/40'
    case 'Weak Fundamentals / Negative Forecast': return 'bg-red-950/60 text-red-400 border-red-800/40'
    case 'Weak Negative': return 'bg-red-950/60 text-red-400 border-red-800/40'
    case 'Stable Watchlist': return 'bg-blue-950/60 text-blue-400 border-blue-800/40'
    case 'Needs Further Review': return 'bg-slate-900/60 text-slate-400 border-slate-700/40'
    default: return 'bg-slate-900/60 text-slate-400 border-slate-700/40'
  }
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'Lower Risk': return '#34D399'
    case 'Moderate Risk': return '#F59E0B'
    case 'High Risk': return '#F87171'
    default: return '#697386'
  }
}

export function getRiskBgClass(risk: string): string {
  switch (risk) {
    case 'Lower Risk': return 'bg-emerald-950/50 text-emerald-400 border-emerald-800/30'
    case 'Moderate Risk': return 'bg-amber-950/50 text-amber-400 border-amber-800/30'
    case 'High Risk': return 'bg-red-950/50 text-red-400 border-red-800/30'
    default: return 'bg-slate-900/50 text-slate-400 border-slate-700/30'
  }
}

export function getReliabilityBgClass(reliability: string): string {
  switch (reliability) {
    case 'Strong Reliability': return 'bg-emerald-950/50 text-emerald-400 border-emerald-800/30'
    case 'Acceptable Reliability': return 'bg-blue-950/50 text-blue-400 border-blue-800/30'
    case 'High Error': return 'bg-amber-950/50 text-amber-400 border-amber-800/30'
    case 'Very High Error': return 'bg-red-950/50 text-red-400 border-red-800/30'
    default: return 'bg-slate-900/50 text-slate-400 border-slate-700/30'
  }
}

export function getForecastSignalClass(signal: string): string {
  switch (signal) {
    case 'Positive Forecast': return 'bg-emerald-950/50 text-emerald-400 border-emerald-800/30'
    case 'Negative Forecast': return 'bg-red-950/50 text-red-400 border-red-800/30'
    case 'Neutral Forecast': return 'bg-slate-900/50 text-slate-400 border-slate-700/30'
    default: return 'bg-slate-900/50 text-slate-400 border-slate-700/30'
  }
}
