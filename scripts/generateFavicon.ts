#!/usr/bin/env node

import { createCanvas, type CanvasRenderingContext2D } from 'canvas';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const generateFavicon = (): void => {
  const size = 32;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  // Draw circle background
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(245 158 11)'; // amber-500
  ctx.fill();

  // Draw a simple 'E' for Encyclopedian
  ctx.fillStyle = 'white';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', size/2, size/2);

  try {
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    const outputPath = resolve(__dirname, '../public/favicon.ico');
    writeFileSync(outputPath, buffer);
    
    console.log('Favicon generated successfully at:', outputPath);
  } catch (error) {
    console.error('Error generating favicon:', error);
    process.exit(1);
  }
};

generateFavicon(); 