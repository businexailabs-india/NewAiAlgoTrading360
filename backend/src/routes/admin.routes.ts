import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const result = await DatabaseService.getUsers(page, limit);
  res.json({ success: true, data: result });
}));

router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await DatabaseService.getAdminStats();
  res.json({ success: true, data: stats });
}));

export default router;
