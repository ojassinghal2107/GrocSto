const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. ADD NEW PRODUCT (For Postman Testing)
exports.createProduct = async (req, res) => {
  const { storeId, name, description, price, stock } = req.body;

  if (!storeId || !name || !price) {
    return res.status(400).json({
      success: false,
      message: "storeId, name, and price are required fields."
    });
  }

  try {
    const product = await prisma.product.create({
      data: {
        storeId: parseInt(storeId),
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock) || 0
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

// 2. GET PRODUCTS FOR A SPECIFIC STORE (Customer view — in-stock only)
exports.getStoreProducts = async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({
      success: false,
      message: "Missing storeId query parameter."
    });
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        storeId: parseInt(storeId),
        stock: { gt: 0 } // Only display items that are actually in stock
      }
    });

    return res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 2b. GET ALL PRODUCTS FOR MERCHANT DASHBOARD (includes zero-stock items)
exports.getAllStoreProducts = async (req, res) => {
  const { storeId } = req.query;

  if (!storeId) {
    return res.status(400).json({
      success: false,
      message: "Missing storeId query parameter."
    });
  }

  try {
    const products = await prisma.product.findMany({
      where: { storeId: parseInt(storeId) },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error("Error fetching all products:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 3. UPDATE PRODUCT PRICE AND STOCK (For daily inventory changes)
exports.updateProduct = async (req, res) => {
  const { productId } = req.params;
  const { price, stock, description } = req.body;

  try {
    // 1. Verify if the product actually exists before updating
    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    // 2. Perform the partial update
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(productId) },
      data: {
        // Only update fields if they are provided in the request body
        price: price !== undefined ? parseFloat(price) : existingProduct.price,
        stock: stock !== undefined ? parseInt(stock) : existingProduct.stock,
        description: description !== undefined ? description : existingProduct.description
      }
    });

    return res.json({
      success: true,
      message: "Product updated successfully!",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
