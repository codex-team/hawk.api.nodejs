Error.stackTraceLimit = Infinity;

require("./src/env");
const { HawkAPI } = require("./src");

const start = async () => {
  const app = new HawkAPI();
  /**
   * Exit handler, called when received SIGTERM/SIGINT (Ctrl+C)
   */
  const exitHandler = async () => {
    console.log("Exiting...");
    try {
      await app.stop();
    } catch (e) {
      console.error(e);
    }
    /**
     * @todo it doesn't exit w/o this line,
     * so probably there's unhandled async functions/promises running after shutdown
     */
    process.exit(0);
  };

  /**
   * Unhandled exception handler
   * @param {Error} err - Exception
   */
  const exceptionHandler = async err => {
    if (err.name == "MongoNetworkError") {
      console.error("Mongo connection error:");
    } else {
      console.error("Uncaught exception:");
    }
    await exitHandler();
  };

  try {
    await app.start();
  } catch (err) {
    exceptionHandler(err);
  }

  process.on("SIGINT", exitHandler);
  process.on("SIGTERM", exitHandler);
  process.on("uncaughtException", exceptionHandler);
  process.on("unhandledRejection", exceptionHandler);
};

start();
