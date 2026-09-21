const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { importCsv } = require('../services/csvImportService');

// @route POST /api/import/csv  (multipart/form-data, field name "file")
const uploadCsv = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No CSV file uploaded (expected field name "file")');

  const csvText = req.file.buffer.toString('utf-8');
  const summary = await importCsv({ csvText, userId: req.user._id });

  res.status(201).json({ success: true, data: summary });
});

module.exports = { uploadCsv };
