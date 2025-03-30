const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const pythonBridge = require('./pythonBridge');
const s3Service = require('../s3Service');
const { v4: uuidv4 } = require('uuid');

// Zodiac signs in both English and Russian
const ZODIAC_SIGNS = {
  ARIES: { ru: 'Овен', en: 'ARIES' },
  TAURUS: { ru: 'Телец', en: 'TAURUS' },
  GEMINI: { ru: 'Близнецы', en: 'GEMINI' },
  CANCER: { ru: 'Рак', en: 'CANCER' },
  LEO: { ru: 'Лев', en: 'LEO' },
  VIRGO: { ru: 'Дева', en: 'VIRGO' },
  LIBRA: { ru: 'Весы', en: 'LIBRA' },
  SCORPIO: { ru: 'Скорпион', en: 'SCORPIO' },
  SAGITTARIUS: { ru: 'Стрелец', en: 'SAGITTARIUS' },
  CAPRICORN: { ru: 'Козерог', en: 'CAPRICORN' },
  AQUARIUS: { ru: 'Водолей', en: 'AQUARIUS' },
  PISCES: { ru: 'Рыбы', en: 'PISCES' }
};

class HoroscopeGenerator {
  constructor() {
    this.id = 'horoscope';
    this.name = 'Гороскоп';
    this.description = 'Генератор гороскопов для публикации в ВК';
    this.params = [
      {
        name: 'signSelection',
        label: 'Выбор знаков зодиака',
        type: 'select',
        options: [
          { value: 'all', label: 'Все знаки зодиака' },
          { value: 'single', label: 'Один знак зодиака' },
          { value: 'multiple', label: 'Несколько знаков зодиака' }
        ],
        default: 'all'
      },
      {
        name: 'signs',
        label: 'Знак(и) зодиака',
        type: 'multiselect',
        options: Object.entries(ZODIAC_SIGNS).map(([key, value]) => ({
          value: key,
          label: value.ru
        })),
        default: [],
        dependent: {
          param: 'signSelection',
          values: ['single', 'multiple']
        }
      },
      {
        name: 'imageType',
        label: 'Тип публикации',
        type: 'select',
        options: [
          { value: 'text', label: 'Только текст' },
          { value: 'image', label: 'С изображениями' }
        ],
        default: 'text'
      },
      {
        name: 'carouselMode',
        label: 'Режим карусели для изображений',
        type: 'boolean',
        default: true,
        dependent: {
          param: 'imageType',
          values: ['image']
        }
      },
      {
        name: 'addHeader',
        label: 'Добавить заголовок',
        type: 'boolean',
        default: true
      },
      {
        name: 'header',
        label: 'Текст заголовка',
        type: 'text',
        default: '',
        dependent: {
          param: 'addHeader',
          values: [true]
        }
      },
      {
        name: 'addFooter',
        label: 'Добавить подпись',
        type: 'boolean',
        default: true
      },
      {
        name: 'footer',
        label: 'Текст подписи',
        type: 'text',
        default: `Ставь ❤️ и пиши ВО БЛАГО для удачного дня!
Напиши дату рождения в комментариях и
получи личный гороскоп от астролога`,
        dependent: {
          param: 'addFooter',
          values: [true]
        }
      }
    ];
  }

  // Main generation method that will be called from contentGeneratorService
  async generateContent(params) {
    try {
      console.log('Generating horoscope content with params:', params);
      
      // Ensure carouselMode has a default value if it's not explicitly provided
      if (params.imageType === 'image' && params.carouselMode === undefined) {
        params.carouselMode = true; // Default to true for carousel mode
        console.log('Setting default carouselMode to true');
      }
      
      // Determine which signs to generate
      let signsToGenerate = [];
      if (params.signSelection === 'all') {
        signsToGenerate = Object.keys(ZODIAC_SIGNS);
      } else if (params.signSelection === 'single' && params.signs && params.signs.length > 0) {
        signsToGenerate = [params.signs[0]]; // First selected sign for 'single' mode
      } else if (params.signSelection === 'multiple' && params.signs && params.signs.length > 0) {
        signsToGenerate = params.signs; // All selected signs for 'multiple' mode
      } else {
        // Default to all signs if selection is invalid
        signsToGenerate = Object.keys(ZODIAC_SIGNS);
      }

      console.log(`Generating horoscopes for signs: ${signsToGenerate.join(', ')}`);

      // Fetch horoscope texts for all selected signs
      const horoscopeData = await this.fetchHoroscopeTexts(signsToGenerate);
      
      // If image type is selected, generate images for each horoscope
      if (params.imageType === 'image') {
        await this.generateHoroscopeImages(horoscopeData);
      }

      // Format the content for VK posting
      return this.formatHoroscopeForPosting(horoscopeData, params);
    } catch (error) {
      console.error('Error generating horoscope content:', error);
      throw new Error(`Failed to generate horoscope: ${error.message}`);
    }
  }

