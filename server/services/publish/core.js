const vkAuthService = require('../vkAuthService');


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 
 * @description Получает активные токены из сервиса авторизации ВК
 * @param {number} counter - Счетчик попыток получения токенов (по умолчанию 0)
 */
async function getActiveTokens(counter) {
    let counter = counter || 0;
    const maxRetries = 5; // Максимальное количество попыток
    try {
        const tokens = await vkAuthService.getTokens();
        if (activeTokens.length === 0) {
            console.log(`No active tokens found. Retrying ${counter}/${maxRetries} ...`);
            if (counter >= maxRetries) {
                console.error('Max retries reached. Exiting...');
                return [];
            }
            sleep(60000); // Ждем 1 минуту перед повторной попыткой
            getActiveTokens(counter + 1); // Повторяем попытку
        }
        console.log(`Found ${tokens.length} active tokens`);
        return tokens;
    }
    catch (error) {
        console.error('Error fetching active tokens:', error);
        return [];
    }
}

/**
 * 
 * @description Подготавливает пост перед публикацией
 * @param {Object} post - Пост, который нужно подготовить
 * @param {*} preOptions 
 * @param {*} postCustomizationOptions
 * @returns 
 */
async function preparePost(post, preOptions, postCustomizationOptions) {
    if(typeof post == 'object' 
        && post !== null 
        && typeof preOptions == 'object' 
        && preOptions !== null
        && typeof postCustomizationOptions == 'object'
        && postCustomizationOptions !== null) {

        /// Применение предварительных опций к посту
        if(typeof preOptions.removeHashtags == 'boolean' && preOptions.removeHashtags) {
            post.text = removeHashtags(post.text);
        }
        if(typeof preOptions.transliterate == 'boolean' && preOptions.transliterate) {
            post.text = transliterateText(post.text);
        }
        /// Применение опций кастомизации к посту
        if(typeof postCustomizationOptions.addText == 'object') {
            
            // Добавляем текст в начало или конец
            if (postCustomizationOptions.addText.position == 'before') {
                post.text = postCustomizationOptions.addText.text + '\n\n' + post.text;
            }
            else if (postCustomizationOptions.addText.position == 'after') {
                post.text = post.text + '\n\n' + postCustomizationOptions.addText.text;
            }
            // Добавление хештегов
            if (postCustomizationOptions.addHashtags?.enabled && postCustomizationOptions.addHashtags?.hashtags) {
                const hashtags = postCustomizationOptions.addHashtags.hashtags
                  .split(/[\s,]+/)
                  .filter(tag => tag.length > 0)
                  .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
                  .join(' ');
                post.text += `\n\n${hashtags}`;
            }
            // Добавление ссылки на источник 
            if (postCustomizationOptions.addSourceLink?.enabled && post.postUrl) {
                const sourcePrefix = postCustomizationOptions.addSourceLink.text || 'источник';
                post.text += `\n\n[${sourcePrefix}|${post.postUrl}]`;
            }
            // Добавление подписи в конце поста
            if (postCustomizationOptions.addSignature?.enabled && postCustomizationOptions.addSignature?.text) {
                post.text += `\n\n${postCustomizationOptions.addSignature.text}`;
            }
            // Добавление изображения в пост
            if (postCustomizationOptions.addImage?.enabled && postCustomizationOptions.addImage?.imageUrl) {
                post.attachments = post.attachments || [];
                post.attachments.push({
                    type: 'photo',
                    url: postCustomizationOptions.addImage.imageUrl
                });
            }
        }
    }
    return post;
}


/**
 * Удаляет все хештеги из текста
 * @param {string} text - Исходный текст
 * @returns {string} Текст без хештегов
 */
function removeHashtags(text) {
    if (!text) return text;

    // Удаляем хештеги в формате #слово
    let result = text.replace(/#[\wа-яА-ЯёЁ]+/g, '');
    // Заменяем множественные пробелы на один, но сохраняем переносы строк
    result = result.replace(/[^\S\n]+/g, ' ');
    // Удаляем пробелы в начале и конце строк, но сохраняем переносы
    return result.trim();
}
/**
 * Транслитерирует текст (заменяет русские символы на английские аналоги)
 * @param {string} text - Исходный текст
 * @returns {string} Транслитерированный текст
 */
function transliterateText(text) {
    if (!text) return text;
    // console.log(text)
    const translitMap = {
        'а': 'a', 'е': 'e', 'ё': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 
        'у': 'y', 'х': 'x', 'А': 'A', 'В': 'B', 'Е': 'E', 'Ё': 'E',
        'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C',
        'Т': 'T', 'Х': 'X'
    };
    let result = text.split('').map(char => {
        // Если символ есть в мапе - заменяем, иначе оставляем как есть (включая \n, \t и другие)
        return translitMap[char] !== undefined ? translitMap[char] : char;
    }).join('');
    return result;
}

module.exports = {
    getActiveTokens,
    preparePost
};