import User from "../models/User.js";

async function getProfile(req, res) {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      message: "Could not fetch the user profile.",
    });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, phone } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    if (name !== undefined) {
      const trimmedName = String(name).trim();

      if (trimmedName.length < 2) {
        return res.status(400).json({
          message: "Name must contain at least 2 characters.",
        });
      }

      if (trimmedName.length > 50) {
        return res.status(400).json({
          message: "Name cannot contain more than 50 characters.",
        });
      }

      user.name = trimmedName;
    }

    if (phone !== undefined) {
      const trimmedPhone = String(phone).trim();

      user.phone = trimmedPhone || null;
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully.",

      user: {
        _id: user._id,
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
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      const validationMessages = Object.values(
        error.errors
      ).map((item) => item.message);

      return res.status(400).json({
        message: validationMessages[0],
        errors: validationMessages,
      });
    }

    return res.status(500).json({
      message: "Could not update the user profile.",
    });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "New password must contain at least 6 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message:
          "The new password must be different from the current password.",
      });
    }

    const user = await User.findById(req.userId).select(
      "+password"
    );

    if (!user) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const currentPasswordIsCorrect =
      await user.comparePassword(currentPassword);

    if (!currentPasswordIsCorrect) {
      return res.status(400).json({
        message: "The current password is incorrect.",
      });
    }

    /*
      User.js automatically hashes modified passwords
      before saving, so assign the plain new password here.
    */
    user.password = newPassword;

    await user.save();

    return res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);

    if (error.name === "ValidationError") {
      const validationMessages = Object.values(
        error.errors
      ).map((item) => item.message);

      return res.status(400).json({
        message: validationMessages[0],
        errors: validationMessages,
      });
    }

    return res.status(500).json({
      message: "Could not change the password.",
    });
  }
}

export {
  getProfile,
  updateProfile,
  changePassword,
};