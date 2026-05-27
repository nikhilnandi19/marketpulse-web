# scripts/01_fetch_live_prices.py

from pathlib import Path
import time

import pandas as pd
import yfinance as yf


TICKER_SOURCE_PATH = Path("public/data/marketpulse_dashboard_company_summary.csv")
OUTPUT_PATH = Path("data/live/sp500_prices_live.csv")

YFINANCE_PERIOD = "3y"
CHUNK_SIZE = 75


def to_yfinance_symbol(symbol: str) -> str:
    return symbol.upper().strip().replace(".", "-")


def load_symbols() -> list[str]:
    if not TICKER_SOURCE_PATH.exists():
        raise FileNotFoundError(f"Missing ticker source file: {TICKER_SOURCE_PATH}")

    df = pd.read_csv(TICKER_SOURCE_PATH)

    if "symbol" not in df.columns:
        raise ValueError("Ticker source CSV must contain a 'symbol' column.")

    symbols = (
        df["symbol"]
        .dropna()
        .astype(str)
        .str.upper()
        .str.strip()
        .drop_duplicates()
        .sort_values()
        .tolist()
    )

    if not symbols:
        raise ValueError("No symbols found.")

    return symbols


def chunk_list(items: list[str], chunk_size: int) -> list[list[str]]:
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]


def normalize_price_frame(df: pd.DataFrame, original_symbol: str) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["date", "symbol", "open", "high", "low", "close", "volume"])

    df = df.reset_index()

    df = df.rename(
        columns={
            "Date": "date",
            "Datetime": "date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )

    required_cols = ["date", "open", "high", "low", "close", "volume"]

    if not all(col in df.columns for col in required_cols):
        return pd.DataFrame(columns=["date", "symbol", "open", "high", "low", "close", "volume"])

    df["symbol"] = original_symbol

    return df[["date", "symbol", "open", "high", "low", "close", "volume"]]


def download_chunk(original_symbols: list[str]) -> pd.DataFrame:
    yf_symbols = [to_yfinance_symbol(symbol) for symbol in original_symbols]

    yf_to_original = {
        to_yfinance_symbol(symbol): symbol
        for symbol in original_symbols
    }

    print(f"Downloading {len(yf_symbols)} tickers...")

    raw = yf.download(
        tickers=yf_symbols,
        period=YFINANCE_PERIOD,
        interval="1d",
        group_by="ticker",
        auto_adjust=False,
        actions=False,
        threads=True,
        progress=False,
    )

    rows = []

    if raw.empty:
        return pd.DataFrame(columns=["date", "symbol", "open", "high", "low", "close", "volume"])

    for yf_symbol in yf_symbols:
        try:
            if isinstance(raw.columns, pd.MultiIndex):
                if yf_symbol not in raw.columns.get_level_values(0):
                    continue

                one = raw[yf_symbol].copy()
            else:
                one = raw.copy()

            clean_one = normalize_price_frame(one, yf_to_original[yf_symbol])

            if not clean_one.empty:
                rows.append(clean_one)

        except Exception as exc:
            print(f"Warning: failed to process {yf_symbol}: {exc}")

    if not rows:
        return pd.DataFrame(columns=["date", "symbol", "open", "high", "low", "close", "volume"])

    return pd.concat(rows, ignore_index=True)


def download_single_symbol(original_symbol: str) -> pd.DataFrame:
    yf_symbol = to_yfinance_symbol(original_symbol)

    print(f"Retrying single ticker: {original_symbol} as {yf_symbol}")

    try:
        ticker = yf.Ticker(yf_symbol)

        raw = ticker.history(
            period=YFINANCE_PERIOD,
            interval="1d",
            auto_adjust=False,
            actions=False,
        )

        clean_one = normalize_price_frame(raw, original_symbol)

        return clean_one

    except Exception as exc:
        print(f"Retry failed for {original_symbol}: {exc}")
        return pd.DataFrame(columns=["date", "symbol", "open", "high", "low", "close", "volume"])


def clean_prices(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
    df["symbol"] = df["symbol"].astype(str).str.upper().str.strip()

    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["date", "symbol", "close"])

    df = (
        df
        .sort_values(["symbol", "date"])
        .drop_duplicates(subset=["symbol", "date"], keep="last")
        .reset_index(drop=True)
    )

    return df[["date", "symbol", "open", "high", "low", "close", "volume"]]


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    symbols = load_symbols()

    print(f"Symbols found: {len(symbols)}")
    print(f"yfinance period: {YFINANCE_PERIOD}")

    all_chunks = []

    chunks = chunk_list(symbols, CHUNK_SIZE)

    for index, chunk in enumerate(chunks, start=1):
        print(f"\nChunk {index} of {len(chunks)}")
        chunk_df = download_chunk(chunk)
        all_chunks.append(chunk_df)
        time.sleep(1)

    prices = clean_prices(pd.concat(all_chunks, ignore_index=True))

    downloaded_symbols = set(prices["symbol"].unique())
    missing_symbols = sorted(set(symbols) - downloaded_symbols)

    if missing_symbols:
        print("\nInitial missing symbols:")
        for symbol in missing_symbols:
            print(symbol)

        retry_frames = []

        print("\nRetrying missing symbols one by one...")

        for symbol in missing_symbols:
            retry_df = download_single_symbol(symbol)

            if not retry_df.empty:
                retry_frames.append(retry_df)

            time.sleep(1)

        if retry_frames:
            retry_prices = clean_prices(pd.concat(retry_frames, ignore_index=True))
            prices = clean_prices(pd.concat([prices, retry_prices], ignore_index=True))

    prices.to_csv(OUTPUT_PATH, index=False)

    downloaded_symbols = set(prices["symbol"].unique())
    final_missing_symbols = sorted(set(symbols) - downloaded_symbols)

    print("\nSaved:", OUTPUT_PATH)
    print(f"Rows: {len(prices):,}")
    print(f"Symbols downloaded: {prices['symbol'].nunique():,}")
    print(f"Earliest date: {prices['date'].min()}")
    print(f"Latest date: {prices['date'].max()}")

    if final_missing_symbols:
        print("\nFinal missing symbols:")
        for symbol in final_missing_symbols:
            print(symbol)
    else:
        print("\nFinal missing symbols: none")


if __name__ == "__main__":
    main()
