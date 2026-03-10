require('dotenv').config();
const app = require('./app');
const config = require('./config');
const initDb = require('./db/init');

let server;

const startServer = async () => {
  await initDb();

  server = app.listen(config.port, () => {
    console.log(`Server running in ${config.env} mode on port ${config.port}`);
  });
};

(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (!server) {
    process.exit(0);
    return;
  }
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});
