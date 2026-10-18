export interface RateLimitCounterRepository {
  incrementWithinWindow(keyHash: string, now: Date, expiresAt: Date): Promise<number>;
  deleteExpired(now: Date, limit: number): Promise<number>;
}
