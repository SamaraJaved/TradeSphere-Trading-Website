import { useState } from "react";
import { Link, useNavigate } from "react-router";

function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
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

    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
    } = formData;

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (
      !trimmedName ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      setMessage("Please complete all required fields.");
      setMessageType("error");
      return;
    }

    if (trimmedName.length < 2) {
      setMessage("Name must contain at least 2 characters.");
      setMessageType("error");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      setMessageType("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            email: normalizedEmail,
            phone: trimmedPhone || null,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Account creation failed."
        );
        setMessageType("error");
        return;
      }

      setMessage(
        "Account created successfully. Redirecting to email verification..."
      );
      setMessageType("success");

      setTimeout(() => {
        navigate("/verify-email", {
          state: {
            email: data.email || normalizedEmail,
          },
        });
      }, 1000);
    } catch (error) {
      console.error("Signup error:", error);

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
      <div className="auth-brand-panel signup-brand-panel">
        <Link to="/" className="logo auth-logo">
          <span className="logo-icon">T</span>
          <span>TradeSphere</span>
        </Link>

        <div className="auth-brand-content">
          <span className="eyebrow light-eyebrow">
            CREATE YOUR ACCOUNT
          </span>

          <h1>Start your paper-trading journey today.</h1>

          <p>
            Learn how trading works, build a virtual portfolio,
            and track your performance in one place.
          </p>

          <ul className="auth-benefit-list">
            <li>$25,000 virtual starting balance</li>
            <li>Mock stock and cryptocurrency trading</li>
            <li>Guided trading lessons</li>
            <li>Portfolio and transaction tracking</li>
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <Link to="/" className="back-link">
            ← Back to home
          </Link>

          <div className="auth-heading">
            <span className="eyebrow">FREE REGISTRATION</span>
            <h2>Create your account</h2>
            <p>Complete the form to start paper trading.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full name *</label>

              <input
                type="text"
                id="name"
                name="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email address *</label>

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
              <label htmlFor="phone">Phone number</label>

              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="+92 300 1234567"
                value={formData.phone}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="tel"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>

              <input
                type="password"
                id="password"
                name="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm password *
              </label>

              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Enter your password again"
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
                ? "Creating Account..."
                : "Create Account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?
            <Link to="/login"> Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;