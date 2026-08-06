import { Link } from "react-router";
import Navbar from "../components/Navbar";

const marketData = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: "$227.16",
    change: "+1.28%",
    positive: true,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    price: "$319.94",
    change: "-0.74%",
    positive: false,
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: "$68,421",
    change: "+2.41%",
    positive: true,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: "$3,482",
    change: "+1.83%",
    positive: true,
  },
];

const features = [
  {
    icon: "📊",
    title: "Real-Time Market View",
    description:
      "Monitor stocks and cryptocurrencies through a simple and professional trading dashboard.",
  },
  {
    icon: "💼",
    title: "Virtual Portfolio",
    description:
      "Practice buying and selling assets using virtual funds without risking real money.",
  },
  {
    icon: "🔒",
    title: "Secure Account",
    description:
      "Create your personal account and securely access your portfolio and trading history.",
  },
];

function Home() {
  return (
    <div className="home-page">
      <Navbar />

      <main>
        <section className="hero">
          <div className="container hero-content">
            <div className="hero-text">
              <span className="eyebrow">SMARTER PAPER TRADING</span>

              <h1>
                Learn trading.
                <span> Build confidence.</span>
              </h1>

              <p>
                Practice buying and selling stocks and cryptocurrencies using
                virtual money. Track your portfolio and improve your trading
                decisions without financial risk.
              </p>

              <div className="hero-actions">
                <Link to="/signup" className="btn btn-primary btn-large">
                  Create Free Account
                </Link>

                <a href="#features" className="btn btn-secondary btn-large">
                  Explore Features
                </a>
              </div>

              <div className="hero-benefits">
                <span>✓ No real money required</span>
                <span>✓ Beginner friendly</span>
                <span>✓ Free virtual balance</span>
              </div>
            </div>

            <div className="dashboard-preview">
              <div className="preview-header">
                <div>
                  <span className="small-label">Portfolio balance</span>
                  <h2>$25,430.80</h2>
                </div>

                <span className="profit-badge">+4.82%</span>
              </div>

              <div className="chart-container">
                <div className="chart-label">$25K</div>

                <div className="chart">
                  <div className="chart-line">
                    <span className="chart-point point-one"></span>
                    <span className="chart-point point-two"></span>
                    <span className="chart-point point-three"></span>
                    <span className="chart-point point-four"></span>
                    <span className="chart-point point-five"></span>
                  </div>
                </div>

                <div className="chart-days">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                </div>
              </div>

              <div className="preview-stats">
                <div>
                  <span>Available cash</span>
                  <strong>$7,420.00</strong>
                </div>

                <div>
                  <span>Invested</span>
                  <strong>$18,010.80</strong>
                </div>

                <div>
                  <span>Today's return</span>
                  <strong className="positive-text">+$328.40</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="market-strip" id="markets">
          <div className="container">
            <div className="section-heading market-heading">
              <div>
                <span className="eyebrow">MARKET SNAPSHOT</span>
                <h2>Popular assets</h2>
              </div>

              <span className="demo-label">Demo data</span>
            </div>

            <div className="market-grid">
              {marketData.map((asset) => (
                <article className="market-card" key={asset.symbol}>
                  <div className="asset-icon">{asset.symbol.charAt(0)}</div>

                  <div className="asset-details">
                    <strong>{asset.symbol}</strong>
                    <span>{asset.name}</span>
                  </div>

                  <div className="asset-price">
                    <strong>{asset.price}</strong>
                    <span
                      className={
                        asset.positive ? "positive-text" : "negative-text"
                      }
                    >
                      {asset.change}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="container">
            <div className="section-heading centered-heading">
              <span className="eyebrow">CORE FEATURES</span>
              <h2>Everything needed for your first trade</h2>
              <p>
                A simple platform designed to help beginners understand the
                basic trading workflow.
              </p>
            </div>

            <div className="features-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="steps-section" id="how-it-works">
          <div className="container">
            <div className="section-heading centered-heading">
              <span className="eyebrow">HOW IT WORKS</span>
              <h2>Start in three simple steps</h2>
            </div>

            <div className="steps-grid">
              <article className="step-card">
                <span>01</span>
                <h3>Create your account</h3>
                <p>Register using your name, email address, and password.</p>
              </article>

              <article className="step-card">
                <span>02</span>
                <h3>Receive virtual funds</h3>
                <p>Begin with a virtual balance to practice your trades.</p>
              </article>

              <article className="step-card">
                <span>03</span>
                <h3>Build your portfolio</h3>
                <p>Buy mock assets and monitor your portfolio performance.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="container">
            <div className="cta-card">
              <div>
                <span className="eyebrow light-eyebrow">START PRACTICING</span>
                <h2>Ready to make your first virtual trade?</h2>
                <p>
                  Create your account and receive a virtual trading balance.
                </p>
              </div>

              <Link to="/signup" className="btn btn-light btn-large">
                Get Started Free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-content">
          <Link to="/" className="logo footer-logo">
            <span className="logo-icon">T</span>
            <span>TradeSphere</span>
          </Link>

          <p>
            A paper-trading demonstration project built with the MERN stack.
          </p>

          <span>© 2026 TradeSphere</span>
        </div>
      </footer>
    </div>
  );
}

export default Home;