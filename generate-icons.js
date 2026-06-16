const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function makeIcon(size, outFile) {
  const radius = size * 0.167; // ~16% rounded corners
  const text = size < 256 ? 96 : 256;
  const fontSize = Math.round(size * 0.57);
  const textY = Math.round(size * 0.68);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#10b981"/>
    <text x="${text}" y="${textY}" font-family="Arial,sans-serif" font-size="${fontSize}"
      font-weight="bold" text-anchor="middle" fill="white">G</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outFile);
  console.log(`Created ${outFile}`);
}

async function run() {
  await makeIcon(192, path.join(dir, 'icon-192.png'));
  await makeIcon(512, path.join(dir, 'icon-512.png'));

  // Update manifest to use PNG
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
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };

  fs.writeFileSync(
    path.join(__dirname, 'public', 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('manifest.json updated to use PNG icons');
}

run().catch(console.error);
