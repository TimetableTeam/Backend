'use strict';

class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.extra = extra;
  }

  static badRequest(message, extra) {
    return new ApiError(400, message, extra);
  }
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }
  static conflict(message, extra) {
    return new ApiError(409, message, extra);
  }
  static internal(message = 'Something went wrong') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
