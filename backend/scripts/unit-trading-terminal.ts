/**
 * Trading Terminal acceptance tests
 * Run: npx ts-node --transpile-only scripts/unit-trading-terminal.ts
 */
import { prisma } from '../src/config/database';
import { TradingTerminalService } from '../src/services/trading-terminal/trading-terminal.service';
import { validateLotSize } from '../src/libs/trading/instrument-catalog';
import { oppositeSide } from '../src/libs/trading/order-ticket';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(validateLotSize(25, 25) === null, 'lot ok');
  assert(validateLotSize(26, 25) !== null, 'lot fail');
  assert(oppositeSide('BUY') === 'SELL', 'opposite');

  const email = `tt-${Date.now()}@test.local`;
  const user = await prisma.user.create({
    data: { email, passwordHash: 'x', name: 'TT Test', role: 'user' }
  });

  try {
    await TradingTerminalService.ensureCatalogSeeded();
    const stocks = await TradingTerminalService.searchInstruments('RELIANCE');
    assert(stocks.some((s) => s.symbol === 'RELIANCE' && s.instrument_type === 'STOCK'), 'stock search');
    const stock = stocks.find((s) => s.instrument_type === 'STOCK')!;
    const trad = await TradingTerminalService.getTradability(user.id, stock.instrument_id);
    assert(trad.buy_sell_enabled === true, 'stock buy/sell enabled');

    const indices = await TradingTerminalService.searchInstruments('NIFTY');
    const indexSpot = indices.find((s) => s.instrument_type === 'INDEX')!;
    assert(!!indexSpot, 'nifty index');
    const idxTrad = await TradingTerminalService.getTradability(user.id, indexSpot.instrument_id);
    assert(idxTrad.index_spot_blocked === true, 'index blocked');
    assert(idxTrad.buy_sell_enabled === false, 'index no buy/sell');

    const deriv = await TradingTerminalService.getDerivatives(indexSpot.instrument_id);
    assert(deriv.contracts.length > 0, 'derivatives');
    const fut = deriv.contracts.find((c) => c.instrument_type === 'INDEX_FUTURE')!;
    assert(!!fut, 'future contract');
    const futTrad = await TradingTerminalService.getTradability(user.id, fut.instrument_id);
    assert(futTrad.buy_sell_enabled === true, 'future buy/sell');

    const livePreview = await TradingTerminalService.previewOrder(user.id, {
      instrument_id: stock.instrument_id,
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 1,
      mode: 'LIVE',
      source: 'ORDER_TICKET',
      price: 1400
    });
    assert(livePreview.required_approval === true, 'live requires approval');
    assert(
      livePreview.next_action === 'FIX_ERRORS' || livePreview.next_action === 'REQUEST_APPROVAL',
      'live not auto submit'
    );

    const paper = await TradingTerminalService.previewOrder(user.id, {
      instrument_id: stock.instrument_id,
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 1,
      mode: 'PAPER',
      source: 'CHART',
      price: 1400
    });
    assert(paper.allowed === true, 'paper preview allowed');
    const submitted = await TradingTerminalService.submitOrder(user.id, paper.preview_id);
    assert(!!submitted.order?.id, 'paper order created');
    console.log('OK paper order');

    const add = await TradingTerminalService.chartOrderAction(user.id, {
      instrument_id: stock.instrument_id,
      symbol: 'RELIANCE',
      action: 'ADD_QTY',
      quantity: 1,
      mode: 'PAPER',
      price: 1400
    });
    assert(!!add.order, 'add qty');
    console.log('OK add qty');

    const reduce = await TradingTerminalService.chartOrderAction(user.id, {
      instrument_id: stock.instrument_id,
      symbol: 'RELIANCE',
      action: 'REDUCE_QTY',
      quantity: 1,
      mode: 'PAPER',
      price: 1400
    });
    assert(!!reduce.order, 'reduce qty');
    console.log('OK reduce qty');

    let reduceOverFailed = false;
    try {
      await TradingTerminalService.chartOrderAction(user.id, {
        symbol: 'RELIANCE',
        action: 'REDUCE_QTY',
        quantity: 999999,
        mode: 'PAPER'
      });
    } catch {
      reduceOverFailed = true;
    }
    assert(reduceOverFailed, 'reduce cannot exceed open qty');

    const basket = await TradingTerminalService.createBasket(user.id, {
      basket_name: 'Test Basket',
      mode: 'PAPER'
    });
    await TradingTerminalService.addBasketLeg(user.id, basket.id, {
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 1,
      price: 1400
    });
    await TradingTerminalService.addBasketLeg(user.id, basket.id, {
      symbol: 'TCS',
      side: 'SELL',
      quantity: 1,
      price: 3500
    });
    const niftyOpt = (await TradingTerminalService.searchInstruments('NIFTY')).find(
      (i) => i.instrument_type === 'INDEX_OPTION' && i.option_type === 'CE'
    );
    if (niftyOpt) {
      await TradingTerminalService.addBasketLeg(user.id, basket.id, {
        instrument_id: niftyOpt.instrument_id,
        symbol: niftyOpt.symbol,
        side: 'BUY',
        quantity: niftyOpt.lot_size,
        price: 100
      });
    }
    const bp = await TradingTerminalService.previewBasket(user.id, basket.id);
    assert(typeof bp.total_estimated_margin === 'number', 'basket margin');
    assert(bp.allowed === true, 'basket risk ok');
    const bs = await TradingTerminalService.submitBasket(user.id, basket.id);
    assert(bs.filled >= 2, 'basket filled legs');
    console.log('OK basket');

    let indexDirectFailed = false;
    try {
      await TradingTerminalService.chartOrderAction(user.id, {
        instrument_id: indexSpot.instrument_id,
        action: 'BUY',
        quantity: 1,
        mode: 'PAPER'
      });
    } catch {
      indexDirectFailed = true;
    }
    assert(indexDirectFailed, 'index direct blocked');

    const audits = await TradingTerminalService.listAudits(user.id);
    assert(audits.length >= 5, 'audits exist');
    console.log('OK audits', audits.length);

    console.log('\nunit-trading-terminal: PASS');
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
