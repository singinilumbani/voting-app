import { Router } from 'express';
import type { StationController } from '../controllers/station.controller.js';
import { requireHost } from '../middleware/require-host.js';

export function createHostStationsRouter(controller: StationController): Router {
  const router = Router();
  router.use(requireHost);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:stationId', controller.update);
  router.post('/:stationId/categories', controller.createCategory);
  router.patch('/:stationId/categories/:categoryId', controller.renameCategory);
  router.put('/:stationId/categories/order', controller.reorderCategories);
  router.delete('/:stationId/categories/:categoryId', controller.deleteCategory);
  router.post('/:stationId/categories/:categoryId/candidates', controller.createCandidate);
  router.patch('/:stationId/candidates/:candidateId', controller.editCandidate);
  router.delete('/:stationId/candidates/:candidateId', controller.deleteCandidate);
  router.post('/:stationId/uploads/sign', controller.signUpload);
  router.put('/:stationId/registration-config', controller.registrationConfig);
  router.put('/:stationId/voting-config', controller.votingConfig);
  router.post('/:stationId/launch', controller.launch);
  router.post('/:stationId/extend-registration', controller.extendRegistration);
  router.patch('/:stationId/voter-cap', controller.voterCap);
  router.post('/:stationId/start-voting', controller.startVoting);
  router.post('/:stationId/cancel', controller.cancel);
  router.get('/:stationId/activity-log', controller.activity);
  router.get('/:stationId', controller.detail);
  return router;
}

export function createPublicStationsRouter(controller: StationController): Router {
  const router = Router();
  router.get('/:publicId', controller.publicDetail);
  return router;
}
