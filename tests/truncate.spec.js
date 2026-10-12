const { expect } = require('chai');
const { applyBudget, DEFAULT_MAX_LOG_SIZE_BYTES, MIN_MAX_LOG_SIZE_BYTES } = require('../truncate');

const makeString = (length, fill = 'a') => fill.repeat(length);

describe('truncate.applyBudget', function () {
  it('Should pass small metadata through unchanged', function () {
    const metadata = { message: 'hello', items: [1, 2, 3] };
    const result = applyBudget(metadata, DEFAULT_MAX_LOG_SIZE_BYTES);
    expect(result.truncated).to.equal(false);
    expect(result.metadata).to.deep.equal(metadata);
  });

  it('Should not mark or alter payloads under budget', function () {
    const metadata = { items: Array.from({ length: 11 }, (_, i) => ({ id: i })) };
    const result = applyBudget(metadata, DEFAULT_MAX_LOG_SIZE_BYTES);
    expect(result.truncated).to.equal(false);
    expect(result.metadata).to.deep.equal(metadata);
  });

  it('Should truncate long strings with a suffix', function () {
    const metadata = { big: makeString(5000) };
    const result = applyBudget(metadata, 3000);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.big.startsWith(makeString(2048))).to.equal(true);
    expect(result.metadata.big).to.contain('[truncated');
  });

  it('Should cap arrays with a marker preserving originalLength', function () {
    const metadata = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, payload: makeString(200) })) };
    const result = applyBudget(metadata, 3000);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.items).to.have.lengthOf(11);
    expect(result.metadata.items[10]).to.deep.equal({ __truncated: true, originalLength: 50 });
    expect(result.metadata.items[0].id).to.equal(0);
  });

  it('Should truncate nested objects and arrays', function () {
    const metadata = { outer: { inner: { list: Array.from({ length: 30 }, () => makeString(3000)) } } };
    const result = applyBudget(metadata, 40000);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.outer.inner.list).to.have.lengthOf(11);
    expect(result.metadata.outer.inner.list[0].length).to.be.at.most(2100);
  });

  it('Should progressively reduce caps until under a tight budget', function () {
    const metadata = { items: Array.from({ length: 100 }, () => makeString(100)) };
    const result = applyBudget(metadata, 512);
    expect(result.truncated).to.equal(true);
    expect(Buffer.byteLength(JSON.stringify(result.metadata))).to.be.at.most(512);
  });

  it('Should collapse to preview when caps cannot reach the budget', function () {
    const metadata = { big: makeString(10000, 'x') };
    const result = applyBudget(metadata, 256);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.__truncated).to.equal(true);
    expect(result.metadata.originalSize).to.be.above(256);
    expect(result.metadata.preview).to.be.a('string');
    expect(Buffer.byteLength(JSON.stringify(result.metadata))).to.be.at.most(256);
  });

  it('Should never throw on circular structures', function () {
    const metadata = { name: 'circular' };
    metadata.self = metadata;
    const result = applyBudget(metadata, 204800);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.__truncated).to.equal(true);
  });

  it('Should preserve Date values on truncated records', function () {
    const metadata = { timestamp: new Date('2026-10-12T10:00:00.000Z'), items: Array.from({ length: 50 }, () => makeString(200)) };
    const result = applyBudget(metadata, 2048);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.timestamp).to.equal(metadata.timestamp);
  });

  it('Should never throw on BigInt metadata', function () {
    const metadata = { count: 9007199254740993n };
    const result = applyBudget(metadata, 204800);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.__truncated).to.equal(true);
  });

  it('Should handle null, undefined and empty metadata', function () {
    expect(applyBudget(null).truncated).to.equal(false);
    expect(applyBudget(undefined).truncated).to.equal(false);
    expect(applyBudget({}).truncated).to.equal(false);
  });

  it('Should export the 200 KiB default', function () {
    expect(DEFAULT_MAX_LOG_SIZE_BYTES).to.equal(200 * 1024);
  });

  it('Should export the supported minimum budget', function () {
    expect(MIN_MAX_LOG_SIZE_BYTES).to.equal(256);
  });

  it('Should report truthful originalLength across progressive passes', function () {
    const metadata = { items: Array.from({ length: 100 }, () => makeString(100)) };
    const result = applyBudget(metadata, 512);
    expect(result.truncated).to.equal(true);
    const markers = result.metadata.items.filter((item) => item && item.__truncated);
    expect(markers).to.have.lengthOf(1);
    expect(markers[0].originalLength).to.equal(100);
  });

  it('Should report truthful truncated-char counts across progressive passes', function () {
    const metadata = { big: makeString(10000) };
    const result = applyBudget(metadata, 1024);
    expect(result.truncated).to.equal(true);
    expect(result.metadata.big).to.contain('[truncated 9488 chars]');
  });
});
