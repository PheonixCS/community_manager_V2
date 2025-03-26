const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Zodiac sign enum equivalent
const ZODIAC_SIGN = {
  ARIES: 'ARIES',
  TAURUS: 'TAURUS',
  GEMINI: 'GEMINI',
  CANCER: 'CANCER',
  LEO: 'LEO',
  VIRGO: 'VIRGO',
  LIBRA: 'LIBRA',
  SCORPIO: 'SCORPIO',
  SAGITTARIUS: 'SAGITTARIUS',
  CAPRICORN: 'CAPRICORN',
  AQUARIUS: 'AQUARIUS',
  PISCES: 'PISCES'
};

// Month translations
const MONTH_DICT = {
  "1": 'января',
  "2": 'февраля',
  "3": 'марта',
  "4": 'апреля',
  "5": 'мая',
  "6": 'июня',
  "7": 'июля',
  "8": 'августа',
  "9": 'сентября',
  "10": 'октября',
  "11": 'ноября',
  "12": 'декабря'
};

// Zodiac sign translations
const ZODIAC_DICT = {
  [ZODIAC_SIGN.ARIES]: 'Овен',
  [ZODIAC_SIGN.TAURUS]: 'Телец', 
  [ZODIAC_SIGN.GEMINI]: 'Близнецы',
  [ZODIAC_SIGN.CANCER]: 'Рак',
  [ZODIAC_SIGN.LEO]: 'Лев',
  [ZODIAC_SIGN.VIRGO]: 'Дева',
  [ZODIAC_SIGN.LIBRA]: 'Весы',
  [ZODIAC_SIGN.SCORPIO]: 'Скорпион',
  [ZODIAC_SIGN.SAGITTARIUS]: 'Стрелец',
  [ZODIAC_SIGN.CAPRICORN]: 'Козерог',
  [ZODIAC_SIGN.AQUARIUS]: 'Водолей',
  [ZODIAC_SIGN.PISCES]: 'Рыбы'
};

class HoroscopeImageGenerator {
  constructor() {
    // Initialize paths
    const resourcesPath = path.join(__dirname, '../../resources');
    this.ensureResourcesExist(resourcesPath);
    
    this.imgPath = path.join(resourcesPath, 'main.png');
    this.headerFont = path.join(resourcesPath, 'fonts/bebas_neue_ru.ttf');
    this.baseHeaderFontSize = 80;
    
    this.bodyFont = path.join(resourcesPath, 'fonts/museo_cyrl.otf');
    this.baseBodyFontSize = 60;
    this.spacing = 10;
    
    this.fontRate = path.join(resourcesPath, 'fonts/Roboto.ttf');
    this.baseFontRateSize = 60;

    // Register fonts
    try {
      registerFont(this.headerFont, { family: 'BebasNeue' });
      registerFont(this.bodyFont, { family: 'Museo' });
      registerFont(this.fontRate, { family: 'Roboto' });
    } catch (error) {
      console.error('Error registering fonts:', error);
    }
  }

  ensureResourcesExist(resourcesPath) {
    // Create resources directory if it doesn't exist
    if (!fs.existsSync(resourcesPath)) {
      fs.mkdirSync(resourcesPath, { recursive: true });
      fs.mkdirSync(path.join(resourcesPath, 'fonts'), { recursive: true });
      console.log(`Created resources directories at ${resourcesPath}`);
    }
  }

  async generateHoroscopeImage(zodiacSign, text) {
    try {
      // Create canvas (1080x1080)
      const canvas = createCanvas(1080, 1080);
      const ctx = canvas.getContext('2d');
      
      // Load background image
      let backgroundImage;
      try {
        backgroundImage = await loadImage(this.imgPath);
      } catch (error) {
        // If image doesn't exist, create a gradient background
        console.log('Background image not found, creating default background');
        const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
        gradient.addColorStop(0, '#1e3b70');
        gradient.addColorStop(1, '#29539b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1080);
      }
      
      if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, 1080, 1080);
      }

      // Generate header
      const header = this.getTomorrowHeader(zodiacSign);
      
      // Draw header
      ctx.font = `${this.baseHeaderFontSize}px BebasNeue`;
      ctx.fillStyle = 'white';
      const headerWidth = ctx.measureText(header).width;
      const headerX = (1080 - headerWidth) / 2;
      ctx.fillText(header, headerX, 100);
      
      // Calculate and draw text
      const fontSize = this.calculateTextSize(ctx, text);
      this.drawTextToCenter(ctx, text, fontSize);
      
      // Create footer icons
      const icons = this.createFooterIcons();
      this.drawFooter(ctx, canvas.width, icons);
      
      // Convert to buffer and return
      return canvas.toBuffer('image/png');
    } catch (error) {
      console.error('Error generating horoscope image:', error);
      throw error;
    }
  }

  getTomorrowHeader(zodiacSign) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const day = tomorrow.getDate();
    const month = MONTH_DICT[tomorrow.getMonth() + 1].toUpperCase();
    return `${day} ${month}, ${ZODIAC_DICT[zodiacSign]}`;
  }

  calculateTextSize(ctx, text, startSize = 60) {
    let fontSize = startSize;
    const maxWidth = 1080 * 0.8; // 80% of image width
    const maxHeight = 600; // Maximum height for text area
    const minFontSize = 30;
    
    // Start with largest font and decrease until text fits
    while (fontSize > minFontSize) {
      ctx.font = `${fontSize}px Museo`;
      
      const lines = this.splitTextToLines(ctx, text, maxWidth);
      const totalHeight = lines.length * (fontSize + this.spacing);
      
      if (totalHeight <= maxHeight) {
        break;
      }
      
      fontSize -= 5;
    }
    
    return fontSize;
  }

  splitTextToLines(ctx, text, maxWidth) {
    ctx.font = `${ctx.font.split('px')[0]}px Museo`;
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(`${currentLine} ${word}`).width;
      
      if (width < maxWidth) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    
    lines.push(currentLine);
    return lines;
  }

  drawTextToCenter(ctx, text, fontSize) {
    ctx.font = `${fontSize}px Museo`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    const maxWidth = 1080 * 0.8; // 80% of image width
    const lines = this.splitTextToLines(ctx, text, maxWidth);
    
    // Calculate total height of text
    const totalHeight = lines.length * (fontSize + this.spacing);
    
    // Start position (centered vertically)
    let y = (1080 - totalHeight) / 2 + 50; // +50 to adjust for header
    
    // Draw each line
    lines.forEach(line => {
      ctx.fillText(line, 1080 / 2, y);
      y += fontSize + this.spacing;
    });
  }

  createFooterIcons() {
    // In a real implementation, this would load actual icons
    // Here we'll just create rating values
    const icons = [];
    for (let i = 1; i <= 4; i++) {
      icons.push({ value: String(Math.floor(Math.random() * 5) + 5) }); // Random value between 5-9
    }
    return icons;
  }

  drawFooter(ctx, width, icons) {
    const iconSpacing = width / 5;
    const iconY = 1000; // Position from top
    
    ctx.font = `${this.baseFontRateSize}px Roboto`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    // Draw values with even spacing
    icons.forEach((icon, index) => {
      const x = iconSpacing * (index + 1);
      ctx.fillText(icon.value, x, iconY);
    });
  }
}

module.exports = new HoroscopeImageGenerator();
