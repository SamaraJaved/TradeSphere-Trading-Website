import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [2, "Name must contain at least 2 characters."],
      maxlength: [50, "Name cannot contain more than 50 characters."],
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address.",
      ],
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must contain at least 6 characters."],
      select: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationCode: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },

    resetPasswordCode: {
      type: String,
      default: null,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    virtualBalance: {
      type: Number,
      default: 25000,
      min: [0, "Virtual balance cannot be negative."],
    },

    learningProgress: {
      currentLesson: {
        type: Number,
        default: 1,
      },

      completedLessons: {
        type: [Number],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

/*
  This middleware runs before saving a user.
  It converts the password into a secure hash.
*/
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/*
  This method is used during login and password checks.
*/
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;