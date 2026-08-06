import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router";

import AppNavigation from "../components/AppNavigation";

const API_URL =
  "http://localhost:5000";

const cryptoAssets = [
  {
    symbol: "BTC",
    routeKey: "BTCUSDT",
    productId: "BTC-USD",
    pair: "BTC/USD",
    name: "Bitcoin",
  },
  {
    symbol: "ETH",
    routeKey: "ETHUSDT",
    productId: "ETH-USD",
    pair: "ETH/USD",
    name: "Ethereum",
  },
  {
    symbol: "SOL",
    routeKey: "SOLUSDT",
    productId: "SOL-USD",
    pair: "SOL/USD",
    name: "Solana",
  },
];

const demoSteps = [
  {
    title:
      "Welcome to TradeSphere",

    description:
      "You will use demo funds to learn how crypto Buy and Sell positions work without risking real money.",
  },
  {
    title:
      "Choose a crypto pair",

    description:
      "Select BTC/USD, ETH/USD, or SOL/USD to open its live trading chart.",
  },
  {
    title:
      "Read the candle chart",

    description:
      "Green candles show upward price movement and red candles show downward price movement.",
  },
  {
    title:
      "Choose Buy or Sell",

    description:
      "Choose Buy when you expect the price to rise, or Sell when you expect the price to fall.",
  },
  {
    title:
      "Set quantity, SL, and TP",

    description:
      "Quantity controls position size. Stop Loss limits potential loss, while Take Profit automatically closes the position at your profit target.",
  },
];

