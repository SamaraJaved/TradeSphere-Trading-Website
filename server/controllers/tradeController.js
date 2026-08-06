import Trade from "../models/Trade.js";
import User from "../models/User.js";

import {
  getCurrentPrice,
} from "../services/marketDataService.js";

const PRODUCT_ID_BY_ASSET = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
};

const SUPPORTED_BROKER =
  "TradeSphere Demo Broker";

/*
  Converts values such as:

  BTC -> BTC-USD
  ETH -> ETH-USD
  SOL -> SOL-USD
*/
function getProductIdForAsset(asset) {
  const normalizedAsset = String(
    asset || ""
  )
    .trim()
    .toUpperCase();

  return (
    PRODUCT_ID_BY_ASSET[
      normalizedAsset
    ] || null
  );
}

/*
  Uses only the market price stored on
  the backend.

  The frontend cannot decide the entry
  or closing price.
*/
function getTrustedMarketPrice(asset) {
  const productId =
    getProductIdForAsset(asset);

  if (!productId) {
    return null;
  }

  const price =
    getCurrentPrice(productId);

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }

  return Number(price);
}

function roundMoney(value) {
  return Number(
    Number(value || 0).toFixed(2)
  );
}

function roundQuantity(value) {
  return Number(
    Number(value || 0).toFixed(8)
  );
}

/*
  Empty SL/TP inputs are converted to null.
*/
function parseOptionalPrice(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const numericValue = Number(value);

  if (
    !Number.isFinite(numericValue) ||
    numericValue <= 0
  ) {
    return NaN;
  }

  return numericValue;
}

/*
  BUY:

  Profit when closing price is above entry.

  (closingPrice - entryPrice) * quantity

  SELL:

  Profit when closing price is below entry.

  (entryPrice - closingPrice) * quantity
*/
function calculatePositionProfitLoss(
  trade,
  closingPrice
) {
  const entryPrice =
    Number(trade.entryPrice);

  const quantity =
    Number(trade.quantity);

  let profitLoss = 0;

  if (trade.side === "buy") {
    profitLoss =
      (closingPrice - entryPrice) *
      quantity;
  }

  if (trade.side === "sell") {
    profitLoss =
      (entryPrice - closingPrice) *
      quantity;
  }

  return roundMoney(profitLoss);
}

/*
  Checks whether the current live price
  has reached SL or TP.
*/
function getAutomaticCloseReason(
  trade,
  currentPrice
) {
  const stopLoss =
    trade.stopLoss === null
      ? null
      : Number(trade.stopLoss);

  const takeProfit =
    trade.takeProfit === null
      ? null
      : Number(trade.takeProfit);

  if (trade.side === "buy") {
    if (
      Number.isFinite(stopLoss) &&
      currentPrice <= stopLoss
    ) {
      return "stop_loss";
    }

    if (
      Number.isFinite(takeProfit) &&
      currentPrice >= takeProfit
    ) {
      return "take_profit";
    }
  }

  if (trade.side === "sell") {
    if (
      Number.isFinite(stopLoss) &&
      currentPrice >= stopLoss
    ) {
      return "stop_loss";
    }

    if (
      Number.isFinite(takeProfit) &&
      currentPrice <= takeProfit
    ) {
      return "take_profit";
    }
  }

  return null;
}

/*
  Validates that SL and TP are on the
  correct sides of the entry price.
*/
function validateRiskLevels({
  side,
  entryPrice,
  stopLoss,
  takeProfit,
}) {
  if (side === "buy") {
    if (
      stopLoss !== null &&
      stopLoss >= entryPrice
    ) {
      return (
        "For a Buy position, stop loss " +
        "must be below the entry price."
      );
    }

    if (
      takeProfit !== null &&
      takeProfit <= entryPrice
    ) {
      return (
        "For a Buy position, take profit " +
        "must be above the entry price."
      );
    }
  }

  if (side === "sell") {
    if (
      stopLoss !== null &&
      stopLoss <= entryPrice
    ) {
      return (
        "For a Sell position, stop loss " +
        "must be above the entry price."
      );
    }

    if (
      takeProfit !== null &&
      takeProfit >= entryPrice
    ) {
      return (
        "For a Sell position, take profit " +
        "must be below the entry price."
      );
    }
  }

  return null;
}

