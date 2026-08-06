import {
  getAllMarketData,
  getMarketData,
  isMarketDataReady,
} from "../services/marketDataService.js";

const COINBASE_EXCHANGE_API_URL =
  "https://api.exchange.coinbase.com";

const SUPPORTED_PRODUCTS = [
  "BTC-USD",
  "ETH-USD",
  "SOL-USD",
];

const TIMEFRAME_CONFIG = {
  "1m": {
    coinbaseGranularity: 60,
    candleSeconds: 60,
    aggregateCount: 1,
  },

  "5m": {
    coinbaseGranularity: 300,
    candleSeconds: 300,
    aggregateCount: 1,
  },

  "15m": {
    coinbaseGranularity: 900,
    candleSeconds: 900,
    aggregateCount: 1,
  },

  "1h": {
    coinbaseGranularity: 3600,
    candleSeconds: 3600,
    aggregateCount: 1,
  },

  /*
    Coinbase Exchange does not provide a
    native four-hour granularity.

    We fetch one-hour candles and combine
    every four candles into one 4-hour candle.
  */
  "4h": {
    coinbaseGranularity: 3600,
    candleSeconds: 14400,
    aggregateCount: 4,
  },

  "1d": {
    coinbaseGranularity: 86400,
    candleSeconds: 86400,
    aggregateCount: 1,
  },
};

function normalizeProductId(productId) {
  return String(productId || "")
    .trim()
    .toUpperCase();
}

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return Math.min(number, maximum);
}

function normalizeCoinbaseCandle(candle) {
  if (
    !Array.isArray(candle) ||
    candle.length < 6
  ) {
    return null;
  }

  const [
    time,
    low,
    high,
    open,
    close,
    volume,
  ] = candle;

  const normalizedCandle = {
    time: Number(time),
    low: Number(low),
    high: Number(high),
    open: Number(open),
    close: Number(close),
    volume: Number(volume),
  };

  const values = [
    normalizedCandle.time,
    normalizedCandle.low,
    normalizedCandle.high,
    normalizedCandle.open,
    normalizedCandle.close,
    normalizedCandle.volume,
  ];

  if (
    !values.every((value) =>
      Number.isFinite(value)
    )
  ) {
    return null;
  }

  return normalizedCandle;
}

function aggregateCandles(
  candles,
  targetSeconds
) {
  const groupedCandles = new Map();

  for (const candle of candles) {
    const bucketStart =
      Math.floor(
        candle.time / targetSeconds
      ) * targetSeconds;

    const existingCandle =
      groupedCandles.get(bucketStart);

    if (!existingCandle) {
      groupedCandles.set(bucketStart, {
        time: bucketStart,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });

      continue;
    }

    existingCandle.high = Math.max(
      existingCandle.high,
      candle.high
    );

    existingCandle.low = Math.min(
      existingCandle.low,
      candle.low
    );

    /*
      Candles are sorted from oldest to newest,
      so every later candle updates the close.
    */
    existingCandle.close =
      candle.close;

    existingCandle.volume +=
      candle.volume;
  }

  return Array.from(
    groupedCandles.values()
  ).sort(
    (firstCandle, secondCandle) =>
      firstCandle.time -
      secondCandle.time
  );
}

