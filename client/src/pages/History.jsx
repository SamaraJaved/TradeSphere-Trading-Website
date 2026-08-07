import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router";

import AppNavigation from "../components/AppNavigation";
import API_URL from "../config/api";

function formatMoney(value) {
  return Number(
    value || 0
  ).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value) {
  return Number(
    value || 0
  ).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

function formatTradeDate(dateValue) {
  if (!dateValue) {
    return {
      date: "—",
      time: "—",
    };
  }

  const date = new Date(dateValue);

  return {
    date: date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ),

    time: date.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    ),
  };
}

function getCloseReasonLabel(
  closeReason
) {
  const labels = {
    manual: "Manual close",
    stop_loss: "Stop Loss",
    take_profit: "Take Profit",
    cancelled: "Cancelled",
  };

  return (
    labels[closeReason] ||
    "Closed"
  );
}

const periodOptions = [
  { value: "all", label: "All Time" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
];

function startOfWeek(date) {
  const dayIndex = date.getDay();

  const daysSinceMonday =
    dayIndex === 0 ? 6 : dayIndex - 1;

  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysSinceMonday
  );

  return monday;
}

/*
  Returns the [start, end] boundary for a
  period option, or null for "all" (no
  date filtering).
*/
function getPeriodRange(period) {
  const now = new Date();

  if (period === "this_week") {
    return {
      start: startOfWeek(now),
      end: now,
    };
  }

  if (period === "last_week") {
    const startOfThisWeek =
      startOfWeek(now);

    const start = new Date(
      startOfThisWeek
    );
    start.setDate(
      start.getDate() - 7
    );

    const end = new Date(
      startOfThisWeek.getTime() - 1
    );

    return { start, end };
  }

  if (period === "this_month") {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ),
      end: now,
    };
  }

  if (period === "last_month") {
    const start = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const end = new Date(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).getTime() - 1
    );

    return { start, end };
  }

  if (period === "this_year") {
    return {
      start: new Date(
        now.getFullYear(),
        0,
        1
      ),
      end: now,
    };
  }

  if (period === "last_year") {
    const start = new Date(
      now.getFullYear() - 1,
      0,
      1
    );

    const end = new Date(
      new Date(
        now.getFullYear(),
        0,
        1
      ).getTime() - 1
    );

    return { start, end };
  }

  return null;
}

function isTradeWithinPeriod(
  trade,
  period
) {
  const range = getPeriodRange(period);

  if (!range) {
    return true;
  }

  const closedDateValue =
    trade.closedAt || trade.updatedAt;

  if (!closedDateValue) {
    return false;
  }

  const closedDate = new Date(
    closedDateValue
  );

  return (
    closedDate >= range.start &&
    closedDate <= range.end
  );
}

function getTradeResult(
  profitLoss
) {
  const numericProfitLoss =
    Number(profitLoss || 0);

  if (numericProfitLoss > 0) {
    return {
      label: "Profit",
      filter: "profit",
      className:
        "history-status history-status-won",
    };
  }

  if (numericProfitLoss < 0) {
    return {
      label: "Loss",
      filter: "loss",
      className:
        "history-status history-status-lost",
    };
  }

  return {
    label: "Break-even",
    filter: "break_even",
    className:
      "history-status",
  };
}

