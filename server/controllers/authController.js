import crypto from "crypto";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/sendEmail.js";

function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(String(code).trim())
    .digest("hex");
}

function generateSixDigitCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function registerUser(request, response) {
  try {
    const { name, email, phone, password } = request.body;

    if (!name || !email || !password) {
      return response.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    if (String(name).trim().length < 2) {
      return response.status(400).json({
        success: false,
        message: "Name must contain at least 2 characters.",
      });
    }

    if (password.length < 6) {
      return response.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return response.status(409).json({
        success: false,
        message: "An account already exists with this email address.",
      });
    }

    const verificationCode = generateSixDigitCode();
    const hashedVerificationCode = hashCode(verificationCode);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      password,
      emailVerified: false,
      emailVerificationCode: hashedVerificationCode,
      emailVerificationExpires: new Date(
        Date.now() + 10 * 60 * 1000
      ),
    });

    try {
      await sendVerificationEmail(
        user.email,
        verificationCode
      );
    } catch (emailError) {
      console.error(
        "Verification email error:",
        emailError
      );

      await User.findByIdAndDelete(user._id);

      return response.status(500).json({
        success: false,
        message:
          "We could not send the verification email. Please check the email configuration and try again.",
      });
    }

    return response.status(201).json({
      success: true,
      message:
        "Account created successfully. A verification code has been sent to your email.",
      email: user.email,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        message: "An account already exists with this email address.",
      });
    }

    if (error.name === "ValidationError") {
      const validationMessages = Object.values(
        error.errors
      ).map((item) => item.message);

      return response.status(400).json({
        success: false,
        message: validationMessages[0],
        errors: validationMessages,
      });
    }

    return response.status(500).json({
      success: false,
      message:
        "Something went wrong while creating the account.",
    });
  }
}

export async function loginUser(request, response) {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return response.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordIsCorrect =
      await user.comparePassword(password);

    if (!passwordIsCorrect) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.emailVerified) {
      return response.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        message:
          "Please verify your email before logging in.",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return response.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        virtualBalance: user.virtualBalance,
        learningProgress: user.learningProgress,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return response.status(500).json({
      success: false,
      message: "Something went wrong while logging in.",
    });
  }
}

export async function verifyEmail(request, response) {
  try {
    const { email, code } = request.body;

    if (!email || !code) {
      return response.status(400).json({
        success: false,
        message:
          "Email and verification code are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedCode = hashCode(code);

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+emailVerificationCode +emailVerificationExpires"
    );

    if (!user) {
      return response.status(404).json({
        success: false,
        message: "User account was not found.",
      });
    }

    if (user.emailVerified) {
      return response.status(200).json({
        success: true,
        message: "Email is already verified.",
      });
    }

    if (
      !user.emailVerificationCode ||
      !user.emailVerificationExpires
    ) {
      return response.status(400).json({
        success: false,
        message:
          "No active verification code was found.",
      });
    }

    if (
      user.emailVerificationExpires.getTime() <
      Date.now()
    ) {
      return response.status(400).json({
        success: false,
        message: "Verification code has expired.",
      });
    }

    if (user.emailVerificationCode !== hashedCode) {
      return response.status(400).json({
        success: false,
        message: "Invalid verification code.",
      });
    }

    user.emailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;

    await user.save();

    return response.status(200).json({
      success: true,
      message:
        "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error(
      "Email verification error:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Something went wrong while verifying the email.",
    });
  }
}

export async function resendVerification(
  request,
  response
) {
  try {
    const { email } = request.body;

    if (!email) {
      return response.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+emailVerificationCode +emailVerificationExpires"
    );

    if (!user) {
      return response.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a verification code has been sent.",
      });
    }

    if (user.emailVerified) {
      return response.status(400).json({
        success: false,
        message:
          "This email address is already verified.",
      });
    }

    const verificationCode = generateSixDigitCode();

    user.emailVerificationCode =
      hashCode(verificationCode);

    user.emailVerificationExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await user.save();

    try {
      await sendVerificationEmail(
        user.email,
        verificationCode
      );
    } catch (emailError) {
      console.error(
        "Resend verification email error:",
        emailError
      );

      return response.status(500).json({
        success: false,
        message:
          "The verification code was created, but the email could not be sent.",
      });
    }

    return response.status(200).json({
      success: true,
      message:
        "A new verification code has been sent to your email.",
      email: user.email,
    });
  } catch (error) {
    console.error(
      "Resend verification error:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Something went wrong while resending the verification code.",
    });
  }
}

export async function forgotPassword(
  request,
  response
) {
  try {
    const { email } = request.body;

    if (!email) {
      return response.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+resetPasswordCode +resetPasswordExpires"
    );

    if (!user) {
      return response.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset code has been sent.",
      });
    }

    const resetCode = generateSixDigitCode();

    user.resetPasswordCode = hashCode(resetCode);

    user.resetPasswordExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await user.save();

    try {
      await sendPasswordResetEmail(
        user.email,
        resetCode
      );
    } catch (emailError) {
      console.error(
        "Password reset email error:",
        emailError
      );

      return response.status(500).json({
        success: false,
        message:
          "The password reset code was created, but the email could not be sent.",
      });
    }

    return response.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset code has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return response.status(500).json({
      success: false,
      message:
        "Something went wrong while processing the password reset request.",
    });
  }
}

export async function resetPassword(
  request,
  response
) {
  try {
    const { email, code, newPassword } =
      request.body;

    if (!email || !code || !newPassword) {
      return response.status(400).json({
        success: false,
        message:
          "Email, reset code, and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return response.status(400).json({
        success: false,
        message:
          "New password must contain at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedResetCode = hashCode(code);

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+password +resetPasswordCode +resetPasswordExpires"
    );

    if (!user) {
      return response.status(400).json({
        success: false,
        message:
          "Invalid or expired password reset code.",
      });
    }

    if (
      !user.resetPasswordCode ||
      !user.resetPasswordExpires
    ) {
      return response.status(400).json({
        success: false,
        message:
          "No active password reset request was found.",
      });
    }

    if (
      user.resetPasswordExpires.getTime() <
      Date.now()
    ) {
      user.resetPasswordCode = null;
      user.resetPasswordExpires = null;

      await user.save();

      return response.status(400).json({
        success: false,
        message: "Password reset code has expired.",
      });
    }

    if (
      user.resetPasswordCode !== hashedResetCode
    ) {
      return response.status(400).json({
        success: false,
        message: "Invalid password reset code.",
      });
    }

    const sameAsOldPassword =
      await user.comparePassword(newPassword);

    if (sameAsOldPassword) {
      return response.status(400).json({
        success: false,
        message:
          "The new password must be different from the current password.",
      });
    }

    /*
      User.js hashes modified passwords automatically
      before saving, so assign the plain new password here.
    */
    user.password = newPassword;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;

    await user.save();

    return response.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return response.status(500).json({
      success: false,
      message:
        "Something went wrong while resetting the password.",
    });
  }
}