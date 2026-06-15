const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// POST: Create a Razorpay order (returns order id + key for frontend popup)
router.post('/create-razorpay-order', orderController.createRazorpayOrder);

// POST: Verify Razorpay payment signature and save the order
router.post('/verify-payment', orderController.verifyAndPlaceOrder);

// POST: Place a Cash on Delivery order
router.post('/checkout', orderController.placeCODOrder);

// GET: Fetch all orders for a store (merchant dashboard)
router.get('/store/:storeId', orderController.getStoreOrders);

// PUT: Update the status of a specific order
router.put('/status/:orderId', orderController.updateOrderStatus);

module.exports = router;
