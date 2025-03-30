const axios = require('axios');
const config = require('../config/config');
const Settings = require('../models/Settings');

class VkApiService {
  constructor() {
    this.communityIdCache = new Map();
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
    // Initialize the API method in the constructor
    this.api = async (method, params = {}) => {
      try {
        // Get settings to load the token
        const settings = await Settings.findOne();
        if (!settings?.vkApi?.serviceToken) {
          throw new Error('VK API service token not found in settings');
        }

        const response = await axios.get(`https://api.vk.com/method/${method}`, {
          params: {
            ...params,
            access_token: settings.vkApi.serviceToken,
            v: settings.vkApi.apiVersion || config.vk.apiVersion
          }
        });

        if (response.data.error) {
          throw new Error(`VK API Error: ${response.data.error.error_msg}`);
        }

        return response.data.response;
      } catch (error) {
        console.error(`VK API Error (${method}):`, error.message);
        throw error;
      }
    };

    console.log('VK API Service initialized');
    this.apiVersion = '5.131';
    this.baseUrl = 'https://api.vk.com/method/';
    this.settings = null;
  }

  async initializeSettings() {
    if (!this.settings) {
      this.settings = await Settings.findOne();
      if (!this.settings) {
        throw new Error('VK API settings not found');
      }
    }
    return this.settings;
  }

  // Получение постов со стены сообщества
  async getWallPosts(community, params = {}) {
    await this.initializeSettings();
    
    // Определяем, что это - ID или домен
    let owner_id;
    
    if (community.type === 'domain') {
      // Если это домен, используем параметр domain
      params.domain = community.value;
    } else {
      // Если это ID, строим owner_id
      owner_id = community.value.startsWith('-') ? community.value : `-${community.value}`;
      params.owner_id = owner_id;
    }

    const defaultParams = {
      count: 100,
      offset: 0,
      filter: 'all',
      extended: 1,
      access_token: this.settings.vkApi.serviceToken,
      v: this.settings.vkApi.apiVersion || this.apiVersion
    };

    const requestParams = { ...defaultParams, ...params };

    try {
      const response = await axios.get(`${this.baseUrl}wall.get`, { params: requestParams });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }
      
      let posts = response.data.response.items;

      const hasExternalLinks = (text) => {
        console.log('Checking for external links in text:', text);
        // Regex to match URLs but exclude VK-specific mentions/links like [id123|Name]
        const urlRegex = /(?:https?:\/\/|www\.)[^\s\[\]]+/gi;
        // Exclude VK mention format [id123|Name] or [club123|Name]
        const vkMentionRegex = /\[(id|club)\d+\|[^\]]+\]/g;
        
        // Remove VK mentions first
        const textWithoutMentions = text.replace(vkMentionRegex, '');
        
        // Then check for external URLs
        return urlRegex.test(textWithoutMentions);
      };

      if (params.skipExternalLinks) {
        posts = posts.filter(post => !hasExternalLinks(post.text));
      }