/*
  Closes one position using the latest
  trusted backend market price.

  closeReason can be:

  manual
  stop_loss
  take_profit
*/
async function closePosition({
  trade,
  userId,
  closingPrice,
  closeReason,
}) {
  const profitLoss =
    calculatePositionProfitLoss(
      trade,
      closingPrice
    );

  /*
    status: "open" is included in the
    update condition to reduce the chance
    of closing the same position twice.
  */
  const closedTrade =
    await Trade.findOneAndUpdate(
      {
        _id: trade._id,
        user: userId,
        status: "open",
      },
      {
        $set: {
          status: "closed",
          closingPrice,
          closeReason,
          profitLoss,
          closedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

  if (!closedTrade) {
    return null;
  }

  /*
    We do not deduct the full position
    value when the position opens.

    The realised profit or loss is added
    to the demo balance when it closes.
  */
  const updatedUser =
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          virtualBalance:
            profitLoss,
        },
      },
      {
        new: true,
      }
    );

  if (!updatedUser) {
    throw new Error(
      "User account was not found."
    );
  }

  /*
    Keep balance at two decimal places.
  */
  updatedUser.virtualBalance =
    roundMoney(
      updatedUser.virtualBalance
    );

  await updatedUser.save();

  return {
    trade: closedTrade,
    virtualBalance:
      updatedUser.virtualBalance,
  };
}

/*
  Checks every open position belonging
  to a user.

  Positions are automatically closed when
  the trusted live price reaches SL or TP.
*/
async function checkOpenPositionsForUser(
  userId
) {
  const openTrades =
    await Trade.find({
      user: userId,
      status: "open",
    }).sort({
      openedAt: 1,
    });

  const automaticallyClosedTrades = [];

  for (const trade of openTrades) {
    const currentPrice =
      getTrustedMarketPrice(
        trade.asset
      );

    if (
      !Number.isFinite(currentPrice)
    ) {
      continue;
    }

    const closeReason =
      getAutomaticCloseReason(
        trade,
        currentPrice
      );

    if (!closeReason) {
      continue;
    }

    const result =
      await closePosition({
        trade,
        userId,
        closingPrice:
          currentPrice,
        closeReason,
      });

    if (result?.trade) {
      automaticallyClosedTrades.push(
        result.trade
      );
    }
  }

  return automaticallyClosedTrades;
}

/*
  Adds live values to an open trade
  without permanently storing a new
  database value every second.
*/
function addLivePositionValues(trade) {
  const tradeObject =
    trade.toObject
      ? trade.toObject()
      : trade;

  const currentPrice =
    getTrustedMarketPrice(
      tradeObject.asset
    );

  if (
    !Number.isFinite(currentPrice)
  ) {
    return {
      ...tradeObject,
      currentPrice: null,
      unrealizedProfitLoss: null,
    };
  }

  return {
    ...tradeObject,
    currentPrice,

    unrealizedProfitLoss:
      calculatePositionProfitLoss(
        tradeObject,
        currentPrice
      ),
  };
}

