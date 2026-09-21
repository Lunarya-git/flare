const express = require('express');
const multer = require('multer');
const { uploadCsv } = require('../controllers/importController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Keep the file in memory (not disk) - it's parsed immediately and never persisted as a file.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(new Error('Only .csv files are accepted'));
    }
    cb(null, true);
  },
});

router.post('/csv', upload.single('file'), uploadCsv);

module.exports = router;
