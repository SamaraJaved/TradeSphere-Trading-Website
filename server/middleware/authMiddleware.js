import jwt from "jsonwebtoken";

async function protectRoute(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (
      !authorizationHeader ||
      !authorizationHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message: "Access denied. No authentication token provided.",
      });
    }

    const token = authorizationHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Access denied. Invalid authentication token.",
      });
    }

    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId =
      decodedToken.userId ||
      decodedToken.id ||
      decodedToken._id;

    if (!userId) {
      return res.status(401).json({
        message: "Invalid token. User information is missing.",
      });
    }

    req.userId = userId;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Your session has expired. Please log in again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    return res.status(500).json({
      message: "Could not authenticate the request.",
    });
  }
}

export default protectRoute;