'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Activity, BarChart2, GitBranch, Globe, Crosshair, Bot, BookOpen, TrendingUp, Sparkles, AlertTriangle, ArrowUpRight, Info } from 'lucide-react'
import ExecutiveOverview from '@/components/dashboard/ExecutiveOverview'
import CompanyExplorer from '@/components/dashboard/CompanyExplorer'
import ForecastPerformance from '@/components/dashboard/ForecastPerformance'
import SectorComparison from '@/components/dashboard/SectorComparison'
import RiskOpportunityMatrix from '@/components/dashboard/RiskOpportunityMatrix'
import AIAnalyst from '@/components/dashboard/AIAnalyst'
import LearnTab from '@/components/dashboard/LearnTab'
import { loadCompanySummary, loadSectorSummary, loadKPIs, loadActualVsPredicted, loadFutureForecast } from '@/lib/data'
import type { CompanySummary, SectorSummary, KPIs, ActualVsPredicted, FutureForecast } from '@/lib/types'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'explorer', label: 'Explorer', icon: BarChart2 },
  { id: 'forecast', label: 'Forecast', icon: GitBranch },
  { id: 'sector', label: 'Sector', icon: Globe },
  { id: 'matrix', label: 'Risk Matrix', icon: Crosshair },
  { id: 'ai', label: 'MarketPulse AI', icon: Bot },
  { id: 'learn', label: 'Learn', icon: BookOpen },
]

