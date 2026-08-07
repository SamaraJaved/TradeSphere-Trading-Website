import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import AppNavigation from "../components/AppNavigation";
import API_URL from "../config/api";

function Profile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageType, setProfileMessageType] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordMessageType, setPasswordMessageType] = useState("");

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [tradeConfirmations, setTradeConfirmations] =
    useState({
      openTrade: true,
      closeTrade: true,
      riskEdit: true,
    });

  useEffect(() => {
    async function fetchProfile() {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setIsLoadingProfile(true);

        const response = await fetch(
          `${API_URL}/api/users/profile`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }

        if (!response.ok) {
          setProfileMessage(
            data.message || "Could not load your profile."
          );
          setProfileMessageType("error");
          return;
        }

        setUser(data.user);

        setFormData({
          name: data.user?.name || "",
          email: data.user?.email || "",
          phone: data.user?.phone || "",
        });

        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );
      } catch (error) {
        console.error("Fetch profile error:", error);

        setProfileMessage(
          "Could not connect to the backend. Make sure the server is running."
        );
        setProfileMessageType("error");
      } finally {
        setIsLoadingProfile(false);
      }
    }

    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    setTradeConfirmations({
      openTrade:
        localStorage.getItem(
          "tradesphere_skip_open_confirm"
        ) !== "true",

      closeTrade:
        localStorage.getItem(
          "tradesphere_skip_close_confirm"
        ) !== "true",

      riskEdit:
        localStorage.getItem(
          "tradesphere_skip_riskedit_confirm"
        ) !== "true",
    });
  }, []);

  function toggleTradeConfirmation(
    key,
    storageKey
  ) {
    setTradeConfirmations((previous) => {
      const nextEnabled = !previous[key];

      if (nextEnabled) {
        localStorage.removeItem(
          storageKey
        );
      } else {
        localStorage.setItem(
          storageKey,
          "true"
        );
      }

      return {
        ...previous,
        [key]: nextEnabled,
      };
    });
  }

  function handleProfileChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;

    setPasswordData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    setProfileMessage("");
    setProfileMessageType("");

    const token = localStorage.getItem("token");
    const trimmedName = formData.name.trim();
    const trimmedPhone = formData.phone.trim();

    if (!token) {
      navigate("/login");
      return;
    }

    if (trimmedName.length < 2) {
      setProfileMessage(
        "Name must contain at least 2 characters."
      );
      setProfileMessageType("error");
      return;
    }

    if (trimmedName.length > 50) {
      setProfileMessage(
        "Name cannot contain more than 50 characters."
      );
      setProfileMessageType("error");
      return;
    }

    try {
      setIsSavingProfile(true);

      const response = await fetch(
        `${API_URL}/api/users/profile`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: trimmedName,
            phone: trimmedPhone,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        setProfileMessage(
          data.message || "Could not update your profile."
        );
        setProfileMessageType("error");
        return;
      }

      setUser(data.user);

      setFormData({
        name: data.user?.name || "",
        email: data.user?.email || "",
        phone: data.user?.phone || "",
      });

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      setProfileMessage(
        data.message || "Profile updated successfully."
      );
      setProfileMessageType("success");
    } catch (error) {
      console.error("Update profile error:", error);

      setProfileMessage(
        "Could not connect to the backend. Make sure the server is running."
      );
      setProfileMessageType("error");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    setPasswordMessage("");
    setPasswordMessageType("");

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordMessage("Please complete all password fields.");
      setPasswordMessageType("error");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage(
        "New password must contain at least 6 characters."
      );
      setPasswordMessageType("error");
      return;
    }

    if (
      passwordData.newPassword !==
      passwordData.confirmPassword
    ) {
      setPasswordMessage("The new passwords do not match.");
      setPasswordMessageType("error");
      return;
    }

    if (
      passwordData.currentPassword ===
      passwordData.newPassword
    ) {
      setPasswordMessage(
        "The new password must be different from the current password."
      );
      setPasswordMessageType("error");
      return;
    }

    try {
      setIsChangingPassword(true);

      const response = await fetch(
        `${API_URL}/api/users/change-password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword:
              passwordData.currentPassword,
            newPassword: passwordData.newPassword,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        setPasswordMessage(
          data.message || "Could not change the password."
        );
        setPasswordMessageType("error");
        return;
      }

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setPasswordMessage(
        data.message || "Password changed successfully."
      );
      setPasswordMessageType("success");
    } catch (error) {
      console.error("Change password error:", error);

      setPasswordMessage(
        "Could not connect to the backend. Make sure the server is running."
      );
      setPasswordMessageType("error");
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (isLoadingProfile) {
    return (
      <div className="profile-page">
        <AppNavigation />

        <main className="profile-container">
          <p className="profile-message">
            Loading your profile...
          </p>
        </main>
      </div>
    );
  }

  const virtualBalance = Number(
    user?.virtualBalance ?? 25000
  );

  return (
    <div className="profile-page">
      <AppNavigation />

      <main className="profile-container">
        <section className="profile-heading">
          <div>
            <span className="eyebrow">
              ACCOUNT SETTINGS
            </span>

            <h1>Manage your TradeSphere profile</h1>

            <p>
              Review your personal information, account
              verification status, and demo trading preferences.
            </p>
          </div>
        </section>

        <div className="profile-layout">
          <aside className="profile-summary-card">
            <div className="profile-large-avatar">
              {(formData.name || "T")
                .charAt(0)
                .toUpperCase()}
            </div>

            <h2>{formData.name || "Trader"}</h2>

            <p>
              {formData.email || "No email available"}
            </p>

            <div className="profile-verification-badge">
              {user?.emailVerified
                ? "✓ Email verified"
                : "Email not verified"}
            </div>

            <div className="profile-account-details">
              <div>
                <span>Account mode</span>
                <strong>Demo Trading</strong>
              </div>

              <div>
                <span>Virtual balance</span>

                <strong>
                  $
                  {virtualBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>

              <div>
                <span>Account status</span>

                <strong className="profile-positive">
                  Active
                </strong>
              </div>
            </div>
          </aside>

          <section className="profile-form-panel">
            <div className="profile-panel-heading">
              <div>
                <span className="eyebrow">
                  PERSONAL INFORMATION
                </span>

                <h2>Profile details</h2>
              </div>
            </div>

            <form
              className="profile-form"
              onSubmit={handleProfileSubmit}
            >
              <div className="profile-form-group">
                <label htmlFor="name">Full name</label>

                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleProfileChange}
                  placeholder="Enter your full name"
                  disabled={isSavingProfile}
                />
              </div>

              <div className="profile-form-group">
                <label htmlFor="email">
                  Email address
                </label>

                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  disabled
                />

                <small>
                  Your verified email cannot be changed from
                  this screen.
                </small>
              </div>

              <div className="profile-form-group">
                <label htmlFor="phone">
                  Phone number
                </label>

                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleProfileChange}
                  placeholder="+92 300 1234567"
                  disabled={isSavingProfile}
                />
              </div>

              {profileMessage && (
                <p
                  className={
                    profileMessageType === "error"
                      ? "form-message form-error"
                      : "form-message form-success"
                  }
                >
                  {profileMessage}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary profile-save-button"
                disabled={isSavingProfile}
              >
                {isSavingProfile
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </form>
          </section>
        </div>

        <section className="profile-security-panel">
          <div className="profile-panel-heading">
            <div>
              <span className="eyebrow">SECURITY</span>
              <h2>Change password</h2>

              <p>
                Enter your current password and choose a new
                password for your account.
              </p>
            </div>
          </div>

          <form
            className="profile-form"
            onSubmit={handlePasswordSubmit}
          >
            <div className="profile-form-group">
              <label htmlFor="currentPassword">
                Current password
              </label>

              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your current password"
                disabled={isChangingPassword}
                autoComplete="current-password"
              />
            </div>

            <div className="profile-form-group">
              <label htmlFor="newPassword">
                New password
              </label>

              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="Minimum 6 characters"
                disabled={isChangingPassword}
                autoComplete="new-password"
              />
            </div>

            <div className="profile-form-group">
              <label htmlFor="confirmPassword">
                Confirm new password
              </label>

              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Enter the new password again"
                disabled={isChangingPassword}
                autoComplete="new-password"
              />
            </div>

            {passwordMessage && (
              <p
                className={
                  passwordMessageType === "error"
                    ? "form-message form-error"
                    : "form-message form-success"
                }
              >
                {passwordMessage}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary profile-save-button"
              disabled={isChangingPassword}
            >
              {isChangingPassword
                ? "Changing Password..."
                : "Change Password"}
            </button>
          </form>
        </section>

        <section className="profile-preferences-panel">
          <div className="profile-panel-heading">
            <div>
              <span className="eyebrow">
                TRADE SAFETY
              </span>

              <h2>Trade confirmation pop-ups</h2>
            </div>
          </div>

          <div className="profile-preference-list">
            <label className="profile-checkbox-row">
              <input
                type="checkbox"
                checked={tradeConfirmations.openTrade}
                onChange={() =>
                  toggleTradeConfirmation(
                    "openTrade",
                    "tradesphere_skip_open_confirm"
                  )
                }
              />

              <div>
                <strong>
                  Confirm before opening a trade
                </strong>

                <span>
                  Show a pop-up before a Buy or Sell
                  position is placed.
                </span>
              </div>
            </label>

            <label className="profile-checkbox-row">
              <input
                type="checkbox"
                checked={tradeConfirmations.closeTrade}
                onChange={() =>
                  toggleTradeConfirmation(
                    "closeTrade",
                    "tradesphere_skip_close_confirm"
                  )
                }
              />

              <div>
                <strong>
                  Confirm before closing a trade
                </strong>

                <span>
                  Show a pop-up before an open position is
                  closed.
                </span>
              </div>
            </label>

            <label className="profile-checkbox-row">
              <input
                type="checkbox"
                checked={tradeConfirmations.riskEdit}
                onChange={() =>
                  toggleTradeConfirmation(
                    "riskEdit",
                    "tradesphere_skip_riskedit_confirm"
                  )
                }
              />

              <div>
                <strong>
                  Confirm before editing Stop Loss / Take
                  Profit
                </strong>

                <span>
                  Show a pop-up when changing SL or TP from
                  the chart tool or an open position.
                </span>
              </div>
            </label>
          </div>
        </section>

        <section className="profile-preferences-panel">
          <div className="profile-panel-heading">
            <div>
              <span className="eyebrow">
                TRADING PREFERENCES
              </span>

              <h2>Demo account settings</h2>
            </div>
          </div>

          <div className="profile-preference-list">
            <label className="profile-checkbox-row">
              <input type="checkbox" defaultChecked />

              <div>
                <strong>
                  Show guided demo after login
                </strong>

                <span>
                  Display the beginner walkthrough when
                  opening the dashboard.
                </span>
              </div>
            </label>

            <label className="profile-checkbox-row">
              <input type="checkbox" defaultChecked />

              <div>
                <strong>
                  Show trading explanations
                </strong>

                <span>
                  Display guidance about candles, expiry, and
                  trade direction.
                </span>
              </div>
            </label>

            <label className="profile-checkbox-row">
              <input type="checkbox" />

              <div>
                <strong>Compact market view</strong>

                <span>
                  Reduce spacing between crypto market rows.
                </span>
              </div>
            </label>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Profile;