import { Router } from 'express';
import type { StationController } from '../controllers/station.controller.js';
import type { VoterController } from '../controllers/voter.controller.js';
import { requireHost } from '../middleware/require-host.js';
import type { VotingController } from '../controllers/voting.controller.js';
import type { AnalyticsController } from '../controllers/analytics.controller.js';

export function createHostStationsRouter(
  controller: StationController,
  voterController: VoterController,
  analyticsController: AnalyticsController
): Router {
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
  const analytics = Router({ mergeParams: true });
  analytics.get('/snapshot', analyticsController.snapshot);
  analytics.get('/audit', analyticsController.audit);
  analytics.get('/export.csv', analyticsController.exportCsv);
  router.use('/:stationId/analytics', analytics);
  const voters = Router({ mergeParams: true });
  voters.get('/', voterController.list);
  voters.post('/bulk-approve', voterController.bulkApprove);
  voters.post('/bulk-reject', voterController.bulkReject);
  voters.get('/integrity', voterController.integrity);
  voters.get('/export.csv', voterController.exportCsv);
  voters.post('/:voterId/approve', voterController.approve);
  voters.post('/:voterId/reject', voterController.reject);
  voters.post('/:voterId/revoke', voterController.revoke);
  voters.post('/:voterId/reissue-token', voterController.reissueToken);
  voters.post('/:voterId/block-number', voterController.blockNumber);
  router.use('/:stationId/voters', voters);
  router.get('/:stationId/activity-log', controller.activity);
  router.get('/:stationId', controller.detail);
  return router;
}

export function createPublicStationsRouter(
  controller: StationController,
  voterController: VoterController,
  votingController: VotingController
): Router {
  const router = Router({ mergeParams: true });
  router.post('/:publicId/register', voterController.register);
  router.post('/:publicId/status', voterController.status);
  router.post('/:publicId/vote/enter', votingController.enter);
  router.post('/:publicId/vote/submit', votingController.submit);
  router.get('/:publicId/results', votingController.results);
  router.get('/:publicId', controller.publicDetail);
  return router;
}
