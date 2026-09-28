const Jimp = require('jimp');

async function getColor() {
  const image = await Jimp.read('public/logo_blue_croped.png');
  const counts = {};
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];
    if (a > 128) {
      const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      counts[hex] = (counts[hex] || 0) + 1;
    }
  });
  
  let maxCount = 0;
  let dominant = '';
  // filter out black, white, gray
  for (const hex in counts) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    // skip grays
    if (Math.abs(r-g) < 15 && Math.abs(g-b) < 15) continue;
    
    if (counts[hex] > maxCount) {
      maxCount = counts[hex];
      dominant = hex;
    }
  }
  console.log('Dominant Color:', dominant);
}
getColor();
