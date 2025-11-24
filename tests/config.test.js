import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigSchema, ensureValidConfig, getConfigSnapshot } from '../src/config.js';

test('current configuration validates successfully', () => {
  assert.doesNotThrow(() => ensureValidConfig());
});

test('pay-to-relay requires positive pricing', () => {
  const invalidConfig = getConfigSnapshot();
  invalidConfig.PAY_TO_RELAY_ENABLED = true;
  invalidConfig.RELAY_ACCESS_PRICE_SATS = 0;

  const result = ConfigSchema.safeParse(invalidConfig);
  assert.equal(result.success, false, 'expected validation to fail for zero price');
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /RELAY_ACCESS_PRICE_SATS/);
  }
});

test('spam filter sets must contain numeric kinds', () => {
  const invalidConfig = getConfigSnapshot();
  invalidConfig.blockedEventKinds.add('invalid-kind');

  const result = ConfigSchema.safeParse(invalidConfig);
  assert.equal(result.success, false, 'expected validation to fail for invalid kind');
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /Expected number/);
  }
});
