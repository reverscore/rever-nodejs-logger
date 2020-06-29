/*eslint no-console: "off"*/
const httpContext = require('express-http-context');
const path = require('path');
const util = require('util');
const { createLogger, format, transports } = require('winston');
const _ = require('lodash');

class Logger {
  constructor(metadata, options, customTransports = []) {
    this.validateMetadata(metadata);
    const _metadata = this.buildMetadataConfig(metadata);
    this.logger = this.initializeLogger(options, _metadata, customTransports);
  }

  validateMetadata(metadata) {
    if (!metadata.service || !metadata.environment) {
      throw new Error(
        'No service or environment configured when initializing the logger class.',
      );
    }
  }

  buildMetadataConfig(metadata) {
    return Object.assign({}, metadata, {
      service: `${metadata.service}-${metadata.environment}`,
    });
  }

  initializeLogger(options, metadata, customTransports) {
    return createLogger({
      level: 'info',
      exitOnError: false,
      format: format.json(),
      defaultMeta: metadata,
      transports: _.compact([
        this._enableConsoleTransport(options),
        this._enableDatadogTransport(options, metadata),
        this._enableFileTransport(options),
        ...customTransports,
      ]),
    });
  }

  _enableConsoleTransport(options) {
    return new transports.Console({
      format: format.simple(),
    });
  }

  _enableFileTransport(options) {
    if (options && options.filename) {
      return new transports.File({
        filename: options.filename,
      });
    }

    return null;
  }

  _enableDatadogTransport(options, _metadata) {
    if (options && options.datadog_api_key) {
      const httpTransportOptions = {
        host: 'http-intake.logs.datadoghq.com',
        path: `/v1/input/${options.datadog_api_key}?ddsource=nodejs&service=${_metadata.service}`,
        ssl: true,
      };

      return new transports.Http(httpTransportOptions);
    }

    return null;
  }

  setProcess(processName) {
    this.processName = processName;
  }

  setFilename(filename) {
    this.processName = path.basename(filename);
  }

  setMethodProcess(methodName) {
    if (!this.classProcessName) {
      this.classProcessName = this.processName;
    }
    const methodNameCapitalized =
      methodName.charAt(0).toUpperCase() + methodName.slice(1);
    this.setProcess(
      `${this.classProcessName}) (methods:${methodNameCapitalized}`,
    );
  }

  setLogId(logId) {
    this.createContext();
    httpContext.set('logId', logId);
  }

  getLogId() {
    return httpContext.get('logId');
  }

  setUserId(userId) {
    this.createContext();
    httpContext.set('userId', userId);
  }

  getUserId() {
    return httpContext.get('userId');
  }

  initMiddleware() {
    return httpContext.middleware;
  }

  createContext() {
    if (!httpContext.ns.active) {
      let context = httpContext.ns.createContext();
      httpContext.ns.context = context;
      httpContext.ns.active = context;
      return httpContext.ns;
    }
  }

  doLog(level, message, opts) {
    try {
      const logId = this.getLogId() || null;
      const userId = this.getUserId('userId') || null;

      if (!this.processName) {
        throw new Error('No process name set on logger');
      }

      const msg = `[${this.processName}]: ${message}`;
      const _opts = Object.assign({}, opts);
      // Adding as attributes does not enable search by attributes on datadog
      if (logId) {
        _opts.logId = logId;
        _opts.trace_id = logId;
      }

      if (userId) _opts.userId = userId;
      if (this.processName) _opts.processName = this.processName;

      return this.logger[level](msg, _opts);
    } catch (err) {
      return this.logger[level](err);
    }
  }

  i(message, opts) {
    this.doLog('info', message, opts);
  }

  l(message, opts) {
    return this.i(message, opts);
  }

  log(message, opts) {
    return this.i(message, opts);
  }

  info(message, opts) {
    return this.i(message, opts);
  }

  e(message, opts) {
    this.doLog('error', message, opts);
  }

  error(message, opts) {
    return this.e(message, opts);
  }

  w(message, opts) {
    this.doLog('warn', message, opts);
  }

  warn(message, opts) {
    return this.w(message, opts);
  }

  warning(message, opts) {
    return this.w(message, opts);
  }

  d(message, opts) {
    this.doLog('debug', message, opts);
  }

  debug(message, opts) {
    return this.d(message, opts);
  }

  test(message, opts) {
    if (opts) {
      console.log(message, opts);
    } else {
      console.log(message);
    }

    return;
  }
}

module.exports = Logger;
