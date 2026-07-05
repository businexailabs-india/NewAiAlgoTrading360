import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as knowledgeController from '../controllers/knowledge.controller';

const router = Router();
router.use(authenticate);

router.get('/documents', knowledgeController.listDocuments);
router.post('/documents', knowledgeController.createDocument);
router.delete('/documents/:id', knowledgeController.deleteDocument);
router.post('/query', knowledgeController.queryKnowledge);
router.post('/reindex', knowledgeController.reindex);

export default router;
