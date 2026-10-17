import express from 'express';

export const bodyLimit = express.json({ limit: '1mb' });
