const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');

// 1. THE QR SCAN LOGIC (public — no password returned)
exports.verifyStoreScan = async (req, res) => {
  const { storeSlug } = req.params;

  try {
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true
        // password intentionally excluded
      }
    });

    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found. Please verify the QR code." });
    }

    return res.json({
      success: true,
      message: `Welcome to ${store.name}!`,
      store
    });
  } catch (error) {
    console.error("Error in verifyStoreScan:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 2. MERCHANT LOGIN — slug + password
exports.merchantLogin = async (req, res) => {
  const { slug, password } = req.body;

  if (!slug || !password) {
    return res.status(400).json({ success: false, message: "Slug and password are required." });
  }

  try {
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, address: true, city: true, password: true }
    });

    if (!store) {
      return res.status(401).json({ success: false, message: "Invalid slug or password." });
    }

    if (!store.password) {
      return res.status(401).json({ success: false, message: "This store has no password set. Use the /stores/create or /stores/set-password endpoint." });
    }

    const isMatch = await bcrypt.compare(password, store.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid slug or password." });
    }

    // Return store info without the password hash
    const { password: _, ...storeData } = store;
    return res.json({ success: true, store: storeData });
  } catch (error) {
    console.error("Error in merchantLogin:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 3. THE POSTMAN CREATION LOGIC
exports.createStore = async (req, res) => {
  const { name, slug, address, city, password } = req.body;

  if (!name || !slug || !address || !city || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields (name, slug, address, city, password) are required."
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newStore = await prisma.store.create({
      data: { name, slug, address, city, password: hashedPassword }
    });

    // Don't return the hash in the response
    const { password: _, ...storeData } = newStore;
    return res.status(201).json({
      success: true,
      message: "Store created successfully!",
      store: storeData
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: "A store with this slug already exists."
      });
    }
    console.error("Error creating store:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 4. GENERATE QR CODE FOR A STORE
exports.getStoreQR = async (req, res) => {
  const { storeSlug } = req.params;

  try {
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug }
    });

    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    const frontendUrl = `${process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`}/?store=${store.slug}`;

    const qrCodeImageUrl = await QRCode.toDataURL(frontendUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      scale: 10,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return res.json({
      success: true,
      storeName: store.name,
      targetUrl: frontendUrl,
      qrCodeDataUrl: qrCodeImageUrl
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 5. SET / RESET PASSWORD FOR AN EXISTING STORE (Postman use)
exports.setStorePassword = async (req, res) => {
  const { slug, password } = req.body;

  if (!slug || !password) {
    return res.status(400).json({ success: false, message: "slug and password are required." });
  }

  try {
    const store = await prisma.store.findUnique({ where: { slug } });
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.store.update({ where: { slug }, data: { password: hashed } });

    return res.json({ success: true, message: `Password set for store "${store.name}".` });
  } catch (error) {
    console.error("Error in setStorePassword:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
