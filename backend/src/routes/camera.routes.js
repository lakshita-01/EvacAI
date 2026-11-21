const router = require('express').Router();
const { list, create, update, seedDemoCameras } = require('../controllers/camera.controller');
router.get('/', list);
router.post('/', create);
router.post('/seed-demo', seedDemoCameras);
router.put('/:id', update);
module.exports = router;
