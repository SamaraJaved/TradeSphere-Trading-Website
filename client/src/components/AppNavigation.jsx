import { useEffect, useState } from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router";

import API_URL from "../config/api";

const navigationLinks = [
  {
    path: "/dashboard",
    label: "Dashboard",
  },
  {
    path: "/market",
    label: "Markets",
  },
  {
    path: "/trade/BTCUSDT",
    label: "Trade",
  },
  {
    path: "/portfolio",
    label: "Portfolio",
  },
  {
    path: "/history",
    label: "History",
  },
  {
    path: "/profile",
    label: "Profile",
  },
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const savedUser = localStorage.getItem("user");

  const initialUser = savedUser
    ? JSON.parse(savedUser)
    : null;

  const [user, setUser] = useState(initialUser);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  }

  useEffect(() => {
    async function loadNavigationData() {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const [profileResponse, portfolioResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/users/profile`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }),

            fetch(`${API_URL}/api/trades/portfolio`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }),
          ]);

        if (
          profileResponse.status === 401 ||
          portfolioResponse.status === 401
        ) {
          logout();
          return;
        }

        const profileData =
          await profileResponse.json();

        const portfolioData =
          await portfolioResponse.json();

        if (
          !profileResponse.ok ||
          !portfolioResponse.ok
        ) {
          return;
        }

        const autoClosedTrades =
          Array.isArray(
            portfolioData.automaticallyClosedTrades
          )
            ? portfolioData.automaticallyClosedTrades
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

        const updatedUser = {
          ...profileData.user,
          virtualBalance:
            portfolioData.portfolio
              ?.virtualBalance ?? 0,
        };

        setUser(updatedUser);

        localStorage.setItem(
          "user",
          JSON.stringify(updatedUser)
        );
      } catch (error) {
        console.error(
          "Navigation data error:",
          error
        );
      }
    }

    loadNavigationData();
  }, [location.pathname]);

  useEffect(() => {
    let stopped = false;

    async function checkForAutoClosedTrades() {
      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/trades/active`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok || stopped) {
          return;
        }

        const data = await response.json();

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
      } catch (error) {
        console.error(
          "Auto-close check error:",
          error
        );
      }
    }

    checkForAutoClosedTrades();

    const autoCloseTimer = setInterval(
      checkForAutoClosedTrades,
      5000
    );

    return () => {
      stopped = true;
      clearInterval(autoCloseTimer);
    };
  }, []);

  return (
    <header className="app-navigation">
      <div className="app-navigation-content">
        <NavLink
          to="/dashboard"
          className="app-navigation-brand"
        >
          <span className="logo-icon">T</span>
          <span>TradeSphere</span>
        </NavLink>

        <nav className="app-navigation-links">
          {navigationLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                isActive
                  ? "app-navigation-link active"
                  : "app-navigation-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-navigation-account">
          <div className="app-navigation-balance">
            <span>Demo balance</span>

            <strong>
              $
              {formatMoney(
                user?.virtualBalance ?? 0
              )}
            </strong>
          </div>

          <NavLink
            to="/profile"
            className="app-navigation-avatar"
            title="Open profile"
          >
            {(user?.name || "T")
              .charAt(0)
              .toUpperCase()}
          </NavLink>

          <button
            type="button"
            className="text-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppNavigation;