/**
 * Pure unit checks (no DB) for encryption + capability registry.
 * Run: npx ts-node scripts/unit-encryption-capabilities.ts
 */
import { EncryptionService } from '../src/services/encryption.service';
import { capabilityMatrixFromTools, getCapabilityDef, DHAN_CAPABILITY_REGISTRY } from '../src/services/dhan-capability.registry';
import { OrderReconcilerService } from '../src/services/order-reconciler.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const payload = EncryptionService.encryptJson({ clientId: '111', accessToken: 'tok' });
const parsed = EncryptionService.decryptJson<{ clientId: string; accessToken: string }>(payload);
assert(parsed?.clientId === '111' && parsed.accessToken === 'tok', 'json encrypt failed');
assert(EncryptionService.maskSecret('1234567890', 4).endsWith('7890'), 'mask failed');

const matrix = capabilityMatrixFromTools(['trading_agent_tool', 'alerts_agent_tool']);
assert(matrix['trading.place'] === true, 'trading.place missing');
assert(matrix['alerts.create'] === true, 'alerts.create missing');
assert(matrix['portfolio.funds'] === false, 'portfolio.funds should be false');
assert(getCapabilityDef('trading.cancel').tool === 'trading_agent_tool', 'def lookup failed');
assert(DHAN_CAPABILITY_REGISTRY.length >= 20, 'registry too small');

assert(OrderReconcilerService.normalizeStatus('PART_TRADED') === 'PARTIAL', 'partial map');
assert(OrderReconcilerService.normalizeStatus('REJECTED') === 'REJECTED', 'reject map');

console.log('unit-encryption-capabilities: PASS');
