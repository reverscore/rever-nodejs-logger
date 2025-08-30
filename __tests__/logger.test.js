const { v4: uuidv4 } = require("uuid");
const Logger = require("../index");

describe("Logger", () => {
  let logger;

  beforeAll(() => {
    logger = new Logger(
      { service: "service-test", environment: "dev" },
      { filename: "./test.log" }
    );
    logger.setFilename(__filename);
  });

  it("should log simple string without error", () => {
    logger.setLogId(uuidv4());
    expect(() => logger.info("Hello simple string")).not.toThrow();
  });

  it("should log with object payload without error", () => {
    expect(() =>
      logger.info("Hello with object", { username: "someUser" })
    ).not.toThrow();
  });

  it("should catch and log an error object", () => {
    const error = new Error("Test error");
    expect(() => logger.error(error)).not.toThrow();
  });
});