async function fetchCoinbaseCandles({
  productId,
  granularity,
  requestedCandleCount,
}) {
  /*
    Coinbase Exchange returns at most
    300 candles in one request.
  */
  const maximumCoinbaseCandles = 300;

  const candleCount = Math.min(
    requestedCandleCount,
    maximumCoinbaseCandles
  );

  const endTimestamp = Math.floor(
    Date.now() / 1000
  );

  const startTimestamp =
    endTimestamp -
    granularity * candleCount;

  const queryParameters =
    new URLSearchParams({
      granularity:
        String(granularity),

      start: new Date(
        startTimestamp * 1000
      ).toISOString(),

      end: new Date(
        endTimestamp * 1000
      ).toISOString(),
    });

  const requestUrl =
    `${COINBASE_EXCHANGE_API_URL}` +
    `/products/${encodeURIComponent(
      productId
    )}/candles?${queryParameters.toString()}`;

  const response = await fetch(
    requestUrl,
    {
      method: "GET",

      headers: {
        Accept: "application/json",

        /*
          Asking Coinbase not to return a
          stale cached candle response.
        */
        "Cache-Control": "no-cache",

        "User-Agent":
          "TradeSphere-MVP/1.0",
      },
    }
  );

  const responseData =
    await response.json();

  if (!response.ok) {
    const coinbaseMessage =
      responseData?.message;

    throw new Error(
      coinbaseMessage ||
        "Coinbase could not provide historical candles."
    );
  }

  if (!Array.isArray(responseData)) {
    throw new Error(
      "Coinbase returned an unexpected candle response."
    );
  }

  return responseData
    .map(normalizeCoinbaseCandle)
    .filter(Boolean)
    .sort(
      (firstCandle, secondCandle) =>
        firstCandle.time -
        secondCandle.time
    );
}

async function getAllMarkets(
  req,
  res
) {
  try {
    return res.status(200).json({
      success: true,

      marketDataReady:
        isMarketDataReady(),

      markets:
        getAllMarketData(),
    });
  } catch (error) {
    console.error(
      "Get all markets error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Could not fetch live market data.",
    });
  }
}

async function getSingleMarket(
  req,
  res
) {
  try {
    const productId =
      normalizeProductId(
        req.params.productId
      );

    const market =
      getMarketData(productId);

    if (!market) {
      return res.status(404).json({
        success: false,

        message:
          "Market was not found.",
      });
    }

    return res.status(200).json({
      success: true,

      marketDataReady:
        isMarketDataReady(),

      market,
    });
  } catch (error) {
    console.error(
      "Get single market error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Could not fetch live market data.",
    });
  }
}

async function getHistoricalCandles(
  req,
  res
) {
  try {
    const productId =
      normalizeProductId(
        req.params.productId
      );

    if (
      !SUPPORTED_PRODUCTS.includes(
        productId
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Historical candles are currently available only for BTC-USD, ETH-USD, and SOL-USD.",
      });
    }

    const timeframe = String(
      req.query.timeframe || "1m"
    ).toLowerCase();

    const timeframeConfig =
      TIMEFRAME_CONFIG[timeframe];

    if (!timeframeConfig) {
      return res.status(400).json({
        success: false,

        message:
          "Timeframe must be 1m, 5m, 15m, 1h, 4h, or 1d.",
      });
    }

    /*
      The frontend can request up to
      200 final candles.

      120 gives a dense chart without
      making the screen too crowded.
    */
    const limit =
      parsePositiveInteger(
        req.query.limit,
        120,
        200
      );

    const sourceCandleCount =
      Math.min(
        limit *
          timeframeConfig.aggregateCount +
          timeframeConfig.aggregateCount,
        300
      );

    const sourceCandles =
      await fetchCoinbaseCandles({
        productId,

        granularity:
          timeframeConfig.coinbaseGranularity,

        requestedCandleCount:
          sourceCandleCount,
      });

    let finalCandles =
      sourceCandles;

    if (
      timeframeConfig.aggregateCount >
      1
    ) {
      finalCandles =
        aggregateCandles(
          sourceCandles,
          timeframeConfig.candleSeconds
        );
    }

    finalCandles =
      finalCandles.slice(-limit);

    if (
      finalCandles.length === 0
    ) {
      return res.status(404).json({
        success: false,

        message:
          "No historical candles were available for this market and timeframe.",
      });
    }

    return res.status(200).json({
      success: true,

      productId,

      timeframe,

      count:
        finalCandles.length,

      candles:
        finalCandles,
    });
  } catch (error) {
    console.error(
      "Get historical candles error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Could not fetch historical candles.",
    });
  }
}

export {
  getAllMarkets,
  getSingleMarket,
  getHistoricalCandles,
};