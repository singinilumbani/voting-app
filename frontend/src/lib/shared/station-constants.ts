export const STATION_LIMITS = {
  categories: {
    minimum: 1,
  },
  candidatesPerCategory: {
    minimum: 2,
  },
  registration: {
    minimumVoters: 2,
    defaultVoters: 500,
    maximumVoters: 50_000,
    recommendedVoters: 2_500,
    minimumDurationHours: 1,
    defaultDurationHours: 12,
    maximumDurationHours: 24,
  },
  voting: {
    minimumDurationMinutes: 15,
    defaultDurationMinutes: 720,
    maximumDurationMinutes: 1_440,
    maximumScheduledDays: 7,
  },
  image: {
    maximumSideLength: 800,
    maximumFileBytes: 10 * 1024 * 1024,
  },
} as const;
