const path = require('path');
const fs = require('fs').promises;
const horoscopeImageGenerator = require('./horoscopeImageGenerator');
const axios = require('axios');
const cheerio = require('cheerio');

class PythonBridge {
  constructor() {
    console.log('JavaScript implementation bridge initialized');
  }

  /**
   * Generate a horoscope image using JavaScript implementation
   * @param {string} zodiacSign - Zodiac sign
   * @param {string} text - Horoscope text
   * @returns {Promise<Buffer>} - Image buffer
   */
  async generateHoroscopeImage(zodiacSign, text) {
    try {
      console.log(`Generating horoscope image for ${zodiacSign}`);
      
      // Generate the image using our JavaScript implementation
      const imageBuffer = await horoscopeImageGenerator.generateHoroscopeImage(zodiacSign, text);
      
      // For debugging, save to file if needed
      if (process.env.DEBUG_IMAGES) {
        const tempDir = path.join(require('os').tmpdir(), 'horoscope-images');
        await fs.mkdir(tempDir, { recursive: true });
        const outputPath = path.join(tempDir, `${zodiacSign.toLowerCase()}_${Date.now()}.png`);
        await fs.writeFile(outputPath, imageBuffer);
        console.log(`Debug image saved to ${outputPath}`);
      }
      
      return imageBuffer;
    } catch (error) {
      console.error('Error generating horoscope image:', error);
      throw error;
    }
  }

  /**
   * Fetch horoscope text from Mail.ru
   * @param {string} zodiacSign - Zodiac sign
   * @returns {Promise<Object>} - Horoscope data
   */
  async fetchHoroscopeText(zodiacSign) {
    try {
      console.log(`Fetching horoscope for ${zodiacSign}`);
      
      // Create URL for the zodiac sign
      const zodiacLower = zodiacSign.toLowerCase();
      const url = `https://horo.mail.ru/prediction/${zodiacLower}/tomorrow/`;
      
      // Set headers similar to Python version
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 YaBrowser/21.8.1.468 Yowser/2.5 Safari/537.36',
        'Accept': '*/*'
      };
      
      // Make request to the horoscope page
      const response = await axios.get(url, { headers });
      
      if (response.status !== 200) {
        throw new Error(`Failed to fetch horoscope, status: ${response.status}`);
      }
      
      // Parse HTML using cheerio (JavaScript equivalent of BeautifulSoup)
      const $ = cheerio.load(response.data);
      
      // Extract text from page
      const articleBody = $('[itemprop="articleBody"]');
      let fullText = articleBody.text().trim();
      let shortText = articleBody.find('div').first().text().trim();
      
      // If cannot find specific element, use fallback
      if (!shortText) {
        shortText = fullText.substring(0, Math.min(100, fullText.length)) + '...';
      }
      
      // Add line breaks after periods (similar to Python regex)
      fullText = fullText.replace(/\.(?=\S)/g, '.\n\n');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return {
        text: shortText,
        full_text: fullText,
        sign: zodiacSign,
        date: tomorrow.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Error fetching horoscope text:', error);
      
      // Fallback to mock data if fetching fails
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const mockHoroscopes = {
        ARIES: "Завтра вам предстоит столкнуться с неожиданными поворотами судьбы. Будьте готовы к переменам и не бойтесь новых возможностей.",
        TAURUS: "День будет благоприятным для финансовых дел. Можете смело планировать крупные покупки или инвестиции.",
        GEMINI: "Вам стоит обратить внимание на своё здоровье. Не перенапрягайтесь и найдите время для отдыха.",
        CANCER: "Эмоциональный фон дня будет нестабильным. Старайтесь контролировать свои чувства и не принимать поспешных решений.",
        LEO: "Прекрасное время для творческой самореализации. Ваши таланты будут замечены и оценены по достоинству.",
        VIRGO: "День подходит для решения практических задач и наведения порядка во всех сферах жизни.",
        LIBRA: "Гармония и баланс - ваши ключевые слова на завтра. Старайтесь избегать конфликтов и находить компромиссы.",
        SCORPIO: "Интуиция будет вашим лучшим советчиком. Доверяйте своим ощущениям и не позволяйте другим влиять на ваши решения.",
        SAGITTARIUS: "Энергия и оптимизм помогут вам преодолеть любые препятствия. Хороший день для начала путешествий или обучения.",
        CAPRICORN: "Сосредоточьтесь на долгосрочных целях и не распыляйтесь на мелочи. Ваша целеустремленность поможет добиться результатов.",
        AQUARIUS: "День благоприятен для общения и укрепления дружеских связей. Ваши оригинальные идеи найдут поддержку.",
        PISCES: "Интуиция и творческое вдохновение будут на высоте. Доверяйте своим снам и внутренним ощущениям."
      };
      
      return {
        text: mockHoroscopes[zodiacSign].substring(0, 100) + "...",
        full_text: mockHoroscopes[zodiacSign],
        sign: zodiacSign,
        date: tomorrow.toISOString().split('T')[0]
      };
    }
  }
}

module.exports = new PythonBridge();

/**
 * Bridge to Python scripts for content generation
 */
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const horoscopeImageGenerator = require('./horoscopeImageGenerator');

/**
 * Fetch horoscope text for a specific sign
 * @param {string} sign - Zodiac sign
 * @returns {Promise<Object>} Horoscope data
 */
async function fetchHoroscopeText(sign) {
  // This is a mock implementation
  console.log(`Fetching horoscope text for ${sign}`);

  // Generate some mock horoscope text
  const texts = [
    'Сегодня вам улыбнется удача в финансовых делах. Не бойтесь брать инициативу в свои руки.',
    'Благоприятный день для начала новых проектов. Звезды на вашей стороне.',
    'Сложный день для общения с близкими. Постарайтесь быть терпеливее и внимательнее.',
    'Сегодня вы почувствуете прилив энергии. Используйте её для решения накопившихся проблем.',
    'Хороший день для отдыха и самопознания. Уделите время себе и своим мыслям.',
    'Не торопите события. Сегодня лучше всё тщательно обдумать, прежде чем принимать решения.'
  ];
  
  const randomText = texts[Math.floor(Math.random() * texts.length)];
  const fullText = randomText + ' ' + texts[Math.floor(Math.random() * texts.length)];
  
  // Return mock horoscope data
  return {
    sign,
    text: randomText,
    full_text: fullText,
    date: new Date().toISOString()
  };
}

/**
 * Generate horoscope image for a specific sign
 * @param {string} sign - Zodiac sign
 * @param {string} text - Horoscope text
 * @returns {Promise<Buffer>} Image buffer
 */
async function generateHoroscopeImage(sign, text) {
  try {
    // Use the JavaScript implementation
    return await horoscopeImageGenerator.generateHoroscopeImage(sign, text);
  } catch (error) {
    console.error(`Error generating horoscope image: ${error.message}`);
    throw error;
  }
}

module.exports = {
  fetchHoroscopeText,
  generateHoroscopeImage
};
