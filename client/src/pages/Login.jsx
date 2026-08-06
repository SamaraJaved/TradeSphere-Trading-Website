import { useState } from "react";
import { Link, useNavigate } from "react-router";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  function handleForgotPassword() {
    navigate("/forgot-password", {
      state: {
        email: formData.email.trim(),
      },
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    if (!formData.email || !formData.password) {
      setMessage("Please complete all fields.");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email.trim(),
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed.");
        setMessageType("error");

        if (data.requiresVerification) {
          setTimeout(() => {
            navigate("/verify-email", {
              state: {
                email: data.email || formData.email.trim(),
              },
            });
          }, 1200);
        }

        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setMessage("Login successful. Redirecting...");
      setMessageType("success");

      setTimeout(() => {
        navigate("/dashboard");
      }, 700);
    } catch (error) {
      console.error("Login error:", error);

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
          <span className="eyebrow light-eyebrow">WELCOME BACK</span>

          <h1>Access your crypto trading dashboard.</h1>

          <p>
            Log in to explore crypto markets, view candlestick charts, and use
            the guided demo trading experience.
          </p>

          <div className="auth-stat-card">
            <span>Your demo balance</span>
            <strong>$25,000.00</strong>
            <small>Use simulated funds inside the MVP.</small>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <Link to="/" className="back-link">
            ← Back to home
          </Link>

          <div className="auth-heading">
            <span className="eyebrow">ACCOUNT ACCESS</span>
            <h2>Log in to TradeSphere</h2>
            <p>Enter your verified account details below.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>

              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="password">Password</label>

                <button
                  type="button"
                  className="text-button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>

              <input
                type="password"
                id="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="current-password"
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
              {isLoading ? "Logging In..." : "Log In"}
            </button>
          </form>

          <p className="auth-switch">
            Don&apos;t have an account?
            <Link to="/signup"> Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;