import fs from 'fs';
import path from 'path';

const svgPath = 'C:\\Users\\Chino\\Documents\\Ether\\frontend\\public\\logo.svg';
const outPath = 'C:\\Users\\Chino\\Documents\\Ether\\frontend\\src-tauri\\icons\\logo_source.jpg';

try {
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  // Regex to find the base64 string
  const match = svgContent.match(/data:image\/jpeg;base64,([^"]+)/);

  if (match && match[1]) {
    const base64Data = match[1];
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(outPath, buffer);
    console.log(`Successfully extracted image to ${outPath}`);
  } else {
    console.error('Could not find base64 image data in SVG');
    process.exit(1);
  }
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
