const axios = require('axios');
const config = require('../config/config');
const VK = require('vk-io').VK;
const VkUserToken = require('../models/VkUserToken');

// Initialize a basic VK API client with the service token as fallback
const vk = new VK({
  token: config.vk.token || config.vkApi.serviceToken
});

/**
 * Сервис для работы с API ВКонтакте
 */
class VkService {
  /**
   * Получение списка групп, в которых пользователь является администратором
   */
  async getUserGroups() {
    try {
      // First try to get an active user token
      const VkUserToken = require('../models/VkUserToken');
      const activeToken = await VkUserToken.findOne({ 
        isActive: true,
        expiresAt: { $gt: Math.floor(Date.now() / 1000) }
      });
      
      if (activeToken) {
        console.log(`Using active user token for ${activeToken.vkUserName} to fetch groups`);
        
        // Create a temporary VK API instance with the user token
        const userVk = new VK({
          token: activeToken.accessToken
        });
        
        // Get groups where user is admin using the user token
        const response = await userVk.api.groups.get({
          extended: 1,
          filter: 'admin',
          fields: 'name,screen_name,photo_50,members_count'
        });
        
        return response.items.map(group => ({
          id: `-${group.id}`, // Negative ID for groups in VK API
          name: group.name,
          screenName: group.screen_name,
          photo: group.photo_50,
          membersCount: group.members_count
        }));
      } else {
        console.warn('No active user token found, trying other methods');
        // Try second method - using service token
        return await this.getGroupsUsingServiceToken();
      }
    } catch (error) {
      console.error('Error fetching user VK groups:', error);
      
      // Try service token if user token fails
      try {
        return await this.getGroupsUsingServiceToken();
      } catch (serviceError) {
        console.error('Service token method also failed:', serviceError);
        
        // Fallback using settings groups from DB if available
        try {
          const SettingsModel = require('../models/Settings');
          const settings = await SettingsModel.findOne({ key: 'vk-groups' });
          
          if (settings && settings.value && Array.isArray(settings.value)) {
            console.log('Using groups from settings');
            return settings.value;
          }
        } catch (dbError) {
          console.error('Error fetching groups from settings:', dbError);
        }
      }
      
      // Return empty array if all methods fail
      return [];
    }
  }

  /**
   * Получение групп с использованием сервисного токена
   * @private
   */
  async getGroupsUsingServiceToken() {
    // Try to get groups where user has privileges using service token
    // Note: This has limited capabilities compared to user token
    try {
      console.log('Attempting to get groups using service token');
      const response = await axios.get('https://api.vk.com/method/groups.get', {
        params: {
          user_id: config.vk.userId, // You may need to configure this in your config
          extended: 1,
          filter: 'admin,editor,moderator',
          fields: 'name,screen_name,photo_50,members_count',
          access_token: config.vkApi.serviceToken,
          v: '5.131'
        }
      });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }
      
      if (response.data.response && response.data.response.items) {
        return response.data.response.items.map(group => ({
          id: `-${group.id}`,
          name: group.name,
          screenName: group.screen_name,
          photo: group.photo_50,
          membersCount: group.members_count
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error getting groups with service token:', error);
      throw error;
    }
  }
  
  /**
   * Получение информации о группе по ID
   */
  async getGroupInfo(groupId) {
    try {
      // Make sure group ID is positive for VK API
      const positiveGroupId = groupId.toString().replace('-', '');
      
      // Try to get an active user token first
      const activeToken = await VkUserToken.findOne({ 
        isActive: true,
        expiresAt: { $gt: Math.floor(Date.now() / 1000) }
      });
      
      let apiClient = vk;
      if (activeToken) {
        // Create a temporary VK API instance with the user token
        apiClient = new VK({
          token: activeToken.accessToken
        });
      }
      
      const response = await apiClient.api.groups.getById({
        group_id: positiveGroupId,
        fields: 'name,screen_name,photo_50,members_count,description'
      });
      
      if (!response.items || response.items.length === 0) {
        throw new Error(`Group with ID ${groupId} not found`);
      }
      
      const group = response.items[0];
      
      return {
        id: `-${group.id}`,
        name: group.name,
        screenName: group.screen_name,
        photo: group.photo_50,
        membersCount: group.members_count,
        description: group.description
      };
    } catch (error) {
      console.error(`Error getting info for group ${groupId}:`, error);
      throw error;
    }
  }
  
  /**
   * Поиск групп по запросу
   */
  async searchGroups(query, count = 20) {
    try {
      // Try to get an active user token first
      const activeToken = await VkUserToken.findOne({ 
        isActive: true,
        expiresAt: { $gt: Math.floor(Date.now() / 1000) }
      });
      
      let apiClient = vk;
      if (activeToken) {
        // Create a temporary VK API instance with the user token
        apiClient = new VK({
          token: activeToken.accessToken
        });
      }
      
      const response = await apiClient.api.groups.search({
        q: query,
        count: count,
        sort: 0, // Sort by popularity
        fields: 'name,screen_name,photo_50,members_count'
      });
      
      return response.items.map(group => ({
        id: `-${group.id}`,
        name: group.name,
        screenName: group.screen_name,
        photo: group.photo_50,
        membersCount: group.members_count
      }));
    } catch (error) {
      console.error(`Error searching groups with query "${query}":`, error);
      throw error;
    }
  }
}

module.exports = new VkService();
