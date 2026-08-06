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

const API_URL = "http://localhost:5000";

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

  const filteredTrades =
    useMemo(() => {
      if (filter === "all") {
        return trades;
      }

      if (
        filter === "buy" ||
        filter === "sell"
      ) {
        return trades.filter(
          (trade) =>
            trade.side === filter
        );
      }

      return trades.filter(
        (trade) =>
          getTradeResult(
            trade.profitLoss
          ).filter === filter
      );
    }, [
      filter,
      trades,
    ]);

  const totalProfitLoss =
    useMemo(() => {
      return trades.reduce(
        (total, trade) =>
          total +
          Number(
            trade.profitLoss || 0
          ),
        0
      );
    }, [trades]);

  const profitableTrades =
    useMemo(() => {
      return trades.filter(
        (trade) =>
          Number(
            trade.profitLoss || 0
          ) > 0
      ).length;
    }, [trades]);

  const losingTrades =
    useMemo(() => {
      return trades.filter(
        (trade) =>
          Number(
            trade.profitLoss || 0
          ) < 0
      ).length;
    }, [trades]);

  const breakEvenTrades =
    useMemo(() => {
      return trades.filter(
        (trade) =>
          Number(
            trade.profitLoss || 0
          ) === 0
      ).length;
    }, [trades]);

  const manuallyClosedTrades =
    useMemo(() => {
      return trades.filter(
        (trade) =>
          trade.closeReason ===
          "manual"
      ).length;
    }, [trades]);

  const winRate =
    trades.length > 0
      ? Number(
          (
            (profitableTrades /
              trades.length) *
            100
          ).toFixed(2)
        )
      : 0;

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

        <section className="history-summary-grid">
          <article className="history-summary-card">
            <span>
              Closed trades
            </span>

            <strong>
              {trades.length}
            </strong>

            <small>
              All closed positions
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
              {trades.length > 0
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
                  There are no closed
                  positions matching this
                  filter.
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