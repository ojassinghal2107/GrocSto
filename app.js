const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Dynamic manifest.json — reads Referer header to inject correct store start_url.
// iOS Safari reads manifest.json at page load time (before JS runs) and uses
// start_url for the "Add to Home Screen" shortcut. By reading the Referer,
// we know which store page the user is on and return the right start_url.
// Must be registered BEFORE express.static so it intercepts /manifest.json.
app.get('/manifest.json', (req, res) => {
  const referer = req.get('Referer') || '';
  const pathMatch = referer.match(/\/store\/([^/?#]+)/);
  const storeSlug = pathMatch ? decodeURIComponent(pathMatch[1]) : null;

  const manifest = {
    name: "GrocSto",
    short_name: "GrocSto",
    description: "Order groceries from your local store",
    start_url: storeSlug ? `/store/${storeSlug}` : "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10b981",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(manifest);
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/stores', require('./routes/storeRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));

// Clean store URLs: /store/:slug → serve index.html
app.get('/store/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Base route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
