import { Link } from "react-router";

function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="logo">
          <span className="logo-icon">T</span>
          <span>TradeSphere</span>
        </Link>

        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#markets">Markets</a>
          <a href="#how-it-works">How It Works</a>
        </nav>

        <div className="nav-actions">
          <Link to="/login" className="btn btn-outline">
            Log In
          </Link>

          <Link to="/signup" className="btn btn-primary">
            Start Trading
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Navbar;