/*
  POST /api/trades

  Opens a Buy or Sell position.
*/
async function placeTrade(req, res) {
  try {
    const {
      asset,
      side,
      quantity,
      stopLoss,
      takeProfit,
      broker,
    } = req.body;

    if (
      !asset ||
      !side ||
      quantity === undefined
    ) {
      return res.status(400).json({
        message:
          "Please provide asset, side, and quantity.",
      });
    }

    const normalizedAsset =
      String(asset)
        .trim()
        .toUpperCase();

    const normalizedSide =
      String(side)
        .trim()
        .toLowerCase();

    const productId =
      getProductIdForAsset(
        normalizedAsset
      );

    if (!productId) {
      return res.status(400).json({
        message:
          "Asset must be BTC, ETH, or SOL.",
      });
    }

    if (
      !["buy", "sell"].includes(
        normalizedSide
      )
    ) {
      return res.status(400).json({
        message:
          "Side must be either buy or sell.",
      });
    }

    const numericQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {
      return res.status(400).json({
        message:
          "Quantity must be greater than zero.",
      });
    }

    const numericStopLoss =
      parseOptionalPrice(
        stopLoss
      );

    const numericTakeProfit =
      parseOptionalPrice(
        takeProfit
      );

    if (
      Number.isNaN(
        numericStopLoss
      )
    ) {
      return res.status(400).json({
        message:
          "Stop loss must be a valid positive price.",
      });
    }

    if (
      Number.isNaN(
        numericTakeProfit
      )
    ) {
      return res.status(400).json({
        message:
          "Take profit must be a valid positive price.",
      });
    }

    const normalizedBroker =
      String(
        broker ||
          SUPPORTED_BROKER
      ).trim();

    if (
      normalizedBroker !==
      SUPPORTED_BROKER
    ) {
      return res.status(400).json({
        message:
          "Only TradeSphere Demo Broker is currently supported.",
      });
    }

    const trustedEntryPrice =
      getTrustedMarketPrice(
        normalizedAsset
      );

    if (
      !Number.isFinite(
        trustedEntryPrice
      )
    ) {
      return res.status(503).json({
        message:
          "Live Coinbase market price is not available yet. Please try again shortly.",
      });
    }

    const riskValidationError =
      validateRiskLevels({
        side: normalizedSide,
        entryPrice:
          trustedEntryPrice,
        stopLoss:
          numericStopLoss,
        takeProfit:
          numericTakeProfit,
      });

    if (riskValidationError) {
      return res.status(400).json({
        message:
          riskValidationError,
      });
    }

    const user =
      await User.findById(
        req.userId
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User account not found.",
      });
    }

    /*
      The notional value is used as a
      simple demo risk limit.

      Example:

      BTC price: $64,000
      Quantity: 0.01 BTC
      Notional: $640
    */
    const positionValue =
      roundMoney(
        trustedEntryPrice *
          numericQuantity
      );

    if (
      positionValue >
      user.virtualBalance
    ) {
      return res.status(400).json({
        message:
          "The position value exceeds your available demo balance.",
      });
    }

    const trade =
      await Trade.create({
        user: req.userId,

        broker:
          SUPPORTED_BROKER,

        asset:
          normalizedAsset,

        productId,

        side:
          normalizedSide,

        quantity:
          roundQuantity(
            numericQuantity
          ),

        entryPrice:
          trustedEntryPrice,

        stopLoss:
          numericStopLoss,

        takeProfit:
          numericTakeProfit,

        status: "open",

        openedAt:
          new Date(),
      });

    return res.status(201).json({
      message:
        `${normalizedSide === "buy" ? "Buy" : "Sell"} position opened using the live Coinbase price.`,

      trade: addLivePositionValues(
        trade
      ),

      positionValue,

      virtualBalance:
        user.virtualBalance,
    });
  } catch (error) {
    console.error(
      "Open position error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not open the position.",
    });
  }
}

/*
  GET /api/trades/active

  Returns all open positions with:

  currentPrice
  unrealizedProfitLoss
*/
async function getActiveTrades(
  req,
  res
) {
  try {
    const automaticallyClosed =
      await checkOpenPositionsForUser(
        req.userId
      );

    const openTrades =
      await Trade.find({
        user: req.userId,
        status: "open",
      }).sort({
        openedAt: -1,
      });

    const tradesWithLiveValues =
      openTrades.map(
        addLivePositionValues
      );

    return res.status(200).json({
      count:
        tradesWithLiveValues.length,

      trades:
        tradesWithLiveValues,

      automaticallyClosedCount:
        automaticallyClosed.length,

      automaticallyClosedTrades:
        automaticallyClosed,
    });
  } catch (error) {
    console.error(
      "Get open positions error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not fetch open positions.",
    });
  }
}

