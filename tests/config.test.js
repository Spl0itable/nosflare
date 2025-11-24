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

test('pay-to-relay requires npub and limitation flags when enabled', () => {
  const invalidConfig = getConfigSnapshot();
  invalidConfig.PAY_TO_RELAY_ENABLED = true;
  invalidConfig.relayNpub = '';
  invalidConfig.relayInfo = {
    ...invalidConfig.relayInfo,
    limitation: { payment_required: false, restricted_writes: false },
  };

  const result = ConfigSchema.safeParse(invalidConfig);
  assert.equal(result.success, false, 'expected validation to fail for missing npub and flags');
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /relayNpub/);
    assert.match(messages, /payment_required/);
    assert.match(messages, /restricted_writes/);
  }
});

test('pay-to-relay must be disabled in relay info when feature is off', () => {
  const invalidConfig = getConfigSnapshot();
  invalidConfig.PAY_TO_RELAY_ENABLED = false;
  invalidConfig.relayInfo = {
    ...invalidConfig.relayInfo,
    limitation: { payment_required: true },
  };

  const result = ConfigSchema.safeParse(invalidConfig);
  assert.equal(result.success, false, 'expected validation to fail when limitation requests payment');
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /payment_required must be false/);
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

test('anti-spam requires at least one kind when enabled', () => {
  const invalidConfig = getConfigSnapshot();
  invalidConfig.enableAntiSpam = true;
  invalidConfig.antiSpamKinds = new Set();

  const result = ConfigSchema.safeParse(invalidConfig);
  assert.equal(result.success, false, 'expected anti-spam configuration to require kinds');
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /antiSpamKinds cannot be empty/);
  }
});

test('relay info requires contact and supported NIPs', () => {
  const invalidConfig = getConfigSnapshot();
  invalidConfig.relayInfo = {
    ...invalidConfig.relayInfo,
    contact: '',
    supported_nips: [],
  };

  const result = ConfigSchema.safeParse(invalidConfig);
  assert.equal(result.success, false, 'expected relay info validation to fail');
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    assert.match(messages, /contact is required/);
    assert.match(messages, /supported_nips must include/);
  }
});
