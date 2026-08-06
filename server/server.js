import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";

import connectDatabase from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import tradeRoutes from "./routes/tradeRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import marketRoutes from "./routes/marketRoutes.js";

import {
  startMarketDataService,
  isMarketDataReady,
} from "./services/marketDataService.js";

dotenv.config();

/*
  This fixes the MongoDB Atlas SRV DNS issue
  on networks where the default DNS cannot resolve it.
*/
dns.setServers(["1.1.1.1", "8.8.8.8"]);

console.log(
  "Email user loaded:",
  Boolean(process.env.EMAIL_USER)
);

console.log(
  "Email password loaded:",
  Boolean(process.env.EMAIL_APP_PASSWORD)
);

const app = express();

/*
  Allows the React frontend to communicate
  with the backend.
*/
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

/*
  Allows Express to read JSON request bodies.
*/
app.use(express.json());

app.get("/", (request, response) => {
  response.status(200).json({
    success: true,
    message: "TradeSphere API is running.",
  });
});

app.get("/api/health", (request, response) => {
  response.status(200).json({
    success: true,
    message: "TradeSphere backend is healthy.",
    marketDataReady: isMarketDataReady(),
  });
});

/*
  API routes.
*/
app.use("/api/auth", authRoutes);
app.use("/api/trades", tradeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/markets", marketRoutes);

/*
  Handles routes that do not exist.
*/
app.use((request, response) => {
  response.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();

    /*
      Starts the Coinbase real-time market-data service.
      Prices are kept in backend memory.
    */
    startMarketDataService();

    app.listen(PORT, () => {
      console.log(
        `TradeSphere server is running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "The server could not start:",
      error.message
    );

    process.exit(1);
  }
}

startServer();