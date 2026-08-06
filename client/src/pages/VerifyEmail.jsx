import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!normalizedEmail || !trimmedCode) {
      setMessage("Email and verification code are required.");
      setMessageType("error");
      return;
    }

    if (trimmedCode.length !== 6) {
      setMessage("Verification code must contain 6 digits.");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/verify-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            code: trimmedCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Email verification failed."
        );
        setMessageType("error");
        return;
      }

      setMessage(
        data.message ||
          "Email verified successfully. Redirecting to login..."
      );
      setMessageType("success");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      console.error("Verification error:", error);

      setMessage(
        "Could not connect to the backend. Make sure the server is running."
      );
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    setMessage("");
    setMessageType("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setMessage("Enter your email address first.");
      setMessageType("error");
      return;
    }

    try {
      setIsResending(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not resend the verification code."
        );
        setMessageType("error");
        return;
      }

      setMessage(
        data.message ||
          "A new verification code has been sent."
      );
      setMessageType("success");
      setCode("");
    } catch (error) {
      console.error("Resend verification error:", error);

      setMessage(
        "Could not connect to the backend. Make sure the server is running."
      );
      setMessageType("error");
    } finally {
      setIsResending(false);
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
            EMAIL VERIFICATION
          </span>

          <h1>Verify your account before you begin trading.</h1>

          <p>
            Enter the six-digit code sent to your email address. The code
            expires after 10 minutes.
          </p>

          <div className="auth-stat-card">
            <span>Code validity</span>
            <strong>10 Minutes</strong>
            <small>
              Request a new code if the current one has expired.
            </small>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <Link to="/signup" className="back-link">
            ← Back to signup
          </Link>

          <div className="auth-heading">
            <span className="eyebrow">VERIFY EMAIL</span>
            <h2>Enter verification code</h2>
            <p>Check your inbox and spam folder.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>

              <input
                type="email"
                id="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                disabled={isLoading || isResending}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="code">Six-digit code</label>

              <input
                type="text"
                id="code"
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6)
                  )
                }
                placeholder="123456"
                maxLength={6}
                disabled={isLoading || isResending}
                inputMode="numeric"
                autoComplete="one-time-code"
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
              disabled={isLoading || isResending}
            >
              {isLoading ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              className="text-button"
              onClick={handleResendCode}
              disabled={isLoading || isResending}
            >
              {isResending
                ? "Sending new code..."
                : "Resend verification code"}
            </button>
          </form>

          <p className="auth-switch">
            Already verified?
            <Link to="/login"> Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;