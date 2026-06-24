// Shared error type thrown by both the live client and the mock adapter so
// pages can handle failures uniformly (status + Arabic message + optional data).

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}
