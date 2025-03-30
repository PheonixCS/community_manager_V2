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
    console.log('Initializing HoroscopeImageGenerator');
    const resourcesPath = path.join(__dirname, '../../resources');
    this.ensureResourcesExist(resourcesPath);
    
    this.imgPath = path.join(resourcesPath, 'main.png');
    this.iconPaths = [
      path.join(resourcesPath, '1.png'),
      path.join(resourcesPath, '2.png'),
      path.join(resourcesPath, '3.png'),
      path.join(resourcesPath, '4.png')
    ];
    this.headerFont = path.join(resourcesPath, 'fonts/bebas_neue_ru.ttf');
    this.baseHeaderFontSize = 80;
    
    this.bodyFont = path.join(resourcesPath, 'fonts/museo_cyrl.otf');
    this.baseBodyFontSize = 60;
    this.spacing = 10;
    
    this.fontRate = path.join(resourcesPath, 'fonts/Roboto.ttf');
    this.baseFontRateSize = 60;

    // Layout constants
    this.headerHeight = 150;  // Space reserved for header
    this.footerHeight = 50;  // Space reserved for footer
    this.horizontalPadding = 90; // Padding from sides
    this.textVerticalPadding = 40; // Padding above and below text

    // Register fonts
    try {
      registerFont(this.headerFont, { family: 'BebasNeue' });
      registerFont(this.bodyFont, { family: 'Museo' });
      registerFont(this.fontRate, { family: 'Roboto' });
    } catch (error) {
      console.error('Error registering fonts:', error);
    }

    // Check if fonts exist and create default ones if they don't
    this.ensureFontsExist(path.join(path.dirname(this.headerFont)));
  }

  ensureResourcesExist(resourcesPath) {
    // Create resources directory if it doesn't exist
    if (!fs.existsSync(resourcesPath)) {
      fs.mkdirSync(resourcesPath, { recursive: true });
      fs.mkdirSync(path.join(resourcesPath, 'fonts'), { recursive: true });
      console.log(`Created resources directories at ${resourcesPath}`);
    }
  }

  ensureFontsExist(fontsPath) {
    console.log(`Checking fonts in: ${fontsPath}`);
    try {
      if (!fs.existsSync(this.headerFont)) {
        console.log(`Header font not found at: ${this.headerFont}, using system font`);
      }
      if (!fs.existsSync(this.bodyFont)) {
        console.log(`Body font not found at: ${this.bodyFont}, using system font`);
      }
      if (!fs.existsSync(this.fontRate)) {
        console.log(`Rate font not found at: ${this.fontRate}, using system font`);
      }
    } catch (error) {
      console.error('Error checking fonts:', error);
    }
  }

  async generateHoroscopeImage(zodiacSign, text) {
    try {
      console.log(`Generating horoscope image for ${zodiacSign} with text length: ${text?.length}`);
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
      ctx.fillText(header, headerX, this.headerHeight - 55);
      
      // Create footer icons - changed from synchronous to async
      const icons = await this.createFooterIcons();
      
      // Calculate available space for text
      const availableHeight = canvas.height - this.headerHeight - this.footerHeight;
      
      // Calculate and draw text to fill available space
      const fontSize = this.calculateOptimalTextSize(ctx, text, availableHeight);
      this.drawTextToCenter(ctx, text, fontSize, this.headerHeight, this.footerHeight);
      
      // Draw footer
      this.drawFooter(ctx, canvas.width, icons);
      
      // Convert to buffer and return
      return canvas.toBuffer('image/png');
    } catch (error) {
      console.error('Error generating horoscope image:', error);
      // Create a fallback image with error message
      return this.generateFallbackImage(zodiacSign, error.message);
    }
  }

  // Add fallback image generation for error cases
  async generateFallbackImage(zodiacSign, errorMessage) {
    try {
      const canvas = createCanvas(1080, 1080);
      const ctx = canvas.getContext('2d');
      
      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
      gradient.addColorStop(0, '#1e3b70');
      gradient.addColorStop(1, '#29539b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1080);

      // Draw header
      ctx.font = '80px Arial'; // Use standard font as fallback
      ctx.fillStyle = 'white';
      const header = `${new Date().getDate()} ${new Date().toLocaleString('ru', { month: 'long' }).toUpperCase()}, ${ZODIAC_DICT[zodiacSign]}`;
      const headerWidth = ctx.measureText(header).width;
      const headerX = (1080 - headerWidth) / 2;
      ctx.fillText(header, headerX, 100);
      
      // Draw error message
      ctx.font = '40px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText('Ошибка при генерации изображения:', 540, 400);
      
      // Draw error details
      ctx.font = '30px Arial';
      const lines = this.wrapText(ctx, errorMessage, 900);
      lines.forEach((line, i) => {
        ctx.fillText(line, 540, 450 + i * 40);
      });
      
      return canvas.toBuffer('image/png');
    } catch (secondError) {
      console.error('Error generating fallback image:', secondError);
      // If even fallback fails, return empty buffer
      return Buffer.from([]);
    }
  }
  
  wrapText(ctx, text, maxWidth) {
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

  getTomorrowHeader(zodiacSign) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const day = tomorrow.getDate();
    const month = MONTH_DICT[tomorrow.getMonth() + 1].toUpperCase();
    return `${day} ${month}, ${ZODIAC_DICT[zodiacSign]}`;
  }

  calculateOptimalTextSize(ctx, text, availableHeight) {
    const maxWidth = 1080 - 2 * this.horizontalPadding; // Width with padding
    const maxHeight = availableHeight - 2 * this.textVerticalPadding; // Height with padding
    
    // Start with a larger font size
    let fontSize = 70;
    const minFontSize = 30;
    
    while (fontSize > minFontSize) {
      ctx.font = `${fontSize}px Museo`;
      
      const lines = this.splitTextToLines(ctx, text, maxWidth);
      const totalHeight = lines.length * (fontSize + this.spacing);
      
      if (totalHeight <= maxHeight) {
        break;
      }
      
      fontSize -= 2;
    }
    
    return fontSize;
  }

  splitTextToLines(ctx, text, maxWidth) {
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

  drawTextToCenter(ctx, text, fontSize, headerHeight, footerHeight) {
    ctx.font = `${fontSize}px Museo`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    const maxWidth = 1080 - 2 * this.horizontalPadding;
    const lines = this.splitTextToLines(ctx, text, maxWidth);
    
    // Calculate total height of text
    const totalHeight = lines.length * (fontSize + this.spacing);
    
    // Calculate the available vertical space between header and footer
    const availableSpace = 1080 - headerHeight - footerHeight;
    
    // Start position (centered vertically in the available space)
    let y = headerHeight + (availableSpace - totalHeight) / 2 + fontSize;
    
    // Draw each line
    lines.forEach(line => {
      ctx.fillText(line, 1080 / 2, y);
      y += fontSize + this.spacing;
    });
  }

  async createFooterIcons() {
    try {
      const icons = [];
      // Try to load each icon image and add its rating value
      for (let i = 0; i < 4; i++) {
        try {
          const iconPath = this.iconPaths[i];
          
          // Check if icon file exists
          if (fs.existsSync(iconPath)) {
            const iconImage = await loadImage(iconPath);
            icons.push({
              image: iconImage,
              value: String(Math.floor(Math.random() * 5) + 5) // Random value between 5-9
            });
          } else {
            console.warn(`Icon image not found at: ${iconPath}`);
            // If icon image doesn't exist, just add the value
            icons.push({
              image: null,
              value: String(Math.floor(Math.random() * 5) + 5)
            });
          }
        } catch (error) {
          console.error(`Error loading icon ${i+1}:`, error);
          // If loading fails, just add the value
          icons.push({
            image: null,
            value: String(Math.floor(Math.random() * 5) + 5)
          });
        }
      }
      return icons;
    } catch (error) {
      console.error('Error creating footer icons:', error);
      // In case of error, return fallback icons (just values)
      return Array(4).fill(0).map(() => ({
        image: null,
        value: String(Math.floor(Math.random() * 5) + 5)
      }));
    }
  }

  drawFooter(ctx, width, icons) {
    // Improved positioning for footer elements with values on the right side of icons
    const iconSpacing = width / 5;
    const footerBottomMargin = -15; // Отступ снизу в 5 пикселей
    const iconSize = 65;
    const textOffsetX = 15; // Horizontal space between icon and text
    const iconY = 1080 - this.footerHeight + iconSize / 2 + footerBottomMargin; // Сдвигаем вверх на 5px + центрируем иконки
    
    ctx.font = `${this.baseFontRateSize}px Roboto`;
    ctx.fillStyle = 'white';
    
    // Draw each icon with its value to the right
    icons.forEach((icon, index) => {
      const x = iconSpacing * (index + 1);
      
      // If we have a loaded image, draw it
      if (icon.image) {
        // Draw icon
        ctx.drawImage(
          icon.image, 
          x - iconSize/2, 
          iconY - iconSize/2, 
          iconSize, 
          iconSize
        );
      }
      
      // Set text alignment to left for placing text after icon
      ctx.textAlign = 'left';
      
      // Draw the value to the right of the icon
      ctx.fillText(icon.value, x + iconSize/2 + textOffsetX, iconY + iconSize/4);
    });
  }
}

const generator = new HoroscopeImageGenerator();
console.log('HoroscopeImageGenerator initialized successfully');

// Export the generator directly without wrapping it
// This prevents issues with other code that expects direct methods
module.exports = generator;