  // Fetch horoscope text for the selected signs
  async fetchHoroscopeTexts(signs) {
    try {
      // In a real implementation, this would fetch from an API or database
      const horoscopes = {};
      
      for (const sign of signs) {
        try {
          const horoscopeData = await this.getHoroscopeForSign(sign);
          horoscopes[sign] = {
            sign,
            signName: ZODIAC_SIGNS[sign].ru,
            text: horoscopeData.text,
            fullText: horoscopeData.fullText,
            date: horoscopeData.date || new Date(),
            imagePath: null // Will be set later if image generation is enabled
          };
        } catch (error) {
          console.error(`Error fetching horoscope for ${sign}:`, error);
          // If one sign fails, continue with others
          horoscopes[sign] = {
            sign,
            signName: ZODIAC_SIGNS[sign].ru,
            text: `Не удалось получить гороскоп для знака ${ZODIAC_SIGNS[sign].ru}.`,
            fullText: `Не удалось получить гороскоп для знака ${ZODIAC_SIGNS[sign].ru}.`, // Исправлена опечатка ZODIAK -> ZODIAC
            date: new Date(),
            imagePath: null
          };
        }
      }
      
      return horoscopes;
    } catch (error) {
      console.error('Error fetching horoscope texts:', error);
      throw error;
    }
  }

  // Get horoscope for a specific sign
  async getHoroscopeForSign(sign) {
    try {
      // Use our JavaScript bridge instead of Python
      const horoscopeData = await pythonBridge.fetchHoroscopeText(sign);
      
      return {
        text: horoscopeData.text,
        fullText: horoscopeData.full_text,
        date: new Date(horoscopeData.date)
      };
    } catch (error) {
      console.error(`Error getting horoscope for sign ${sign}:`, error);
      throw error;
    }
  }

  // Generate images for horoscopes if needed
  async generateHoroscopeImages(horoscopeData) {
    try {
      // Create S3 folder path for this batch (with unique identifier)
      const s3FolderPath = `horoscope-images/${Date.now()}-${uuidv4().substring(0, 8)}`;
      console.log(`Using S3 folder path: ${s3FolderPath}`);

      // For each horoscope, generate an image and upload to S3
      for (const sign in horoscopeData) {
        const horoscope = horoscopeData[sign];
        const fileName = `${sign.toLowerCase()}_horoscope.png`;
        
        try {
          // Generate image
          console.log(`Generating image for ${sign}...`);
          const imageBuffer = await pythonBridge.generateHoroscopeImage(sign, horoscope.text);
          
          // Upload to S3
          console.log(`Uploading ${fileName} to S3...`);
          const s3Result = await s3Service.uploadFromBuffer(
            imageBuffer,
            fileName,
            s3FolderPath,
            'image/png'
          );
          
          if (s3Result.success) {
            // Store the public URL for later use
            horoscope.imageUrl = s3Result.url;
            horoscope.s3Key = s3Result.key;
            console.log(`Successfully uploaded image for ${sign} to S3: ${s3Result.url}`);
          } else {
            console.error(`Failed to upload image for ${sign} to S3:`, s3Result.error);
          }
        } catch (error) {
          console.error(`Error processing image for ${sign}:`, error);
          // Continue without image if generation fails
        }
      }
    } catch (error) {
      console.error('Error generating horoscope images:', error);
      // Continue without images if generation fails
    }
  }

