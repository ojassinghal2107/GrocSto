const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#10b981"/>
  <text x="96" y="130" font-family="Arial,sans-serif" font-size="110" font-weight="bold" text-anchor="middle" fill="white">G</text>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#10b981"/>
  <text x="256" y="345" font-family="Arial,sans-serif" font-size="290" font-weight="bold" text-anchor="middle" fill="white">G</text>
</svg>`;

fs.writeFileSync(path.join(dir, 'icon-192.svg'), svg192);
fs.writeFileSync(path.join(dir, 'icon-512.svg'), svg512);

// Update manifest to use SVG icons
const manifest = {
  name: "GrocSto",
  short_name: "GrocSto",
  description: "Order groceries from your local store",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#10b981",
  orientation: "portrait",
  icons: [
    { src: "icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
    { src: "icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
  ]
};

fs.writeFileSync(
  path.join(__dirname, 'public', 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log('Icons and manifest generated.');
