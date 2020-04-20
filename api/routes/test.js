const express = require('express');
const testController = require('../controllers/test');

module.exports = (context) => {
  let router = express.Router();
  router.get('/start', testController.start.bind(context));
  router.get('/stop', testController.stop.bind(context));
  return router;
};
