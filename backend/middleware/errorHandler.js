class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || (error.name === "CastError" ? 404 : 500);
  const message = statusCode === 500 && process.env.NODE_ENV === "production"
    ? "Internal server error."
    : error.message || "Internal server error.";

  if (process.env.NODE_ENV !== "production") {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {})
  });
}

module.exports = { AppError, notFound, errorHandler };