  // Format horoscope data for VK posting
  formatHoroscopeForPosting(horoscopeData, params) {
    try {
      // Create post content based on params
      let postText = '';
      const attachments = [];
      const hasImages = Object.values(horoscopeData).some(h => h.imageUrl);
      
      // Add header if requested
      if (params.addHeader && params.header) {
        postText += params.header + '\n\n';
      }
      
      // Add horoscope text for each sign
      const signs = Object.values(horoscopeData);
      const monthNames = [
        'ЯНВАРЯ', 'ФЕВРАЛЯ', 'МАРТА', 'АПРЕЛЯ', 'МАЯ', 'ИЮНЯ',
        'ИЮЛЯ', 'АВГУСТА', 'СЕНТЯБРЯ', 'ОКТЯБРЯ', 'НОЯБРЯ', 'ДЕКАБРЯ'
      ];
      const zodiacEmojis = {
        ARIES: '♈️',
        TAURUS: '♉️',
        GEMINI: '♊️',
        CANCER: '♋️',
        LEO: '♌️',
        VIRGO: '♍️',
        LIBRA: '♎️',
        SCORPIO: '♏️',
        SAGITTARIUS: '♐️',
        CAPRICORN: '♑️',
        AQUARIUS: '♒️',
        PISCES: '♓️'
      };
      const ruZodiacSign = {
        ARIES: 'овен',
        TAURUS: 'телец',
        GEMINI: 'близнецы',
        CANCER: 'рак',
        LEO: 'лев',
        VIRGO: 'дева',
        LIBRA: 'весы',
        SCORPIO: 'скорпион',
        SAGITTARIUS: 'стрелец',
        CAPRICORN: 'козерог',
        AQUARIUS: 'водолей',
        PISCES: 'рыбы'
      };
      let signsList = []; // Массив для сбора названий знаков
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const day = d.getDate();
      const month = monthNames[d.getMonth()];
      // If we have images but no text (only header/footer), add a minimal text
      if (params.imageType === 'image') {
        const Ru_month = monthNames[d.getMonth()];
        const header = `ГОРОСКОП НА ${day} ${Ru_month} ✨\n`;
        postText += header;
      }

      for (let i = 0; i < signs.length; i++) {
        const horoscope = signs[i];
        
        // Only include text if we're not using images or this specific horoscope doesn't have an image
        if (params.imageType !== 'image' || !horoscope.imageUrl) {
          // Получаем эмодзи знака зодиака
          
          
          const emoji = zodiacEmojis[horoscope.sign] || '';
          
          // Формируем текст в новом формате
          postText += `ГОРОСКОП НА ${day} ${month} ${emoji}\n\n${horoscope.fullText}\n\n`;
        }
        
        // Add image attachment if any
        if (horoscope.imageUrl) {
          const signName = ruZodiacSign[horoscope.sign];
          signsList.push(signName);
          
          attachments.push({
            type: 'photo',
            url: horoscope.imageUrl,
            s3Key: horoscope.s3Key // Include S3 key for later cleanup
          });
        }
      }
      
      
      if (params.imageType === 'image') {
        let resultString = signsList.join(', ');
        resultString = resultString.charAt(0).toUpperCase() + resultString.slice(1);
        postText += resultString + '\n';
      }
      // Add footer if requested
      if (params.addFooter && params.footer) {
        postText += params.footer;
        
      }
      
      
      // Make sure we always include the carouselMode parameter in the result
      // Default to true if it's not explicitly set to false
      const carouselMode = params.carouselMode !== false;
      
      return {
        text: postText,
        attachments: attachments.length > 0 ? attachments : undefined,
        isCarousel: params.imageType === 'image' && carouselMode && attachments.length > 1
      };
    } catch (error) {
      console.error('Error formatting horoscope for posting:', error);
      throw error;
    }
  }

  // Helper method to format date
  formatDate(date) {
    try {
      const d = new Date(date);
      return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    } catch (error) {
      return 'скоро';
    }
  }
}

// Убедимся, что файл существует и экспортирует объект с правильной структурой
console.log('Loading horoscope generator...');

// Проверка на экспорт
const generator = new HoroscopeGenerator();
console.log('Horoscope generator initialized with id:', generator.id);

module.exports = generator;
