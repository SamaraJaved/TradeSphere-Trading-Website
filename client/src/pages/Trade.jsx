import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
} from "lightweight-charts";

import AppNavigation from "../components/AppNavigation";

const API_URL = "http://localhost:5000";
const HISTORICAL_CANDLE_LIMIT = 120;
const MAX_CANDLES = 200;

const marketAssets = {
  BTCUSDT: {
    routeKey: "BTCUSDT",
    symbol: "BTC",
    pair: "BTC/USD",
    name: "Bitcoin",
    productId: "BTC-USD",
    pricePrecision: 2,
  },

  ETHUSDT: {
    routeKey: "ETHUSDT",
    symbol: "ETH",
    pair: "ETH/USD",
    name: "Ethereum",
    productId: "ETH-USD",
    pricePrecision: 2,
  },

  SOLUSDT: {
    routeKey: "SOLUSDT",
    symbol: "SOL",
    pair: "SOL/USD",
    name: "Solana",
    productId: "SOL-USD",
    pricePrecision: 2,
  },
};

const cryptoPairs = Object.values(
  marketAssets
);

const forexPairs = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
];

const timeframeOptions = [
  {
    value: "1m",
    label: "1m",
    seconds: 60,
  },
  {
    value: "5m",
    label: "5m",
    seconds: 300,
  },
  {
    value: "15m",
    label: "15m",
    seconds: 900,
  },
  {
    value: "1h",
    label: "1h",
    seconds: 3600,
  },
  {
    value: "4h",
    label: "4h",
    seconds: 14400,
  },
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatSignedMoney(value) {
  const number = Number(value || 0);

  if (number > 0) {
    return `+$${formatMoney(number)}`;
  }

  if (number < 0) {
    return `-$${formatMoney(
      Math.abs(number)
    )}`;
  }

  return "$0.00";
}

function buildSparklinePoints(candles) {
  if (
    !Array.isArray(candles) ||
    candles.length < 2
  ) {
    return "";
  }

  const recentCandles = candles.slice(-40);

  const closes = recentCandles.map(
    (candle) => candle.close
  );

  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const range = maxClose - minClose || 1;

  return closes
    .map((close, index) => {
      const x =
        closes.length > 1
          ? (index / (closes.length - 1)) * 120
          : 60;

      const y =
        34 -
        ((close - minClose) / range) * 32;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function formatQuantityForChart(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

function getTimeframeSeconds(timeframe) {
  return (
    timeframeOptions.find(
      (option) =>
        option.value === timeframe
    )?.seconds || 60
  );
}

function getCandleStartTime(
  timestampMilliseconds,
  timeframeSeconds
) {
  const timestampSeconds = Math.floor(
    timestampMilliseconds / 1000
  );

  return (
    Math.floor(
      timestampSeconds /
        timeframeSeconds
    ) * timeframeSeconds
  );
}

function normalizeCandle(candle) {
  const normalizedCandle = {
    time: Number(candle.time),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  };

  const values = [
    normalizedCandle.time,
    normalizedCandle.open,
    normalizedCandle.high,
    normalizedCandle.low,
    normalizedCandle.close,
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

function updateCandlesWithLivePrice(
  previousCandles,
  price,
  timestampMilliseconds,
  timeframeSeconds
) {
  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return previousCandles;
  }

  const candleTime = getCandleStartTime(
    timestampMilliseconds,
    timeframeSeconds
  );

  if (
    previousCandles.length === 0
  ) {
    return [
      {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
      },
    ];
  }

  const candles = [
    ...previousCandles,
  ];

  const lastCandle =
    candles[candles.length - 1];

  if (
    lastCandle.time === candleTime
  ) {
    candles[candles.length - 1] = {
      ...lastCandle,

      high: Math.max(
        lastCandle.high,
        price
      ),

      low: Math.min(
        lastCandle.low,
        price
      ),

      close: price,
    };

    return candles;
  }

  if (
    candleTime >
    lastCandle.time
  ) {
    candles.push({
      time: candleTime,
      open: lastCandle.close,
      high: Math.max(
        lastCandle.close,
        price
      ),
      low: Math.min(
        lastCandle.close,
        price
      ),
      close: price,
    });

    return candles.slice(
      -MAX_CANDLES
    );
  }

  return candles;
}


const drawingTools = [
  { id: "pointer", label: "Select", icon: "↖" },
  { id: "risk-buy", label: "Buy risk/reward", icon: "↥" },
  { id: "risk-sell", label: "Sell risk/reward", icon: "↧" },
  { id: "trend", label: "Trend line", icon: "╱" },
  { id: "horizontal", label: "Horizontal line", icon: "─" },
  { id: "rectangle", label: "Rectangle", icon: "▭" },
  { id: "fibonacci", label: "Fibonacci", icon: "Φ" },
  { id: "text", label: "Add text", icon: "T" },
];

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createDrawingId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getNormalizedPoint(event, element) {
  const bounds = element.getBoundingClientRect();

  return {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height),
  };
}

function DrawingToolbar({
  activeTool,
  setActiveTool,
  selectedDrawingId,
  deleteSelectedDrawing,
  clearAllDrawings,
  openCalculator,
}) {
  return (
    <div className="chart-drawing-toolbar">
      {drawingTools.map((tool) => (
        <button
          type="button"
          key={tool.id}
          className={activeTool === tool.id ? "active" : ""}
          title={tool.label}
          aria-label={tool.label}
          onClick={() => setActiveTool(tool.id)}
        >
          {tool.icon}
        </button>
      ))}

      <span className="drawing-toolbar-divider" />

      <button
        type="button"
        title="Calculator"
        aria-label="Calculator"
        onClick={openCalculator}
      >
        🧮
      </button>

      <button
        type="button"
        title="Delete selected drawing"
        aria-label="Delete selected drawing"
        disabled={!selectedDrawingId}
        onClick={deleteSelectedDrawing}
      >
        ⌫
      </button>

      <button
        type="button"
        title="Clear all drawings"
        aria-label="Clear all drawings"
        onClick={clearAllDrawings}
      >
        ✕
      </button>
    </div>
  );
}

function ChartCalculator({ selectedAsset, onClose }) {
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [quantity, setQuantity] = useState("0.001");
  const [side, setSide] = useState("buy");

  const entryNumber = Number(entry);
  const exitNumber = Number(exit);
  const quantityNumber = Number(quantity);

  const priceDifference =
    Number.isFinite(entryNumber) && Number.isFinite(exitNumber)
      ? exitNumber - entryNumber
      : 0;

  const percentageChange =
    Number.isFinite(entryNumber) &&
    entryNumber > 0 &&
    Number.isFinite(exitNumber)
      ? (priceDifference / entryNumber) * 100
      : 0;

  const pnl =
    Number.isFinite(entryNumber) &&
    Number.isFinite(exitNumber) &&
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0
      ? side === "buy"
        ? (exitNumber - entryNumber) * quantityNumber
        : (entryNumber - exitNumber) * quantityNumber
      : 0;

  return (
    <div className="chart-calculator-panel">
      <div className="chart-calculator-heading">
        <div>
          <strong>Trade calculator</strong>
          <span>{selectedAsset.pair}</span>
        </div>

        <button
          type="button"
          aria-label="Close calculator"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <label>
        Side
        <select value={side} onChange={(event) => setSide(event.target.value)}>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </label>

      <label>
        Entry price
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Entry"
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
        />
      </label>

      <label>
        Exit price
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Exit"
          value={exit}
          onChange={(event) => setExit(event.target.value)}
        />
      </label>

      <label>
        Quantity
        <input
          type="number"
          min="0"
          step="0.001"
          placeholder="Quantity"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </label>

      <div className="calculator-results">
        <span>
          Price difference
          <strong>{formatSignedMoney(priceDifference)}</strong>
        </span>

        <span>
          Percentage change
          <strong>
            {percentageChange >= 0 ? "+" : ""}
            {percentageChange.toFixed(2)}%
          </strong>
        </span>

        <span>
          Estimated PnL
          <strong className={pnl >= 0 ? "trade-positive" : "trade-negative"}>
            {formatSignedMoney(pnl)}
          </strong>
        </span>
      </div>
    </div>
  );
}

function DrawingLayer({
  drawings,
  draftDrawing,
  activeTool,
  selectedDrawingId,
  setSelectedDrawingId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onEdgePointerDown,
  onEdgePointerMove,
  onEdgePointerUp,
}) {
  const visibleDrawings = draftDrawing
    ? [...drawings, { ...draftDrawing, id: "draft-drawing" }]
    : drawings;

  function percentX(value) {
    return `${value * 100}%`;
  }

  function percentY(value) {
    return `${value * 100}%`;
  }

  function handleDrawingClick(event, drawingId) {
    event.stopPropagation();

    if (activeTool === "pointer" && drawingId !== "draft-drawing") {
      setSelectedDrawingId(drawingId);
    }
  }

  return (
    <svg
      className={`chart-drawing-layer ${
        activeTool === "pointer"
          ? "pointer-mode"
          : activeTool === "risk-buy" ||
              activeTool === "risk-sell"
            ? "risk-native-mode"
            : "drawing-mode"
      }`}
      viewBox="0 0 1000 520"
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={() => {
        if (activeTool === "pointer") {
          setSelectedDrawingId("");
        }
      }}
    >
      {visibleDrawings.map((drawing) => {
        const isSelected =
          selectedDrawingId === drawing.id ||
          drawing.id === "position-edit";
        const stroke = isSelected ? "#16a34a" : "#2563eb";
        const strokeWidth = isSelected ? 3 : 2;

        if (drawing.type === "horizontal") {
          return (
            <line
              key={drawing.id}
              x1="0"
              x2="1000"
              y1={drawing.start.y * 520}
              y2={drawing.start.y * 520}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray="8 6"
              vectorEffect="non-scaling-stroke"
              onClick={(event) => handleDrawingClick(event, drawing.id)}
            />
          );
        }

        if (drawing.type === "trend") {
          return (
            <line
              key={drawing.id}
              x1={drawing.start.x * 1000}
              y1={drawing.start.y * 520}
              x2={drawing.end.x * 1000}
              y2={drawing.end.y * 520}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              onClick={(event) => handleDrawingClick(event, drawing.id)}
            />
          );
        }

        if (drawing.type === "rectangle") {
          const x = Math.min(drawing.start.x, drawing.end.x) * 1000;
          const y = Math.min(drawing.start.y, drawing.end.y) * 520;
          const width = Math.abs(drawing.end.x - drawing.start.x) * 1000;
          const height = Math.abs(drawing.end.y - drawing.start.y) * 520;

          return (
            <rect
              key={drawing.id}
              x={x}
              y={y}
              width={width}
              height={height}
              fill="rgba(37, 99, 235, 0.10)"
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              onClick={(event) => handleDrawingClick(event, drawing.id)}
            />
          );
        }

        if (
          drawing.type === "risk-buy" ||
          drawing.type === "risk-sell"
        ) {
          const left = Math.min(drawing.start.x, drawing.end.x) * 1000;
          const right = Math.max(drawing.start.x, drawing.end.x) * 1000;
          const top = Math.min(drawing.start.y, drawing.end.y) * 520;
          const bottom = Math.max(drawing.start.y, drawing.end.y) * 520;
          const entry = clamp(drawing.entryY ?? 0.5) * 520;
          const width = Math.max(right - left, 96);
          const side = drawing.side || (drawing.type === "risk-buy" ? "buy" : "sell");
          const topFill = side === "buy"
            ? "rgba(22, 163, 74, 0.16)"
            : "rgba(220, 38, 38, 0.16)";
          const bottomFill = side === "buy"
            ? "rgba(220, 38, 38, 0.16)"
            : "rgba(22, 163, 74, 0.16)";

          const topZoneHeight = entry - top;
          const bottomZoneHeight = bottom - entry;

          const LABEL_FONT_SIZE = 9.5;
          const LABEL_CHIP_HEIGHT = 16;
          const LABEL_MIN_ZONE = 18;

          function estimateChipWidth(text) {
            return Math.min(
              Math.max(text.length * 5.6 + 12, 46),
              Math.max(width - 8, 46)
            );
          }

          const topLabelSide = side === "buy" ? "TP" : "SL";
          const bottomLabelSide = side === "buy" ? "SL" : "TP";

          const topLabelPrice = side === "buy"
            ? drawing.takeProfit
            : drawing.stopLoss;

          const bottomLabelPrice = side === "buy"
            ? drawing.stopLoss
            : drawing.takeProfit;

          const topLabelText = `${topLabelSide} $${formatMoney(topLabelPrice)}`;
          const bottomLabelText = `${bottomLabelSide} $${formatMoney(bottomLabelPrice)}`;
          const entryLabelText = `ENTRY $${formatMoney(drawing.entryPrice)}`;

          const topLabelColor = side === "buy" ? "#166534" : "#991b1b";
          const bottomLabelColor = side === "buy" ? "#991b1b" : "#166534";

          const topLabelY = top + topZoneHeight / 2;
          const bottomLabelY = entry + bottomZoneHeight / 2;

          const topLabelWidth = estimateChipWidth(topLabelText);
          const bottomLabelWidth = estimateChipWidth(bottomLabelText);
          const entryLabelWidth = estimateChipWidth(entryLabelText);

          return (
            <g
              key={drawing.id}
              onClick={(event) => handleDrawingClick(event, drawing.id)}
            >
              <rect
                x={left}
                y={top}
                width={width}
                height={Math.max(entry - top, 0)}
                fill={topFill}
                stroke="none"
              />

              <rect
                x={left}
                y={entry}
                width={width}
                height={Math.max(bottom - entry, 0)}
                fill={bottomFill}
                stroke="none"
              />

              <rect
                x={left}
                y={top}
                width={width}
                height={Math.max(bottom - top, 1)}
                fill="transparent"
                stroke={isSelected ? "#16a34a" : "#475569"}
                strokeWidth={strokeWidth}
                vectorEffect="non-scaling-stroke"
              />

              <line
                x1={left}
                x2={left + width}
                y1={entry}
                y2={entry}
                stroke="#0f172a"
                strokeWidth="2"
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />

              {topZoneHeight >= LABEL_MIN_ZONE && (
                <g>
                  <rect
                    x={left + 4}
                    y={
                      topLabelY -
                      LABEL_CHIP_HEIGHT / 2
                    }
                    width={topLabelWidth}
                    height={LABEL_CHIP_HEIGHT}
                    rx={3}
                    fill="#ffffff"
                    stroke={topLabelColor}
                    strokeWidth={1}
                  />

                  <text
                    x={
                      left +
                      4 +
                      topLabelWidth / 2
                    }
                    y={
                      topLabelY +
                      LABEL_FONT_SIZE * 0.33
                    }
                    fill={topLabelColor}
                    fontSize={LABEL_FONT_SIZE}
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {topLabelText}
                  </text>
                </g>
              )}

              <g>
                <rect
                  x={left + 4}
                  y={
                    entry -
                    LABEL_CHIP_HEIGHT / 2
                  }
                  width={entryLabelWidth}
                  height={LABEL_CHIP_HEIGHT}
                  rx={3}
                  fill="#0f172a"
                  stroke="#0f172a"
                  strokeWidth={1}
                />

                <text
                  x={
                    left +
                    4 +
                    entryLabelWidth / 2
                  }
                  y={
                    entry +
                    LABEL_FONT_SIZE * 0.33
                  }
                  fill="#ffffff"
                  fontSize={LABEL_FONT_SIZE}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {entryLabelText}
                </text>
              </g>

              {bottomZoneHeight >= LABEL_MIN_ZONE && (
                <g>
                  <rect
                    x={left + 4}
                    y={
                      bottomLabelY -
                      LABEL_CHIP_HEIGHT / 2
                    }
                    width={bottomLabelWidth}
                    height={LABEL_CHIP_HEIGHT}
                    rx={3}
                    fill="#ffffff"
                    stroke={bottomLabelColor}
                    strokeWidth={1}
                  />

                  <text
                    x={
                      left +
                      4 +
                      bottomLabelWidth / 2
                    }
                    y={
                      bottomLabelY +
                      LABEL_FONT_SIZE * 0.33
                    }
                    fill={bottomLabelColor}
                    fontSize={LABEL_FONT_SIZE}
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {bottomLabelText}
                  </text>
                </g>
              )}

              {isSelected &&
                activeTool === "pointer" &&
                drawing.id !== "draft-drawing" && (
                  <>
                    <line
                      x1={left}
                      x2={left + width}
                      y1={top}
                      y2={top}
                      stroke="transparent"
                      strokeWidth={16}
                      pointerEvents="stroke"
                      style={{ cursor: "ns-resize" }}
                      onPointerDown={(event) =>
                        onEdgePointerDown(event, drawing, "top")
                      }
                      onPointerMove={onEdgePointerMove}
                      onPointerUp={onEdgePointerUp}
                      onPointerCancel={onEdgePointerUp}
                    />

                    <rect
                      x={left + width / 2 - 14}
                      y={top - 5}
                      width={28}
                      height={10}
                      rx={5}
                      fill="#ffffff"
                      stroke={side === "buy" ? "#16a34a" : "#dc2626"}
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />

                    <line
                      x1={left}
                      x2={left + width}
                      y1={bottom}
                      y2={bottom}
                      stroke="transparent"
                      strokeWidth={16}
                      pointerEvents="stroke"
                      style={{ cursor: "ns-resize" }}
                      onPointerDown={(event) =>
                        onEdgePointerDown(event, drawing, "bottom")
                      }
                      onPointerMove={onEdgePointerMove}
                      onPointerUp={onEdgePointerUp}
                      onPointerCancel={onEdgePointerUp}
                    />

                    <rect
                      x={left + width / 2 - 14}
                      y={bottom - 5}
                      width={28}
                      height={10}
                      rx={5}
                      fill="#ffffff"
                      stroke={side === "buy" ? "#dc2626" : "#16a34a"}
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
                  </>
                )}
            </g>
          );
        }

        if (drawing.type === "fibonacci") {
          const levels = [
            { value: 0, label: "0%" },
            { value: 0.236, label: "23.6%" },
            { value: 0.382, label: "38.2%" },
            { value: 0.5, label: "50%" },
            { value: 0.618, label: "61.8%" },
            { value: 0.786, label: "78.6%" },
            { value: 1, label: "100%" },
          ];

          const left = Math.min(drawing.start.x, drawing.end.x) * 1000;
          const right = Math.max(drawing.start.x, drawing.end.x) * 1000;

          return (
            <g
              key={drawing.id}
              onClick={(event) => handleDrawingClick(event, drawing.id)}
            >
              {levels.map((level) => {
                const y =
                  (drawing.start.y +
                    (drawing.end.y - drawing.start.y) * level.value) *
                  520;

                return (
                  <g key={level.value}>
                    <line
                      x1={left}
                      x2={right}
                      y1={y}
                      y2={y}
                      stroke={stroke}
                      strokeWidth={level.value === 0.5 ? strokeWidth : 1.5}
                      strokeDasharray={level.value === 0.5 ? "0" : "7 5"}
                      vectorEffect="non-scaling-stroke"
                    />

                    <text
                      x={left + 6}
                      y={y - 5}
                      fill={stroke}
                      fontSize="12"
                      fontWeight="700"
                    >
                      {level.label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        }

        if (drawing.type === "text") {
          return (
            <text
              key={drawing.id}
              x={drawing.start.x * 1000}
              y={drawing.start.y * 520}
              fill={stroke}
              fontSize="18"
              fontWeight="700"
              paintOrder="stroke"
              stroke="#ffffff"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              onClick={(event) => handleDrawingClick(event, drawing.id)}
            >
              {drawing.text}
            </text>
          );
        }

        return null;
      })}
    </svg>
  );
}

function TradingChart({
  candles,
  chartType,
  selectedAsset,
  isLoadingCandles,
  currentPrice,
  quantity,
  setStopLoss,
  setTakeProfit,
  openPositions,
  clearRiskSetupSignal,
  requestConfirmation,
  editingPosition,
  onPositionRiskEdit,
}) {
  const chartContainerRef =
    useRef(null);

  const drawingLayerRef =
    useRef(null);

  const chartRef = useRef(null);

  const candleSeriesRef =
    useRef(null);

  const lineSeriesRef =
    useRef(null);

  const hasPositionedChartRef =
    useRef(false);

  const positionPriceLinesRef =
    useRef([]);

  const hasReceivedClearSignalRef =
    useRef(false);

  const currentPriceRef =
    useRef(currentPrice);

  const quantityRef =
    useRef(quantity);

  const chartTypeRef =
    useRef(chartType);

  const [activeTool, setActiveTool] =
    useState("pointer");

  const [drawings, setDrawings] =
    useState([]);

  const [draftDrawing, setDraftDrawing] =
    useState(null);

  const [selectedDrawingId, setSelectedDrawingId] =
    useState("");

  const [isCalculatorOpen, setIsCalculatorOpen] =
    useState(false);

  const [edgeDrag, setEdgeDrag] =
    useState(null);

  const [positionEditDrawing, setPositionEditDrawing] =
    useState(null);

  const [chartWarning, setChartWarning] =
    useState("");

  const [isConfirmingClearAll, setIsConfirmingClearAll] =
    useState(false);

  const chartWarningTimerRef = useRef(null);

  function showChartWarning(message) {
    setChartWarning(message);

    if (chartWarningTimerRef.current) {
      clearTimeout(chartWarningTimerRef.current);
    }

    chartWarningTimerRef.current = setTimeout(() => {
      setChartWarning("");
      chartWarningTimerRef.current = null;
    }, 4000);
  }

  function dismissChartWarning() {
    if (chartWarningTimerRef.current) {
      clearTimeout(chartWarningTimerRef.current);
      chartWarningTimerRef.current = null;
    }

    setChartWarning("");
  }

  useEffect(() => {
    return () => {
      if (chartWarningTimerRef.current) {
        clearTimeout(chartWarningTimerRef.current);
      }
    };
  }, []);

  const storageKey =
    `tradesphere-drawings-${selectedAsset.productId}`;

  useEffect(() => {
    currentPriceRef.current = currentPrice;
  }, [currentPrice]);

  useEffect(() => {
    if (!hasReceivedClearSignalRef.current) {
      hasReceivedClearSignalRef.current = true;
      return;
    }

    setDrawings((previousDrawings) =>
      previousDrawings.filter(
        (drawing) =>
          drawing.type !== "risk-buy" &&
          drawing.type !== "risk-sell"
      )
    );

    setDraftDrawing(null);
    setSelectedDrawingId("");
    setActiveTool("pointer");
  }, [clearRiskSetupSignal]);

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  useEffect(() => {
    chartTypeRef.current = chartType;
  }, [chartType]);

  useEffect(() => {
    if (!editingPosition) {
      setPositionEditDrawing(null);
      return;
    }

    const activeSeries =
      chartTypeRef.current === "line"
        ? lineSeriesRef.current
        : candleSeriesRef.current;

    const container =
      chartContainerRef.current;

    if (!activeSeries || !container) {
      setPositionEditDrawing(null);
      return;
    }

    const bounds =
      container.getBoundingClientRect();

    if (!bounds.height) {
      setPositionEditDrawing(null);
      return;
    }

    const side = editingPosition.side;
    const entryPrice = Number(
      editingPosition.entryPrice
    );

    const fallbackOffset =
      entryPrice * 0.01;

    const storedStopLoss = Number(
      editingPosition.stopLoss
    );

    const storedTakeProfit = Number(
      editingPosition.takeProfit
    );

    const stopLossPrice =
      Number.isFinite(storedStopLoss) &&
      storedStopLoss > 0
        ? storedStopLoss
        : side === "buy"
          ? entryPrice - fallbackOffset
          : entryPrice + fallbackOffset;

    const takeProfitPrice =
      Number.isFinite(
        storedTakeProfit
      ) && storedTakeProfit > 0
        ? storedTakeProfit
        : side === "buy"
          ? entryPrice + fallbackOffset
          : entryPrice - fallbackOffset;

    const entryCoordinate =
      activeSeries.priceToCoordinate(
        entryPrice
      );

    const stopLossCoordinate =
      activeSeries.priceToCoordinate(
        stopLossPrice
      );

    const takeProfitCoordinate =
      activeSeries.priceToCoordinate(
        takeProfitPrice
      );

    if (
      !Number.isFinite(
        entryCoordinate
      ) ||
      !Number.isFinite(
        stopLossCoordinate
      ) ||
      !Number.isFinite(
        takeProfitCoordinate
      )
    ) {
      setPositionEditDrawing(null);
      return;
    }

    const topCoordinate =
      side === "buy"
        ? takeProfitCoordinate
        : stopLossCoordinate;

    const bottomCoordinate =
      side === "buy"
        ? stopLossCoordinate
        : takeProfitCoordinate;

    setPositionEditDrawing({
      id: "position-edit",
      type:
        side === "buy"
          ? "risk-buy"
          : "risk-sell",
      side,
      start: {
        x: 0.15,
        y: clamp(
          topCoordinate / bounds.height
        ),
      },
      end: {
        x: 0.85,
        y: clamp(
          bottomCoordinate /
            bounds.height
        ),
      },
      entryY: clamp(
        entryCoordinate / bounds.height
      ),
      entryPrice,
      stopLoss:
        editingPosition.stopLoss ??
        null,
      takeProfit:
        editingPosition.takeProfit ??
        null,
      quantity:
        editingPosition.quantity,
    });
  }, [
    editingPosition?._id,
    editingPosition?.stopLoss,
    editingPosition?.takeProfit,
    editingPosition?.entryPrice,
    editingPosition?.side,
    candles.length,
  ]);

  useEffect(() => {
    if (editingPosition?._id) {
      setActiveTool("pointer");
    }
  }, [editingPosition?._id]);

  useEffect(() => {
    try {
      const savedDrawings =
        localStorage.getItem(storageKey);

      setDrawings(
        savedDrawings
          ? JSON.parse(savedDrawings)
          : []
      );
    } catch (error) {
      console.error(
        "Could not load chart drawings:",
        error
      );

      setDrawings([]);
    }

    setSelectedDrawingId("");
    setDraftDrawing(null);
    setActiveTool("pointer");
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(drawings)
      );
    } catch (error) {
      console.error(
        "Could not save chart drawings:",
        error
      );
    }
  }, [drawings, storageKey]);

  useEffect(() => {
    const container =
      chartContainerRef.current;

    if (!container) {
      return undefined;
    }

    const chart = createChart(
      container,
      {
        width:
          container.clientWidth,

        height: 520,

        layout: {
          background: {
            type:
              ColorType.Solid,

            color: "#ffffff",
          },

          textColor:
            "#475569",

          fontFamily:
            "Inter, Arial, sans-serif",
        },

        grid: {
          vertLines: {
            color: "#e8edf3",
          },

          horzLines: {
            color: "#e8edf3",
          },
        },

        crosshair: {
          mode:
            CrosshairMode.Normal,

          vertLine: {
            visible: true,
            color: "#64748b",
            width: 1,
            style: 2,

            labelVisible: true,

            labelBackgroundColor:
              "#0f172a",
          },

          horzLine: {
            visible: true,
            color: "#64748b",
            width: 1,
            style: 2,

            labelVisible: true,

            labelBackgroundColor:
              "#0f172a",
          },
        },

        rightPriceScale: {
          visible: true,

          borderVisible: true,

          borderColor:
            "#dbe2ea",

          entireTextOnly: true,

          scaleMargins: {
            top: 0.08,
            bottom: 0.1,
          },
        },

        leftPriceScale: {
          visible: false,
        },

        timeScale: {
          visible: true,

          borderVisible: true,

          borderColor:
            "#dbe2ea",

          timeVisible: true,

          secondsVisible: false,

          rightOffset: 6,

          barSpacing: 7,

          minBarSpacing: 2,

          fixLeftEdge: false,

          fixRightEdge: false,

          lockVisibleTimeRangeOnResize:
            true,
        },

        handleScroll: {
          mouseWheel: true,

          pressedMouseMove: true,

          horzTouchDrag: true,

          vertTouchDrag: false,
        },

        handleScale: {
          axisPressedMouseMove: true,

          mouseWheel: true,

          pinch: true,
        },
      }
    );

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor: "#16a34a",

          downColor: "#ef4444",

          borderVisible: true,

          borderUpColor:
            "#16a34a",

          borderDownColor:
            "#ef4444",

          wickUpColor:
            "#16a34a",

          wickDownColor:
            "#ef4444",

          priceLineVisible: true,

          priceLineColor:
            "#16a34a",

          priceLineWidth: 2,

          priceLineStyle: 2,

          lastValueVisible: true,

          priceFormat: {
            type: "price",

            precision:
              selectedAsset.pricePrecision,

            minMove: 0.01,
          },
        }
      );

    const lineSeries =
      chart.addSeries(
        LineSeries,
        {
          color: "#16a34a",

          lineWidth: 2,

          priceLineVisible: true,

          priceLineColor:
            "#16a34a",

          priceLineWidth: 2,

          lastValueVisible: true,

          priceFormat: {
            type: "price",

            precision:
              selectedAsset.pricePrecision,

            minMove: 0.01,
          },
        }
      );

    lineSeries.applyOptions({
      visible: false,
    });

    chartRef.current = chart;

    candleSeriesRef.current =
      candleSeries;

    lineSeriesRef.current =
      lineSeries;

    hasPositionedChartRef.current =
      false;

    const resizeObserver =
      new ResizeObserver(
        (entries) => {
          const entry =
            entries[0];

          if (!entry) {
            return;
          }

          chart.applyOptions({
            width: Math.floor(
              entry.contentRect.width
            ),
          });
        }
      );

    resizeObserver.observe(
      container
    );

    return () => {
      resizeObserver.disconnect();

      chart.remove();

      chartRef.current = null;

      candleSeriesRef.current =
        null;

      lineSeriesRef.current =
        null;

      hasPositionedChartRef.current =
        false;
    };
  }, [
    selectedAsset.productId,
    selectedAsset.pricePrecision,
  ]);

  useEffect(() => {
    const chart =
      chartRef.current;

    const candleSeries =
      candleSeriesRef.current;

    const lineSeries =
      lineSeriesRef.current;

    if (
      !chart ||
      !candleSeries ||
      !lineSeries
    ) {
      return;
    }

    candleSeries.setData(
      candles
    );

    lineSeries.setData(
      candles.map((candle) => ({
        time: candle.time,
        value: candle.close,
      }))
    );

    candleSeries.applyOptions({
      visible:
        chartType ===
        "candles",
    });

    lineSeries.applyOptions({
      visible:
        chartType === "line",
    });

    if (
      candles.length > 0 &&
      !hasPositionedChartRef.current
    ) {
      const visibleCandleCount =
        Math.min(
          candles.length,
          85
        );

      chart
        .timeScale()
        .setVisibleLogicalRange({
          from:
            candles.length -
            visibleCandleCount,

          to:
            candles.length + 5,
        });

      hasPositionedChartRef.current =
        true;
    }
  }, [
    candles,
    chartType,
  ]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;

    if (!candleSeries || !lineSeries) {
      return;
    }

    positionPriceLinesRef.current.forEach(({ series, line }) => {
      try {
        series.removePriceLine(line);
      } catch (error) {
        console.error("Could not remove position price line:", error);
      }
    });

    positionPriceLinesRef.current = [];

    const addLineToBothSeries = (options) => {
      [candleSeries, lineSeries].forEach((series) => {
        const line = series.createPriceLine(options);
        positionPriceLinesRef.current.push({ series, line });
      });
    };

    const visiblePosition =
      [...(openPositions || [])]
        .sort((firstPosition, secondPosition) => {
          const firstTime = new Date(
            firstPosition.openedAt ||
              firstPosition.createdAt ||
              0
          ).getTime();

          const secondTime = new Date(
            secondPosition.openedAt ||
              secondPosition.createdAt ||
              0
          ).getTime();

          return secondTime - firstTime;
        })[0];

    if (visiblePosition) {
      const entryPrice = Number(
        visiblePosition.entryPrice
      );

      const positionQuantity = Number(
        visiblePosition.quantity
      );

      const side =
        visiblePosition.side === "sell"
          ? "SELL"
          : "BUY";

      const sideColor =
        visiblePosition.side === "sell"
          ? "#dc2626"
          : "#16a34a";

      if (
        Number.isFinite(entryPrice) &&
        entryPrice > 0
      ) {
        addLineToBothSeries({
          price: entryPrice,
          color: sideColor,
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${side} ${formatQuantityForChart(
            positionQuantity
          )} ${
            visiblePosition.asset ||
            selectedAsset.symbol
          }`,
        });
      }

      const stopLossPrice = Number(
        visiblePosition.stopLoss
      );

      if (
        Number.isFinite(stopLossPrice) &&
        stopLossPrice > 0
      ) {
        addLineToBothSeries({
          price: stopLossPrice,
          color: "#dc2626",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: "",
        });
      }

      const takeProfitPrice = Number(
        visiblePosition.takeProfit
      );

      if (
        Number.isFinite(takeProfitPrice) &&
        takeProfitPrice > 0
      ) {
        addLineToBothSeries({
          price: takeProfitPrice,
          color: "#16a34a",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: "",
        });
      }
    }

    return () => {
      positionPriceLinesRef.current.forEach(({ series, line }) => {
        try {
          series.removePriceLine(line);
        } catch {
          // The chart may already be removed during navigation.
        }
      });
      positionPriceLinesRef.current = [];
    };
  }, [openPositions, selectedAsset.symbol]);

  useEffect(() => {
    const isRiskTool =
      activeTool === "risk-buy" ||
      activeTool === "risk-sell";

    const container =
      chartContainerRef.current;

    if (!isRiskTool || !container) {
      return undefined;
    }

    let nativeDraft = null;
    let activePointerId = null;

    function getChartPoint(event) {
      const bounds =
        container.getBoundingClientRect();

      const chartX = clamp(
        event.clientX - bounds.left,
        0,
        bounds.width
      );

      const chartY = clamp(
        event.clientY - bounds.top,
        0,
        bounds.height
      );

      return {
        chartX,
        chartY,
        normalized: {
          x: bounds.width > 0
            ? chartX / bounds.width
            : 0,
          y: bounds.height > 0
            ? chartY / bounds.height
            : 0,
        },
      };
    }

    function resetRiskInteraction() {
      nativeDraft = null;
      activePointerId = null;
      setDraftDrawing(null);
    }

    function handleNativePointerDown(event) {
      if (
        event.button !== 0 ||
        activePointerId !== null
      ) {
        return;
      }

      const activeSeries =
        chartTypeRef.current === "line"
          ? lineSeriesRef.current
          : candleSeriesRef.current;

      const livePrice = Number(
        currentPriceRef.current
      );

      if (
        !activeSeries ||
        !Number.isFinite(livePrice) ||
        livePrice <= 0
      ) {
        showChartWarning(
          "The live entry price is not ready yet."
        );
        setActiveTool("pointer");
        return;
      }

      const point = getChartPoint(event);

      nativeDraft = {
        id: createDrawingId(),
        type: activeTool,
        start: point.normalized,
        end: point.normalized,
        startChartY: point.chartY,
      };

      activePointerId = event.pointerId;
      setDraftDrawing(nativeDraft);

      container.setPointerCapture(
        event.pointerId
      );

      event.preventDefault();
    }

    function handleNativePointerMove(event) {
      if (
        !nativeDraft ||
        event.pointerId !== activePointerId
      ) {
        return;
      }

      const point = getChartPoint(event);

      nativeDraft = {
        ...nativeDraft,
        end: point.normalized,
        endChartY: point.chartY,
      };

      setDraftDrawing(nativeDraft);
      event.preventDefault();
    }

    function handleNativePointerUp(event) {
      if (
        !nativeDraft ||
        event.pointerId !== activePointerId
      ) {
        return;
      }

      const point = getChartPoint(event);
      const activeSeries =
        chartTypeRef.current === "line"
          ? lineSeriesRef.current
          : candleSeriesRef.current;

      const livePrice = Number(
        currentPriceRef.current
      );

      const entryCoordinate =
        activeSeries?.priceToCoordinate(
          livePrice
        );

      const startChartY =
        nativeDraft.startChartY;

      const endChartY =
        point.chartY;

      const topChartY = Math.min(
        startChartY,
        endChartY
      );

      const bottomChartY = Math.max(
        startChartY,
        endChartY
      );

      if (
        !activeSeries ||
        !Number.isFinite(livePrice) ||
        livePrice <= 0 ||
        entryCoordinate === null ||
        entryCoordinate === undefined
      ) {
        showChartWarning(
          "The live entry price is not ready yet."
        );
        resetRiskInteraction();
        setActiveTool("pointer");
        return;
      }

      if (
        entryCoordinate <= topChartY ||
        entryCoordinate >= bottomChartY
      ) {
        showChartWarning(
          "Draw the risk/reward rectangle across the current price line so the entry price stays inside the rectangle."
        );
        resetRiskInteraction();
        setActiveTool("pointer");
        return;
      }

      const topPrice = Number(
        activeSeries.coordinateToPrice(
          topChartY
        )
      );

      const bottomPrice = Number(
        activeSeries.coordinateToPrice(
          bottomChartY
        )
      );

      if (
        !Number.isFinite(topPrice) ||
        !Number.isFinite(bottomPrice) ||
        topPrice <= 0 ||
        bottomPrice <= 0
      ) {
        showChartWarning(
          "The selected chart prices could not be calculated."
        );
        resetRiskInteraction();
        setActiveTool("pointer");
        return;
      }

      const side =
        activeTool === "risk-buy"
          ? "buy"
          : "sell";

      const calculatedStopLoss =
        side === "buy"
          ? bottomPrice
          : topPrice;

      const calculatedTakeProfit =
        side === "buy"
          ? topPrice
          : bottomPrice;

      const precision =
        selectedAsset.pricePrecision || 2;

      setStopLoss(
        calculatedStopLoss.toFixed(
          precision
        )
      );

      setTakeProfit(
        calculatedTakeProfit.toFixed(
          precision
        )
      );

      const bounds =
        container.getBoundingClientRect();

      const completedDrawing = {
        id: nativeDraft.id,
        type: nativeDraft.type,
        start: nativeDraft.start,
        end: point.normalized,
        side,
        entryY:
          bounds.height > 0
            ? clamp(
                entryCoordinate /
                  bounds.height
              )
            : 0.5,
        entryPrice: livePrice,
        stopLoss: calculatedStopLoss,
        takeProfit:
          calculatedTakeProfit,
        quantity: Number(
          quantityRef.current || 0
        ),
      };

      setDrawings(
        (previousDrawings) => [
          ...previousDrawings.filter(
            (drawing) =>
              drawing.type !==
                "risk-buy" &&
              drawing.type !==
                "risk-sell"
          ),
          completedDrawing,
        ]
      );

      setSelectedDrawingId(
        completedDrawing.id
      );

      if (
        container.hasPointerCapture(
          event.pointerId
        )
      ) {
        container.releasePointerCapture(
          event.pointerId
        );
      }

      resetRiskInteraction();
      setActiveTool("pointer");
      event.preventDefault();
    }

    container.addEventListener(
      "pointerdown",
      handleNativePointerDown
    );

    container.addEventListener(
      "pointermove",
      handleNativePointerMove
    );

    container.addEventListener(
      "pointerup",
      handleNativePointerUp
    );

    container.addEventListener(
      "pointercancel",
      handleNativePointerUp
    );

    return () => {
      container.removeEventListener(
        "pointerdown",
        handleNativePointerDown
      );

      container.removeEventListener(
        "pointermove",
        handleNativePointerMove
      );

      container.removeEventListener(
        "pointerup",
        handleNativePointerUp
      );

      container.removeEventListener(
        "pointercancel",
        handleNativePointerUp
      );

      if (
        activePointerId !== null &&
        container.hasPointerCapture(
          activePointerId
        )
      ) {
        container.releasePointerCapture(
          activePointerId
        );
      }
    };
  }, [
    activeTool,
    selectedAsset.pricePrecision,
    setStopLoss,
    setTakeProfit,
  ]);

  function handleDrawingPointerDown(event) {
    if (
      activeTool === "pointer" ||
      activeTool === "text" ||
      activeTool === "risk-buy" ||
      activeTool === "risk-sell"
    ) {
      return;
    }

    const layer =
      event.currentTarget;

    const point =
      getNormalizedPoint(
        event,
        layer
      );

    const nextDraft = {
      id: createDrawingId(),
      type: activeTool,
      start: point,
      end:
        activeTool === "horizontal"
          ? point
          : point,
    };

    setDraftDrawing(
      nextDraft
    );

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  function handleDrawingPointerMove(event) {
    if (
      !draftDrawing ||
      draftDrawing.type === "risk-buy" ||
      draftDrawing.type === "risk-sell"
    ) {
      return;
    }

    const point =
      getNormalizedPoint(
        event,
        event.currentTarget
      );

    setDraftDrawing(
      (previousDraft) => ({
        ...previousDraft,
        end: point,
      })
    );
  }

  function handleDrawingPointerUp(event) {
    if (
      !draftDrawing ||
      draftDrawing.type === "risk-buy" ||
      draftDrawing.type === "risk-sell"
    ) {
      return;
    }

    const point = getNormalizedPoint(
      event,
      event.currentTarget
    );

    const completedDrawing = {
      ...draftDrawing,
      end:
        draftDrawing.type ===
        "horizontal"
          ? draftDrawing.start
          : point,
    };

    setDrawings(
      (previousDrawings) => [
        ...previousDrawings,
        completedDrawing,
      ]
    );

    setSelectedDrawingId(
      completedDrawing.id
    );

    setDraftDrawing(null);
    setActiveTool("pointer");

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
  }

  function handleTextPlacement(event) {
    if (activeTool !== "text") {
      return;
    }

    const note = window.prompt(
      "Enter chart text:"
    );

    if (!note?.trim()) {
      setActiveTool("pointer");
      return;
    }

    const point =
      getNormalizedPoint(
        event,
        event.currentTarget
      );

    const newDrawing = {
      id: createDrawingId(),
      type: "text",
      start: point,
      end: point,
      text: note.trim(),
    };

    setDrawings(
      (previousDrawings) => [
        ...previousDrawings,
        newDrawing,
      ]
    );

    setSelectedDrawingId(
      newDrawing.id
    );

    setActiveTool("pointer");
  }

  function deleteSelectedDrawing() {
    if (!selectedDrawingId) {
      return;
    }

    setDrawings(
      (previousDrawings) =>
        previousDrawings.filter(
          (drawing) =>
            drawing.id !==
            selectedDrawingId
        )
    );

    setSelectedDrawingId("");
  }

  function requestClearAllDrawings() {
    if (drawings.length === 0) {
      return;
    }

    setIsConfirmingClearAll(true);
  }

  function cancelClearAllDrawings() {
    setIsConfirmingClearAll(false);
  }

  function confirmClearAllDrawings() {
    setDrawings([]);
    setSelectedDrawingId("");
    setDraftDrawing(null);
    setActiveTool("pointer");
    setIsConfirmingClearAll(false);
  }

  const combinedDrawings = positionEditDrawing
    ? [...drawings, positionEditDrawing]
    : drawings;

  function handleEdgePointerDown(
    event,
    drawing,
    edge
  ) {
    event.stopPropagation();

    const container =
      chartContainerRef.current;

    if (!container) {
      return;
    }

    const bounds =
      container.getBoundingClientRect();

    const entryChartY =
      (drawing.entryY ?? 0.5) *
      bounds.height;

    const rawChartY = clamp(
      event.clientY - bounds.top,
      0,
      bounds.height
    );

    const chartY =
      edge === "top"
        ? Math.min(
            rawChartY,
            entryChartY - 4
          )
        : Math.max(
            rawChartY,
            entryChartY + 4
          );

    setEdgeDrag({
      drawingId: drawing.id,
      edge,
      pointerId: event.pointerId,
      chartY,
      boundsHeight: bounds.height,
      entryChartY,
    });

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    event.preventDefault();
  }

  function handleEdgePointerMove(event) {
    if (
      !edgeDrag ||
      event.pointerId !== edgeDrag.pointerId
    ) {
      return;
    }

    const container =
      chartContainerRef.current;

    if (!container) {
      return;
    }

    const bounds =
      container.getBoundingClientRect();

    const rawChartY = clamp(
      event.clientY - bounds.top,
      0,
      bounds.height
    );

    const chartY =
      edgeDrag.edge === "top"
        ? Math.min(
            rawChartY,
            edgeDrag.entryChartY - 4
          )
        : Math.max(
            rawChartY,
            edgeDrag.entryChartY + 4
          );

    setEdgeDrag((previous) =>
      previous
        ? {
            ...previous,
            chartY,
            boundsHeight: bounds.height,
          }
        : previous
    );

    event.preventDefault();
  }

  function handleEdgePointerUp(event) {
    if (
      !edgeDrag ||
      event.pointerId !== edgeDrag.pointerId
    ) {
      return;
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }

    const drawing = combinedDrawings.find(
      (item) =>
        item.id === edgeDrag.drawingId
    );

    const activeSeries =
      chartTypeRef.current === "line"
        ? lineSeriesRef.current
        : candleSeriesRef.current;

    const finalPrice = activeSeries
      ? Number(
          activeSeries.coordinateToPrice(
            edgeDrag.chartY
          )
        )
      : null;

    const boundsHeight =
      edgeDrag.boundsHeight;

    const chartY = edgeDrag.chartY;
    const edge = edgeDrag.edge;

    setEdgeDrag(null);

    if (
      !drawing ||
      !Number.isFinite(finalPrice) ||
      finalPrice <= 0 ||
      !boundsHeight
    ) {
      return;
    }

    const precision =
      selectedAsset.pricePrecision || 2;

    const roundedPrice = Number(
      finalPrice.toFixed(precision)
    );

    const isTakeProfit =
      (edge === "top") ===
      (drawing.side === "buy");

    if (edgeDrag.drawingId === "position-edit") {
      if (!editingPosition) {
        return;
      }

      const currentStopLossValue =
        editingPosition.stopLoss
          ? String(editingPosition.stopLoss)
          : "";

      const currentTakeProfitValue =
        editingPosition.takeProfit
          ? String(
              editingPosition.takeProfit
            )
          : "";

      onPositionRiskEdit(
        isTakeProfit
          ? currentStopLossValue
          : String(roundedPrice),
        isTakeProfit
          ? String(roundedPrice)
          : currentTakeProfitValue
      );

      return;
    }

    const normalizedY = clamp(
      chartY / boundsHeight
    );

    function applyEdit() {
      setDrawings((previousDrawings) =>
        previousDrawings.map((item) => {
          if (item.id !== drawing.id) {
            return item;
          }

          const startIsTop =
            item.start.y <= item.end.y;

          const positioned =
            edge === "top"
              ? startIsTop
                ? {
                    ...item,
                    start: {
                      ...item.start,
                      y: normalizedY,
                    },
                  }
                : {
                    ...item,
                    end: {
                      ...item.end,
                      y: normalizedY,
                    },
                  }
              : startIsTop
                ? {
                    ...item,
                    end: {
                      ...item.end,
                      y: normalizedY,
                    },
                  }
                : {
                    ...item,
                    start: {
                      ...item.start,
                      y: normalizedY,
                    },
                  };

          return {
            ...positioned,
            stopLoss: isTakeProfit
              ? item.stopLoss
              : roundedPrice,
            takeProfit: isTakeProfit
              ? roundedPrice
              : item.takeProfit,
          };
        })
      );

      if (isTakeProfit) {
        setTakeProfit(
          roundedPrice.toFixed(precision)
        );
      } else {
        setStopLoss(
          roundedPrice.toFixed(precision)
        );
      }
    }

    requestConfirmation(
      {
        side: drawing.side,
        asset: selectedAsset,
        changes: [
          {
            label: isTakeProfit
              ? "Take Profit"
              : "Stop Loss",
            oldPrice: isTakeProfit
              ? drawing.takeProfit
              : drawing.stopLoss,
            newPrice: roundedPrice,
          },
        ],
      },
      applyEdit
    );
  }

  const drawingsForDisplay = !edgeDrag
    ? combinedDrawings
    : combinedDrawings.map((drawing) => {
        if (
          drawing.id !==
            edgeDrag.drawingId ||
          !edgeDrag.boundsHeight
        ) {
          return drawing;
        }

        const startIsTop =
          drawing.start.y <=
          drawing.end.y;

        const normalizedY = clamp(
          edgeDrag.chartY /
            edgeDrag.boundsHeight
        );

        const positioned =
          edgeDrag.edge === "top"
            ? startIsTop
              ? {
                  ...drawing,
                  start: {
                    ...drawing.start,
                    y: normalizedY,
                  },
                }
              : {
                  ...drawing,
                  end: {
                    ...drawing.end,
                    y: normalizedY,
                  },
                }
            : startIsTop
              ? {
                  ...drawing,
                  end: {
                    ...drawing.end,
                    y: normalizedY,
                  },
                }
              : {
                  ...drawing,
                  start: {
                    ...drawing.start,
                    y: normalizedY,
                  },
                };

        const activeSeries =
          chartTypeRef.current === "line"
            ? lineSeriesRef.current
            : candleSeriesRef.current;

        const livePrice = activeSeries
          ? Number(
              activeSeries.coordinateToPrice(
                edgeDrag.chartY
              )
            )
          : null;

        const isTakeProfit =
          (edgeDrag.edge === "top") ===
          (drawing.side === "buy");

        if (!Number.isFinite(livePrice)) {
          return positioned;
        }

        return {
          ...positioned,
          stopLoss: isTakeProfit
            ? positioned.stopLoss
            : livePrice,
          takeProfit: isTakeProfit
            ? livePrice
            : positioned.takeProfit,
        };
      });

  const selectedRiskDrawing =
    positionEditDrawing ||
    drawings.find(
      (drawing) =>
        drawing.id ===
          selectedDrawingId &&
        (drawing.type === "risk-buy" ||
          drawing.type === "risk-sell")
    );

  const isNativeRiskToolActive =
    activeTool === "risk-buy" ||
    activeTool === "risk-sell";

  return (
    <div
      className={`professional-chart-wrapper ${
        isNativeRiskToolActive
          ? "risk-tool-active"
          : ""
      }`}
    >
      <DrawingToolbar
        activeTool={activeTool}
        setActiveTool={(tool) => {
          setActiveTool(tool);
          setDraftDrawing(null);

          if (tool !== "pointer") {
            setSelectedDrawingId("");
          }
        }}
        selectedDrawingId={selectedDrawingId}
        deleteSelectedDrawing={deleteSelectedDrawing}
        clearAllDrawings={requestClearAllDrawings}
        openCalculator={() => setIsCalculatorOpen(true)}
      />

      {chartWarning && (
        <div className="chart-warning-banner">
          <span className="chart-warning-icon">
            ⚠
          </span>

          <span className="chart-warning-text">
            {chartWarning}
          </span>

          <button
            type="button"
            className="chart-warning-dismiss"
            aria-label="Dismiss warning"
            onClick={dismissChartWarning}
          >
            ×
          </button>
        </div>
      )}

      {isCalculatorOpen && (
        <ChartCalculator
          selectedAsset={selectedAsset}
          onClose={() => setIsCalculatorOpen(false)}
        />
      )}

      {isLoadingCandles && (
        <div className="chart-loading-message">
          Loading historical market
          candles...
        </div>
      )}

      {!isLoadingCandles &&
        candles.length === 0 && (
          <div className="chart-loading-message">
            No candle data is
            available.
          </div>
        )}

      <div
        ref={chartContainerRef}
        className="professional-chart"
      />

      <div
        ref={drawingLayerRef}
        className="drawing-interaction-wrapper"
        onClick={handleTextPlacement}
      >
        <DrawingLayer
          drawings={drawingsForDisplay}
          draftDrawing={draftDrawing}
          activeTool={activeTool}
          selectedDrawingId={selectedDrawingId}
          setSelectedDrawingId={setSelectedDrawingId}
          onPointerDown={handleDrawingPointerDown}
          onPointerMove={handleDrawingPointerMove}
          onPointerUp={handleDrawingPointerUp}
          onEdgePointerDown={handleEdgePointerDown}
          onEdgePointerMove={handleEdgePointerMove}
          onEdgePointerUp={handleEdgePointerUp}
        />
      </div>

      <div className="drawing-tool-hint">
        {activeTool === "pointer" &&
          selectedRiskDrawing &&
          "Drag the top or bottom edge of the rectangle to adjust Take Profit and Stop Loss."}

        {activeTool === "pointer" &&
          !selectedRiskDrawing &&
          "Select drawings or use the chart normally."}

        {activeTool === "risk-buy" &&
          "Drag a rectangle across the current price. Top becomes TP and bottom becomes SL for a Buy."}

        {activeTool === "risk-sell" &&
          "Drag a rectangle across the current price. Top becomes SL and bottom becomes TP for a Sell."}

        {activeTool === "trend" &&
          "Drag from the first point to the second point."}

        {activeTool === "horizontal" &&
          "Click and release at the desired level."}

        {activeTool === "rectangle" &&
          "Drag to highlight a chart area."}

        {activeTool === "fibonacci" &&
          "Drag from the starting point to the ending point."}

        {activeTool === "text" &&
          "Click the chart to add a text note."}
      </div>

      {isConfirmingClearAll && (
        <div
          className="trade-confirm-overlay"
          onClick={cancelClearAllDrawings}
        >
          <div
            className="trade-confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="trade-confirm-icon close">
              ⌫
            </div>

            <h3>Delete all drawings?</h3>

            <p>
              This removes every trend line, rectangle,
              and risk/reward zone drawn on this chart.
              This cannot be undone.
            </p>

            <div className="trade-confirm-actions">
              <button
                type="button"
                className="trade-confirm-cancel"
                onClick={cancelClearAllDrawings}
              >
                Cancel
              </button>

              <button
                type="button"
                className="trade-confirm-proceed close"
                onClick={confirmClearAllDrawings}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketDetailsPanel({
  selectedAsset,
  currentPrice,
  changeAmount24h,
  change24h,
  high24h,
  low24h,
  open24h,
  direction,
  candles,
  isOpen,
  onToggle,
}) {
  const directionLabel =
    direction === "bullish"
      ? "Bullish"
      : direction === "bearish"
        ? "Bearish"
        : "Neutral";

  const sparklinePoints = useMemo(
    () => buildSparklinePoints(candles),
    [candles]
  );

  return (
    <section
      className={`market-details-panel ${direction}`}
    >
      <button
        type="button"
        className="market-details-header"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="market-details-heading-text">
          <span className="eyebrow">
            MARKET DETAILS
          </span>

          <h2>
            {selectedAsset.name} ·{" "}
            {selectedAsset.symbol}
          </h2>
        </div>

        <span
          className={`market-details-toggle-icon ${
            isOpen ? "open" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="market-details-body">
          <div className="market-details-price-row">
            <strong className="market-details-price">
              {Number.isFinite(currentPrice)
                ? `$${formatMoney(currentPrice)}`
                : "Loading..."}
            </strong>

            <span
              className={`market-direction-badge ${direction}`}
            >
              {directionLabel}
            </span>
          </div>

          <div className="market-details-sparkline">
            <svg
              viewBox="0 0 120 36"
              preserveAspectRatio="none"
            >
              {sparklinePoints && (
                <>
                  <polygon
                    points={`0,36 ${sparklinePoints} 120,36`}
                    className={`market-sparkline-fill ${direction}`}
                  />

                  <polyline
                    points={sparklinePoints}
                    className={`market-sparkline-line ${direction}`}
                  />
                </>
              )}
            </svg>
          </div>

          <div className="market-details-change-row">
            <span
              className={`market-change-amount ${direction}`}
            >
              {Number.isFinite(changeAmount24h)
                ? formatSignedMoney(
                    changeAmount24h
                  )
                : "—"}
            </span>

            <span
              className={`market-change-percent ${direction}`}
            >
              {Number.isFinite(change24h)
                ? `${
                    change24h > 0 ? "+" : ""
                  }${change24h.toFixed(2)}%`
                : "—"}
            </span>

            <span className="market-change-caption">
              24h change
            </span>
          </div>

          <div className="market-details-stats">
            <div className="market-details-stat">
              <span>24h High</span>

              <strong>
                {Number.isFinite(high24h)
                  ? `$${formatMoney(high24h)}`
                  : "—"}
              </strong>
            </div>

            <div className="market-details-stat">
              <span>24h Low</span>

              <strong>
                {Number.isFinite(low24h)
                  ? `$${formatMoney(low24h)}`
                  : "—"}
              </strong>
            </div>

            <div className="market-details-stat">
              <span>Opening Price</span>

              <strong>
                {Number.isFinite(open24h)
                  ? `$${formatMoney(open24h)}`
                  : "—"}
              </strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Trade() {
  const navigate = useNavigate();
  const { symbol = "BTCUSDT" } = useParams();

  const selectedAsset =
    marketAssets[symbol] || marketAssets.BTCUSDT;

  const [timeframe, setTimeframe] = useState("1m");
  const [chartType, setChartType] = useState("candles");
  const [quantity, setQuantity] = useState("0.01");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [broker] = useState("TradeSphere Demo Broker");
  const [virtualBalance, setVirtualBalance] = useState(0);
  const [openPositions, setOpenPositions] = useState([]);
  const [tradeResult, setTradeResult] = useState("");
  const [tradeResultType, setTradeResultType] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCandles, setIsLoadingCandles] = useState(true);
  const [isOpeningPosition, setIsOpeningPosition] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState("");

  const [editingPositionId, setEditingPositionId] =
    useState("");

  const [positionEditValues, setPositionEditValues] =
    useState({ stopLoss: "", takeProfit: "" });

  const [positionEditError, setPositionEditError] =
    useState("");

  const [isSavingPositionEdit, setIsSavingPositionEdit] =
    useState(false);
  const [marketData, setMarketData] = useState(null);
  const [candles, setCandles] = useState([]);
  const [marketError, setMarketError] = useState("");

  const [
    clearRiskSetupSignal,
    setClearRiskSetupSignal,
  ] = useState(0);

  const [pendingConfirmation, setPendingConfirmation] =
    useState(null);

  const [skipConfirmChecked, setSkipConfirmChecked] =
    useState(false);

  const [isMarketPanelOpen, setIsMarketPanelOpen] =
    useState(true);

  const historicalCandlesReadyRef = useRef(false);

  const currentPrice = marketData?.price ?? null;
  const change24h = marketData?.change24h ?? null;
  const open24h = marketData?.open24h ?? null;
  const high24h = marketData?.high24h ?? null;
  const low24h = marketData?.low24h ?? null;

  const changeAmount24h =
    Number.isFinite(currentPrice) &&
    Number.isFinite(open24h)
      ? currentPrice - open24h
      : null;

  const marketDirection = Number.isFinite(
    change24h
  )
    ? change24h > 0
      ? "bullish"
      : change24h < 0
        ? "bearish"
        : "neutral"
    : "neutral";

  const timeframeSeconds = getTimeframeSeconds(timeframe);
  const currentCandle = candles[candles.length - 1] || null;

  const numericQuantity = Number(quantity);

  const estimatedPositionValue = useMemo(() => {
    if (
      !Number.isFinite(currentPrice) ||
      !Number.isFinite(numericQuantity) ||
      currentPrice <= 0 ||
      numericQuantity <= 0
    ) {
      return 0;
    }

    return currentPrice * numericQuantity;
  }, [currentPrice, numericQuantity]);

  const selectedAssetPositions = useMemo(
    () =>
      openPositions.filter(
        (position) => position.asset === selectedAsset.symbol
      ),
    [openPositions, selectedAsset.symbol]
  );

  const editingPosition =
    selectedAssetPositions.find(
      (position) =>
        position._id === editingPositionId
    ) || null;

  function clearSessionAndRedirect() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  function updateStoredUserBalance(balance) {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUser);

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...parsedUser,
          virtualBalance: balance,
        })
      );
    } catch (error) {
      console.error("Could not update stored user:", error);
    }
  }

  function handlePairChange(event) {
    const routeKey = event.target.value;

    if (!marketAssets[routeKey]) {
      return;
    }

    navigate(`/trade/${routeKey}`);
  }

  async function readJson(response) {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  async function loadHistoricalCandles() {
    historicalCandlesReadyRef.current = false;
    setIsLoadingCandles(true);

    try {
      const response = await fetch(
        `${API_URL}/api/markets/${selectedAsset.productId}/candles?timeframe=${timeframe}&limit=${HISTORICAL_CANDLE_LIMIT}`,
        { cache: "no-store" }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load historical candles."
        );
      }

      const normalizedCandles = Array.isArray(data.candles)
        ? data.candles
            .map(normalizeCandle)
            .filter(Boolean)
            .sort(
              (firstCandle, secondCandle) =>
                firstCandle.time - secondCandle.time
            )
        : [];

      if (normalizedCandles.length === 0) {
        throw new Error("No historical candle data was returned.");
      }

      setCandles(normalizedCandles);
      historicalCandlesReadyRef.current = true;
      setMarketError("");
    } catch (error) {
      console.error("Historical candle error:", error);
      setCandles([]);
      setMarketError(
        error.message || "Could not load historical candle data."
      );
    } finally {
      setIsLoadingCandles(false);
    }
  }

  async function loadMarketData() {
    const response = await fetch(
      `${API_URL}/api/markets/${selectedAsset.productId}`,
      { cache: "no-store" }
    );

    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(
        data.message || "Could not load live market data."
      );
    }

    const nextMarket = data.market;
    const nextPrice = Number(nextMarket?.price);

    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      throw new Error("The live market price is not ready yet.");
    }

    setMarketData(nextMarket);
    setMarketError("");

    if (historicalCandlesReadyRef.current) {
      setCandles((previousCandles) =>
        updateCandlesWithLivePrice(
          previousCandles,
          nextPrice,
          Date.now(),
          timeframeSeconds
        )
      );
    }
  }

  async function loadPortfolio() {
    const token = localStorage.getItem("token");

    if (!token) {
      clearSessionAndRedirect();
      return;
    }

    const response = await fetch(`${API_URL}/api/trades/portfolio`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readJson(response);

    if (response.status === 401) {
      clearSessionAndRedirect();
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not load portfolio.");
    }

    const balance = data.portfolio?.virtualBalance ?? 0;
    setVirtualBalance(balance);
    updateStoredUserBalance(balance);
  }

  async function loadOpenPositions({ silent = false } = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
      clearSessionAndRedirect();
      return;
    }

    const response = await fetch(`${API_URL}/api/trades/active`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await readJson(response);

    if (response.status === 401) {
      clearSessionAndRedirect();
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not load open positions.");
    }

    setOpenPositions(Array.isArray(data.trades) ? data.trades : []);

    if (data.automaticallyClosedCount > 0) {
      await loadPortfolio();

      const closedTrades = Array.isArray(
        data.automaticallyClosedTrades
      )
        ? data.automaticallyClosedTrades
        : [];

      closedTrades.forEach((trade) => {
        window.dispatchEvent(
          new CustomEvent(
            "tradesphere-trade-closed",
            { detail: { trade } }
          )
        );
      });

      if (!silent) {
        setTradeResult(
          `${data.automaticallyClosedCount} position(s) closed automatically because Stop Loss or Take Profit was reached.`
        );
        setTradeResultType("success");
      }
    }
  }

  async function refreshPage() {
    try {
      setIsLoading(true);

      await Promise.all([
        loadHistoricalCandles(),
        loadMarketData(),
        loadPortfolio(),
        loadOpenPositions({ silent: true }),
      ]);
    } catch (error) {
      console.error("Load trading page error:", error);
      setTradeResult(
        error.message || "Could not load trading information."
      );
      setTradeResultType("error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setMarketData(null);
    setCandles([]);
    setMarketError("");
    historicalCandlesReadyRef.current = false;
    refreshPage();
  }, [symbol, timeframe]);

  useEffect(() => {
    setEditingPositionId("");
    setPositionEditError("");
  }, [symbol]);

  useEffect(() => {
    let stopped = false;

    async function refreshLiveMarket() {
      try {
        await loadMarketData();
      } catch (error) {
        if (!stopped) {
          console.error("Live market refresh error:", error);
          setMarketError(
            error.message || "The live market connection was interrupted."
          );
        }
      }
    }

    const marketTimer = setInterval(refreshLiveMarket, 1000);

    return () => {
      stopped = true;
      clearInterval(marketTimer);
    };
  }, [symbol, timeframeSeconds]);

  useEffect(() => {
    let stopped = false;

    async function refreshPositions() {
      try {
        await loadOpenPositions({ silent: true });
      } catch (error) {
        if (!stopped) {
          console.error("Open position refresh error:", error);
        }
      }
    }

    const positionTimer = setInterval(refreshPositions, 2000);

    return () => {
      stopped = true;
      clearInterval(positionTimer);
    };
  }, [symbol]);

  function validateOrder(side) {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return "The live market price is not ready yet.";
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return "Please enter a valid quantity greater than zero.";
    }

    if (estimatedPositionValue > virtualBalance) {
      return "The estimated position value exceeds your available demo balance.";
    }

    const numericStopLoss = stopLoss === "" ? null : Number(stopLoss);
    const numericTakeProfit = takeProfit === "" ? null : Number(takeProfit);

    if (
      numericStopLoss !== null &&
      (!Number.isFinite(numericStopLoss) || numericStopLoss <= 0)
    ) {
      return "Stop Loss must be a valid positive price.";
    }

    if (
      numericTakeProfit !== null &&
      (!Number.isFinite(numericTakeProfit) || numericTakeProfit <= 0)
    ) {
      return "Take Profit must be a valid positive price.";
    }

    if (side === "buy") {
      if (numericStopLoss !== null && numericStopLoss >= currentPrice) {
        return "For a Buy position, Stop Loss must be below the current price.";
      }

      if (numericTakeProfit !== null && numericTakeProfit <= currentPrice) {
        return "For a Buy position, Take Profit must be above the current price.";
      }
    }

    if (side === "sell") {
      if (numericStopLoss !== null && numericStopLoss <= currentPrice) {
        return "For a Sell position, Stop Loss must be above the current price.";
      }

      if (numericTakeProfit !== null && numericTakeProfit >= currentPrice) {
        return "For a Sell position, Take Profit must be below the current price.";
      }
    }

    return "";
  }

  function requestOpenPosition(side) {
    const validationMessage = validateOrder(side);

    if (validationMessage) {
      setTradeResult(validationMessage);
      setTradeResultType("error");
      return;
    }

    if (
      localStorage.getItem(
        "tradesphere_skip_open_confirm"
      ) === "true"
    ) {
      openPosition(side);
      return;
    }

    setSkipConfirmChecked(false);
    setPendingConfirmation({
      type: "open",
      side,
    });
  }

  function requestClosePosition(position) {
    if (
      localStorage.getItem(
        "tradesphere_skip_close_confirm"
      ) === "true"
    ) {
      closePosition(position._id);
      return;
    }

    setSkipConfirmChecked(false);
    setPendingConfirmation({
      type: "close",
      position,
    });
  }

  function requestRiskEditConfirmation(
    details,
    applyEdit
  ) {
    if (
      localStorage.getItem(
        "tradesphere_skip_riskedit_confirm"
      ) === "true"
    ) {
      applyEdit();
      return;
    }

    setSkipConfirmChecked(false);
    setPendingConfirmation({
      type: "riskEdit",
      onConfirm: applyEdit,
      ...details,
    });
  }

  function confirmPendingAction() {
    if (!pendingConfirmation) {
      return;
    }

    if (pendingConfirmation.type === "open") {
      if (skipConfirmChecked) {
        localStorage.setItem(
          "tradesphere_skip_open_confirm",
          "true"
        );
      }

      openPosition(pendingConfirmation.side);
    }

    if (pendingConfirmation.type === "close") {
      if (skipConfirmChecked) {
        localStorage.setItem(
          "tradesphere_skip_close_confirm",
          "true"
        );
      }

      closePosition(
        pendingConfirmation.position._id
      );
    }

    if (pendingConfirmation.type === "riskEdit") {
      if (skipConfirmChecked) {
        localStorage.setItem(
          "tradesphere_skip_riskedit_confirm",
          "true"
        );
      }

      pendingConfirmation.onConfirm();
    }

    setPendingConfirmation(null);
  }

  function cancelPendingAction() {
    setPendingConfirmation(null);
  }

  async function openPosition(side) {
    setTradeResult("");
    setTradeResultType("");

    const validationMessage = validateOrder(side);

    if (validationMessage) {
      setTradeResult(validationMessage);
      setTradeResultType("error");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      clearSessionAndRedirect();
      return;
    }

    try {
      setIsOpeningPosition(true);

      const response = await fetch(`${API_URL}/api/trades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset: selectedAsset.symbol,
          side,
          quantity: numericQuantity,
          stopLoss: stopLoss === "" ? null : Number(stopLoss),
          takeProfit: takeProfit === "" ? null : Number(takeProfit),
          broker,
        }),
      });

      const data = await readJson(response);

      if (response.status === 401) {
        clearSessionAndRedirect();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not open the position.");
      }

      setTradeResult(
        `${side === "buy" ? "Buy" : "Sell"} position opened at $${formatMoney(
          data.trade?.entryPrice ?? currentPrice
        )}.`
      );
      setTradeResultType("success");
      setStopLoss("");
      setTakeProfit("");
      setClearRiskSetupSignal(
        (previousSignal) =>
          previousSignal + 1
      );

      await Promise.all([
        loadOpenPositions({ silent: true }),
        loadPortfolio(),
      ]);
    } catch (error) {
      console.error("Open position error:", error);
      setTradeResult(
        error.message || "Could not connect to the backend."
      );
      setTradeResultType("error");
    } finally {
      setIsOpeningPosition(false);
    }
  }

  async function closePosition(tradeId) {
    const token = localStorage.getItem("token");

    if (!token) {
      clearSessionAndRedirect();
      return;
    }

    try {
      setClosingTradeId(tradeId);
      setTradeResult("");
      setTradeResultType("");

      const response = await fetch(
        `${API_URL}/api/trades/${tradeId}/close`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readJson(response);

      if (response.status === 401) {
        clearSessionAndRedirect();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not close the position.");
      }

      const profitLoss = Number(data.trade?.profitLoss || 0);

      setTradeResult(
        `Position closed at $${formatMoney(
          data.trade?.closingPrice
        )}. Realised PnL: ${formatSignedMoney(profitLoss)}.`
      );
      setTradeResultType(profitLoss < 0 ? "error" : "success");

      setVirtualBalance(data.virtualBalance);
      updateStoredUserBalance(data.virtualBalance);

      if (data.trade) {
        window.dispatchEvent(
          new CustomEvent(
            "tradesphere-trade-closed",
            { detail: { trade: data.trade } }
          )
        );
      }

      await loadOpenPositions({ silent: true });
    } catch (error) {
      console.error("Close position error:", error);
      setTradeResult(error.message || "Could not close the position.");
      setTradeResultType("error");
    } finally {
      setClosingTradeId("");
    }
  }

  function openPositionEdit(position) {
    setEditingPositionId(
      (previousId) =>
        previousId === position._id
          ? ""
          : position._id
    );

    setPositionEditValues({
      stopLoss: position.stopLoss
        ? String(position.stopLoss)
        : "",
      takeProfit: position.takeProfit
        ? String(position.takeProfit)
        : "",
    });

    setPositionEditError("");
  }

  function closePositionEdit() {
    setEditingPositionId("");
    setPositionEditError("");
  }

  function validatePositionRiskLevels(
    position,
    stopLossValue,
    takeProfitValue
  ) {
    const numericStopLoss =
      stopLossValue === ""
        ? null
        : Number(stopLossValue);

    const numericTakeProfit =
      takeProfitValue === ""
        ? null
        : Number(takeProfitValue);

    if (
      numericStopLoss !== null &&
      (!Number.isFinite(numericStopLoss) ||
        numericStopLoss <= 0)
    ) {
      return "Stop Loss must be a valid positive price.";
    }

    if (
      numericTakeProfit !== null &&
      (!Number.isFinite(
        numericTakeProfit
      ) ||
        numericTakeProfit <= 0)
    ) {
      return "Take Profit must be a valid positive price.";
    }

    const entryPrice = Number(
      position.entryPrice
    );

    if (position.side === "buy") {
      if (
        numericStopLoss !== null &&
        numericStopLoss >= entryPrice
      ) {
        return "For a Buy position, Stop Loss must be below the entry price.";
      }

      if (
        numericTakeProfit !== null &&
        numericTakeProfit <= entryPrice
      ) {
        return "For a Buy position, Take Profit must be above the entry price.";
      }
    }

    if (position.side === "sell") {
      if (
        numericStopLoss !== null &&
        numericStopLoss <= entryPrice
      ) {
        return "For a Sell position, Stop Loss must be above the entry price.";
      }

      if (
        numericTakeProfit !== null &&
        numericTakeProfit >= entryPrice
      ) {
        return "For a Sell position, Take Profit must be below the entry price.";
      }
    }

    return "";
  }

  async function savePositionRiskLevels(
    tradeId,
    stopLoss,
    takeProfit
  ) {
    const token =
      localStorage.getItem("token");

    if (!token) {
      clearSessionAndRedirect();
      return;
    }

    try {
      setIsSavingPositionEdit(true);

      const response = await fetch(
        `${API_URL}/api/trades/${tradeId}/risk`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stopLoss,
            takeProfit,
          }),
        }
      );

      const data = await readJson(
        response
      );

      if (response.status === 401) {
        clearSessionAndRedirect();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update the position."
        );
      }

      setTradeResult(
        "Stop Loss and Take Profit updated successfully."
      );
      setTradeResultType("success");

      closePositionEdit();

      await loadOpenPositions({
        silent: true,
      });
    } catch (error) {
      console.error(
        "Update position risk levels error:",
        error
      );

      setPositionEditError(
        error.message ||
          "Could not update the position."
      );
    } finally {
      setIsSavingPositionEdit(false);
    }
  }

  function requestPositionRiskEdit(
    position,
    stopLossValue,
    takeProfitValue
  ) {
    setPositionEditError("");

    const validationMessage =
      validatePositionRiskLevels(
        position,
        stopLossValue,
        takeProfitValue
      );

    if (validationMessage) {
      setPositionEditError(
        validationMessage
      );
      return;
    }

    const numericStopLoss =
      stopLossValue === ""
        ? null
        : Number(stopLossValue);

    const numericTakeProfit =
      takeProfitValue === ""
        ? null
        : Number(takeProfitValue);

    const changes = [];

    if (
      numericStopLoss !==
      (position.stopLoss ?? null)
    ) {
      changes.push({
        label: "Stop Loss",
        oldPrice: position.stopLoss,
        newPrice: numericStopLoss,
      });
    }

    if (
      numericTakeProfit !==
      (position.takeProfit ?? null)
    ) {
      changes.push({
        label: "Take Profit",
        oldPrice: position.takeProfit,
        newPrice: numericTakeProfit,
      });
    }

    if (changes.length === 0) {
      closePositionEdit();
      return;
    }

    const applyEdit = () =>
      savePositionRiskLevels(
        position._id,
        numericStopLoss,
        numericTakeProfit
      );

    requestRiskEditConfirmation(
      {
        side: position.side,
        asset: {
          pair: `${position.asset}/USD`,
        },
        changes,
      },
      applyEdit
    );
  }

  function requestPositionRiskEditFromChart(
    stopLossValue,
    takeProfitValue
  ) {
    if (!editingPosition) {
      return;
    }

    requestPositionRiskEdit(
      editingPosition,
      stopLossValue,
      takeProfitValue
    );
  }

  const orderControlsDisabled =
    isLoading ||
    isOpeningPosition ||
    !Number.isFinite(currentPrice);

  return (
    <div className="trade-light-page">
      <style>{`
        .trade-light-page {
          min-height: 100vh;
          color: #0f172a;
          background: #f5f7fa;
        }

        .trade-light-container {
          width: min(1540px, calc(100% - 32px));
          margin: 0 auto;
          padding: 16px 0 60px;
        }

        .trade-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 16px;
        }

        .trade-light-chart-panel,
        .trade-light-order-panel,
        .open-positions-panel {
          border: 1px solid #dfe5ec;
          border-radius: 12px;
          background: #ffffff;
        }

        .trade-light-chart-panel {
          min-width: 0;
          padding: 16px;
        }

        .trade-light-order-panel {
          align-self: start;
          padding: 22px;
        }

        .trade-side-column {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .market-details-panel {
          border: 1px solid #dfe5ec;
          border-radius: 12px;
          background: #ffffff;
          overflow: hidden;
        }

        .market-details-header {
          width: 100%;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: none;
          background: transparent;
          text-align: left;
        }

        .market-details-heading-text .eyebrow {
          display: block;
          margin-bottom: 4px;
          color: #16a34a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.7px;
        }

        .market-details-heading-text h2 {
          margin: 0;
          color: #0f172a;
          font-size: 15px;
        }

        .market-details-toggle-icon {
          color: #64748b;
          font-size: 12px;
          transition: transform 0.15s ease;
        }

        .market-details-toggle-icon.open {
          transform: rotate(180deg);
        }

        .market-details-body {
          padding: 0 18px 18px;
          display: grid;
          gap: 14px;
        }

        .market-details-price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .market-details-price {
          color: #0f172a;
          font-size: 24px;
        }

        .market-direction-badge {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .market-direction-badge.bullish {
          color: #166534;
          background: #dcfce7;
        }

        .market-direction-badge.bearish {
          color: #991b1b;
          background: #fee2e2;
        }

        .market-direction-badge.neutral {
          color: #334155;
          background: #e2e8f0;
        }

        .market-details-sparkline {
          height: 44px;
          border-radius: 8px;
          background: #f8fafc;
        }

        .market-details-sparkline svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .market-sparkline-line {
          fill: none;
          stroke-width: 2;
          vector-effect: non-scaling-stroke;
        }

        .market-sparkline-line.bullish {
          stroke: #16a34a;
        }

        .market-sparkline-line.bearish {
          stroke: #dc2626;
        }

        .market-sparkline-line.neutral {
          stroke: #64748b;
        }

        .market-sparkline-fill {
          stroke: none;
        }

        .market-sparkline-fill.bullish {
          fill: rgba(22, 163, 74, 0.12);
        }

        .market-sparkline-fill.bearish {
          fill: rgba(220, 38, 38, 0.12);
        }

        .market-sparkline-fill.neutral {
          fill: rgba(100, 116, 139, 0.1);
        }

        .market-details-change-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
        }

        .market-change-amount.bullish,
        .market-change-percent.bullish {
          color: #16a34a;
        }

        .market-change-amount.bearish,
        .market-change-percent.bearish {
          color: #dc2626;
        }

        .market-change-amount.neutral,
        .market-change-percent.neutral {
          color: #64748b;
        }

        .market-change-caption {
          color: #94a3b8;
          font-size: 10px;
          font-weight: 600;
        }

        .market-details-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .market-details-stat {
          padding: 9px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
        }

        .market-details-stat span {
          display: block;
          color: #64748b;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .market-details-stat strong {
          display: block;
          margin-top: 4px;
          color: #0f172a;
          font-size: 12px;
        }

        @media (max-width: 480px) {
          .market-details-stats {
            grid-template-columns: 1fr;
          }
        }

        .trade-chart-controls {
          margin-bottom: 14px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
        }

        .trade-control-groups {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 14px;
        }

        .trade-selector-group {
          display: grid;
          gap: 6px;
        }

        .trade-selector-group label,
        .order-field label {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .forex-notice {
          max-width: 230px;
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.45;
        }

        .trade-light-select,
        .order-field input,
        .order-field select {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          outline: none;
          color: #0f172a;
          border: 1px solid #cfd8e3;
          border-radius: 8px;
          background: #ffffff;
          font: inherit;
        }

        .trade-light-select {
         min-width: 125px;
        font-weight: 700;
        font-size: 12px;
        }

        .trade-light-select:focus,
        .order-field input:focus,
        .order-field select:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
        }

        .trade-timeframe-buttons,
        .trade-chart-type-buttons {
          display: flex;
          gap: 4px;
          padding: 4px;
          border: 1px solid #dfe5ec;
          border-radius: 9px;
          background: #f8fafc;
        }

        .trade-timeframe-buttons button,
        .trade-chart-type-buttons button {
          min-width: 42px;
          height: 31px;
          padding: 0 10px;
          border: none;
          border-radius: 6px;
          color: #64748b;
          background: transparent;
          font-size: 11px;
          font-weight: 700;
        }

        .trade-timeframe-buttons button.active,
        .trade-chart-type-buttons button.active {
          color: #ffffff;
          background: #16a34a;
        }

        .trade-data-status {
          color: #64748b;
          font-size: 11px;
        }

        .professional-chart-wrapper {
          min-height: 520px;
          position: relative;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #ffffff;
        }


        .drawing-interaction-wrapper {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
        }

        .chart-drawing-layer {
          width: 100%;
          height: 100%;
          display: block;
        }

        .chart-drawing-layer.pointer-mode,
        .chart-drawing-layer.drawing-mode {
          pointer-events: auto;
        }

        .chart-drawing-layer.risk-native-mode {
          pointer-events: none;
        }

        .professional-chart-wrapper.risk-tool-active
        .professional-chart {
          cursor: crosshair;
        }

        .chart-drawing-layer.pointer-mode {
          cursor: default;
        }

        .chart-drawing-layer.drawing-mode {
          cursor: crosshair;
        }

        .chart-drawing-toolbar {
          width: 40px;
          padding: 5px;
          position: absolute;
          top: 50%;
          left: 9px;
          z-index: 12;
          display: grid;
          gap: 4px;
          border: 1px solid #dbe3ec;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.11);
          transform: translateY(-50%);
          backdrop-filter: blur(10px);
        }

        .chart-drawing-toolbar button {
          width: 30px;
          height: 30px;
          padding: 0;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 7px;
          color: #475569;
          background: transparent;
          font-size: 14px;
          font-weight: 800;
        }

        .chart-drawing-toolbar button:hover:not(:disabled) {
          color: #16a34a;
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .chart-drawing-toolbar button.active {
          color: #ffffff;
          border-color: #16a34a;
          background: #16a34a;
        }

        .chart-drawing-toolbar button:disabled {
          cursor: not-allowed;
          opacity: 0.35;
        }

        .drawing-toolbar-divider {
          height: 1px;
          background: #e2e8f0;
        }

        .drawing-tool-hint {
          max-width: calc(100% - 115px);
          padding: 6px 9px;
          position: absolute;
          left: 58px;
          bottom: 8px;
          z-index: 10;
          color: #64748b;
          border: 1px solid rgba(226, 232, 240, 0.88);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.9);
          font-size: 9px;
          pointer-events: none;
        }

        .chart-calculator-panel {
          width: 240px;
          padding: 14px;
          position: absolute;
          top: 12px;
          left: 58px;
          z-index: 14;
          display: grid;
          gap: 9px;
          border: 1px solid #dbe3ec;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 18px 38px rgba(15, 23, 42, 0.16);
        }

        .chart-calculator-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .chart-calculator-heading strong,
        .chart-calculator-heading span {
          display: block;
        }

        .chart-calculator-heading strong {
          font-size: 13px;
        }

        .chart-calculator-heading span {
          margin-top: 3px;
          color: #64748b;
          font-size: 9px;
        }

        .chart-calculator-heading button {
          width: 25px;
          height: 25px;
          border: 1px solid #dbe3ec;
          border-radius: 6px;
          color: #475569;
          background: #ffffff;
          font-size: 16px;
        }

        .chart-calculator-panel label {
          display: grid;
          gap: 4px;
          color: #64748b;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .chart-calculator-panel input,
        .chart-calculator-panel select {
          width: 100%;
          height: 34px;
          padding: 0 9px;
          outline: none;
          color: #0f172a;
          border: 1px solid #cfd8e3;
          border-radius: 7px;
          background: #ffffff;
          font-size: 11px;
        }

        .chart-calculator-panel input:focus,
        .chart-calculator-panel select:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.1);
        }

        .calculator-results {
          display: grid;
          gap: 6px;
        }

        .calculator-results span {
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-radius: 7px;
          color: #64748b;
          background: #f8fafc;
          font-size: 9px;
        }

        .calculator-results strong {
          color: #0f172a;
          font-size: 10px;
        }

        .professional-chart {
          width: 100%;
          min-height: 520px;
        }

        .chart-warning-banner {
          width: min(420px, calc(100% - 32px));
          padding: 10px 14px;
          position: absolute;
          top: 14px;
          left: 50%;
          z-index: 15;
          display: flex;
          align-items: flex-start;
          gap: 9px;
          border: 1px solid #fcd34d;
          border-radius: 10px;
          background: #fffbeb;
          box-shadow: 0 12px 26px rgba(120, 53, 15, 0.18);
          animation: chart-warning-in 0.18s ease-out;
          transform: translateX(-50%);
        }

        .chart-warning-icon {
          color: #b45309;
          font-size: 14px;
          line-height: 1.4;
        }

        .chart-warning-text {
          flex: 1;
          color: #78350f;
          font-size: 12px;
          line-height: 1.4;
        }

        .chart-warning-dismiss {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          border: none;
          border-radius: 6px;
          color: #b45309;
          background: transparent;
          font-size: 15px;
          line-height: 1;
        }

        .chart-warning-dismiss:hover {
          color: #78350f;
          background: rgba(180, 83, 9, 0.12);
        }

        @keyframes chart-warning-in {
          from {
            opacity: 0;
            transform: translate(-50%, -6px);
          }

          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .chart-loading-message {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: grid;
          place-items: center;
          pointer-events: none;
          color: #64748b;
          background: rgba(255, 255, 255, 0.88);
          font-size: 13px;
        }

        .trade-candle-stats {
          margin-top: 13px;
          display: flex;
          flex-wrap: wrap;
          gap: 22px;
          color: #64748b;
          font-size: 11px;
        }

        .trade-candle-stats strong {
          margin-left: 5px;
          color: #0f172a;
        }

        .trade-positive {
          color: #16a34a !important;
        }

        .trade-negative {
          color: #dc2626 !important;
        }

        .trade-eyebrow {
          color: #16a34a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        .trade-light-order-panel h2 {
          margin: 10px 0 7px;
          font-size: 22px;
        }

        .order-intro {
          margin: 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.6;
        }

        .broker-box,
        .balance-box,
        .position-value-box {
          margin-top: 14px;
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #dcfce7;
          border-radius: 8px;
          background: #f0fdf4;
        }

        .broker-box span,
        .balance-box span,
        .position-value-box span {
          color: #64748b;
          font-size: 9px;
        }

        .broker-box strong,
        .balance-box strong,
        .position-value-box strong {
          color: #166534;
          font-size: 11px;
          text-align: right;
        }

        .order-field {
          margin-top: 14px;
          display: grid;
          gap: 6px;
        }

        .field-help {
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.45;
        }

        .risk-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .trade-direction-grid {
          margin-top: 17px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .trade-direction-grid button {
          min-height: 66px;
          border: none;
          border-radius: 9px;
          color: #ffffff;
        }

        .trade-direction-grid button span,
        .trade-direction-grid button small {
          display: block;
        }

        .trade-direction-grid button span {
          font-size: 15px;
          font-weight: 800;
        }

        .trade-direction-grid button small {
          margin-top: 5px;
          font-size: 9px;
          opacity: 0.82;
        }

        .trade-buy-button {
          background: #16a34a;
        }

        .trade-sell-button {
          background: #dc2626;
        }

        .trade-direction-grid button:disabled,
        .close-position-button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .trade-light-result {
          margin-top: 14px;
          padding: 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 650;
          line-height: 1.55;
        }

        .trade-light-result.success {
          color: #166534;
          border: 1px solid #86efac;
          background: #f0fdf4;
        }

        .trade-light-result.error {
          color: #991b1b;
          border: 1px solid #fca5a5;
          background: #fef2f2;
        }

        .trade-light-disclaimer {
          margin-top: 14px;
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.5;
        }

        .open-positions-panel {
          margin-top: 16px;
          padding: 16px;
        }

        .open-positions-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .open-positions-heading h3 {
          font-size: 16px;
        }

        .open-positions-heading span {
          color: #64748b;
          font-size: 10px;
        }

        .position-list {
          display: grid;
          gap: 9px;
        }

        .position-card {
          padding: 13px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #f8fafc;
          cursor: pointer;
        }

        .position-card:hover {
          border-color: #cbd5e1;
        }

        .position-card.editing {
          border-color: #16a34a;
          background: #f0fdf4;
        }

        .position-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .position-side {
          width: fit-content;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .position-side.buy {
          color: #166534;
          background: #dcfce7;
        }

        .position-side.sell {
          color: #991b1b;
          background: #fee2e2;
        }

        .position-pnl {
          font-size: 14px;
          font-weight: 800;
        }

        .position-details {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 7px 12px;
        }

        .position-details span {
          color: #64748b;
          font-size: 9px;
        }

        .position-details strong {
          display: block;
          margin-top: 3px;
          color: #0f172a;
          font-size: 10px;
        }

        .position-edit-hint {
          display: block;
          margin-top: 9px;
          color: #94a3b8;
          font-size: 9px;
          font-style: italic;
        }

        .position-edit-box {
          margin-top: 11px;
          padding: 11px;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          background: #ffffff;
          cursor: default;
        }

        .position-edit-fields {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .position-edit-fields label {
          display: grid;
          gap: 4px;
          color: #64748b;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .position-edit-fields input {
          width: 100%;
          height: 34px;
          padding: 0 9px;
          outline: none;
          color: #0f172a;
          border: 1px solid #cfd8e3;
          border-radius: 7px;
          background: #ffffff;
          font-size: 11px;
        }

        .position-edit-fields input:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.1);
        }

        .position-edit-error {
          margin: 8px 0 0;
          color: #b91c1c;
          font-size: 10px;
        }

        .position-edit-actions {
          margin-top: 10px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .position-edit-actions button {
          min-height: 34px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 800;
        }

        .position-edit-cancel {
          border: 1px solid #cbd5e1;
          color: #334155;
          background: #ffffff;
        }

        .position-edit-cancel:hover:not(:disabled) {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .position-edit-save {
          border: none;
          color: #ffffff;
          background: #16a34a;
        }

        .position-edit-save:hover:not(:disabled) {
          background: #15803d;
        }

        .position-edit-save:disabled,
        .position-edit-cancel:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .close-position-button {
          width: 100%;
          min-height: 36px;
          margin-top: 11px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          color: #0f172a;
          background: #ffffff;
          font-size: 10px;
          font-weight: 800;
        }

        .close-position-button:hover:not(:disabled) {
          color: #ffffff;
          border-color: #0f172a;
          background: #0f172a;
        }

        .empty-position-state {
          padding: 20px;
          color: #64748b;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          text-align: center;
          font-size: 11px;
        }

        @media (max-width: 1050px) {
          .trade-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .trade-light-container {
            width: min(100% - 24px, 1540px);
          }

          .trade-chart-controls,
          .trade-control-groups {
            align-items: stretch;
            flex-direction: column;
            width: 100%;
          }

          .trade-light-select {
            width: 100%;
          }

          .trade-timeframe-buttons,
          .trade-chart-type-buttons {
            overflow-x: auto;
          }

          .professional-chart-wrapper,
          .professional-chart {
            min-height: 400px;
          }

          .risk-grid,
          .trade-direction-grid,
          .position-details {
            grid-template-columns: 1fr;
          }
        }

        .trade-confirm-overlay {
          position: fixed;
          inset: 0;
          z-index: 40;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.52);
          backdrop-filter: blur(3px);
          animation: trade-confirm-fade-in 0.15s ease-out;
        }

        .trade-confirm-modal {
          width: min(380px, 100%);
          padding: 26px;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
          animation: trade-confirm-pop-in 0.18s ease-out;
        }

        .trade-confirm-icon {
          width: 46px;
          height: 46px;
          margin-bottom: 14px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-size: 20px;
          font-weight: 800;
        }

        .trade-confirm-icon.buy {
          color: #16a34a;
          background: #dcfce7;
        }

        .trade-confirm-icon.sell {
          color: #dc2626;
          background: #fee2e2;
        }

        .trade-confirm-icon.close {
          color: #334155;
          background: #e2e8f0;
        }

        .trade-confirm-modal h3 {
          margin: 0 0 6px;
          color: #0f172a;
          font-size: 17px;
          font-weight: 800;
        }

        .trade-confirm-modal > p {
          margin: 0 0 16px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .trade-confirm-details {
          margin-bottom: 16px;
          display: grid;
          gap: 8px;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }

        .trade-confirm-details span {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #64748b;
          font-size: 11px;
        }

        .trade-confirm-details span strong {
          color: #0f172a;
          font-size: 12px;
        }

        .trade-confirm-detail-group {
          display: contents;
        }

        .trade-confirm-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #475569;
          font-size: 12px;
          cursor: pointer;
        }

        .trade-confirm-checkbox input {
          width: 15px;
          height: 15px;
          accent-color: #16a34a;
        }

        .trade-confirm-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .trade-confirm-actions button {
          min-height: 42px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 800;
        }

        .trade-confirm-cancel {
          border: 1px solid #cbd5e1;
          color: #334155;
          background: #ffffff;
        }

        .trade-confirm-cancel:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .trade-confirm-proceed {
          border: none;
          color: #ffffff;
        }

        .trade-confirm-proceed.buy {
          background: #16a34a;
        }

        .trade-confirm-proceed.buy:hover {
          background: #15803d;
        }

        .trade-confirm-proceed.sell {
          background: #dc2626;
        }

        .trade-confirm-proceed.sell:hover {
          background: #b91c1c;
        }

        .trade-confirm-proceed.close {
          background: #0f172a;
        }

        .trade-confirm-proceed.close:hover {
          background: #1e293b;
        }

        @keyframes trade-confirm-fade-in {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes trade-confirm-pop-in {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(6px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      <AppNavigation />

      <main className="trade-light-container">
        {marketError && (
          <div className="trade-light-result error">
            {marketError}
          </div>
        )}

        <div className="trade-main-grid">
          <section className="trade-light-chart-panel">
            <div className="trade-chart-controls">
              <div className="trade-control-groups">
                <div className="trade-selector-group">
                  <label htmlFor="pairSelector">Market pair</label>

                  <select
                    id="pairSelector"
                    className="trade-light-select"
                    value={selectedAsset.routeKey}
                    onChange={handlePairChange}
                  >
                    <optgroup label="Crypto">
                      {cryptoPairs.map((asset) => (
                        <option
                          key={asset.routeKey}
                          value={asset.routeKey}
                        >
                          {asset.pair}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Forex — provider required">
                      {forexPairs.map((pair) => (
                        <option
                          key={pair}
                          value={pair}
                          disabled
                        >
                          {pair}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  <span className="forex-notice">
                    Forex pairs are planned but currently require a separate
                    market-data and broker provider.
                  </span>
                </div>

                <div className="trade-selector-group">
                  <label>Candle interval</label>

                  <div className="trade-timeframe-buttons">
                    {timeframeOptions.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        className={
                          timeframe === option.value ? "active" : ""
                        }
                        onClick={() => setTimeframe(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="trade-selector-group">
                  <label>Chart type</label>

                  <div className="trade-chart-type-buttons">
                    <button
                      type="button"
                      className={chartType === "candles" ? "active" : ""}
                      onClick={() => setChartType("candles")}
                    >
                      Candles
                    </button>

                    <button
                      type="button"
                      className={chartType === "line" ? "active" : ""}
                      onClick={() => setChartType("line")}
                    >
                      Line
                    </button>
                  </div>
                </div>
              </div>

              <span className="trade-data-status">
                {selectedAsset.pair} · {timeframe} ·{" "}
                {Number.isFinite(currentPrice)
                  ? `$${formatMoney(currentPrice)}`
                  : "Loading live price"}
              </span>
            </div>

            <TradingChart
              candles={candles}
              chartType={chartType}
              selectedAsset={selectedAsset}
              isLoadingCandles={isLoadingCandles}
              currentPrice={currentPrice}
              quantity={quantity}
              setStopLoss={setStopLoss}
              setTakeProfit={setTakeProfit}
              openPositions={selectedAssetPositions}
              clearRiskSetupSignal={
                clearRiskSetupSignal
              }
              requestConfirmation={
                requestRiskEditConfirmation
              }
              editingPosition={editingPosition}
              onPositionRiskEdit={
                requestPositionRiskEditFromChart
              }
            />

            <div className="trade-candle-stats">
              <span>
                Open
                <strong>
                  ${formatMoney(currentCandle?.open ?? currentPrice)}
                </strong>
              </span>

              <span>
                High
                <strong>
                  ${formatMoney(currentCandle?.high ?? currentPrice)}
                </strong>
              </span>

              <span>
                Low
                <strong>
                  ${formatMoney(currentCandle?.low ?? currentPrice)}
                </strong>
              </span>

              <span>
                Close
                <strong>
                  ${formatMoney(currentCandle?.close ?? currentPrice)}
                </strong>
              </span>

              {Number.isFinite(change24h) && (
                <span>
                  24h
                  <strong
                    className={
                      change24h >= 0 ? "trade-positive" : "trade-negative"
                    }
                  >
                    {change24h >= 0 ? "+" : ""}
                    {change24h.toFixed(2)}%
                  </strong>
                </span>
              )}
            </div>

            <section className="open-positions-panel">
              <div className="open-positions-heading">
                <h3>Open positions</h3>
                <span>
                  {selectedAssetPositions.length} on {selectedAsset.pair}
                </span>
              </div>

              {selectedAssetPositions.length === 0 ? (
                <div className="empty-position-state">
                  You do not currently have an open {selectedAsset.pair}
                  position.
                </div>
              ) : (
                <div className="position-list">
                  {selectedAssetPositions.map((position) => {
                    const pnl = Number(
                      position.unrealizedProfitLoss || 0
                    );

                    return (
                      <article
                        className={`position-card ${
                          editingPositionId === position._id
                            ? "editing"
                            : ""
                        }`}
                        key={position._id}
                        onClick={() =>
                          openPositionEdit(position)
                        }
                      >
                        <div className="position-card-top">
                          <span
                            className={`position-side ${position.side}`}
                          >
                            {position.side.toUpperCase()} {position.asset}
                          </span>

                          <strong
                            className={`position-pnl ${
                              pnl >= 0 ? "trade-positive" : "trade-negative"
                            }`}
                          >
                            {formatSignedMoney(pnl)}
                          </strong>
                        </div>

                        <div className="position-details">
                          <span>
                            Quantity
                            <strong>{position.quantity}</strong>
                          </span>

                          <span>
                            Entry
                            <strong>${formatMoney(position.entryPrice)}</strong>
                          </span>

                          <span>
                            Current
                            <strong>
                              ${formatMoney(position.currentPrice)}
                            </strong>
                          </span>

                          <span>
                            Stop Loss
                            <strong>
                              {position.stopLoss
                                ? `$${formatMoney(position.stopLoss)}`
                                : "Not set"}
                            </strong>
                          </span>

                          <span>
                            Take Profit
                            <strong>
                              {position.takeProfit
                                ? `$${formatMoney(position.takeProfit)}`
                                : "Not set"}
                            </strong>
                          </span>

                          <span>
                            Broker
                            <strong>{position.broker}</strong>
                          </span>
                        </div>

                        {editingPositionId !==
                          position._id && (
                          <span className="position-edit-hint">
                            Click this position to edit
                            Stop Loss / Take Profit.
                          </span>
                        )}

                        {editingPositionId ===
                          position._id && (
                          <div
                            className="position-edit-box"
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            <div className="position-edit-fields">
                              <label>
                                Stop Loss
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Not set"
                                  value={
                                    positionEditValues.stopLoss
                                  }
                                  onChange={(event) =>
                                    setPositionEditValues(
                                      (previous) => ({
                                        ...previous,
                                        stopLoss:
                                          event.target
                                            .value,
                                      })
                                    )
                                  }
                                  disabled={
                                    isSavingPositionEdit
                                  }
                                />
                              </label>

                              <label>
                                Take Profit
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Not set"
                                  value={
                                    positionEditValues.takeProfit
                                  }
                                  onChange={(event) =>
                                    setPositionEditValues(
                                      (previous) => ({
                                        ...previous,
                                        takeProfit:
                                          event.target
                                            .value,
                                      })
                                    )
                                  }
                                  disabled={
                                    isSavingPositionEdit
                                  }
                                />
                              </label>
                            </div>

                            {positionEditError && (
                              <p className="position-edit-error">
                                {positionEditError}
                              </p>
                            )}

                            <div className="position-edit-actions">
                              <button
                                type="button"
                                className="position-edit-cancel"
                                disabled={
                                  isSavingPositionEdit
                                }
                                onClick={
                                  closePositionEdit
                                }
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                className="position-edit-save"
                                disabled={
                                  isSavingPositionEdit
                                }
                                onClick={() =>
                                  requestPositionRiskEdit(
                                    position,
                                    positionEditValues.stopLoss,
                                    positionEditValues.takeProfit
                                  )
                                }
                              >
                                {isSavingPositionEdit
                                  ? "Saving..."
                                  : "Save changes"}
                              </button>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          className="close-position-button"
                          disabled={closingTradeId === position._id}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestClosePosition(position);
                          }}
                        >
                          {closingTradeId === position._id
                            ? "Closing..."
                            : "Close position now"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>

          <div className="trade-side-column">
            <MarketDetailsPanel
              selectedAsset={selectedAsset}
              currentPrice={currentPrice}
              changeAmount24h={changeAmount24h}
              change24h={change24h}
              high24h={high24h}
              low24h={low24h}
              open24h={open24h}
              direction={marketDirection}
              candles={candles}
              isOpen={isMarketPanelOpen}
              onToggle={() =>
                setIsMarketPanelOpen(
                  (previous) => !previous
                )
              }
            />

          <aside className="trade-light-order-panel">
            <span className="trade-eyebrow">DEMO BROKER ORDER</span>

            <h2>Open a crypto position</h2>

            <p className="order-intro">
              Choose Buy if you expect the price to rise or Sell if you expect
              it to fall. The position remains open until you close it or its
              Stop Loss or Take Profit is reached.
            </p>

            <div className="broker-box">
              <span>Broker</span>
              <strong>{broker}</strong>
            </div>

            <div className="balance-box">
              <span>Available demo balance</span>
              <strong>${formatMoney(virtualBalance)}</strong>
            </div>

            <div className="order-field">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                min="0.00000001"
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={orderControlsDisabled}
              />
              <span className="field-help">
                Enter the amount of {selectedAsset.symbol} you want to trade.
              </span>
            </div>

            <div className="position-value-box">
              <span>Estimated position value</span>
              <strong>${formatMoney(estimatedPositionValue)}</strong>
            </div>

            <div className="risk-grid">
              <div className="order-field">
                <label htmlFor="stopLoss">Stop Loss (optional)</label>
                <input
                  id="stopLoss"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={stopLoss}
                  onChange={(event) => setStopLoss(event.target.value)}
                  disabled={orderControlsDisabled}
                />
              </div>

              <div className="order-field">
                <label htmlFor="takeProfit">Take Profit (optional)</label>
                <input
                  id="takeProfit"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={takeProfit}
                  onChange={(event) => setTakeProfit(event.target.value)}
                  disabled={orderControlsDisabled}
                />
              </div>
            </div>

            <div className="trade-direction-grid">
              <button
                type="button"
                className="trade-buy-button"
                disabled={orderControlsDisabled}
                onClick={() => requestOpenPosition("buy")}
              >
                <span>BUY</span>
                <small>Profit if price rises</small>
              </button>

              <button
                type="button"
                className="trade-sell-button"
                disabled={orderControlsDisabled}
                onClick={() => requestOpenPosition("sell")}
              >
                <span>SELL</span>
                <small>Profit if price falls</small>
              </button>
            </div>

            {tradeResult && (
              <div
                className={`trade-light-result ${
                  tradeResultType === "error" ? "error" : "success"
                }`}
              >
                {tradeResult}
              </div>
            )}

            <p className="trade-light-disclaimer">
              Coinbase supplies the live crypto market price. TradeSphere Demo
              Broker simulates position execution. No real-money order is sent
              to Coinbase or another broker.
            </p>
          </aside>
          </div>
        </div>
      </main>

      {pendingConfirmation && (
        <div
          className="trade-confirm-overlay"
          onClick={cancelPendingAction}
        >
          <div
            className="trade-confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            {pendingConfirmation.type === "open" && (
              <>
                <div
                  className={`trade-confirm-icon ${pendingConfirmation.side}`}
                >
                  {pendingConfirmation.side === "buy" ? "↑" : "↓"}
                </div>

                <h3>
                  Confirm{" "}
                  {pendingConfirmation.side === "buy" ? "Buy" : "Sell"}{" "}
                  position
                </h3>

                <p>
                  You are about to open a{" "}
                  {pendingConfirmation.side === "buy" ? "Buy" : "Sell"}{" "}
                  position on {selectedAsset.pair}.
                </p>

                <div className="trade-confirm-details">
                  <span>
                    Quantity
                    <strong>
                      {quantity} {selectedAsset.symbol}
                    </strong>
                  </span>

                  <span>
                    Entry price
                    <strong>
                      {Number.isFinite(currentPrice)
                        ? `$${formatMoney(currentPrice)}`
                        : "—"}
                    </strong>
                  </span>

                  <span>
                    Estimated value
                    <strong>
                      ${formatMoney(estimatedPositionValue)}
                    </strong>
                  </span>

                  <span>
                    Stop Loss
                    <strong>
                      {stopLoss ? `$${formatMoney(stopLoss)}` : "Not set"}
                    </strong>
                  </span>

                  <span>
                    Take Profit
                    <strong>
                      {takeProfit
                        ? `$${formatMoney(takeProfit)}`
                        : "Not set"}
                    </strong>
                  </span>
                </div>
              </>
            )}

            {pendingConfirmation.type === "close" && (
              <>
                <div className="trade-confirm-icon close">✕</div>

                <h3>Confirm close position</h3>

                <p>
                  You are about to close your{" "}
                  {pendingConfirmation.position.side === "sell"
                    ? "Sell"
                    : "Buy"}{" "}
                  position on {pendingConfirmation.position.asset}.
                </p>

                <div className="trade-confirm-details">
                  <span>
                    Quantity
                    <strong>
                      {pendingConfirmation.position.quantity}
                    </strong>
                  </span>

                  <span>
                    Entry price
                    <strong>
                      $
                      {formatMoney(
                        pendingConfirmation.position.entryPrice
                      )}
                    </strong>
                  </span>

                  <span>
                    Current price
                    <strong>
                      $
                      {formatMoney(
                        pendingConfirmation.position.currentPrice
                      )}
                    </strong>
                  </span>

                  <span>
                    Unrealized PnL
                    <strong>
                      {formatSignedMoney(
                        pendingConfirmation.position
                          .unrealizedProfitLoss
                      )}
                    </strong>
                  </span>
                </div>
              </>
            )}

            {pendingConfirmation.type === "riskEdit" && (
              <>
                <div
                  className={`trade-confirm-icon ${
                    pendingConfirmation.side === "buy"
                      ? "buy"
                      : "sell"
                  }`}
                >
                  ↕
                </div>

                <h3>
                  Confirm{" "}
                  {pendingConfirmation.changes
                    .map((change) => change.label)
                    .join(" & ")}{" "}
                  change
                  {pendingConfirmation.changes.length > 1
                    ? "s"
                    : ""}
                </h3>

                <p>
                  You are updating the risk levels for your{" "}
                  {pendingConfirmation.side === "buy"
                    ? "Buy"
                    : "Sell"}{" "}
                  position on {pendingConfirmation.asset.pair}.
                </p>

                <div className="trade-confirm-details">
                  {pendingConfirmation.changes.map(
                    (change) => (
                      <div
                        className="trade-confirm-detail-group"
                        key={change.label}
                      >
                        <span>
                          Previous {change.label}
                          <strong>
                            {change.oldPrice
                              ? `$${formatMoney(
                                  change.oldPrice
                                )}`
                              : "Not set"}
                          </strong>
                        </span>

                        <span>
                          New {change.label}
                          <strong>
                            {change.newPrice
                              ? `$${formatMoney(
                                  change.newPrice
                                )}`
                              : "Not set"}
                          </strong>
                        </span>
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            <label className="trade-confirm-checkbox">
              <input
                type="checkbox"
                checked={skipConfirmChecked}
                onChange={(event) =>
                  setSkipConfirmChecked(event.target.checked)
                }
              />
              Don&apos;t ask me again
            </label>

            <div className="trade-confirm-actions">
              <button
                type="button"
                className="trade-confirm-cancel"
                onClick={cancelPendingAction}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`trade-confirm-proceed ${
                  pendingConfirmation.type === "open"
                    ? pendingConfirmation.side
                    : "close"
                }`}
                onClick={confirmPendingAction}
              >
                {pendingConfirmation.type === "open" &&
                  `Confirm ${
                    pendingConfirmation.side === "buy" ? "Buy" : "Sell"
                  }`}

                {pendingConfirmation.type === "close" &&
                  "Confirm Close"}

                {pendingConfirmation.type === "riskEdit" &&
                  `Confirm ${pendingConfirmation.changes
                    .map((change) => change.label)
                    .join(" & ")}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trade;
