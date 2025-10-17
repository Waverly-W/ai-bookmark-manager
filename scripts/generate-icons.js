/* Auto-generate extension icons from public/wxt.svg */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const svgPath = path.resolve(__dirname, '../public/wxt.svg');
  const outDir = path.resolve(__dirname, '../public/icon');
  const sizes = [16, 32, 48, 96, 128];

  if (!fs.existsSync(svgPath)) {
    console.error('[icons] SVG not found:', svgPath);
    process.exit(1);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outFile = path.join(outDir, `${size}.png`);
    try {
      // density 提高矢量渲染质量
      await sharp(svgBuffer, { density: Math.max(180, size * 12) })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(outFile);
      console.log(`[icons] Generated: ${path.relative(process.cwd(), outFile)}`);
    } catch (e) {
      console.error(`[icons] Failed to generate ${size}.png`, e);
      process.exitCode = 1;
    }
  }

  console.log('[icons] Done');
}

main().catch((e) => {
  console.error('[icons] Unexpected error', e);
  process.exit(1);
});

