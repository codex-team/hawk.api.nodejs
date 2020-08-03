module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 54303,
      dbName: 'hawk',
    },
    binary: {
      version: '4.0.3',
      skipMD5: true,
    },
    autoStart: false,
  },
};
