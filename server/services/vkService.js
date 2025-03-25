const axios = require('axios');
const config = require('../config/config');
const VK = require('vk-io').VK;

// Initialize VK API client
const vk = new VK({
  token: config.vk.token
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
      // Get groups where user is admin
      const response = await vk.api.groups.get({
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
    } catch (error) {
      console.error('Error fetching user VK groups:', error);
      
      // Fallback using settings groups from DB if available
      try {
        const SettingsModel = require('../models/Settings');
        const settings = await SettingsModel.findOne({ key: 'vk-groups' });
        
        if (settings && settings.value && Array.isArray(settings.value)) {
          return settings.value;
        }
      } catch (dbError) {
        console.error('Error fetching groups from settings:', dbError);
      }
      
      // Return empty array if all methods fail
      return [];
    }
  }
  
  /**
   * Получение информации о группе по ID
   */
  async getGroupInfo(groupId) {
    // Make sure group ID is positive for VK API
    const positiveGroupId = groupId.toString().replace('-', '');
    
    const response = await vk.api.groups.getById({
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
  }
  
  /**
   * Поиск групп по запросу
   */
  async searchGroups(query, count = 20) {
    const response = await vk.api.groups.search({
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
  }
}

module.exports = new VkService();
