const router = require('express').Router();
const { list, create, resolve, resolveAll } = require('../controllers/alert.controller');
router.get('/', list);
router.post('/', create);
router.post('/resolve-all', resolveAll);
router.patch('/:id', resolve);
module.exports = router;
