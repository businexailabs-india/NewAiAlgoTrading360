import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as predictionController from '../controllers/prediction.controller';

const router = Router();

router.use(authenticate);

router.get('/engines', predictionController.listEngines);
router.post('/engines', predictionController.createEngine);
router.get('/engines/:id', predictionController.getEngine);
router.put('/engines/:id', predictionController.updateEngine);
router.delete('/engines/:id', predictionController.deleteEngine);
router.post('/engines/:id/train', predictionController.trainEngine);
router.post('/engines/:id/predict', predictionController.runPredictions);
router.post('/engines/:id/deploy', predictionController.deployEngine);

export default router;
