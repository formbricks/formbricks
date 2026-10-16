/** Keep producers alive until HTTP requests finish; then wait for active worker jobs before exiting. */
exports.shutdown = async ({ closeHttp, closeWorkers, closeApp }) => {
  await closeHttp();
  await closeWorkers();
  await closeApp();
};
