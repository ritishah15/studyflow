// middleware/errorHandler.js
// Centralised error handling middleware

function errorHandler(err, req, res, next) {
  // Log full error in dev, minimal in prod
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err);
  } else {
    console.error('[ERROR]', err.message);
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 5}MB.` });
  }

  // SyntaxError (bad JSON body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  // Default
  const statusCode = err.statusCode || err.status || 500;
  const message    = statusCode < 500 ? err.message : 'An unexpected server error occurred.';
  res.status(statusCode).json({ error: message });
}

// Wraps async route handlers so they forward thrown errors to errorHandler
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Creates an error with a specific HTTP status
function createError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

module.exports = { errorHandler, asyncHandler, createError };
