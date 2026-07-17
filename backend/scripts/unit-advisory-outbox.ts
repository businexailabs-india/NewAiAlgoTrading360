/**
 * Lightweight checks for advisory outbox topic constants + HMAC signing shape.
 */
import { createHmac } from 'crypto';
import { KafkaTopics } from '../src/events/topics';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(KafkaTopics.USER_LOGIN_SUCCESS === 'user.login.success', 'login topic');
assert(KafkaTopics.ADVISORY_GENERATED === 'advisory.generated', 'generated topic');
assert(KafkaTopics.STRATEGY_PAPER_TEST_REQUESTED.includes('paper_test'), 'paper topic');

const secret = 'dev-service-hmac-secret-change-me';
const tenantId = 't1';
const userId = 'u1';
const role = 'user';
const requestId = 'r1';
const timestamp = 1000;
const payload = `${tenantId}:${userId}:${role}:${requestId}:${timestamp}`;
const sig = createHmac('sha256', secret).update(payload).digest('hex');
assert(sig.length === 64, 'hmac sha256 hex');

console.log('unit-advisory-outbox: PASS');
