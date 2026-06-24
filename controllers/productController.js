const { PrismaClient } = require('@prisma/client');
const { uploadToCloudinary } = require('../middleware/upload');

const prisma = new PrismaClient();

// ── 1. ADD NEW PRODUCT ────────────────────────────────────────────────────────
exports.createProduct = async (req, res) => {
  const { storeId, name, description, price, stock } = req.body;

  if (!storeId || !name || !price) {
    return res.status(400).json({
      success: false,
      message: "storeId, name, and price are required fields."
    });
  }

  try {
    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      } catch (uploadErr) {
        console.error("Cloudinary upload error:", uploadErr.message);
        return res.status(500).json({ success: false, message: `Image upload failed: ${uploadErr.message}` });
      }
    }

    const product = await prisma.product.create({
      data: {
        storeId:     parseInt(storeId),
        name,
        description: description || null,
        price:       parseFloat(price),
        stock:       parseInt(stock) || 0,
        imageUrl
      }
    });

    return res.status(201).json({
      success: true,
      message: "Product added successfully to inventory!",
      product
    });
  } catch (error) {
    console.error("Error creating product:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── 2. GET PRODUCTS FOR A SPECIFIC STORE (customer view — in-stock only) ──────
exports.getStoreProducts = async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "Missing storeId query parameter." });
  }

  try {
    const products = await prisma.product.findMany({
      where: { storeId: parseInt(storeId), stock: { gt: 0 } }
    });
    return res.json({ success: true, count: products.length, products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── 3. GET ALL PRODUCTS FOR MERCHANT DASHBOARD (includes zero-stock) ──────────
exports.getAllStoreProducts = async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({ success: false, message: "Missing storeId query parameter." });
  }

  try {
    const products = await prisma.product.findMany({
      where: { storeId: parseInt(storeId) },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, count: products.length, products });
  } catch (error) {
    console.error("Error fetching all products:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── 5. DELETE PRODUCT ─────────────────────────────────────────────────────────
exports.deleteProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const existing = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!existing) return res.status(404).json({ success: false, message: "Product not found." });

    await prisma.product.delete({ where: { id: parseInt(productId) } });
    return res.json({ success: true, message: "Product deleted." });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
// ── 4. UPDATE PRODUCT (price, stock, description, image) ──────────────────────
exports.updateProduct = async (req, res) => {
  const { productId } = req.params;
  const { price, stock, description } = req.body;

  try {
    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!existingProduct) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    let imageUrl = existingProduct.imageUrl;
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      } catch (uploadErr) {
        console.error("Cloudinary upload error:", uploadErr.message);
        return res.status(500).json({ success: false, message: `Image upload failed: ${uploadErr.message}` });
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(productId) },
      data: {
        price:       price       !== undefined ? parseFloat(price)   : existingProduct.price,
        stock:       stock       !== undefined ? parseInt(stock)      : existingProduct.stock,
        description: description !== undefined ? description          : existingProduct.description,
        imageUrl
      }
    });

    return res.json({ success: true, message: "Product updated successfully!", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
