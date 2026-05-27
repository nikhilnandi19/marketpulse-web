import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are MarketPulse AI Analyst, a finance analytics assistant embedded in an educational S&P 500 forecasting dashboard.

Your role:
- Explain dashboard metrics clearly and cautiously in plain English
- Only use the provided dashboard data and selected company/sector context
- Never provide buy/sell recommendations
- Never claim certainty about future stock prices
- Always mention model reliability, volatility, and limitations when discussing forecasts
- If required data is missing, say so clearly
- Keep responses concise (3-6 sentences typically) but informative
- Be analytical but approachable — no jargon overload
- Always include a brief limitation note when discussing forecasts

Key metric definitions to use:
- MAPE (Mean Absolute Percentage Error): lower is better; <2% = strong, 2-5% = acceptable, >5% = high error
- Annualized Volatility: <20% = lower risk, 20-35% = moderate, >35% = high risk
- Forecast upside: % difference between forecast price and current price
- Final Signal: screening label combining forecast direction, model reliability, volatility, and fundamentals — NOT a buy/sell recommendation
- Adaptive Momentum: the main directional forecast, blends 5D/10D/21D/63D/252D momentum with damping

Always end responses with: "⚠️ This is an educational dashboard — not financial advice."`

export async function POST(req: NextRequest) {
  const apiKey =
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY

  console.log('AI API env check:', {
    OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
    resolved: Boolean(apiKey),
  })

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API key on server.' },
      { status: 500 }
    )
  }

  let body: { messages: { role: string; content: string }[]; context?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, context } = body
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const lastUserMsg = messages[messages.length - 1]
  const enrichedContent = context
    ? `Context from dashboard:\n${context}\n\nUser question: ${lastUserMsg.content}`
    : lastUserMsg.content

  const openRouterMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: enrichedContent },
  ]

  const MODELS = [
    'openai/gpt-oss-20b:free',
    'openai/gpt-oss-120b:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-4-31b-it:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
  ]

  for (const model of MODELS) {
    try {
      console.log('Trying model:', model)
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://marketpulse-web-five.vercel.app',
          'X-Title': 'MarketPulse AI Analyst',
        },
        body: JSON.stringify({
          model,
          messages: openRouterMessages,
          max_tokens: 512,
          temperature: 0.4,
        }),
      })

      if (response.status === 429 || response.status === 404) {
        console.warn(`Model ${model} unavailable (${response.status}), trying next...`)
        continue
      }

      if (!response.ok) {
        const errText = await response.text()
        console.error('OpenRouter error:', response.status, errText)
        continue
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content ?? 'No response generated.'
      console.log('Success with model:', model)
      return NextResponse.json({ response: text })
    } catch (err) {
      console.warn(`Model ${model} threw error, trying next:`, err)
      continue
    }
  }

  return NextResponse.json(
    { error: 'All AI models are currently unavailable. Please try again in a few minutes.' },
    { status: 503 }
  )
}