function formatMoney(value) {
  return Number(
    value || 0
  ).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Dashboard() {
  const navigate =
    useNavigate();

  const [
    user,
    setUser,
  ] = useState(null);

  const [
    portfolio,
    setPortfolio,
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
    marketAssets,
    setMarketAssets,
  ] = useState(
    cryptoAssets.map(
      (asset) => ({
        ...asset,
        price: null,
        change24h: null,
      })
    )
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    showDemo,
    setShowDemo,
  ] = useState(
    localStorage.getItem(
      "tradesphere_demo_completed"
    ) !== "true"
  );

  const [
    demoStep,
    setDemoStep,
  ] = useState(0);

  function clearSessionAndRedirect() {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    navigate("/login");
  }

  function updateStoredUser(
    loadedUser,
    balance
  ) {
    localStorage.setItem(
      "user",
      JSON.stringify({
        ...loadedUser,
        virtualBalance:
          balance,
      })
    );
  }

  async function loadMarketPrices() {
    const results =
      await Promise.allSettled(
        cryptoAssets.map(
          async (asset) => {
            const response =
              await fetch(
                `${API_URL}/api/markets/${asset.productId}`,
                {
                  cache:
                    "no-store",
                }
              );

            const data =
              await response.json();

            if (!response.ok) {
              throw new Error(
                data.message ||
                  `Could not load ${asset.symbol}.`
              );
            }

            return {
              ...asset,

              price:
                Number(
                  data.market
                    ?.price
                ),

              change24h:
                Number(
                  data.market
                    ?.change24h
                ),
            };
          }
        )
      );

    const nextAssets =
      results.map(
        (
          result,
          index
        ) => {
          if (
            result.status ===
            "fulfilled"
          ) {
            return result.value;
          }

          return {
            ...cryptoAssets[
              index
            ],

            price: null,

            change24h:
              null,
          };
        }
      );

    setMarketAssets(
      nextAssets
    );
  }

  useEffect(() => {
    let stopped = false;

    async function loadDashboard() {
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

        const headers = {
          Authorization:
            `Bearer ${token}`,
        };

        const [
          profileResponse,
          portfolioResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/api/users/profile`,
            {
              method: "GET",
              headers,
              cache: "no-store",
            }
          ),

          fetch(
            `${API_URL}/api/trades/portfolio`,
            {
              method: "GET",
              headers,
              cache: "no-store",
            }
          ),
        ]);

        if (
          profileResponse.status ===
            401 ||
          portfolioResponse.status ===
            401
        ) {
          clearSessionAndRedirect();
          return;
        }

        const profileData =
          await profileResponse.json();

        const portfolioData =
          await portfolioResponse.json();

        if (!profileResponse.ok) {
          throw new Error(
            profileData.message ||
              "Could not load your account."
          );
        }

        if (!portfolioResponse.ok) {
          throw new Error(
            portfolioData.message ||
              "Could not load your portfolio."
          );
        }

        if (stopped) {
          return;
        }

        const loadedUser =
          profileData.user;

        const loadedPortfolio =
          portfolioData.portfolio ||
          {};

        setUser(
          loadedUser
        );

        setPortfolio({
          virtualBalance:
            loadedPortfolio.virtualBalance ||
            0,

          totalPortfolioValue:
            loadedPortfolio.totalPortfolioValue ||
            loadedPortfolio.virtualBalance ||
            0,

          openPositions:
            loadedPortfolio.openPositions ??
            loadedPortfolio.activeTrades ??
            0,

          closedTrades:
            loadedPortfolio.closedTrades ??
            loadedPortfolio.completedTrades ??
            0,

          profitableTrades:
            loadedPortfolio.profitableTrades ??
            loadedPortfolio.winningTrades ??
            0,

          losingTrades:
            loadedPortfolio.losingTrades ||
            0,

          breakEvenTrades:
            loadedPortfolio.breakEvenTrades ??
            loadedPortfolio.drawTrades ??
            0,

          winRate:
            loadedPortfolio.winRate ||
            0,

          totalOpenNotional:
            loadedPortfolio.totalOpenNotional ??
            loadedPortfolio.activeTradeAmount ??
            0,

          totalUnrealizedProfitLoss:
            loadedPortfolio.totalUnrealizedProfitLoss ||
            0,

          totalRealizedProfitLoss:
            loadedPortfolio.totalRealizedProfitLoss ??
            loadedPortfolio.totalProfitLoss ??
            0,
        });

        updateStoredUser(
          loadedUser,
          loadedPortfolio.virtualBalance ||
            0
        );
      } catch (error) {
        if (stopped) {
          return;
        }

        console.error(
          "Dashboard error:",
          error
        );

        setMessage(
          error.message ||
            "Could not load dashboard information."
        );
      } finally {
        if (!stopped) {
          setIsLoading(false);
        }
      }
    }

    async function refreshDashboard() {
      await Promise.all([
        loadDashboard(),
        loadMarketPrices(),
      ]);
    }

    refreshDashboard();

    const refreshTimer =
      setInterval(
        refreshDashboard,
        5000
      );

    return () => {
      stopped = true;

      clearInterval(
        refreshTimer
      );
    };
  }, [navigate]);

  function handleNextStep() {
    if (
      demoStep <
      demoSteps.length - 1
    ) {
      setDemoStep(
        (
          previousStep
        ) =>
          previousStep + 1
      );

      return;
    }

    localStorage.setItem(
      "tradesphere_demo_completed",
      "true"
    );

    setShowDemo(false);
  }

  function handleSkipDemo() {
    localStorage.setItem(
      "tradesphere_demo_completed",
      "true"
    );

    setShowDemo(false);
  }

  function replayDemo() {
    setDemoStep(0);
    setShowDemo(true);
  }

  const combinedProfitLoss =
    Number(
      portfolio.totalRealizedProfitLoss ||
        0
    ) +
    Number(
      portfolio.totalUnrealizedProfitLoss ||
        0
    );

  return (
    <div className="dashboard-page">
      <AppNavigation />

      <main className="dashboard-container">
        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">
              CRYPTO TRADING MVP
            </span>

            <h1>
              Welcome,{" "}
              {user?.name?.split(
                " "
              )[0] ||
                "Trader"}
              .
            </h1>

            <p>
              Explore live crypto
              markets, understand
              candlestick charts, and
              manage simulated Buy and
              Sell positions using
              quantity, Stop Loss, and
              Take Profit.
            </p>

            <div className="dashboard-actions">
              <Link
                to="/trade/BTCUSDT"
                className="btn btn-primary btn-large"
              >
                Open Trading Screen
              </Link>

              <Link
                to="/market"
                className="btn btn-outline btn-large"
              >
                Explore Markets
              </Link>

              <Link
                to="/portfolio"
                className="btn btn-outline btn-large"
              >
                View Portfolio
              </Link>

              <Link
                to="/history"
                className="btn btn-outline btn-large"
              >
                Closed Trades
              </Link>

              <button
                type="button"
                className="btn btn-outline btn-large"
                onClick={
                  replayDemo
                }
              >
                Replay Demo
              </button>
            </div>
          </div>

          <article className="balance-card">
            <span>
              Available demo balance
            </span>

            <strong>
              $
              {isLoading
                ? "..."
                : formatMoney(
                    portfolio.virtualBalance
                  )}
            </strong>

            <small>
              Available for simulated
              crypto positions
            </small>
          </article>
        </section>

        {message && (
          <p className="form-message form-error">
            {message}
          </p>
        )}

        <section className="dashboard-stats">
          <article className="dashboard-stat">
            <span>
              Open positions
            </span>

            <strong>
              {isLoading
                ? "..."
                : portfolio.openPositions}
            </strong>

            <small>
              {portfolio.openPositions >
              0
                ? `${portfolio.openPositions} position(s) currently open`
                : "No open positions"}
            </small>
          </article>

          <article className="dashboard-stat">
            <span>
              Closed trades
            </span>

            <strong>
              {isLoading
                ? "..."
                : portfolio.closedTrades}
            </strong>

            <small>
              {portfolio.closedTrades >
              0
                ? `${portfolio.winRate}% profitable-trade rate`
                : "Closed trade results will appear here"}
            </small>
          </article>

          <article className="dashboard-stat">
            <span>
              Realized PnL
            </span>

            <strong
              className={
                portfolio.totalRealizedProfitLoss >
                0
                  ? "dashboard-positive"
                  : portfolio.totalRealizedProfitLoss <
                      0
                    ? "dashboard-negative"
                    : ""
              }
            >
              {isLoading
                ? "..."
                : `${
                    portfolio.totalRealizedProfitLoss >
                    0
                      ? "+"
                      : ""
                  }$${formatMoney(
                    portfolio.totalRealizedProfitLoss
                  )}`}
            </strong>

            <small>
              Final profit or loss from
              closed trades
            </small>
          </article>

          <article className="dashboard-stat">
            <span>
              Unrealized PnL
            </span>

            <strong
              className={
                portfolio.totalUnrealizedProfitLoss >
                0
                  ? "dashboard-positive"
                  : portfolio.totalUnrealizedProfitLoss <
                      0
                    ? "dashboard-negative"
                    : ""
              }
            >
              {isLoading
                ? "..."
                : `${
                    portfolio.totalUnrealizedProfitLoss >
                    0
                      ? "+"
                      : ""
                  }$${formatMoney(
                    portfolio.totalUnrealizedProfitLoss
                  )}`}
            </strong>

            <small>
              Current result of open
              positions
            </small>
          </article>

          <article className="dashboard-stat">
            <span>
              Combined PnL
            </span>

            <strong
              className={
                combinedProfitLoss >
                0
                  ? "dashboard-positive"
                  : combinedProfitLoss <
                      0
                    ? "dashboard-negative"
                    : ""
              }
            >
              {isLoading
                ? "..."
                : `${
                    combinedProfitLoss >
                    0
                      ? "+"
                      : ""
                  }$${formatMoney(
                    combinedProfitLoss
                  )}`}
            </strong>

            <small>
              Realized plus unrealized
              PnL
            </small>
          </article>

          <article className="dashboard-stat">
            <span>
              Account status
            </span>

            <strong
              className={
                user?.emailVerified
                  ? "dashboard-positive"
                  : "dashboard-negative"
              }
            >
              {isLoading
                ? "..."
                : user?.emailVerified
                  ? "Verified"
                  : "Not Verified"}
            </strong>

            <small>
              {user?.emailVerified
                ? "Email verification complete"
                : "Email verification required"}
            </small>
          </article>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="eyebrow">
                MARKET OVERVIEW
              </span>

              <h2>
                Live crypto pairs
              </h2>
            </div>

            <span className="demo-data-label">
              Coinbase market data
            </span>
          </div>

          <div className="crypto-grid">
            {marketAssets.map(
              (asset) => {
                const hasChange =
                  Number.isFinite(
                    asset.change24h
                  );

                const isPositive =
                  hasChange &&
                  asset.change24h >=
                    0;

                return (
                  <article
                    className="crypto-card"
                    key={
                      asset.symbol
                    }
                  >
                    <div className="crypto-card-top">
                      <div className="crypto-symbol">
                        {asset.symbol.charAt(
                          0
                        )}
                      </div>

                      <div>
                        <strong>
                          {asset.pair}
                        </strong>

                        <span>
                          {asset.name}
                        </span>
                      </div>
                    </div>

                    <div className="crypto-price">
                      <strong>
                        {Number.isFinite(
                          asset.price
                        )
                          ? `$${formatMoney(
                              asset.price
                            )}`
                          : "Loading..."}
                      </strong>

                      <span
                        className={
                          !hasChange
                            ? ""
                            : isPositive
                              ? "dashboard-positive"
                              : "dashboard-negative"
                        }
                      >
                        {hasChange
                          ? `${
                              isPositive
                                ? "+"
                                : ""
                            }${asset.change24h.toFixed(
                              2
                            )}%`
                          : "—"}
                      </span>
                    </div>

                    <Link
                      to={`/trade/${asset.routeKey}`}
                      className="btn btn-outline crypto-trade-button"
                    >
                      View Chart
                    </Link>
                  </article>
                );
              }
            )}
          </div>
        </section>

        <section className="dashboard-section beginner-section">
          <div>
            <span className="eyebrow">
              FIRST STEPS
            </span>

            <h2>
              Understand the trading
              screen before opening a
              position
            </h2>

            <p>
              The guided demo explains
              crypto pairs, candles, Buy
              and Sell positions,
              quantity, Stop Loss, and
              Take Profit.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={
              replayDemo
            }
          >
            Start Guided Demo
          </button>
        </section>
      </main>

      {showDemo && (
        <div className="demo-overlay">
          <section className="demo-modal">
            <div className="demo-progress">
              {demoSteps.map(
                (
                  step,
                  index
                ) => (
                  <span
                    key={
                      step.title
                    }
                    className={
                      index <=
                      demoStep
                        ? "active"
                        : ""
                    }
                  />
                )
              )}
            </div>

            <span className="demo-step-number">
              Step {demoStep + 1}{" "}
              of{" "}
              {demoSteps.length}
            </span>

            <h2>
              {
                demoSteps[
                  demoStep
                ].title
              }
            </h2>

            <p>
              {
                demoSteps[
                  demoStep
                ].description
              }
            </p>

            <div className="demo-preview">
              {demoStep === 0 && (
                <div className="demo-balance-preview">
                  <span>
                    Demo balance
                  </span>

                  <strong>
                    $
                    {formatMoney(
                      portfolio.virtualBalance ||
                        25000
                    )}
                  </strong>
                </div>
              )}

              {demoStep === 1 && (
                <div className="demo-market-preview">
                  <span className="crypto-symbol">
                    B
                  </span>

                  <div>
                    <strong>
                      BTC/USD
                    </strong>

                    <small>
                      Bitcoin
                    </small>
                  </div>

                  <strong>
                    {Number.isFinite(
                      marketAssets[0]
                        ?.price
                    )
                      ? `$${formatMoney(
                          marketAssets[0]
                            .price
                        )}`
                      : "Live price"}
                  </strong>
                </div>
              )}

              {demoStep === 2 && (
                <div className="demo-candle-preview">
                  <span className="demo-candle green-candle" />
                  <span className="demo-candle red-candle" />
                  <span className="demo-candle green-candle tall-candle" />
                  <span className="demo-candle green-candle" />
                  <span className="demo-candle red-candle tall-candle" />
                </div>
              )}

              {demoStep === 3 && (
                <div className="demo-direction-preview">
                  <div className="demo-up-button">
                    ↑ BUY

                    <small>
                      Profit if price
                      rises
                    </small>
                  </div>

                  <div className="demo-down-button">
                    ↓ SELL

                    <small>
                      Profit if price
                      falls
                    </small>
                  </div>
                </div>
              )}

              {demoStep === 4 && (
  <div className="demo-risk-preview">
    <div className="demo-risk-row">
      <span>Quantity</span>

      <strong>
        0.001 BTC
      </strong>
    </div>

    <div className="demo-risk-row">
      <span>Stop Loss</span>

      <strong>
        Limits potential loss
      </strong>
    </div>

    <div className="demo-risk-row">
      <span>Take Profit</span>

      <strong>
        Secures potential profit
      </strong>
    </div>
  </div>
)}
            </div>

            <div className="demo-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={
                  handleSkipDemo
                }
              >
                Skip Demo
              </button>

              {demoStep > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setDemoStep(
                      (
                        previousStep
                      ) =>
                        previousStep -
                        1
                    )
                  }
                >
                  Back
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary"
                onClick={
                  handleNextStep
                }
              >
                {demoStep ===
                demoSteps.length -
                  1
                  ? "Finish Demo"
                  : "Next"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Dashboard;