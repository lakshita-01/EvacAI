const router = require('express').Router();
const { calculate, rerouteHandler, getCurrent, reset, resetAll } = require('../controllers/route.controller');
router.post('/calculate', calculate);
router.post('/reroute', rerouteHandler);
router.post('/reset-all', resetAll);
router.post('/reset', reset);
router.get('/current', getCurrent);
module.exports = router;
