import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    code: "",
    newPassword: "",
    confirmPassword: "",
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

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    if (
      !formData.email.trim() ||
      !formData.code.trim() ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      setMessage("Please complete all fields.");
      setMessageType("error");
      return;
    }

    if (formData.code.trim().length !== 6) {
      setMessage("The reset code must contain 6 digits.");
      setMessageType("error");
      return;
    }

    if (formData.newPassword.length < 6) {
      setMessage("New password must contain at least 6 characters.");
      setMessageType("error");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage("The passwords do not match.");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email.trim(),
            code: formData.code.trim(),
            newPassword: formData.newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Could not reset the password."
        );
        setMessageType("error");
        return;
      }

      setMessage(
        data.message ||
          "Password reset successfully. Redirecting to login..."
      );
      setMessageType("success");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (error) {
      console.error("Reset password error:", error);

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
            PASSWORD RESET
          </span>

          <h1>Create a new secure password.</h1>

          <p>
            Enter the six-digit code sent to your email and choose a new
            password for your account.
          </p>

          <div className="auth-stat-card">
            <span>Reset code validity</span>
            <strong>10 Minutes</strong>
            <small>
              Request a new code if the current one has expired.
            </small>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <Link to="/forgot-password" className="back-link">
            ← Request another code
          </Link>

          <div className="auth-heading">
            <span className="eyebrow">RESET PASSWORD</span>
            <h2>Set your new password</h2>
            <p>
              Use the code sent to your registered email address.
            </p>
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
              <label htmlFor="code">Six-digit reset code</label>

              <input
                type="text"
                id="code"
                name="code"
                placeholder="123456"
                value={formData.code}
                onChange={handleChange}
                disabled={isLoading}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New password</label>

              <input
                type="password"
                id="newPassword"
                name="newPassword"
                placeholder="Enter a new password"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm new password
              </label>

              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter your new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="new-password"
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
              {isLoading
                ? "Resetting Password..."
                : "Reset Password"}
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

export default ResetPassword;