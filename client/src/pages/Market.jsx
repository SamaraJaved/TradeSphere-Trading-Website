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

const supportedAssets = [
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

function formatPrice(value) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return "—";
  }

  return numericValue.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatChange(value) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return "—";
  }

  return `${
    numericValue >= 0
      ? "+"
      : ""
  }${numericValue.toFixed(2)}%`;
}

function Market() {
  const navigate =
    useNavigate();

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    assets,
    setAssets,
  ] = useState(
    supportedAssets.map(
      (asset) => ({
        ...asset,
        price: null,
        change24h: null,
        status: "loading",
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
    const token =
      localStorage.getItem(
        "token"
      );

    if (!token) {
      clearSessionAndRedirect();
      return undefined;
    }

    let stopped = false;

    async function loadMarkets() {
      try {
        setMessage("");

        const results =
          await Promise.allSettled(
            supportedAssets.map(
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

                const price =
                  Number(
                    data.market
                      ?.price
                  );

                const change24h =
                  Number(
                    data.market
                      ?.change24h
                  );

                return {
                  ...asset,

                  price:
                    Number.isFinite(
                      price
                    )
                      ? price
                      : null,

                  change24h:
                    Number.isFinite(
                      change24h
                    )
                      ? change24h
                      : null,

                  status:
                    "ready",
                };
              }
            )
          );

        if (stopped) {
          return;
        }

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
                ...supportedAssets[
                  index
                ],

                price: null,

                change24h:
                  null,

                status:
                  "unavailable",
              };
            }
          );

        setAssets(
          nextAssets
        );

        const unavailableCount =
          nextAssets.filter(
            (asset) =>
              asset.status ===
              "unavailable"
          ).length;

        if (
          unavailableCount ===
          nextAssets.length
        ) {
          setMessage(
            "Live market data is currently unavailable. Make sure the backend and Coinbase market service are running."
          );
        }
      } catch (error) {
        if (stopped) {
          return;
        }

        console.error(
          "Market page error:",
          error
        );

        setMessage(
          error.message ||
            "Could not load live market data."
        );
      } finally {
        if (!stopped) {
          setIsLoading(false);
        }
      }
    }

    loadMarkets();

    const refreshTimer =
      setInterval(
        loadMarkets,
        5000
      );

    return () => {
      stopped = true;

      clearInterval(
        refreshTimer
      );
    };
  }, [navigate]);

  const filteredAssets =
    useMemo(() => {
      const searchValue =
        search
          .trim()
          .toLowerCase();

      if (!searchValue) {
        return assets;
      }

      return assets.filter(
        (asset) =>
          asset.symbol
            .toLowerCase()
            .includes(
              searchValue
            ) ||
          asset.name
            .toLowerCase()
            .includes(
              searchValue
            ) ||
          asset.pair
            .toLowerCase()
            .includes(
              searchValue
            )
      );
    }, [
      assets,
      search,
    ]);

  return (
    <div className="market-page">
      <AppNavigation />

      <main className="market-page-container">
        <section className="market-page-heading">
          <div>
            <span className="eyebrow">
              CRYPTO MARKETS
            </span>

            <h1>
              Explore live crypto markets
            </h1>

            <p>
              View live Coinbase prices
              for supported crypto pairs
              and open a Buy or Sell
              position from the trading
              screen.
            </p>
          </div>

          <span className="demo-data-label">
            Live Coinbase data
          </span>
        </section>

        {message && (
          <p className="form-message form-error">
            {message}
          </p>
        )}

        <section className="market-search-panel">
          <label htmlFor="marketSearch">
            Search crypto
          </label>

          <input
            type="text"
            id="marketSearch"
            placeholder="Search Bitcoin, BTC, ETH..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </section>

        <section className="market-list-panel">
          <div className="market-list-heading">
            <span>Asset</span>
            <span>Live price</span>
            <span>24h change</span>
            <span>Market</span>
            <span>Status</span>
            <span />
          </div>

          {isLoading ? (
            <div className="market-empty-state">
              <h2>
                Loading live markets...
              </h2>

              <p>
                Connecting to the
                backend market service.
              </p>
            </div>
          ) : filteredAssets.length >
            0 ? (
            filteredAssets.map(
              (asset) => {
                const isPositive =
                  Number.isFinite(
                    asset.change24h
                  ) &&
                  asset.change24h >=
                    0;

                return (
                  <article
                    className="market-list-row"
                    key={
                      asset.symbol
                    }
                  >
                    <div className="market-list-asset">
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

                    <strong>
                      {Number.isFinite(
                        asset.price
                      )
                        ? `$${formatPrice(
                            asset.price
                          )}`
                        : "—"}
                    </strong>

                    <span
                      className={
                        !Number.isFinite(
                          asset.change24h
                        )
                          ? ""
                          : isPositive
                            ? "dashboard-positive"
                            : "dashboard-negative"
                      }
                    >
                      {formatChange(
                        asset.change24h
                      )}
                    </span>

                    <span>
                      {asset.productId}
                    </span>

                    <span
                      className={
                        asset.status ===
                        "ready"
                          ? "dashboard-positive"
                          : "dashboard-negative"
                      }
                    >
                      {asset.status ===
                      "ready"
                        ? "Live"
                        : "Unavailable"}
                    </span>

                    <Link
                      to={`/trade/${asset.routeKey}`}
                      className="btn btn-outline market-trade-button"
                    >
                      Trade
                    </Link>
                  </article>
                );
              }
            )
          ) : (
            <div className="market-empty-state">
              <h2>
                No crypto asset found
              </h2>

              <p>
                Try searching with
                another name or symbol.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Market;