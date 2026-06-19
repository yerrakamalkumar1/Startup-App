const isProduction = process.env.NODE_ENV === "production";

class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

class ValidationError extends AppError {
  constructor(message = "Validation failed", details = []) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}

class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTH_ERROR");
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN");
  }
}

function errorHandler(err, req, res) {
  if (res.headersSent) return;

  const statusCode = err.statusCode || 500;
  const body = {
    success: false,
    error: err.code || "INTERNAL_ERROR",
    message: isProduction && statusCode === 500 ? "Internal server error" : err.message
  };

  if (err.details && !isProduction) body.details = err.details;
  if (!isProduction && err.stack) body.stack = err.stack.split("\n").slice(0, 6).join("\n");

  if (statusCode === 500) {
    console.error(`[ErrorHandler] ${err.message}`);
    if (!isProduction) console.error(err.stack);
  }

  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function wrapAsync(fn) {
  return (req, res, ...args) => {
    try {
      const result = fn(req, res, ...args);
      if (result && typeof result.catch === "function") {
        result.catch(err => errorHandler(err, req, res));
      }
    } catch (err) {
      errorHandler(err, req, res);
    }
  };
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  AuthError,
  ForbiddenError,
  errorHandler,
  wrapAsync
};
