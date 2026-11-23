const router = require('express').Router();
const multer = require('multer');
const { upload, createDraft, updateDraft, demo, getById, listBuildings } = require('../controllers/map.controller');
const mapUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/', listBuildings);
router.get('/demo', demo);
router.post('/upload', mapUpload.single('file'), upload);
router.post('/draft', createDraft);
router.put('/:id/draft', updateDraft);
router.get('/:id', getById);
module.exports = router;
