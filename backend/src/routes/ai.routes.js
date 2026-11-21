const router = require('express').Router();
const { health } = require('../controllers/ai.controller');
router.get('/health', health);
module.exports = router;
