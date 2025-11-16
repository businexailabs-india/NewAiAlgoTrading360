import { Router } from 'express';
import {
  getLoginUrl,
  handleCallback,
  getBrokerConnections,
  disconnectBroker,
  syncHoldings
} from '../controllers/broker.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBrokerConnection } from '../middleware/validation.middleware';

const router = Router();

// Public route - get login URL
router.get('/login-url/:broker', validateBrokerConnection, getLoginUrl);

// Authenticated routes
router.use(authenticate);

router.get('/callback', handleCallback);
router.get('/connections', getBrokerConnections);
router.delete('/connections/:id', disconnectBroker);
router.post('/sync/:brokerId', syncHoldings);

export default router;
