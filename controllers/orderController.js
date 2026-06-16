const { PrismaClient } = require('@prisma/client');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Razorpay is optional — only initialised when keys are present
const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

// ── HELPER: find-or-create user + register to store ──────────────────────────
async function resolveUser(phone, customerName, storeId) {
  const user = await prisma.user.upsert({
    where: { phone },
    update: { name: customerName },
    create: { phone, name: customerName }
  });
  await prisma.storeCustomer.upsert({
    where: { storeId_userId: { storeId: parseInt(storeId), userId: user.id } },
    update: {},
    create: { storeId: parseInt(storeId), userId: user.id }
  });
  return user;
}

// ── HELPER: build OrderItem create array from cart ────────────────────────────
// cart: { productId: { name, price, quantity } }
function buildItemsPayload(cart) {
  return Object.entries(cart).map(([productId, item]) => ({
    productId: parseInt(productId),
    name: item.name,
    price: parseFloat(item.price),
    quantity: parseInt(item.quantity)
  }));
}

// ── HELPER: decrement stock for each item in cart ─────────────────────────────
async function decrementStock(cart) {
  const updates = Object.entries(cart).map(([productId, item]) =>
    prisma.product.update({
      where: { id: parseInt(productId) },
      data: { stock: { decrement: parseInt(item.quantity) } }
    })
  );
  await Promise.all(updates);
}

// ── 1. CREATE RAZORPAY ORDER ──────────────────────────────────────────────────
exports.createRazorpayOrder = async (req, res) => {
  if (!razorpay)
    return res.status(503).json({ success: false, message: "Online payments are not configured yet." });

  const { totalAmount } = req.body;
  if (!totalAmount || totalAmount <= 0)
    return res.status(400).json({ success: false, message: "Invalid amount." });

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(parseFloat(totalAmount) * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });
    return res.json({
      success: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({ success: false, message: "Could not initiate payment." });
  }
};

// ── 2. VERIFY PAYMENT + SAVE ORDER ───────────────────────────────────────────
exports.verifyAndPlaceOrder = async (req, res) => {
  if (!razorpay)
    return res.status(503).json({ success: false, message: "Online payments are not configured yet." });

  const {
    phone, customerName, storeId, totalAmount, deliveryAddress, cart,
    razorpayOrderId, razorpayPaymentId, razorpaySignature
  } = req.body;

  if (!phone || !storeId || !totalAmount || !deliveryAddress ||
      !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ success: false, message: "Missing payment verification fields." });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature)
    return res.status(400).json({ success: false, message: "Payment verification failed." });

  try {
    const user = await resolveUser(phone, customerName, storeId);
    const newOrder = await prisma.order.create({
      data: {
        storeId: parseInt(storeId),
        userId: user.id,
        totalAmount: parseFloat(totalAmount),
        deliveryAddress,
        status: 'PENDING',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        razorpayOrderId,
        razorpayPaymentId,
        items: { create: cart ? buildItemsPayload(cart) : [] }
      }
    });
    if (cart) await decrementStock(cart);
    return res.status(201).json({
      success: true,
      message: "Payment verified! Order placed successfully.",
      orderId: newOrder.id,
      status: newOrder.status,
      paymentStatus: newOrder.paymentStatus
    });
  } catch (error) {
    console.error("Error placing online order:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── 3. PLACE COD ORDER ────────────────────────────────────────────────────────
exports.placeCODOrder = async (req, res) => {
  const { phone, customerName, storeId, totalAmount, deliveryAddress, cart } = req.body;

  if (!phone || !storeId || !totalAmount || !deliveryAddress) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  try {
    const user = await resolveUser(phone, customerName, storeId);
    const newOrder = await prisma.order.create({
      data: {
        storeId: parseInt(storeId),
        userId: user.id,
        totalAmount: parseFloat(totalAmount),
        deliveryAddress,
        status: 'PENDING',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        items: { create: cart ? buildItemsPayload(cart) : [] }
      }
    });
    if (cart) await decrementStock(cart);
    return res.status(201).json({
      success: true,
      message: "Order placed! Pay cash on delivery.",
      orderId: newOrder.id,
      status: newOrder.status,
      paymentStatus: newOrder.paymentStatus
    });
  } catch (error) {
    console.error("Error placing COD order:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── 4. GET ORDERS BY CUSTOMER PHONE ──────────────────────────────────────────
exports.getCustomerOrders = async (req, res) => {
  const { phone } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user)
      return res.json({ success: true, orders: [] });

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: {
        store: { select: { name: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── 5. GET ALL ORDERS FOR A STORE (merchant dashboard) ───────────────────────
exports.getStoreOrders = async (req, res) => {
  const { storeId } = req.params;

  try {
    const orders = await prisma.order.findMany({
      where: { storeId: parseInt(storeId) },
      include: {
        user: { select: { name: true, phone: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("Error fetching shop orders:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── 6. UPDATE ORDER STATUS ────────────────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ['PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ success: false, message: "Invalid order status." });

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { status }
    });
    return res.json({ success: true, message: `Order status updated to ${status}.`, order: updatedOrder });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