      return posts;
    } catch (error) {
      console.error('Error fetching posts from VK:', error.message);
      throw error;
    }
  }

  async getPosts(communityId, count = 100, offset = 0, filters = {}) {
    try {
      // Логируем информацию о запросе
      
      // Формируем параметры запроса
      const requestParams = {
        owner_id: communityId,
        count,
        offset,
        filter: filters.filter || 'all', // Используем значение фильтра или 'all' по умолчанию
        extended: filters.extended ? 1 : 0 // Преобразуем булевое значение в 1 или 0
      };
      console.log('Getting posts for community:', communityId, 'with filters:', requestParams);
      
      const response = await this.api('wall.get', requestParams);
      // console.log(response);
      console.log(`Retrieved ${response?.items?.length || 0} posts from VK API`);
      
      if (!response || !response.items) {
        console.error('Invalid API response:', response);
        return [];
      }
  
      let posts = response.items;
  
      // Логируем каждый этап фильтрации
      if (filters.depth) {
        const depthMs = filters.depth * 60 * 60 * 1000;
        const minDate = Date.now() - depthMs;
        console.log('Filtering by depth, min date:', new Date(minDate));
        
        const beforeDepthFilter = posts.length;
        posts = posts.filter(post => post.date * 1000 >= minDate);
        console.log(`Depth filter: ${beforeDepthFilter} -> ${posts.length} posts`);
      }
  
      console.log(`Posts after depth filter: ${posts.length}`);
      return posts;
  
    } catch (error) {
      console.error('Error getting posts from VK API:', error);
      console.error('Error details:', error.response?.data || error.message);
      throw error;
    }
  }
  

  // Add this method to the class
  hasExternalLinks(text) {
    if (!text) return false;
  
    // Regex to match URLs (including VK mentions)
    const urlRegex = /(?:https?:\/\/|www\.)[^\s[\]]+/gi;
    // Regex to match VK mention format [id123|Name] or [club123|Name]
    
    const regex = /\[(club|id)\d+\|([^\]]+)\]/g;
    
    // Массив для хранения найденных совпадений
    const matches = [];
    
    // Поиск всех совпадений в тексте
    let match;
    while ((match = regex.exec(text)) !== null) {
        matches.push(match[0]); // Добавляем найденное совпадение в массив
    }
    
    const hasExternalUrls = urlRegex.test(text);

    return hasExternalUrls || matches.length > 0;
  }
  
  

  checkMediaFilters(post, mediaFilters) {
    if (!mediaFilters || !post.attachments) return true;

    const counts = this.countAttachments(post.attachments);

    // Подробно логируем фильтры и количество вложений
    console.log('Media filters check:');
    console.log('- Filters:', JSON.stringify(mediaFilters));
    console.log('- Counts:', JSON.stringify(counts));

    // Проверяем соответствие фильтрам
    return Object.entries(mediaFilters).every(([type, limits]) => {
      // Пропускаем служебные поля Mongoose
      if (type.startsWith('$') || type === '_doc') return true;
      
      // Проверяем, что limits является объектом с нужными полями
      if (!limits || typeof limits !== 'object' || !('min' in limits) || !('max' in limits)) {
        return true;
      }
      
      const count = counts[type];
      
      // Проверка минимального значения
      if (limits.min > 0 && count < limits.min) {
        console.log(`- Filter failed: ${type} count=${count} < min=${limits.min}`);
        return false;
      }
      
      // Проверка максимального значения
      // -1 означает "без ограничений"
      // 0 означает "точное совпадение с 0"
      // положительное число - максимальное значение
      if (limits.max === 0 && count !== 0) {
        console.log(`- Filter failed: ${type} count=${count} != exact match 0`);
        return false;
      }
      if (limits.max > 0 && count > limits.max) {
        console.log(`- Filter failed: ${type} count=${count} > max=${limits.max}`);
        return false;
      }
      
      // console.log(`- Filter passed for ${type}`);
      return true;
    });
  }

  // Получение информации о сообществе (поддержка как ID, так и доменного имени)
  async getCommunityInfo(community) {
    await this.initializeSettings();
    
    let params = {
      fields: 'members_count,description,status',
      access_token: this.settings.vkApi.serviceToken,
      v: this.settings.vkApi.apiVersion || this.apiVersion
    };
    
    if (community.type === 'domain') {
      params.domain = community.value;
    } else {
      params.group_id = community.value.replace('-', '');
    }

    try {
      const response = await axios.get(`${this.baseUrl}groups.getById`, { params });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }
      
      return response.data.response[0];
    } catch (error) {
      console.error('Error fetching community info from VK:', error.message);
      throw error;
    }
  }

  async resolveScreenName(screenName) {
    try {
      const response = await this.api('utils.resolveScreenName', {
        screen_name: screenName
      });
      return response;
    } catch (error) {
      console.error('Error resolving screen name:', error);
      throw error;
    }
  }

  // Add domain resolution for community IDs
  async resolveCommunityId(community) {
    const cacheKey = `${community.type}:${community.value}`;
    // Проверяем, есть ли значение в кеше
    if (this.communityIdCache.has(cacheKey)) {
      const cachedItem = this.communityIdCache.get(cacheKey);
      
      // Если кеш не устарел, возвращаем закешированный ID
      if (Date.now() - cachedItem.timestamp < this.cacheTTL) {
        // console.log(`Using cached community ID for ${cacheKey}: ${cachedItem.id}`);
        return cachedItem.id;
      } else {
        // Удаляем устаревший кеш
        this.communityIdCache.delete(cacheKey);
      }
    }
    let resolvedId;
    try {
      if (community.type === 'id') {
        return community.value;
      } else if (community.type === 'domain') {
        const resolved = await this.resolveScreenName(community.value);
        if (resolved && resolved.type === 'group') {
          resolvedId = `-${resolved.object_id}`;
          // return `-${resolved.object_id}`; // Add minus for groups
        } else if (resolved && resolved.type === 'page') {
          resolvedId = `-${resolved.object_id}`;
          // return `-${resolved.object_id}`; // Add minus for public pages
        }
        
        if (resolvedId) {
          // Сохраняем значение в кеше
          this.communityIdCache.set(cacheKey, 
          { 
            id: resolvedId,
            timestamp: Date.now() 
          });
          return resolvedId;
        }

        throw new Error(`Could not resolve domain ${community.value}`);
      }
      throw new Error('Invalid community type');
    } catch (error) {
      console.error('Error resolving community ID:', error);
      throw error;
    }
  }

  // Новый метод для применения нескольких шаблонов фильтрации
  applyfiltersSet(posts, filtersSet, skipExternalLinks) {
    if (!posts || !posts.length) return [];
    if (!filtersSet || !filtersSet.length) return posts;
    
    // console.log(`Applying ${filtersSet.length} filter templates to ${posts.length} posts`);
    
    // Результирующий массив с постами, прошедшими хотя бы один шаблон
    const filteredPosts = [];
    const processedPostIds = new Set(); // Для отслеживания уже добавленных постов
    
    // Для каждого поста проверяем все шаблоны
    posts.forEach(post => {
      // Если пост уже добавлен, пропускаем
      if (processedPostIds.has(post.id)) return;
      
      if (skipExternalLinks) {
        if (this.hasExternalLinks(post.text)) {
          // console.log(`\n  ❌  post has external links`);
          return
        }
        // console.log(`\n  ✅  post hasnt external links`);
      }
      
      
      let counts = {
        photos: 0,
        videos: 0,
        documents: 0,
        audio: 0
      };
      if (post.attachments) {
        counts = this.countAttachments(post.attachments);
        // console.log(`- Attachment counts: photos=${counts.photos}, videos=${counts.videos}, documents=${counts.documents}, audio=${counts.audio}`);
      }

      let matched = false;
      
      // Проверяем каждый набор фильтров
      for (let i = 0; i < filtersSet.length; i++) {
        const filter = filtersSet[i];
        // Проверяем, соответствует ли пост фильтрам
        const isMatch = 
          (counts.photos >= filter.photos.min && (filter.photos.max === -1 || counts.photos <= filter.photos.max)) &&
          (counts.videos >= filter.videos.min && (filter.videos.max === -1 || counts.videos <= filter.videos.max)) &&
          (counts.documents >= filter.documents.min && (filter.documents.max === -1 || counts.documents <= filter.documents.max)) &&
          (counts.audio >= filter.audio.min && (filter.audio.max === -1 || counts.audio <= filter.audio.max));
    
        if (isMatch) {
          // console.log(`  ✅ Post ${post.id} matched filter set ${i + 1}`);
          filteredPosts.push(post);
          processedPostIds.add(post.id);
          matched = true;
          break; // Если хотя бы один набор фильтров подошел, добавляем пост и переходим к следующему
        } else {
          // console.log(`  ❌ Post ${post.id} did NOT match filter set ${i + 1}`);
        }
      }
    
      // if (!matched) {
      //   console.log(`❌ Post ${post.id} did not match any filter sets and was filtered out`);
      // }
    });
    
    
    // console.log(`After applying templates: ${filteredPosts.length} posts remain`);
    return filteredPosts;
  }
  
  // Выделяем проверку поста в отдельный метод с подробной информацией о результате
  checkPostAgainstTemplate(post, template) {
    // Проверка наличия внешних ссылок
    if (template.skipExternalLinks && this.hasExternalLinks(post.text)) {
      return { 
        matches: false, 
        reason: 'Post contains external links but skipExternalLinks is enabled' 
      };
    }
    
    // Проверка наличия текста
    if (template.containsText && 
        (!post.text || !post.text.toLowerCase().includes(template.containsText.toLowerCase()))) {
      return { 
        matches: false, 
        reason: `Post does not contain required text: "${template.containsText}"` 
      };
    }
    
    // Проверка медиа-фильтров
    if (template.mediaFilters) {
      const mediaCheckResult = this.checkMediaFiltersWithDetail(post, template.mediaFilters);
      if (!mediaCheckResult.matches) {
        return mediaCheckResult;
      }
    } else {
      // console.log(`No media filters defined for template ${template.name}, skipping media check`);
    }
    
    // Все проверки пройдены - пост соответствует шаблону
    return { matches: true, reason: 'All criteria passed' };
  }
  
  // Расширенная версия метода проверки медиа с подробным описанием причины отклонения
  checkMediaFiltersWithDetail(post, mediaFilters) {
    if (!mediaFilters) return { matches: true, reason: 'No media filters specified' };

    // Получаем количество вложений
    const counts = this.countAttachments(post.attachments || []);
    
    // console.log(`Checking media filters for post ${post.id}:`);
    
    // Проверяем каждый тип медиа
    for (const [type, limits] of Object.entries(mediaFilters)) {
      // Пропускаем служебные поля Mongoose
      if (type.startsWith('$') || type === '_doc') continue;
      
      // Проверяем, что limits является объектом с нужными полями
      if (!limits || typeof limits !== 'object' || !('min' in limits) || !('max' in limits)) {
        console.log(`- Skipping invalid filter type: ${type}`);
        continue;
      }
      
      // console.log(`- ${type}: count=${counts[type]}, min=${limits.min}, max=${limits.max}`);
      
      const count = counts[type];
      
      // Проверка минимального значения
      if (Number(limits.min) > 0 && count < Number(limits.min)) {
        // console.log(`❌ Failed min check: ${type} count (${count}) < min (${limits.min})`);
        return { 
          matches: false, 
          reason: `${type} count (${count}) is less than required minimum (${limits.min})` 
        };
      }
      
      // Проверка максимального значения
      if (Number(limits.max) === 0 && count !== 0) {
        // console.log(`❌ Failed exact zero check: ${type} count (${count}) != 0`);
        return { 
          matches: false, 
          reason: `${type} count (${count}) must be exactly 0` 
        };
      }
      
      if (Number(limits.max) > 0 && count > Number(limits.max)) {
        // console.log(`❌ Failed max check: ${type} count (${count}) > max (${limits.max})`);
        return { 
          matches: false, 
          reason: `${type} count (${count}) exceeds maximum allowed (${limits.max})` 
        };
      }
    }
    
    // console.log(`✅ All media filters passed for post ${post.id}`);
    return { matches: true, reason: 'Media filters passed' };
  }
  
  // Вспомогательный метод для подсчета вложений
  countAttachments(attachments) {
    const counts = {
      photos: 0,
      videos: 0,
      documents: 0,
      audio: 0
    };
    
    if (!attachments || !attachments.length) return counts;
    
    attachments.forEach(attachment => {
      if (attachment.type === 'photo') counts.photos++;
      else if (attachment.type === 'video') counts.videos++;
      else if (attachment.type === 'doc') counts.documents++;
      else if (attachment.type === 'audio') counts.audio++;
    });
    
    return counts;
  }
  
}

module.exports = new VkApiService();
