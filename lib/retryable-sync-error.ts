export class RetryableSyncError extends Error {
  constructor() {
    super("The authorized dividend source is temporarily unavailable.");
    this.name = "RetryableSyncError";
  }
}
