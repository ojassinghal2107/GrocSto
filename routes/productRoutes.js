const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// POST: Add an item to a store's stock
router.post('/add', productController.createProduct);

// GET: Fetch all active items for a store (?storeId=X) — customer view, in-stock only
router.get('/', productController.getStoreProducts);

// GET: Fetch ALL items for merchant dashboard (?storeId=X) — includes zero-stock
router.get('/all', productController.getAllStoreProducts);

// PUT: Update an existing product's price, stock, or details
router.put('/update/:productId', productController.updateProduct);

module.exports = router;
