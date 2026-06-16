const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { upload } = require('../middleware/upload');

// POST: Add a product — accepts multipart/form-data with optional image field
router.post('/add', upload.single('image'), productController.createProduct);

// GET: Customer view — in-stock products only
router.get('/', productController.getStoreProducts);

// GET: Merchant view — all products including zero-stock
router.get('/all', productController.getAllStoreProducts);

// PUT: Update price, stock, description, or image
router.put('/update/:productId', upload.single('image'), productController.updateProduct);

module.exports = router;
