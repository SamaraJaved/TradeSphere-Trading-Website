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

export {
  sendVerificationEmail,
  sendPasswordResetEmail,
};