/*
  POST /api/trades/:tradeId/close

  Manually closes an open position.
*/
async function closeTrade(req, res) {
  try {
    const { tradeId } =
      req.params;

    const trade =
      await Trade.findOne({
        _id: tradeId,
        user: req.userId,
      });

    if (!trade) {
      return res.status(404).json({
        message:
          "Position was not found.",
      });
    }

    if (
      trade.status !== "open"
    ) {
      return res.status(400).json({
        message:
          "This position is already closed.",
      });
    }

    const closingPrice =
      getTrustedMarketPrice(
        trade.asset
      );

    if (
      !Number.isFinite(
        closingPrice
      )
    ) {
      return res.status(503).json({
        message:
          "The live market price is unavailable. Please try again shortly.",
      });
    }

    const result =
      await closePosition({
        trade,
        userId: req.userId,
        closingPrice,
        closeReason: "manual",
      });

    if (!result) {
      return res.status(409).json({
        message:
          "The position was already closed.",
      });
    }

    return res.status(200).json({
      message:
        "Position closed manually using the live Coinbase price.",

      trade:
        result.trade,

      virtualBalance:
        result.virtualBalance,
    });
  } catch (error) {
    console.error(
      "Close position error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not close the position.",
    });
  }
}

/*
  PATCH /api/trades/:tradeId/risk

  Updates Stop Loss and/or Take Profit
  on an already-open position.
*/
async function updatePositionRiskLevels(
  req,
  res
) {
  try {
    const { tradeId } = req.params;
    const { stopLoss, takeProfit } =
      req.body;

    const trade =
      await Trade.findOne({
        _id: tradeId,
        user: req.userId,
      });

    if (!trade) {
      return res.status(404).json({
        message:
          "Position was not found.",
      });
    }

    if (
      trade.status !== "open"
    ) {
      return res.status(400).json({
        message:
          "This position is already closed.",
      });
    }

    const numericStopLoss =
      parseOptionalPrice(
        stopLoss
      );

    const numericTakeProfit =
      parseOptionalPrice(
        takeProfit
      );

    if (
      Number.isNaN(
        numericStopLoss
      )
    ) {
      return res.status(400).json({
        message:
          "Stop loss must be a valid positive price.",
      });
    }

    if (
      Number.isNaN(
        numericTakeProfit
      )
    ) {
      return res.status(400).json({
        message:
          "Take profit must be a valid positive price.",
      });
    }

    const riskValidationError =
      validateRiskLevels({
        side: trade.side,
        entryPrice: Number(
          trade.entryPrice
        ),
        stopLoss:
          numericStopLoss,
        takeProfit:
          numericTakeProfit,
      });

    if (riskValidationError) {
      return res.status(400).json({
        message:
          riskValidationError,
      });
    }

    trade.stopLoss =
      numericStopLoss;

    trade.takeProfit =
      numericTakeProfit;

    await trade.save();

    return res.status(200).json({
      message:
        "Stop Loss and Take Profit updated successfully.",

      trade: addLivePositionValues(
        trade
      ),
    });
  } catch (error) {
    console.error(
      "Update position risk levels error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not update the position.",
    });
  }
}

/*
  GET /api/trades/history

  Returns only closed positions.
*/
async function getTradeHistory(
  req,
  res
) {
  try {
    await checkOpenPositionsForUser(
      req.userId
    );

    const trades =
      await Trade.find({
        user: req.userId,

        status: {
          $in: [
            "closed",
            "cancelled",
          ],
        },
      }).sort({
        closedAt: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      count:
        trades.length,

      trades,
    });
  } catch (error) {
    console.error(
      "Get closed trades error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not fetch closed trades.",
    });
  }
}

