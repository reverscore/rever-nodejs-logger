const { v4: uuidv4 } = require('uuid');
const Logger = require('../index');
const logger = new Logger(
  { service: 'service-test', environment: 'dev' },
  {
    filename: './mylog.log',
    datadog_api_key: process.env.DATADOG_API_KEY,
  },
);
logger.setFilename(__filename);

function log() {
  logger.setLogId(uuidv4());
  logger.info('Hello simple string');
  logger.info('Hello with object', { username: 'someUser' });

  logger.info('This is my account', {
    account: {
      username: 'luis',
    },
  });
}

function catchError(message) {
  try {
    if (message.size > 5) {
      const error = new Error('Size too big', message);
      throw error;
    }
  } catch (error) {
    logger.error(error);
  }
}

setInterval(() => {
  log();
  catchError({ size: 10 });
}, 3000);
