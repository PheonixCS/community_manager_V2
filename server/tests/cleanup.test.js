const mongoose = require('mongoose');
const CleanupSettings = require('../models/CleanupSettings');
const cleanupService = require('../services/cleanupService');
const Post = require('../models/Post');
const config = require('../config/config');

// Mock dependencies
jest.mock('../services/postService', () => ({
  deletePost: jest.fn().mockResolvedValue(true)
}));

describe('Cleanup Service Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(config.testMongoURI || 'mongodb://localhost:27017/test_cm_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await CleanupSettings.deleteMany({});
    await Post.deleteMany({});
  });

  test('Should create default settings if none exist', async () => {
    const settings = await cleanupService.getSettings();
    expect(settings).toBeTruthy();
    expect(settings.enabled).toBe(false);
    expect(settings.cronSchedule).toBe('0 3 * * *');
    expect(settings.rules.olderThan.hours).toBe(168); // 7 days
  });

  test('Should update settings correctly', async () => {
    // First get or create default settings
    await cleanupService.getSettings();
    
    // Update settings
    const newSettings = {
      enabled: true,
      cronSchedule: '0 9 * * *',
      rules: {
        olderThan: {
          enabled: true,
          hours: 48
        }
      }
    };
    
    const updated = await cleanupService.updateSettings(newSettings);
    
    // Verify updates
    expect(updated.enabled).toBe(true);
    expect(updated.cronSchedule).toBe('0 9 * * *');
    expect(updated.rules.olderThan.hours).toBe(48);
  });
});
