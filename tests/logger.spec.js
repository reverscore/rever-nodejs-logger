const { expect } = require('chai');
const { PassThrough } = require('stream');
const { transports } = require('winston');
const Logger = require('../index');

const buildLogger = (options = {}) => {
  const stream = new PassThrough();
  const records = [];
  stream.on('data', (chunk) => records.push(JSON.parse(chunk.toString())));
  const logger = new Logger(
    { service: 'service-test', environment: 'test' },
    { level: 'debug', ...options },
    undefined,
    [new transports.Stream({ stream })],
  );
  logger.setProcess('test');
  return { logger, records };
};

describe('Logger size guardrail', function () {
  it('Should not mark healthy logs', function () {
    const { logger, records } = buildLogger();
    logger.i('small', { foo: 'bar' });
    expect(records).to.have.lengthOf(1);
    expect(records[0].logTruncated).to.equal(undefined);
    expect(records[0].metadata).to.deep.equal({ foo: 'bar' });
  });

  it('Should truncate and mark records over the default budget', function () {
    const { logger, records } = buildLogger();
    logger.i('big', { items: Array.from({ length: 5000 }, (_, i) => ({ id: i, payload: 'x'.repeat(200) })) });
    expect(records).to.have.lengthOf(1);
    expect(records[0].logTruncated).to.equal(true);
    expect(records[0].metadata.__truncated).to.equal(true);
    expect(records[0].metadata.items).to.have.lengthOf(11);
  });

  it('Should honor options.maxLogSizeBytes', function () {
    const { logger, records } = buildLogger({ maxLogSizeBytes: 256 });
    logger.i('medium', { data: 'x'.repeat(2000) });
    expect(records[0].logTruncated).to.equal(true);
    expect(Buffer.byteLength(JSON.stringify(records[0].metadata))).to.be.at.most(256);
  });

  it('Should truncate error-level metadata too', function () {
    const { logger, records } = buildLogger();
    const error = new Error('boom');
    error.context = { items: Array.from({ length: 5000 }, () => 'y'.repeat(200)) };
    logger.e('failed', error);
    expect(records[0].logTruncated).to.equal(true);
  });
});