// Glass panel tilt effect — matches Stitch JS
function useGlassTilt(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const cx = rect.width / 2, cy = rect.height / 2
      const rx = (y - cy) / 20, ry = (cx - x) / 20
      el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`
    }
    const onLeave = () => { el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)' }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave) }
  }, [ref])
}

function GlassCard({ children, hoverColor = 'rgba(208,188,255,0.3)', className = '', onClick }: {
  children: React.ReactNode; hoverColor?: string; className?: string; onClick?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useGlassTilt(ref)
  return (
    <div ref={ref} onClick={onClick}
      className={`transition-all duration-300 cursor-pointer ${className}`}
      style={{
        background: 'rgba(30,32,34,0.4)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.08)',
        transition: 'border-color 0.3s, transform 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = hoverColor }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)' }}>
      {children}
    </div>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [sectors, setSectors] = useState<SectorSummary[]>([])
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [actualVsPredicted, setActualVsPredicted] = useState<ActualVsPredicted[]>([])
  const [futureForecast, setFutureForecast] = useState<FutureForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<CompanySummary | null>(null)
  const [explorerSector, setExplorerSector] = useState<string | undefined>(undefined)
  const [explorerSignal, setExplorerSignal] = useState<string | undefined>(undefined)
  const [aiDefaultQuestion, setAiDefaultQuestion] = useState<string | undefined>(undefined)
  const ctaPanelRef = useRef<HTMLDivElement>(null)
  useGlassTilt(ctaPanelRef)

  useEffect(() => {
    async function loadAll() {
      const [c, s, k, avp, ff] = await Promise.all([
        loadCompanySummary(), loadSectorSummary(), loadKPIs(),
        loadActualVsPredicted(), loadFutureForecast(),
      ])
      setCompanies(c); setSectors(s); setKpis(k)
      setActualVsPredicted(avp); setFutureForecast(ff)
      setLoading(false)
    }
    loadAll()
  }, [])

  const navigateToExplorer = useCallback((sector?: string, signal?: string) => {
    setExplorerSector(sector)
    setExplorerSignal(signal)
    setActiveTab('explorer')
  }, [])

  const navigateToAIWithQuestion = useCallback((question: string) => {
    setAiDefaultQuestion(question)
    setActiveTab('ai')
  }, [])

  const navigateToForecast = useCallback((company: CompanySummary) => {
    setSelectedCompany(company); setActiveTab('forecast')
  }, [])
  const navigateToAI = useCallback((company: CompanySummary) => {
    setSelectedCompany(company); setActiveTab('ai')
  }, [])

  const showHero = activeTab === null

  return (
    <div className="min-h-screen" style={{ color: '#e0e3e5', fontFamily: "'Inter', 'Geist', system-ui, sans-serif" }}>

      {/* ── Mesh + Dot grid background (Stitch exact) ─────────────────── */}
      {showHero && (
        <>
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -2,
            background: `radial-gradient(circle at 20% 30%, #3c0091 0%, transparent 40%),
                         radial-gradient(circle at 80% 70%, #00354a 0%, transparent 40%),
                         radial-gradient(circle at 50% 50%, #101415 0%, #0b0f10 100%)`,
          }} />
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }} />
        </>
      )}
      {!showHero && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -2, background: '#101415' }} />
      )}



      {/* ── Navigation (Stitch exact) ───────────────────────────────────── */}
      <header style={{
        background: 'rgba(29,32,34,0.60)',
        backdropFilter: 'blur(60px)',
        WebkitBackdropFilter: 'blur(60px)',
        borderBottom: '1px solid rgba(224,227,229,0.10)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <nav className="flex justify-between items-center w-full px-4 md:px-16 max-w-[1440px] mx-auto" style={{ height: 80 }}>
          {/* Logo + nav links */}
          <div className="flex items-center gap-8">
            <button onClick={() => setActiveTab(null)}
              className="flex items-center gap-2 font-bold tracking-tight" style={{ fontSize: 20, color: '#e0e3e5' }}>
              MarketPulse
              <span style={{
                fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
                padding: '2px 8px', borderRadius: 9999,
                border: '1px solid rgba(208,188,255,0.30)',
                color: '#d0bcff', background: 'rgba(208,188,255,0.10)',
              }}>BETA</span>
            </button>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-6">
              {TABS.map(tab => {
                const active = activeTab === tab.id
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{
                      fontSize: 12, fontWeight: active ? 700 : 400, letterSpacing: '0.05em',
                      color: active ? '#d0bcff' : '#cbc3d7',
                      borderBottom: active ? '2px solid #d0bcff' : '2px solid transparent',
                      paddingBottom: 4, background: 'transparent', transition: 'color 0.15s',
                    }}>
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(30,32,34,0.40)', backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.08)', color: '#e0e3e5',
                letterSpacing: '0.05em',
              }}>
              Educational only
            </span>
            <button onClick={() => setActiveTab('overview')}
              className="px-6 py-2.5 rounded-full font-bold text-xs active:scale-95 transition-all hover:opacity-80"
              style={{
                background: '#d0bcff', color: '#3c0091',
                letterSpacing: '0.05em',
                boxShadow: '0 0 20px rgba(208,188,255,0.25)',
              }}>
              Explore Dashboard
            </button>
          </div>
        </nav>

        {/* Mobile tab scroll */}
        <div className="lg:hidden flex gap-1 px-4 pb-2 overflow-x-auto"
          style={{ borderTop: '1px solid rgba(224,227,229,0.06)' }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1 px-3 py-2 text-xs whitespace-nowrap shrink-0"
                style={{ color: active ? '#d0bcff' : '#cbc3d7', borderBottom: active ? '2px solid #d0bcff' : '2px solid transparent' }}>
                <Icon size={11} /> {tab.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── Landing page ─────────────────────────────────────────────── */}
      {showHero && (
        <main className="relative" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

          {/* ── Hero — ZIP 6 style ────────────────────────────────────────── */}
          <section style={{ padding: '80px 48px 72px', maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            <div>
              {/* Live badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4edea3', boxShadow: '0 0 8px #4edea3' }} />
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#4edea3', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live S&P 500 Analytics</span>
              </div>

              <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 24 }}>
                Explainable market<br />
                <span style={{ color: '#adc6ff' }}>signals</span> for the<br />S&P 500
              </h1>

              <p style={{ fontSize: 16, color: '#8c909f', lineHeight: 1.65, marginBottom: 36, maxWidth: 440 }}>
                Forecasts, volatility, sector context, and AI summaries — built with Databricks, XGBoost Direct, and adaptive momentum models.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('overview')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#adc6ff', color: '#002e6a', fontSize: 14, fontWeight: 600, padding: '12px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Launch Dashboard <ArrowUpRight size={14} />
                </button>
                <button onClick={() => setActiveTab('learn')}
                  style={{ fontSize: 14, fontWeight: 500, color: '#c2c6d6', background: 'transparent', padding: '12px 24px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Technical Specs
                </button>
              </div>
            </div>

            {/* Hero right panel — aggregate score */}
            <div style={{ background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Aggregate Score</div>
                  <div style={{ fontSize: 52, fontWeight: 700, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1 }}>84.2</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>System Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4edea3', boxShadow: '0 0 6px #4edea3' }} />
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#4edea3', letterSpacing: '0.06em' }}>OPERATIONAL</span>
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { l: 'Volatility', v: '31.8%', c: '#fb923c' },
                  { l: 'Avg MAPE', v: '1.55%', c: '#d0bcff' },
                  { l: 'Avg Upside', v: '+1.35%', c: '#4edea3' },
                  { l: 'Companies', v: '528', c: '#e2e2e2' },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: '#1e2020', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '12px 16px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: c, fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 48px' }} />

          {/* ── Feature sections — Apple alternating layout ────────────────── */}

          {/* Company Explorer */}
          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 48px', display: 'grid', gridTemplateColumns: '5fr 4fr', gap: 80, alignItems: 'center' }}>
            <div style={{ background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Ticker tape */}
              <div style={{ background: '#1e2020', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 0, animation: 'tickerScroll 25s linear infinite', whiteSpace: 'nowrap' }}>
                  {['AAPL +2.76%','NVDA +5.91%','MSFT -0.34%','TSLA -1.12%','AMZN +1.83%','GOOGL +3.2%','AAPL +2.76%','NVDA +5.91%'].map((t, i) => (
                    <span key={i} style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: t.includes('-') ? '#f87171' : '#4edea3', paddingInline: 20, borderRight: '1px solid rgba(255,255,255,0.06)' }}>{t}</span>
                  ))}
                </div>
              </div>
              {/* Table preview */}
              <div style={{ padding: '0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px 100px', gap: 0, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['TICKER','NAME','PRICE','30D','SIGNAL'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>
                {[
                  { sym: 'NVDA', name: 'NVIDIA Corp', p: '$1,232', up: '+14.2%', sig: 'OPPORTUNITY', sc: '#4edea3' },
                  { sym: 'AMD', name: 'Adv. Micro Dev.', p: '$168', up: '+11.8%', sig: 'STABLE', sc: '#adc6ff' },
                  { sym: 'TSLA', name: 'Tesla Inc.', p: '$178', up: '-2.4%', sig: 'REVIEW', sc: '#8c909f' },
                ].map(({ sym, name, p, up, sig, sc }) => (
                  <div key={sym} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px 100px', gap: 0, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e2e2e2' }}>{sym}</span>
                    <span style={{ fontSize: 12, color: '#8c909f', fontFamily: 'Inter, system-ui, sans-serif' }}>{name}</span>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#c2c6d6' }}>{p}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: up.startsWith('-') ? '#f87171' : '#4edea3' }}>{up}</span>
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: sc, background: `${sc}15`, border: `1px solid ${sc}30`, padding: '3px 7px', borderRadius: 3 }}>{sig}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Terminal · Node</div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 16 }}>
                Company Explorer
              </h2>
              <p style={{ fontSize: 15, color: '#8c909f', lineHeight: 1.65, marginBottom: 24 }}>
                Dive into a high-density environment for surgical analysis. Track sector rotation, AI-identified opportunities, and systematic risks across all 528 constituent nodes.
              </p>
              <button onClick={() => setActiveTab('explorer')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#adc6ff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500, padding: 0 }}>
                Explore Company Explorer <ArrowUpRight size={14} />
              </button>
            </div>
          </section>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 48px' }} />

          {/* Forecast Performance */}
          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Predictive Power</div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 16 }}>
                Forecast Performance
              </h2>
              <p style={{ fontSize: 15, color: '#8c909f', lineHeight: 1.65, marginBottom: 24 }}>
                Seven forecasting models — from Naive benchmarks to deep XGBoost Direct ensembles and Adaptive Momentum — evaluated on a 90-day test window for maximum predictive accountability.
              </p>
              {/* Model cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { name: 'Adaptive Momentum', val: '+12.4% ARR', c: '#adc6ff' },
                  { name: 'XGBoost Direct', val: '+8.1% ARR', c: '#d0bcff' },
                  { name: 'Weighted Ensemble', val: '+9.2% ARR', c: '#4edea3' },
                ].map(({ name, val, c }) => (
                  <div key={name} style={{ background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: '#8c909f', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 8 }}>{name}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em' }}>{val}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setActiveTab('forecast')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#d0bcff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500, padding: 0 }}>
                Explore Forecast Performance <ArrowUpRight size={14} />
              </button>
            </div>
            {/* Chart SVG preview */}
            <div style={{ background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Forecast Preview · AAPL · Day 30</div>
              <svg viewBox="0 0 380 140" style={{ width: '100%', height: 140, marginBottom: 16 }}>
                <line x1="0" y1="140" x2="380" y2="140" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                {[35,70,105].map(y => <line key={y} x1="0" y1={y} x2="380" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
                {/* Actual price line */}
                <path d="M0,80 Q15,75 30,82 Q45,88 60,70 Q75,52 90,60 Q105,68 120,50 Q135,32 150,40 Q165,48 180,35" fill="none" stroke="#e2e2e2" strokeWidth="2.5" />
                {/* Vertical divider */}
                <line x1="190" y1="0" x2="190" y2="140" stroke="rgba(255,255,255,0.1)" strokeDasharray="4 3" strokeWidth="1" />
                <text x="194" y="16" fontSize="9" fill="#8c909f" fontFamily="JetBrains Mono">Forecast →</text>
                {/* Adaptive momentum */}
                <path d="M180,35 Q210,32 240,28 Q270,24 300,20 Q330,17 360,14 L380,12" fill="none" stroke="#adc6ff" strokeWidth="2.5" />
                {/* XGBoost */}
                <path d="M180,35 Q210,34 240,30 Q270,27 300,24 Q330,22 360,20 L380,19" fill="none" stroke="#d0bcff" strokeWidth="2" />
                {/* Confidence band */}
                <path d="M180,35 Q210,27 240,22 Q270,18 300,14 Q330,11 360,8 L380,6 L380,22 Q330,26 300,30 Q270,33 240,37 Q210,40 180,35 Z" fill="#adc6ff" fillOpacity="0.07" />
              </svg>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[['#adc6ff','Adaptive Momentum'],['#d0bcff','XGBoost Direct'],['rgba(173,198,255,0.3)','Confidence Band']].map(([c, l]) => (
                  <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f' }}>
                    <span style={{ width: 16, height: 2, background: c as string, display: 'inline-block', borderRadius: 1 }} />{l}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 48px' }} />

          {/* Sector + Risk + AI — 3-col benchmarking row */}
          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 48px' }}>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' }}>Benchmarking</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 12, textAlign: 'center' }}>
              Sector Comparison
            </h2>
            <p style={{ fontSize: 15, color: '#8c909f', lineHeight: 1.65, marginBottom: 48, textAlign: 'center', maxWidth: 560, margin: '0 auto 48px' }}>
              Identify lagging and leading sectors. Map capital flows across 11 GICS sectors and benchmark individual tickers against their cohort's median performance.
            </p>
            {/* Sector mini-stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
              {[
                { label: 'Technology', upside: '+8.42%', vol: '18.5%', pos: true },
                { label: 'Healthcare', upside: '+4.2%', vol: '14.2%', pos: true },
                { label: 'Energy', upside: '-1.8%', vol: '22.1%', pos: false },
                { label: 'Utilities', upside: '-0.2%', vol: '12.8%', pos: false },
              ].map(({ label, upside, vol, pos }) => (
                <div key={label} onClick={() => setActiveTab('sector')}
                  style={{ background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(173,198,255,0.25)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}>
                  <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: pos ? '#4edea3' : '#f87171', fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>{upside}</div>
                  <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f' }}>Vol: {vol}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setActiveTab('sector')}
                style={{ fontSize: 14, color: '#4edea3', background: '#1a1c1c', border: '1px solid rgba(78,222,163,0.25)', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}>
                Explore Sector Comparison
              </button>
            </div>
          </section>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 48px' }} />

          {/* Risk Matrix + MarketPulse AI — side by side */}
          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            {/* Risk Matrix card */}
            <div style={{ background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 28 }}>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Visual Analysis</div>
              <h3 style={{ fontSize: 28, fontWeight: 700, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>Risk Matrix</h3>
              <p style={{ fontSize: 14, color: '#8c909f', lineHeight: 1.6, marginBottom: 20 }}>Visualize systemic risk through our matrix. Map standard deviation against forecast variance to isolate true anomalies from market noise.</p>
              {/* Mini scatter */}
              <svg viewBox="0 0 280 160" style={{ width: '100%', height: 120, marginBottom: 16 }}>
                <line x1="140" y1="0" x2="140" y2="160" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 3" strokeWidth="1" />
                <line x1="0" y1="80" x2="280" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 3" strokeWidth="1" />
                {[[40,60,'#4edea3'],[80,40,'#4edea3'],[110,90,'#adc6ff'],[150,50,'#adc6ff'],[180,70,'#fb923c'],[210,30,'#4edea3'],[240,100,'#f87171'],[60,110,'#8c909f'],[170,120,'#fb923c']].map(([x,y,c], i) => (
                  <circle key={i} cx={x} cy={y} r="5" fill={c as string} fillOpacity="0.7" />
                ))}
                <text x="148" y="14" fontSize="8" fill="#8c909f" fontFamily="JetBrains Mono">HIGH UPSIDE / LOW VOL</text>
                <text x="4" y="155" fontSize="8" fill="#8c909f" fontFamily="JetBrains Mono">LOW UPSIDE / HIGH VOL</text>
              </svg>
              <button onClick={() => setActiveTab('matrix')}
                style={{ fontSize: 13, color: '#fb923c', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                Explore Risk Matrix <ArrowUpRight size={13} />
              </button>
            </div>

            {/* MarketPulse AI card */}
            <div style={{ background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 28 }}>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Intelligence</div>
              <h3 style={{ fontSize: 28, fontWeight: 700, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>MarketPulse AI</h3>
              <p style={{ fontSize: 14, color: '#8c909f', lineHeight: 1.6, marginBottom: 20 }}>Plain-English explanations of any company's forecast, risk profile, and fundamentals. Powered by OpenRouter AI — grounded in your dashboard data.</p>
              {/* AI response preview */}
              <div style={{ background: '#1e2020', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4edea3', boxShadow: '0 0 4px #4edea3' }} />
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#4edea3', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI · Analyst Live</span>
                </div>
                <p style={{ fontSize: 12, color: '#c2c6d6', lineHeight: 1.55, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic', marginBottom: 10 }}>
                  "AAPL shows a mild positive adaptive forecast of +2.76% over 30 trading days. Model reliability is Very Strong at 1.34% MAPE."
                </p>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Signal Strength</div><div style={{ fontSize: 14, fontWeight: 600, color: '#4edea3', fontFamily: 'Inter' }}>High</div></div>
                  <div><div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</div><div style={{ fontSize: 14, fontWeight: 600, color: '#adc6ff', fontFamily: 'Inter' }}>94.2%</div></div>
                </div>
              </div>
              <button onClick={() => setActiveTab('ai')}
                style={{ fontSize: 13, color: '#d0bcff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                Explore MarketPulse AI <ArrowUpRight size={13} />
              </button>
            </div>
          </section>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 48px' }} />

          {/* Learn Hub */}
          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 48px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8c909f', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Transparency</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#e2e2e2', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 16 }}>
              Learn Hub
            </h2>
            <p style={{ fontSize: 15, color: '#8c909f', lineHeight: 1.65, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
              We don't believe in black boxes. Full data methodology, model documentation, and plain-English explanations of every signal. Understand the "why" behind every forecast.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'API Documentation', icon: '↗' },
                { label: 'Model Methodology', icon: '◎' },
                { label: 'Data Governance', icon: '⚙' },
              ].map(({ label, icon }) => (
                <button key={label} onClick={() => setActiveTab('learn')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#c2c6d6', background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span style={{ color: '#adc6ff' }}>{icon}</span> {label}
                </button>
              ))}
            </div>
            <button onClick={() => setActiveTab('learn')}
              style={{ fontSize: 14, fontWeight: 600, color: '#e2e2e2', background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.15)', padding: '12px 28px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              Explore Learn Hub
            </button>
          </section>

          {/* CSS animations */}
          <style>{`
            @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          `}</style>

          {/* Footer (Stitch exact) */}
          <footer style={{ background: '#0b0f10', borderTop: '1px solid rgba(224,227,229,0.05)' }}>
            {/* Disclaimer banner */}
            <div className="w-full py-4" style={{ background: 'rgba(208,188,255,0.05)', borderBottom: '1px solid rgba(208,188,255,0.10)' }}>
              <div className="px-4 md:px-16 max-w-[1440px] mx-auto flex items-center gap-3">
                <Info size={16} style={{ color: '#d0bcff', flexShrink: 0 }} />
                <p style={{ fontSize: 12, letterSpacing: '0.05em', color: 'rgba(203,195,215,0.80)' }}>
                  <strong style={{ color: '#e0e3e5' }}>Educational use only.</strong>{' '}
                  This dashboard uses simplified statistical models and historical data. Forecasts are not financial advice.
                  Actual stock prices may differ due to market conditions, earnings, macro events, and sentiment.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full px-4 md:px-16 py-12 max-w-[1440px] mx-auto gap-6">
              <div className="flex flex-col gap-3">
                <span className="font-bold" style={{ fontSize: 20, color: '#e0e3e5' }}>MarketPulse</span>
                <p style={{ fontSize: 12, letterSpacing: '0.05em', color: 'rgba(203,195,215,0.60)', maxWidth: 320, lineHeight: 1.6 }}>
                  S&P 500 Forecasting &amp; Risk Dashboard. Built during Datacrew data science internship.
                  Educational use only — not financial advice.
                </p>
              </div>
              <div className="flex flex-wrap gap-6 items-center">
                {[
                  { label: 'Overview', tab: 'overview' },
                  { label: 'Explorer', tab: 'explorer' },
                  { label: 'Forecast', tab: 'forecast' },
                  { label: 'Risk Matrix', tab: 'matrix' },
                  { label: 'AI Analyst', tab: 'ai' },
                  { label: 'Learn', tab: 'learn' },
                ].map(({ label, tab }) => (
                  <button key={label} onClick={() => setActiveTab(tab)}
                    className="transition-colors hover:text-white"
                    style={{ fontSize: 12, letterSpacing: '0.05em', color: '#cbc3d7' }}>
                    {label}
                  </button>
                ))}
                <span className="flex items-center gap-2" style={{ fontSize: 12, color: '#cbc3d7', letterSpacing: '0.05em' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: '#34d399' }} /> System Active
                </span>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* ── Dashboard ──────────────────────────────────────────────────── */}
      {!showHero && (
        <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-16" style={{ paddingTop: activeTab === 'explorer' ? 0 : 32 }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-7 h-7 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: '#d0bcff' }} />
              <p className="text-xs" style={{ color: '#697386' }}>Loading dashboard data…</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <ExecutiveOverview companies={companies} sectors={sectors} kpis={kpis} onNavigateToExplorer={navigateToExplorer} />}
              {activeTab === 'explorer' && <CompanyExplorer companies={companies} onViewForecast={navigateToForecast} onViewAI={navigateToAI} initialSector={explorerSector} initialSignal={explorerSignal} />}
              {activeTab === 'forecast' && <ForecastPerformance companies={companies} actualVsPredicted={actualVsPredicted} futureForecast={futureForecast} defaultSymbol={selectedCompany?.symbol} />}
              {activeTab === 'sector' && <SectorComparison sectors={sectors} onNavigateToExplorer={navigateToExplorer} />}
              {activeTab === 'matrix' && <RiskOpportunityMatrix companies={companies} onSelectCompany={navigateToForecast} />}
              {activeTab === 'ai' && <AIAnalyst companies={companies} sectors={sectors} defaultCompany={selectedCompany} defaultQuestion={aiDefaultQuestion} />}
              {activeTab === 'learn' && <LearnTab onAskAI={navigateToAIWithQuestion} />}
            </>
          )}
        </main>
      )}
    </div>
  )
}
