import express from "express";

import {
  getAllMarkets,
  getSingleMarket,
  getHistoricalCandles,
} from "../controllers/marketController.js";

const router = express.Router();

router.get("/", getAllMarkets);

/*
  Historical candles must come before
  the generic /:productId route.
*/
router.get(
  "/:productId/candles",
  getHistoricalCandles
);

router.get(
  "/:productId",
  getSingleMarket
);

export default router;