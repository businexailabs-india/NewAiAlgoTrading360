/**
 * Collect 5-10 years of daily OHLCV data for NIFTY 50 stocks.
 * Usage: npx ts-node scripts/collect-historical-data.ts [years]
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { HistoricalDataService } from '../src/services/historical-data.service';

const years = parseInt(process.argv[2] || '10', 10);

async function main() {
  console.log(`\n📊 SmartTrade Historical Data Collector`);
  console.log(`   Years: ${years}`);
  console.log(`   Output: ${HistoricalDataService.getDataDir()}\n`);

  const result = await HistoricalDataService.collectUniverse(undefined, years);

  console.log(`\n✅ Collected: ${result.summary.totalSymbols} symbols`);
  console.log(`   Total bars: ${result.summary.totalBars.toLocaleString()}`);
  if (result.failed.length) {
    console.log(`\n⚠️  Failed (${result.failed.length}):`);
    result.failed.forEach(f => console.log(`   - ${f.symbol}: ${f.error}`));
  }
  console.log(`\n📁 Data saved to: ${HistoricalDataService.getDataDir()}`);
}

main().catch(err => {
  console.error('Collection failed:', err);
  process.exit(1);
});