/*
  GET /api/trades/portfolio
*/
async function getPortfolioSummary(
  req,
  res
) {
  try {
    await checkOpenPositionsForUser(
      req.userId
    );

    const user =
      await User.findById(
        req.userId
      ).select(
        "name email virtualBalance"
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User account not found.",
      });
    }

    const openTrades =
      await Trade.find({
        user: req.userId,
        status: "open",
      });

    const closedTrades =
      await Trade.find({
        user: req.userId,
        status: "closed",
      });

    const openTradesWithLiveValues =
      openTrades.map(
        addLivePositionValues
      );

    const totalOpenNotional =
      roundMoney(
        openTradesWithLiveValues.reduce(
          (total, trade) =>
            total +
            trade.entryPrice *
              trade.quantity,
          0
        )
      );

    const totalUnrealizedProfitLoss =
      roundMoney(
        openTradesWithLiveValues.reduce(
          (total, trade) =>
            total +
            Number(
              trade.unrealizedProfitLoss ||
                0
            ),
          0
        )
      );

    const totalRealizedProfitLoss =
      roundMoney(
        closedTrades.reduce(
          (total, trade) =>
            total +
            Number(
              trade.profitLoss || 0
            ),
          0
        )
      );

    const profitableTrades =
      closedTrades.filter(
        (trade) =>
          trade.profitLoss > 0
      ).length;

    const losingTrades =
      closedTrades.filter(
        (trade) =>
          trade.profitLoss < 0
      ).length;

    const breakEvenTrades =
      closedTrades.filter(
        (trade) =>
          trade.profitLoss === 0
      ).length;

    const winRate =
      closedTrades.length > 0
        ? Number(
            (
              (profitableTrades /
                closedTrades.length) *
              100
            ).toFixed(2)
          )
        : 0;

    const totalPortfolioValue =
      roundMoney(
        user.virtualBalance +
          totalUnrealizedProfitLoss
      );

    return res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
      },

      portfolio: {
        virtualBalance:
          user.virtualBalance,

        totalPortfolioValue,

        openPositions:
          openTrades.length,

        closedTrades:
          closedTrades.length,

        profitableTrades,

        losingTrades,

        breakEvenTrades,

        winRate,

        totalOpenNotional,

        totalUnrealizedProfitLoss,

        totalRealizedProfitLoss,

        /*
          Compatibility names for pages
          that still use the older fields.
        */
        activeTrades:
          openTrades.length,

        completedTrades:
          closedTrades.length,

        winningTrades:
          profitableTrades,

        drawTrades:
          breakEvenTrades,

        activeTradeAmount:
          totalOpenNotional,

        totalProfitLoss:
          totalRealizedProfitLoss,
      },

      openTrades:
        openTradesWithLiveValues,
    });
  } catch (error) {
    console.error(
      "Get portfolio summary error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not fetch portfolio information.",
    });
  }
}

/*
  Compatibility export.

  Your existing route may still call
  settleTrade.

  It now performs a manual close.
*/
const settleTrade = closeTrade;

/*
  Compatibility endpoint for the old
  /settle-expired route.

  There are no expiry-based trades now.
  It only checks open positions for SL/TP.
*/
async function settleExpiredTrades(
  req,
  res
) {
  try {
    const closedTrades =
      await checkOpenPositionsForUser(
        req.userId
      );

    const user =
      await User.findById(
        req.userId
      ).select(
        "virtualBalance"
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User account not found.",
      });
    }

    return res.status(200).json({
      message:
        closedTrades.length > 0
          ? `${closedTrades.length} position(s) closed because SL or TP was reached.`
          : "No stop-loss or take-profit level was reached.",

      count:
        closedTrades.length,

      trades:
        closedTrades,

      virtualBalance:
        user.virtualBalance,
    });
  } catch (error) {
    console.error(
      "Automatic position check error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not check open positions.",
    });
  }
}

export {
  placeTrade,
  getActiveTrades,
  closeTrade,
  updatePositionRiskLevels,
  settleTrade,
  getTradeHistory,
  getPortfolioSummary,
  settleExpiredTrades,
};