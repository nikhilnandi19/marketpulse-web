/** Portfolio risk lab is behind a flag until launch. Off means the old Watchlist is shown. */
export const RISK_LAB = process.env.NEXT_PUBLIC_RISK_LAB === '1'

/** What the saved list of stocks is called in the UI. */
export const LIST_NAME = RISK_LAB ? 'Portfolio' : 'Watchlist'
export const LIST_NAME_LOWER = LIST_NAME.toLowerCase()
