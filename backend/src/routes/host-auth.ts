import { Router } from 'express';
import type { HostAuthController } from '../controllers/host-auth.controller.js';
import { requireHost } from '../middleware/require-host.js';

export function createHostAuthRouter(controller: HostAuthController): Router {
  const router = Router();

  router.post('/signup', controller.signup);
  router.post('/login', controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', requireHost, controller.me);
  router.post('/forgot-password', controller.forgotPassword);
  router.post('/reset-password', controller.resetPassword);
  router.get('/verify-email', controller.verifyEmail);
  router.patch('/profile', requireHost, controller.profile);
  router.post('/change-password', requireHost, controller.changePassword);
  router.post('/change-tier', requireHost, controller.changeTier);
  router.post('/export-data', requireHost, controller.exportData);
  router.delete('/account', requireHost, controller.deleteAccount);

  return router;
}
