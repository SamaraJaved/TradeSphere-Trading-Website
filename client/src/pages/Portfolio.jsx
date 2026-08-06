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

function formatDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  return new Date(
    dateValue
  ).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCloseReasonLabel(
  closeReason
) {
  const labels = {
    manual: "Manual",
    stop_loss: "Stop Loss",
    take_profit: "Take Profit",
    cancelled: "Cancelled",
  };

  return (
    labels[closeReason] ||
    "Closed"
  );
}

function getPairLabel(trade) {
  if (trade.productId) {
    return trade.productId.replace(
      "-",
      "/"
    );
  }

  return `${trade.asset}/USD`;
}

function Portfolio() {
  const navigate =
    useNavigate();

  const [
    portfolioData,
    setPortfolioData,
  ] = useState({
    virtualBalance: 0,
    totalPortfolioValue: 0,
    openPositions: 0,
    closedTrades: 0,
    profitableTrades: 0,
    losingTrades: 0,
    breakEvenTrades: 0,
    winRate: 0,
    totalOpenNotional: 0,
    totalUnrealizedProfitLoss: 0,
    totalRealizedProfitLoss: 0,
  });

  const [
    openTrades,
    setOpenTrades,
  ] = useState([]);

  const [
    recentTrades,
    setRecentTrades,
  ] = useState([]);

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

  function updateStoredBalance(
    balance
  ) {
    const savedUser =
      localStorage.getItem(
        "user"
      );

    if (!savedUser) {
      return;
    }

    try {
      const parsedUser =
        JSON.parse(savedUser);

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...parsedUser,
          virtualBalance:
            balance,
        })
      );
    } catch (error) {
      console.error(
        "Could not update stored user:",
        error
      );
    }
  }

  useEffect(() => {
    let stopped = false;

    async function loadPortfolio(showLoader = false) {
      const token =
        localStorage.getItem(
          "token"
        );

      if (!token) {
        clearSessionAndRedirect();
        return;
      }

      try {
        if (showLoader) {
          setIsLoading(true);
        }

        setMessage("");

        const headers = {
          Authorization:
            `Bearer ${token}`,
        };

        const [
          portfolioResponse,
          activeTradesResponse,
          historyResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/api/trades/portfolio`,
            {
              headers,
              cache: "no-store",
            }
          ),

          fetch(
            `${API_URL}/api/trades/active`,
            {
              headers,
              cache: "no-store",
            }
          ),

          fetch(
            `${API_URL}/api/trades/history`,
            {
              headers,
              cache: "no-store",
            }
          ),
        ]);

        if (
          portfolioResponse.status ===
            401 ||
          activeTradesResponse.status ===
            401 ||
          historyResponse.status ===
            401
        ) {
          clearSessionAndRedirect();
          return;
        }

        const portfolioResult =
          await portfolioResponse.json();

        const activeTradesResult =
          await activeTradesResponse.json();

        const historyResult =
          await historyResponse.json();

        if (
          !portfolioResponse.ok
        ) {
          throw new Error(
            portfolioResult.message ||
              "Could not load portfolio information."
          );
        }

        if (
          !activeTradesResponse.ok
        ) {
          throw new Error(
            activeTradesResult.message ||
              "Could not load open positions."
          );
        }

        if (!historyResponse.ok) {
          throw new Error(
            historyResult.message ||
              "Could not load closed trades."
          );
        }

        if (stopped) {
          return;
        }

        const portfolio =
          portfolioResult.portfolio ||
          {};

        setPortfolioData({
          virtualBalance:
            portfolio.virtualBalance ||
            0,

          totalPortfolioValue:
            portfolio.totalPortfolioValue ||
            0,

          openPositions:
            portfolio.openPositions ??
            portfolio.activeTrades ??
            0,

          closedTrades:
            portfolio.closedTrades ??
            portfolio.completedTrades ??
            0,

          profitableTrades:
            portfolio.profitableTrades ??
            portfolio.winningTrades ??
            0,

          losingTrades:
            portfolio.losingTrades ||
            0,

          breakEvenTrades:
            portfolio.breakEvenTrades ??
            portfolio.drawTrades ??
            0,

          winRate:
            portfolio.winRate || 0,

          totalOpenNotional:
            portfolio.totalOpenNotional ??
            portfolio.activeTradeAmount ??
            0,

          totalUnrealizedProfitLoss:
            portfolio.totalUnrealizedProfitLoss ||
            0,

          totalRealizedProfitLoss:
            portfolio.totalRealizedProfitLoss ??
            portfolio.totalProfitLoss ??
            0,
        });

        setOpenTrades(
          Array.isArray(
            activeTradesResult.trades
          )
            ? activeTradesResult.trades
            : []
        );

        setRecentTrades(
          Array.isArray(
            historyResult.trades
          )
            ? historyResult.trades.slice(
                0,
                5
              )
            : []
        );

        updateStoredBalance(
          portfolio.virtualBalance ||
            0
        );
      } catch (error) {
        if (stopped) {
          return;
        }

        console.error(
          "Portfolio error:",
          error
        );

        setMessage(
          error.message ||
            "Could not load your portfolio."
        );
      } finally {
        if (!stopped && showLoader) {
          setIsLoading(false);
        }
      }
    }

    loadPortfolio(true);

    const refreshTimer = setInterval(() => {
      loadPortfolio(false);
    }, 5000);

    return () => {
      stopped = true;

      clearInterval(
        refreshTimer
      );
    };
  }, [navigate]);

  const combinedProfitLoss =
    useMemo(() => {
      return (
        Number(
          portfolioData.totalRealizedProfitLoss ||
            0
        ) +
        Number(
          portfolioData.totalUnrealizedProfitLoss ||
            0
        )
      );
    }, [portfolioData]);

  const openNotionalPercentage =
    portfolioData.virtualBalance > 0
      ? Math.min(
          100,
          Math.round(
            (portfolioData.totalOpenNotional /
              portfolioData.virtualBalance) *
              100
          )
        )
      : 0;

  return (
    <div className="portfolio-page">
      <AppNavigation />

      <main className="portfolio-container">
        <section className="portfolio-heading">
          <div>
            <span className="eyebrow">
              PORTFOLIO
            </span>

            <h1>
              Your demo trading
              portfolio
            </h1>

            <p>
              Review your demo balance,
              open Buy and Sell
              positions, unrealized PnL,
              realized PnL, and closed
              trades.
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

        {isLoading ? (
          <section className="portfolio-panel">
            <p>
              Loading portfolio...
            </p>
          </section>
        ) : (
          <>
            <section className="portfolio-summary-grid">
              <article className="portfolio-summary-card main-balance-card">
                <span>
                  Demo account value
                </span>

                <strong>
                  $
                  {formatMoney(
                    portfolioData.totalPortfolioValue
                  )}
                </strong>

                <small>
                  Balance plus current
                  unrealized PnL
                </small>
              </article>

              <article className="portfolio-summary-card">
                <span>
                  Available balance
                </span>

                <strong>
                  $
                  {formatMoney(
                    portfolioData.virtualBalance
                  )}
                </strong>

                <small>
                  Available for new
                  positions
                </small>
              </article>

              <article className="portfolio-summary-card">
                <span>
                  Open position value
                </span>

                <strong>
                  $
                  {formatMoney(
                    portfolioData.totalOpenNotional
                  )}
                </strong>

                <small>
                  {portfolioData.openPositions >
                  0
                    ? `${portfolioData.openPositions} open position(s)`
                    : "No open positions"}
                </small>
              </article>

              <article className="portfolio-summary-card">
                <span>
                  Unrealized PnL
                </span>

                <strong
                  className={
                    portfolioData.totalUnrealizedProfitLoss >
                    0
                      ? "dashboard-positive"
                      : portfolioData.totalUnrealizedProfitLoss <
                          0
                        ? "dashboard-negative"
                        : "portfolio-neutral"
                  }
                >
                  {portfolioData.totalUnrealizedProfitLoss >
                  0
                    ? "+"
                    : ""}
                  $
                  {formatMoney(
                    portfolioData.totalUnrealizedProfitLoss
                  )}
                </strong>

                <small>
                  Current result of open
                  positions
                </small>
              </article>

              <article className="portfolio-summary-card">
                <span>
                  Realized PnL
                </span>

                <strong
                  className={
                    portfolioData.totalRealizedProfitLoss >
                    0
                      ? "dashboard-positive"
                      : portfolioData.totalRealizedProfitLoss <
                          0
                        ? "dashboard-negative"
                        : "portfolio-neutral"
                  }
                >
                  {portfolioData.totalRealizedProfitLoss >
                  0
                    ? "+"
                    : ""}
                  $
                  {formatMoney(
                    portfolioData.totalRealizedProfitLoss
                  )}
                </strong>

                <small>
                  Final result from
                  closed trades
                </small>
              </article>

              <article className="portfolio-summary-card">
                <span>
                  Combined PnL
                </span>

                <strong
                  className={
                    combinedProfitLoss > 0
                      ? "dashboard-positive"
                      : combinedProfitLoss <
                          0
                        ? "dashboard-negative"
                        : "portfolio-neutral"
                  }
                >
                  {combinedProfitLoss > 0
                    ? "+"
                    : ""}
                  $
                  {formatMoney(
                    combinedProfitLoss
                  )}
                </strong>

                <small>
                  Realized plus
                  unrealized result
                </small>
              </article>
            </section>

            <section className="portfolio-performance-grid">
              <article className="portfolio-panel performance-card">
                <div className="portfolio-panel-heading">
                  <div>
                    <span className="eyebrow">
                      PERFORMANCE
                    </span>

                    <h2>
                      Trading statistics
                    </h2>
                  </div>

                  <span className="demo-data-label">
                    Demo account
                  </span>
                </div>

                <div className="portfolio-stat-list">
                  <div>
                    <span>
                      Open positions
                    </span>

                    <strong>
                      {
                        portfolioData.openPositions
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Closed trades
                    </span>

                    <strong>
                      {
                        portfolioData.closedTrades
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Profitable trades
                    </span>

                    <strong className="dashboard-positive">
                      {
                        portfolioData.profitableTrades
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Losing trades
                    </span>

                    <strong className="dashboard-negative">
                      {
                        portfolioData.losingTrades
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Break-even trades
                    </span>

                    <strong>
                      {
                        portfolioData.breakEvenTrades
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Win rate
                    </span>

                    <strong>
                      {portfolioData.closedTrades >
                      0
                        ? `${portfolioData.winRate}%`
                        : "—"}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="portfolio-panel allocation-card">
                <div className="portfolio-panel-heading">
                  <div>
                    <span className="eyebrow">
                      EXPOSURE
                    </span>

                    <h2>
                      Open position
                      exposure
                    </h2>
                  </div>
                </div>

                <div className="portfolio-allocation-chart">
                  <div
                    className="allocation-circle"
                    style={{
                      background: `conic-gradient(
                        #16a34a 0deg ${
                          openNotionalPercentage *
                          3.6
                        }deg,
                        #e2e8f0 ${
                          openNotionalPercentage *
                          3.6
                        }deg 360deg
                      )`,
                    }}
                  >
                    <div>
                      <strong>
                        {
                          openNotionalPercentage
                        }
                        %
                      </strong>

                      <span>
                        Exposure
                      </span>
                    </div>
                  </div>
                </div>

                <div className="allocation-legend">
                  <span>
                    <i className="cash-indicator" />
                    Open position value
                  </span>

                  <strong>
                    $
                    {formatMoney(
                      portfolioData.totalOpenNotional
                    )}
                  </strong>
                </div>

                <div className="allocation-legend">
                  <span>
                    Demo balance
                  </span>

                  <strong>
                    $
                    {formatMoney(
                      portfolioData.virtualBalance
                    )}
                  </strong>
                </div>
              </article>
            </section>

            <section className="portfolio-panel portfolio-positions">
              <div className="portfolio-panel-heading">
                <div>
                  <span className="eyebrow">
                    POSITIONS
                  </span>

                  <h2>
                    Open positions
                  </h2>
                </div>

                <Link to="/market">
                  Browse Markets
                </Link>
              </div>

              {openTrades.length ===
              0 ? (
                <div className="portfolio-empty-state">
                  <div className="portfolio-empty-icon">
                    ◉
                  </div>

                  <h3>
                    No open positions
                  </h3>

                  <p>
                    Your open Buy or Sell
                    crypto positions will
                    appear here after you
                    place a demo order.
                  </p>

                  <Link
                    to="/trade/BTCUSDT"
                    className="btn btn-primary"
                  >
                    Start Trading
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse:
                        "collapse",
                    }}
                  >
                    <thead>
                      <tr>
                        <th>
                          Asset
                        </th>

                        <th>
                          Side
                        </th>

                        <th>
                          Quantity
                        </th>

                        <th>
                          Entry
                        </th>

                        <th>
                          Current
                        </th>

                        <th>
                          SL
                        </th>

                        <th>
                          TP
                        </th>

                        <th>
                          Unrealized PnL
                        </th>

                        <th>
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {openTrades.map(
                        (trade) => (
                          <tr
                            key={
                              trade._id
                            }
                          >
                            <td>
                              <strong>
                                {getPairLabel(
                                  trade
                                )}
                              </strong>
                            </td>

                            <td>
                              <strong
                                className={
                                  trade.side ===
                                  "buy"
                                    ? "dashboard-positive"
                                    : "dashboard-negative"
                                }
                              >
                                {trade.side ===
                                "buy"
                                  ? "BUY"
                                  : "SELL"}
                              </strong>
                            </td>

                            <td>
                              {formatQuantity(
                                trade.quantity
                              )}{" "}
                              {
                                trade.asset
                              }
                            </td>

                            <td>
                              $
                              {formatMoney(
                                trade.entryPrice
                              )}
                            </td>

                            <td>
                              {trade.currentPrice !==
                                null &&
                              trade.currentPrice !==
                                undefined
                                ? `$${formatMoney(
                                    trade.currentPrice
                                  )}`
                                : "—"}
                            </td>

                            <td>
                              {trade.stopLoss
                                ? `$${formatMoney(
                                    trade.stopLoss
                                  )}`
                                : "Not set"}
                            </td>

                            <td>
                              {trade.takeProfit
                                ? `$${formatMoney(
                                    trade.takeProfit
                                  )}`
                                : "Not set"}
                            </td>

                            <td
                              className={
                                trade.unrealizedProfitLoss >
                                0
                                  ? "dashboard-positive"
                                  : trade.unrealizedProfitLoss <
                                      0
                                    ? "dashboard-negative"
                                    : ""
                              }
                            >
                              {trade.unrealizedProfitLoss >
                              0
                                ? "+"
                                : ""}
                              $
                              {formatMoney(
                                trade.unrealizedProfitLoss
                              )}
                            </td>

                            <td>
                              <Link
                                to={`/trade/${
                                  trade.asset
                                }USDT`}
                                className="btn btn-outline"
                              >
                                Manage
                              </Link>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="portfolio-panel portfolio-activity">
              <div className="portfolio-panel-heading">
                <div>
                  <span className="eyebrow">
                    ACTIVITY
                  </span>

                  <h2>
                    Recent closed trades
                  </h2>
                </div>

                <Link to="/history">
                  View all history
                </Link>
              </div>

              {recentTrades.length ===
              0 ? (
                <div className="portfolio-empty-state compact-empty-state">
                  <h3>
                    No recent activity
                  </h3>

                  <p>
                    Closed Buy and Sell
                    positions will appear
                    here.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse:
                        "collapse",
                    }}
                  >
                    <thead>
                      <tr>
                        <th>
                          Asset
                        </th>

                        <th>
                          Side
                        </th>

                        <th>
                          Quantity
                        </th>

                        <th>
                          Close reason
                        </th>

                        <th>
                          Profit / Loss
                        </th>

                        <th>
                          Closed
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentTrades.map(
                        (trade) => (
                          <tr
                            key={
                              trade._id
                            }
                          >
                            <td>
                              <strong>
                                {getPairLabel(
                                  trade
                                )}
                              </strong>
                            </td>

                            <td>
                              <strong
                                className={
                                  trade.side ===
                                  "buy"
                                    ? "dashboard-positive"
                                    : "dashboard-negative"
                                }
                              >
                                {trade.side ===
                                "buy"
                                  ? "BUY"
                                  : "SELL"}
                              </strong>
                            </td>

                            <td>
                              {formatQuantity(
                                trade.quantity
                              )}{" "}
                              {
                                trade.asset
                              }
                            </td>

                            <td>
                              {getCloseReasonLabel(
                                trade.closeReason
                              )}
                            </td>

                            <td
                              className={
                                trade.profitLoss >
                                0
                                  ? "dashboard-positive"
                                  : trade.profitLoss <
                                      0
                                    ? "dashboard-negative"
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
                            </td>

                            <td>
                              {formatDate(
                                trade.closedAt ||
                                  trade.updatedAt
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Portfolio;