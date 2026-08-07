import "dotenv/config";
import nodemailer from "nodemailer";

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error(
      "EMAIL_USER or EMAIL_APP_PASSWORD is missing from the .env file."
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },

    /*
      Without these, a stalled connection to Gmail's SMTP
      servers (seen on some cloud hosts, e.g. Railway) hangs
      the request indefinitely instead of failing fast, since
      Nodemailer's own defaults for these are several minutes.
    */
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendVerificationEmail(email, verificationCode) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"TradeSphere" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your TradeSphere account",

    html: `
      <div style="max-width:520px;margin:auto;padding:30px;font-family:Arial,sans-serif;">
        <div style="padding:30px;border:1px solid #dddddd;border-radius:12px;">
          <h1 style="color:#146c43;">Verify your email</h1>

          <p>Thank you for creating a TradeSphere account.</p>

          <p>Enter this verification code in the application:</p>

          <div
            style="
              margin:25px 0;
              padding:18px;
              text-align:center;
              background:#eaf7f0;
              border-radius:10px;
              font-size:32px;
              font-weight:bold;
              letter-spacing:8px;
              color:#0d5032;
            "
          >
            ${verificationCode}
          </div>

          <p>This code expires in 10 minutes.</p>

          <p style="color:#64706a;font-size:13px;">
            Ignore this email if you did not create this account.
          </p>
        </div>
      </div>
    `,
  };

  const result = await transporter.sendMail(mailOptions);

  console.log("Verification email sent:", result.messageId);
}

async function sendPasswordResetEmail(email, resetCode) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"TradeSphere" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your TradeSphere password",

    html: `
      <div style="max-width:520px;margin:auto;padding:30px;font-family:Arial,sans-serif;">
        <div style="padding:30px;border:1px solid #dddddd;border-radius:12px;">
          <h1 style="color:#146c43;">Reset your password</h1>

          <p>We received a request to reset your TradeSphere password.</p>

          <p>Enter this password-reset code in the application:</p>

          <div
            style="
              margin:25px 0;
              padding:18px;
              text-align:center;
              background:#eaf7f0;
              border-radius:10px;
              font-size:32px;
              font-weight:bold;
              letter-spacing:8px;
              color:#0d5032;
            "
          >
            ${resetCode}
          </div>

          <p>This code expires in 10 minutes.</p>

          <p style="color:#64706a;font-size:13px;">
            Ignore this email if you did not request a password reset.
          </p>
        </div>
      </div>
    `,
  };

  const result = await transporter.sendMail(mailOptions);

  console.log("Password reset email sent:", result.messageId);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const CLOSE_REASON_LABEL = {
  manual: "Manually Closed",
  stop_loss: "Stop Loss Reached",
  take_profit: "Take Profit Reached",
  cancelled: "Cancelled",
};

async function sendTradeClosedEmail({
  toEmail,
  userName,
  trade,
  virtualBalance,
}) {
  const transporter = createTransporter();

  const profitLoss = Number(trade.profitLoss || 0);
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;

  const resultLabel = isProfit
    ? "PROFIT"
    : isLoss
    ? "LOSS"
    : "BREAK-EVEN";

  const resultColor = isProfit
    ? "#146c43"
    : isLoss
    ? "#b3261e"
    : "#64706a";

  const closeReasonLabel =
    CLOSE_REASON_LABEL[trade.closeReason] ||
    "Closed";

  const sideLabel =
    trade.side === "sell" ? "SELL" : "BUY";

  const mailOptions = {
    from: `"TradeSphere" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${sideLabel} ${trade.asset} position closed — ${resultLabel} ${formatCurrency(
      profitLoss
    )}`,

    html: `
      <div style="max-width:560px;margin:auto;padding:30px;font-family:Arial,sans-serif;">
        <div style="padding:30px;border:1px solid #dddddd;border-radius:12px;">
          <h1 style="color:#146c43;margin-top:0;">Trade closed</h1>

          <p>Hi ${userName || "there"},</p>

          <p>
            Your ${sideLabel} position on <strong>${trade.asset}</strong>
            has been closed. Reason: <strong>${closeReasonLabel}</strong>.
          </p>

          <div
            style="
              margin:20px 0;
              padding:16px 18px;
              text-align:center;
              background:${isLoss ? "#fdecea" : "#eaf7f0"};
              border-radius:10px;
            "
          >
            <div style="font-size:13px;color:#64706a;letter-spacing:1px;">
              REALIZED PROFIT / LOSS
            </div>

            <div
              style="
                margin-top:6px;
                font-size:28px;
                font-weight:bold;
                color:${resultColor};
              "
            >
              ${resultLabel} ${formatCurrency(profitLoss)}
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tbody>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Asset</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${trade.asset}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Side</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${sideLabel}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Quantity</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${trade.quantity}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Entry price</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${formatCurrency(trade.entryPrice)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Closing price</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${formatCurrency(trade.closingPrice)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Stop Loss</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${
                  trade.stopLoss
                    ? formatCurrency(trade.stopLoss)
                    : "Not set"
                }</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Take Profit</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${
                  trade.takeProfit
                    ? formatCurrency(trade.takeProfit)
                    : "Not set"
                }</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Close reason</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${closeReasonLabel}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Opened at</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${formatDateTime(trade.openedAt)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;">Closed at</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;">${formatDateTime(trade.closedAt)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64706a;border-top:1px solid #eeeeee;">Updated demo balance</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;border-top:1px solid #eeeeee;">${formatCurrency(virtualBalance)}</td>
              </tr>
            </tbody>
          </table>

          <p style="color:#64706a;font-size:13px;margin-top:24px;">
            This is a TradeSphere demo account notification. No real funds
            were involved.
          </p>
        </div>
      </div>
    `,
  };

  const result = await transporter.sendMail(mailOptions);

  console.log("Trade closed email sent:", result.messageId);
}

export {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTradeClosedEmail,
};