const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

// GET request for scanning the QR code
router.get('/scan/:storeSlug', storeController.verifyStoreScan);

// POST: Merchant login — slug + password
router.post('/login', storeController.merchantLogin);

// POST request for creating a store via Postman
router.post('/create', storeController.createStore);

// POST: Set or reset password for an existing store (Postman use)
router.post('/set-password', storeController.setStorePassword);

// GET: Generate and fetch the scannable QR image string for a shop
router.get('/qr/:storeSlug', storeController.getStoreQR);

// GET: Dynamic manifest with store-specific start_url (for PWA install)
router.get('/manifest', storeController.getStoreManifest);

module.exports = router;
