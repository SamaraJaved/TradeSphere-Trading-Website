import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /*
      This identifies the simulated broker
      responsible for executing the position.
    */
    broker: {
      type: String,
      required: true,
      trim: true,
      default: "TradeSphere Demo Broker",
    },

    /*
      Examples:
      asset: BTC
      productId: BTC-USD
    */
    asset: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    productId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: [
        "BTC-USD",
        "ETH-USD",
        "SOL-USD",
      ],
    },

    /*
      The old values were up/down.
      The new position values are buy/sell.
    */
    side: {
      type: String,
      required: true,
      enum: ["buy", "sell"],
      lowercase: true,
    },

    /*
      Crypto quantity, for example:

      0.01 BTC
      0.25 ETH
      2 SOL
    */
    quantity: {
      type: Number,
      required: true,
      min: 0.00000001,
    },

    /*
      The trusted live price obtained from
      the backend when the position opens.
    */
    entryPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    /*
      Optional risk-management prices.

      null means the user did not set that
      option for the position.
    */
    stopLoss: {
      type: Number,
      default: null,
      min: 0,
    },

    takeProfit: {
      type: Number,
      default: null,
      min: 0,
    },

    /*
      The price at which the position was
      finally closed.
    */
    closingPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    /*
      A position remains open until:

      - the user closes it manually
      - the market reaches stop loss
      - the market reaches take profit
    */
    status: {
      type: String,
      enum: [
        "open",
        "closed",
        "cancelled",
      ],
      default: "open",
      index: true,
    },

    closeReason: {
      type: String,
      enum: [
        "manual",
        "stop_loss",
        "take_profit",
        "cancelled",
        null,
      ],
      default: null,
    },

    /*
      Final realised profit or loss.

      Buy:
      (closingPrice - entryPrice) * quantity

      Sell:
      (entryPrice - closingPrice) * quantity
    */
    profitLoss: {
      type: Number,
      default: 0,
    },

    openedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
  Useful for loading a user's newest
  positions and trade history.
*/
tradeSchema.index({
  user: 1,
  createdAt: -1,
});

/*
  Useful for finding the user's currently
  open positions.
*/
tradeSchema.index({
  user: 1,
  status: 1,
});

/*
  Prevent invalid stop-loss and take-profit
  arrangements before saving a position.
*/
tradeSchema.pre("validate", function validateRiskLevels() {
  if (
    !Number.isFinite(this.entryPrice) ||
    !Number.isFinite(this.quantity)
  ) {
    return;
  }

  if (this.side === "buy") {
    if (
      this.stopLoss !== null &&
      this.stopLoss >= this.entryPrice
    ) {
      throw new Error(
        "For a Buy position, stop loss must be below the entry price."
      );
    }

    if (
      this.takeProfit !== null &&
      this.takeProfit <= this.entryPrice
    ) {
      throw new Error(
        "For a Buy position, take profit must be above the entry price."
      );
    }
  }

  if (this.side === "sell") {
    if (
      this.stopLoss !== null &&
      this.stopLoss <= this.entryPrice
    ) {
      throw new Error(
        "For a Sell position, stop loss must be above the entry price."
      );
    }

    if (
      this.takeProfit !== null &&
      this.takeProfit >= this.entryPrice
    ) {
      throw new Error(
        "For a Sell position, take profit must be below the entry price."
      );
    }
  }
});

const Trade = mongoose.model(
  "Trade",
  tradeSchema
);

export default Trade;