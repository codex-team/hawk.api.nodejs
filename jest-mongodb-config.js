module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 55011,
      dbName: 'hawk',
    },
    binary: {
      version: '4.2.13',
      skipMD5: true,
    },
    autoStart: false,
  },
};