function History() {
  const navigate =
    useNavigate();

  const [
    trades,
    setTrades,
  ] = useState([]);

  const [
    filter,
    setFilter,
  ] = useState("all");

  const [
    periodFilter,
    setPeriodFilter,
  ] = useState("all");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  function clearSessionAndRedirect() {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    navigate("/login");
  }

  useEffect(() => {
    async function loadTradeHistory() {
      const token =
        localStorage.getItem(
          "token"
        );

      if (!token) {
        clearSessionAndRedirect();
        return;
      }

      try {
        setIsLoading(true);
        setMessage("");

        const response =
          await fetch(
            `${API_URL}/api/trades/history`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          response.status === 401
        ) {
          clearSessionAndRedirect();
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Could not load closed trades."
          );
        }

        setTrades(
          Array.isArray(data.trades)
            ? data.trades
            : []
        );

        const autoClosedTrades =
          Array.isArray(
            data.automaticallyClosedTrades
          )
            ? data.automaticallyClosedTrades
            : [];

        autoClosedTrades.forEach(
          (trade) => {
            window.dispatchEvent(
              new CustomEvent(
                "tradesphere-trade-closed",
                { detail: { trade } }
              )
            );
          }
        );
      } catch (error) {
        console.error(
          "Trade history error:",
          error
        );

        setMessage(
          error.message ||
            "Could not load closed trades."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadTradeHistory();
  }, [navigate]);

  const periodFilteredTrades =
    useMemo(() => {
      return trades.filter((trade) =>
        isTradeWithinPeriod(
          trade,
          periodFilter
        )
      );
    }, [
      trades,
      periodFilter,
    ]);

  const filteredTrades =
    useMemo(() => {
      if (filter === "all") {
        return periodFilteredTrades;
      }

      if (
        filter === "buy" ||
        filter === "sell"
      ) {
        return periodFilteredTrades.filter(
          (trade) =>
            trade.side === filter
        );
      }

      return periodFilteredTrades.filter(
        (trade) =>
          getTradeResult(
            trade.profitLoss
          ).filter === filter
      );
    }, [
      filter,
      periodFilteredTrades,
    ]);

  const totalProfitLoss =
    useMemo(() => {
      return periodFilteredTrades.reduce(
        (total, trade) =>
          total +
          Number(
            trade.profitLoss || 0
          ),
        0
      );
    }, [periodFilteredTrades]);

  const profitableTrades =
    useMemo(() => {
      return periodFilteredTrades.filter(
        (trade) =>
          Number(
            trade.profitLoss || 0
          ) > 0
      ).length;
    }, [periodFilteredTrades]);

  const losingTrades =
    useMemo(() => {
      return periodFilteredTrades.filter(
        (trade) =>
          Number(
            trade.profitLoss || 0
          ) < 0
      ).length;
    }, [periodFilteredTrades]);

  const breakEvenTrades =
    useMemo(() => {
      return periodFilteredTrades.filter(
        (trade) =>
          Number(
            trade.profitLoss || 0
          ) === 0
      ).length;
    }, [periodFilteredTrades]);

  const manuallyClosedTrades =
    useMemo(() => {
      return periodFilteredTrades.filter(
        (trade) =>
          trade.closeReason ===
          "manual"
      ).length;
    }, [periodFilteredTrades]);

  const winRate =
    periodFilteredTrades.length > 0
      ? Number(
          (
            (profitableTrades /
              periodFilteredTrades.length) *
            100
          ).toFixed(2)
        )
      : 0;

  const activePeriodLabel =
    periodOptions.find(
      (option) =>
        option.value === periodFilter
    )?.label || "All Time";

  return (
    <div className="history-page">
      <AppNavigation />

      <main className="history-container">
        <section className="history-heading">
          <div>
            <span className="eyebrow">
              TRADE HISTORY
            </span>

            <h1>
              Review your closed crypto
              trades
            </h1>

            <p>
              Track every simulated Buy
              and Sell position, its
              closing reason, entry and
              exit prices, and realised
              profit or loss.
            </p>
          </div>

          <Link
            to="/trade/BTCUSDT"
            className="btn btn-primary btn-large"
          >
            Open New Position
          </Link>
        </section>

        {message && (
          <p className="form-message form-error">
            {message}
          </p>
        )}

        <section className="history-panel history-period-panel">
          <div className="history-panel-heading">
            <div>
              <span className="eyebrow">
                TIME PERIOD
              </span>

              <h2>
                Filter by date range
              </h2>
            </div>

            <div className="history-filter-buttons">
              {periodOptions.map(
                (option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      periodFilter ===
                      option.value
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setPeriodFilter(
                        option.value
                      )
                    }
                  >
                    {option.label}
                  </button>
                )
              )}
            </div>
          </div>
        </section>

        <section className="history-summary-grid">
          <article className="history-summary-card">
            <span>
              Closed trades
            </span>

            <strong>
              {periodFilteredTrades.length}
            </strong>

            <small>
              {periodFilter === "all"
                ? "All closed positions"
                : `Closed · ${activePeriodLabel}`}
            </small>
          </article>

          <article className="history-summary-card">
            <span>
              Profitable trades
            </span>

            <strong className="history-positive">
              {profitableTrades}
            </strong>

            <small>
              Positions closed in profit
            </small>
          </article>

          <article className="history-summary-card">
            <span>
              Losing trades
            </span>

            <strong className="history-negative">
              {losingTrades}
            </strong>

            <small>
              Positions closed in loss
            </small>
          </article>

          <article className="history-summary-card">
            <span>
              Win rate
            </span>

            <strong>
              {periodFilteredTrades.length >
              0
                ? `${winRate}%`
                : "—"}
            </strong>

            <small>
              Based on closed trades
            </small>
          </article>

          <article className="history-summary-card">
            <span>
              Realised profit / loss
            </span>

            <strong
              className={
                totalProfitLoss > 0
                  ? "history-positive"
                  : totalProfitLoss < 0
                    ? "history-negative"
                    : ""
              }
            >
              {totalProfitLoss > 0
                ? "+"
                : ""}
              $
              {formatMoney(
                totalProfitLoss
              )}
            </strong>

            <small>
              Final simulated result
            </small>
          </article>

          <article className="history-summary-card">
            <span>
              Break-even trades
            </span>

            <strong>
              {breakEvenTrades}
            </strong>

            <small>
              Closed with zero PnL
            </small>
          </article>

          <article className="history-summary-card">
            <span>
              Manually closed
            </span>

            <strong>
              {manuallyClosedTrades}
            </strong>

            <small>
              Closed by the trader
            </small>
          </article>
        </section>

        <section className="history-panel">
          <div className="history-panel-heading">
            <div>
              <span className="eyebrow">
                CLOSED TRADES
              </span>

              <h2>
                Recent activity
              </h2>

              {periodFilter !== "all" && (
                <small className="history-active-period">
                  Showing {activePeriodLabel}
                </small>
              )}
            </div>

            <div className="history-filter-buttons">
              <button
                type="button"
                className={
                  filter === "all"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("all")
                }
              >
                All
              </button>

              <button
                type="button"
                className={
                  filter === "profit"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("profit")
                }
              >
                Profit
              </button>

              <button
                type="button"
                className={
                  filter === "loss"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("loss")
                }
              >
                Loss
              </button>

              <button
                type="button"
                className={
                  filter ===
                  "break_even"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(
                    "break_even"
                  )
                }
              >
                Break-even
              </button>

              <button
                type="button"
                className={
                  filter === "buy"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("buy")
                }
              >
                Buy
              </button>

              <button
                type="button"
                className={
                  filter === "sell"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter("sell")
                }
              >
                Sell
              </button>
            </div>
          </div>

          <div className="history-table">
            <div className="history-table-heading">
              <span>Asset</span>
              <span>Side</span>
              <span>Quantity</span>
              <span>Entry price</span>
              <span>Closing price</span>
              <span>Result</span>
              <span>Profit / loss</span>
              <span>Closed</span>
            </div>

            {isLoading ? (
              <div className="history-empty-state">
                <h3>
                  Loading closed trades...
                </h3>
              </div>
            ) : filteredTrades.length >
              0 ? (
              filteredTrades.map(
                (trade) => {
                  const closedDate =
                    formatTradeDate(
                      trade.closedAt ||
                        trade.updatedAt
                    );

                  const pair =
                    trade.productId
                      ? trade.productId.replace(
                          "-",
                          "/"
                        )
                      : `${trade.asset}/USD`;

                  const tradeResult =
                    getTradeResult(
                      trade.profitLoss
                    );

                  return (
                    <article
                      className="history-table-row"
                      key={trade._id}
                    >
                      <div className="history-asset">
                        <div className="history-coin-icon">
                          {trade.asset
                            ?.charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {pair}
                          </strong>

                          <span>
                            {trade.broker ||
                              "TradeSphere Demo Broker"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={
                          trade.side ===
                          "buy"
                            ? "history-direction-up"
                            : "history-direction-down"
                        }
                      >
                        {trade.side ===
                        "buy"
                          ? "↑ BUY"
                          : "↓ SELL"}
                      </span>

                      <strong>
                        {formatQuantity(
                          trade.quantity
                        )}{" "}
                        {trade.asset}
                      </strong>

                      <span>
                        $
                        {formatMoney(
                          trade.entryPrice
                        )}
                      </span>

                      <span>
                        {trade.closingPrice !==
                          null &&
                        trade.closingPrice !==
                          undefined
                          ? `$${formatMoney(
                              trade.closingPrice
                            )}`
                          : "—"}
                      </span>

                      <div>
                        <span
                          className={
                            tradeResult.className
                          }
                        >
                          {
                            tradeResult.label
                          }
                        </span>

                        <small
                          style={{
                            display:
                              "block",

                            marginTop:
                              "5px",

                            color:
                              "#64748b",

                            fontSize:
                              "9px",
                          }}
                        >
                          {getCloseReasonLabel(
                            trade.closeReason
                          )}
                        </small>
                      </div>

                      <strong
                        className={
                          trade.profitLoss >
                          0
                            ? "history-positive"
                            : trade.profitLoss <
                                0
                              ? "history-negative"
                              : ""
                        }
                      >
                        {trade.profitLoss >
                        0
                          ? "+"
                          : ""}
                        $
                        {formatMoney(
                          trade.profitLoss
                        )}
                      </strong>

                      <div className="history-date">
                        <strong>
                          {closedDate.date}
                        </strong>

                        <span>
                          {closedDate.time}
                        </span>
                      </div>
                    </article>
                  );
                }
              )
            ) : (
              <div className="history-empty-state">
                <div className="history-empty-icon">
                  ↺
                </div>

                <h3>
                  No closed trades found
                </h3>

                <p>
                  {periodFilter === "all"
                    ? "There are no closed positions matching this filter."
                    : `There are no closed positions matching this filter for ${activePeriodLabel.toLowerCase()}.`}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default History;