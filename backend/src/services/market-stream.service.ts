import { Server } from 'socket.io';
import { MarketService } from './market.service';
import { logger } from '../utils/logger';

const STREAM_INTERVAL_MS = 5000;

let interval: ReturnType<typeof setInterval> | null = null;

export function startMarketStream(io: Server): void {
  if (interval) return;

  const broadcast = async () => {
    try {
      const [indices, gainers, losers, sectors, breadth] = await Promise.all([
        MarketService.getIndices(),
        MarketService.getTopMovers('gainers', 10),
        MarketService.getTopMovers('losers', 10),
        MarketService.getSectorPerformance(),
        MarketService.getMarketBreadth()
      ]);

      io.emit('market:indices', indices);
      io.emit('market:gainers', gainers.data);
      io.emit('market:losers', losers.data);
      io.emit('market:sectors', sectors.data);
      io.emit('market:breadth', breadth);

      for (const idx of indices) {
        io.to(`index:${idx.name}`).emit('market:tick', { type: 'index', ...idx });
      }

      for (const quote of [...gainers.data, ...losers.data]) {
        io.to(`stock:${quote.symbol}`).emit('market:tick', { type: 'stock', ...quote });
      }
    } catch (err) {
      logger.warn(`Market stream tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  interval = setInterval(broadcast, STREAM_INTERVAL_MS);
  broadcast();
  logger.info(`Market live stream started (${STREAM_INTERVAL_MS}ms interval)`);
}

export function stopMarketStream(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
