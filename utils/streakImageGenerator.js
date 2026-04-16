const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

/**
 * Generate streak number image
 * @param {number} streak - Streak count
 * @returns {Buffer} PNG image buffer
 */
function generateStreakImage(streak) {
  const width = 200;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(100, 100, 20, 100, 100, 150);
  gradient.addColorStop(0, '#FF6B35');
  gradient.addColorStop(1, '#D64045');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#FFD93D';
  ctx.beginPath();
  ctx.arc(100, 100, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FF6B35';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(100, 100, 75, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#D64045';
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(streak), 100, 100);

  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('DAYS', 100, 155);

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateStreakImage,
};
