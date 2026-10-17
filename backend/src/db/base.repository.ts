import type { DatabaseExecutor } from './client.js';

export abstract class BaseRepository {
  protected constructor(protected readonly db: DatabaseExecutor) {}

  protected async first<T>(rows: PromiseLike<T[]>): Promise<T | undefined> {
    const [row] = await rows;
    return row;
  }
}
