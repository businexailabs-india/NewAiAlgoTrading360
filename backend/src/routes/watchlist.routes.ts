import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  addToDefaultWatchlist,
  addWatchlistSymbol,
  createWatchlist,
  deleteWatchlist,
  getWatchlist,
  listWatchlists,
  removeWatchlistSymbol,
  renameWatchlist
} from '../controllers/watchlist.controller';

const router = Router();

router.use(authenticate);

router.get('/watchlists', listWatchlists);
router.post('/watchlists', createWatchlist);
router.post('/watchlists/default/symbols', addToDefaultWatchlist);
router.get('/watchlists/:id', getWatchlist);
router.put('/watchlists/:id', renameWatchlist);
router.delete('/watchlists/:id', deleteWatchlist);
router.post('/watchlists/:id/symbols', addWatchlistSymbol);
router.delete('/watchlists/:id/symbols/:itemId', removeWatchlistSymbol);

export default router;
