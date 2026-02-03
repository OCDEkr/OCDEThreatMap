/**
 * Logo Upload Route
 * Handles custom logo upload, retrieval, and deletion
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth-check');

// Paths
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
const CUSTOM_LOGO_PATH = path.join(UPLOAD_DIR, 'custom-logo.png');
const DEFAULT_LOGO = '/images/OCDE-SUP-blue.png';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('[Logo] Created uploads directory');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Always save as custom-logo with original extension
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'custom-logo' + ext);
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PNG, JPEG, GIF, SVG, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * Check if custom logo exists
 */
function hasCustomLogo() {
  // Check for any custom-logo file with various extensions
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  for (const ext of extensions) {
    const logoPath = path.join(UPLOAD_DIR, 'custom-logo' + ext);
    if (fs.existsSync(logoPath)) {
      return { exists: true, path: '/uploads/custom-logo' + ext };
    }
  }
  return { exists: false, path: null };
}

/**
 * GET /api/logo
 * Returns the current logo URL (custom if exists, otherwise default)
 */
router.get('/', (req, res) => {
  const customLogo = hasCustomLogo();

  res.json({
    success: true,
    isCustom: customLogo.exists,
    logoUrl: customLogo.exists ? customLogo.path : DEFAULT_LOGO,
    defaultUrl: DEFAULT_LOGO
  });
});

/**
 * POST /api/logo
 * Upload a custom logo (requires authentication)
 */
router.post('/', requireAuth, upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  // Remove any old custom logos with different extensions
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  const uploadedExt = path.extname(req.file.filename).toLowerCase();

  for (const ext of extensions) {
    if (ext !== uploadedExt) {
      const oldPath = path.join(UPLOAD_DIR, 'custom-logo' + ext);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
  }

  console.log(`[Logo] Custom logo uploaded: ${req.file.filename}`);

  res.json({
    success: true,
    message: 'Logo uploaded successfully',
    logoUrl: '/uploads/' + req.file.filename
  });
});

/**
 * DELETE /api/logo
 * Remove custom logo and revert to default (requires authentication)
 */
router.delete('/', requireAuth, (req, res) => {
  const customLogo = hasCustomLogo();

  if (!customLogo.exists) {
    return res.status(404).json({
      success: false,
      error: 'No custom logo to remove'
    });
  }

  // Remove all custom logo files
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  let removed = false;

  for (const ext of extensions) {
    const logoPath = path.join(UPLOAD_DIR, 'custom-logo' + ext);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
      removed = true;
      console.log(`[Logo] Removed custom logo: custom-logo${ext}`);
    }
  }

  res.json({
    success: true,
    message: 'Custom logo removed. Using default logo.',
    logoUrl: DEFAULT_LOGO
  });
});

// Error handling middleware for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
});

module.exports = router;
