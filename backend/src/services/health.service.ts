import type { AppConfig } from '../config/env.js';

export interface HealthStatus {
  status: 'ok';
  env: AppConfig['appEnv'];
  time: string;
}

export class HealthService {
  constructor(
    private readonly config: AppConfig,
    private readonly now: () => Date = () => new Date()
  ) {}

  getStatus(): HealthStatus {
    return {
      status: 'ok',
      env: this.config.appEnv,
      time: this.now().toISOString()
    };
  }
}
