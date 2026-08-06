import WebSocket from "ws";

const COINBASE_WEBSOCKET_URL =
  "wss://advanced-trade-ws.coinbase.com";

const PRODUCT_IDS = [
  "BTC-USD",
  "ETH-USD",
  "SOL-USD",
];

const marketPrices = new Map();

let websocket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let serviceStarted = false;

function createInitialMarketRecord(productId) {
  return {
    productId,
    symbol: productId.split("-")[0],
    price: null,
    open24h: null,
    high24h: null,
    low24h: null,
    volume24h: null,
    change24h: null,
    updatedAt: null,
  };
}

for (const productId of PRODUCT_IDS) {
  marketPrices.set(
    productId,
    createInitialMarketRecord(productId)
  );
}

function parseNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function calculatePercentageChange(
  currentPrice,
  openPrice
) {
  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(openPrice) ||
    openPrice <= 0
  ) {
    return null;
  }

  return Number(
    (
      ((currentPrice - openPrice) /
        openPrice) *
      100
    ).toFixed(2)
  );
}

function calculateOpenPrice(
  currentPrice,
  percentageChange
) {
  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(percentageChange)
  ) {
    return null;
  }

  const changeMultiplier =
    1 + percentageChange / 100;

  if (changeMultiplier <= 0) {
    return null;
  }

  return Number(
    (
      currentPrice / changeMultiplier
    ).toFixed(2)
  );
}

function updateTickerData(message) {
  const productId = message.product_id;

  if (
    !productId ||
    !PRODUCT_IDS.includes(productId)
  ) {
    return;
  }

  const currentPrice = parseNumber(
    message.price
  );

  if (!Number.isFinite(currentPrice)) {
    return;
  }

  const directOpen24h = parseNumber(
    message.open_24h
  );

  const high24h = parseNumber(
    message.high_24h
  );

  const low24h = parseNumber(
    message.low_24h
  );

  const volume24h = parseNumber(
    message.volume_24h
  );

  const directChange24h = parseNumber(
    message.price_percent_chg_24h
  );

  let change24h = directChange24h;
  let open24h = directOpen24h;

  /*
    Advanced Trade ticker provides the
    24-hour percentage change directly.

    It does not normally provide open_24h,
    so we calculate the approximate 24-hour
    opening price from the percentage change.
  */
  if (
    !Number.isFinite(open24h) &&
    Number.isFinite(change24h)
  ) {
    open24h = calculateOpenPrice(
      currentPrice,
      change24h
    );
  }

  /*
    Older Coinbase ticker messages can provide
    open_24h instead of percentage change.
  */
  if (
    !Number.isFinite(change24h) &&
    Number.isFinite(open24h)
  ) {
    change24h = calculatePercentageChange(
      currentPrice,
      open24h
    );
  }

  const previousRecord =
    marketPrices.get(productId);

  const updatedMarketRecord = {
    productId,
    symbol: productId.split("-")[0],
    price: currentPrice,

    open24h: Number.isFinite(open24h)
      ? open24h
      : previousRecord?.open24h ?? null,

    high24h: Number.isFinite(high24h)
      ? high24h
      : previousRecord?.high24h ?? null,

    low24h: Number.isFinite(low24h)
      ? low24h
      : previousRecord?.low24h ?? null,

    volume24h: Number.isFinite(volume24h)
      ? volume24h
      : previousRecord?.volume24h ?? null,

    change24h: Number.isFinite(change24h)
      ? Number(change24h.toFixed(2))
      : previousRecord?.change24h ?? null,

    updatedAt:
      message.time ||
      new Date().toISOString(),
  };

  marketPrices.set(
    productId,
    updatedMarketRecord
  );
}

function handleAdvancedTickerMessage(message) {
  if (!Array.isArray(message.events)) {
    return;
  }

  for (const event of message.events) {
    if (!Array.isArray(event.tickers)) {
      continue;
    }

    for (const ticker of event.tickers) {
      updateTickerData({
        product_id: ticker.product_id,
        price: ticker.price,
        open_24h: ticker.open_24_h,
        high_24h: ticker.high_24_h,
        low_24h: ticker.low_24_h,
        volume_24h: ticker.volume_24_h,

        price_percent_chg_24h:
          ticker.price_percent_chg_24_h,

        time: message.timestamp,
      });
    }
  }
}

