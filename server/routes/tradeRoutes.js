import express from "express";

import {
  placeTrade,
  getActiveTrades,
  closeTrade,
  updatePositionRiskLevels,
  getTradeHistory,
  getPortfolioSummary,
  settleExpiredTrades,
} from "../controllers/tradeController.js";

import protectRoute from "../middleware/authMiddleware.js";

const router = express.Router();

/*
  Open a Buy or Sell position
*/
router.post(
  "/",
  protectRoute,
  placeTrade
);

/*
  Get all currently open positions
*/
router.get(
  "/active",
  protectRoute,
  getActiveTrades
);

/*
  Get closed trade history
*/
router.get(
  "/history",
  protectRoute,
  getTradeHistory
);

/*
  Get portfolio and PnL summary
*/
router.get(
  "/portfolio",
  protectRoute,
  getPortfolioSummary
);

/*
  Check whether any open position
  reached Stop Loss or Take Profit
*/
router.post(
  "/check-risk-levels",
  protectRoute,
  settleExpiredTrades
);

/*
  Manually close an open position
*/
router.post(
  "/:tradeId/close",
  protectRoute,
  closeTrade
);

/*
  Update Stop Loss / Take Profit on
  an already-open position
*/
router.patch(
  "/:tradeId/risk",
  protectRoute,
  updatePositionRiskLevels
);

export default router;