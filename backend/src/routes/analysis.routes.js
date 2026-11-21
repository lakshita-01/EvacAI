const router = require('express').Router();
const multer = require('multer');
const { getCurrent, simulate, processLiveFrame } = require('../controllers/analysis.controller');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/current', getCurrent);
router.post('/simulate', simulate);
router.post('/live', upload.single('file'), processLiveFrame);
module.exports = router;