function handleWebSocketMessage(rawMessage) {
  try {
    const message = JSON.parse(
      rawMessage.toString()
    );

    /*
      Coinbase Advanced Trade ticker format.
    */
    if (message.channel === "ticker") {
      handleAdvancedTickerMessage(message);
      return;
    }

    /*
      Older Coinbase Exchange ticker format.
    */
    if (
      message.type === "ticker" &&
      message.product_id
    ) {
      updateTickerData({
        product_id: message.product_id,
        price: message.price,
        open_24h: message.open_24h,
        high_24h: message.high_24h,
        low_24h: message.low_24h,
        volume_24h: message.volume_24h,

        price_percent_chg_24h:
          message.price_percent_chg_24h,

        time: message.time,
      });

      return;
    }

    if (
      message.type === "error" ||
      message.channel === "error"
    ) {
      console.error(
        "Coinbase WebSocket error message:",
        message
      );
    }
  } catch (error) {
    console.error(
      "Could not process Coinbase message:",
      error.message
    );
  }
}

function subscribeToCoinbaseChannels() {
  if (
    !websocket ||
    websocket.readyState !== WebSocket.OPEN
  ) {
    return;
  }

  const tickerSubscription = {
    type: "subscribe",
    product_ids: PRODUCT_IDS,
    channel: "ticker",
  };

  const heartbeatSubscription = {
    type: "subscribe",
    channel: "heartbeats",
  };

  websocket.send(
    JSON.stringify(tickerSubscription)
  );

  websocket.send(
    JSON.stringify(heartbeatSubscription)
  );

  console.log(
    "Subscribed to Coinbase ticker and heartbeat channels."
  );
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  reconnectAttempts += 1;

  const delay = Math.min(
    1000 * 2 ** reconnectAttempts,
    30000
  );

  console.log(
    `Reconnecting to Coinbase in ${
      delay / 1000
    } second(s)...`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToCoinbase();
  }, delay);
}

function connectToCoinbase() {
  if (
    websocket &&
    (
      websocket.readyState ===
        WebSocket.OPEN ||
      websocket.readyState ===
        WebSocket.CONNECTING
    )
  ) {
    return;
  }

  console.log(
    "Connecting to Coinbase market data..."
  );

  websocket = new WebSocket(
    COINBASE_WEBSOCKET_URL
  );

  websocket.on("open", () => {
    reconnectAttempts = 0;

    console.log(
      "Coinbase market WebSocket connected."
    );

    subscribeToCoinbaseChannels();
  });

  websocket.on("message", (rawMessage) => {
    handleWebSocketMessage(rawMessage);
  });

  websocket.on("error", (error) => {
    console.error(
      "Coinbase WebSocket connection error:",
      error.message
    );
  });

  websocket.on("close", (code, reason) => {
    console.log(
      `Coinbase WebSocket disconnected. Code: ${code}. Reason: ${
        reason?.toString() ||
        "No reason provided"
      }`
    );

    websocket = null;

    scheduleReconnect();
  });
}

function startMarketDataService() {
  if (serviceStarted) {
    return;
  }

  serviceStarted = true;
  connectToCoinbase();
}

function getMarketData(productId) {
  const normalizedProductId = String(
    productId
  ).toUpperCase();

  return (
    marketPrices.get(normalizedProductId) ||
    null
  );
}

function getCurrentPrice(productId) {
  const marketData =
    getMarketData(productId);

  if (
    !marketData ||
    !Number.isFinite(marketData.price)
  ) {
    return null;
  }

  return marketData.price;
}

function getAllMarketData() {
  return Array.from(
    marketPrices.values()
  );
}

function isMarketDataReady() {
  return PRODUCT_IDS.every((productId) => {
    const market =
      marketPrices.get(productId);

    return Number.isFinite(
      market?.price
    );
  });
}

export {
  startMarketDataService,
  getMarketData,
  getCurrentPrice,
  getAllMarketData,
  isMarketDataReady,
};