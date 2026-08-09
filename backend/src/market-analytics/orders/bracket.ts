export interface BracketLegs {
  parent: { transmit: boolean; parentId: number; orderType: string };
  stop: { transmit: boolean; parentId: number; orderType: string; ocaGroup: string };
  target: { transmit: boolean; parentId: number; orderType: string; ocaGroup: string };
}

export function buildBracketTransmitSequence(parentId: number, stopId: number, targetId: number, ocaGroup: string): BracketLegs {
  if (new Set([parentId, stopId, targetId]).size !== 3) throw new Error('order ids must be unique');
  return {
    parent: { transmit: false, parentId: 0, orderType: 'LMT' },
    stop: { transmit: false, parentId, orderType: 'STP', ocaGroup },
    target: { transmit: true, parentId, orderType: 'LMT', ocaGroup },
  };
}

export function validateBracketSequence(legs: BracketLegs): void {
  if (legs.parent.transmit !== false) throw new Error('parent must transmit=false');
  if (legs.stop.transmit !== false) throw new Error('stop must transmit=false');
  if (legs.target.transmit !== true) throw new Error('target must transmit=True');
  if (legs.stop.parentId !== legs.target.parentId) throw new Error('children must share parent');
  if (legs.stop.ocaGroup !== legs.target.ocaGroup) throw new Error('exits must share OCA');
}

export function safeExitQtyAfterPartial(filledQty: number, originalQty: number): number {
  if (filledQty <= 0) return 0;
  return Math.min(filledQty, originalQty);
}
