import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as orderController from '../controllers/order.controller';

const router = Router();
router.use(authenticate);

router.post('/place', orderController.placeOrder);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);
router.post('/:id/reconcile', orderController.reconcileOrder);
router.delete('/:id', orderController.cancelOrder);

export default router;
