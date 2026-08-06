import express from "express";

import {
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/userController.js";

import protectRoute from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/profile", protectRoute, getProfile);

router.patch("/profile", protectRoute, updateProfile);

router.patch(
  "/change-password",
  protectRoute,
  changePassword
);

export default router;