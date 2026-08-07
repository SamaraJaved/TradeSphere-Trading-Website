import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import API_URL from "../config/api";

function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    if (!email.trim()) {
      setMessage("Please enter your email address.");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        `${API_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Could not process the password reset request."
        );
        setMessageType("error");
        return;
      }

      setMessage(data.message);
      setMessageType("success");

      setTimeout(() => {
        navigate("/reset-password", {
          state: {
            email: email.trim(),
          },
        });
      }, 1200);
    } catch (error) {
      console.error("Forgot password error:", error);

      setMessage(
        "Could not connect to the backend. Make sure the server is running."
      );
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <Link to="/" className="logo auth-logo">
          <span className="logo-icon">T</span>
          <span>TradeSphere</span>
        </Link>

        <div className="auth-brand-content">
          <span className="eyebrow light-eyebrow">
            ACCOUNT RECOVERY
          </span>

          <h1>Recover access to your account.</h1>

          <p>
            Enter your registered email address and we will send you a
            six-digit password reset code.
          </p>

          <div className="auth-stat-card">
            <span>Security notice</span>
            <strong>10 Minutes</strong>
            <small>
              Your password reset code will expire after 10 minutes.
            </small>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <Link to="/login" className="back-link">
            ← Back to login
          </Link>

          <div className="auth-heading">
            <span className="eyebrow">FORGOT PASSWORD</span>
            <h2>Request a reset code</h2>
            <p>Enter the email connected to your TradeSphere account.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>

              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {message && (
              <p
                className={
                  messageType === "error"
                    ? "form-message form-error"
                    : "form-message form-success"
                }
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary submit-button"
              disabled={isLoading}
            >
              {isLoading ? "Sending Code..." : "Send Reset Code"}
            </button>
          </form>

          <p className="auth-switch">
            Remember your password?
            <Link to="/login"> Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;