export class ApiError extends Error {
  constructor(message, code = 'error', details = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}
