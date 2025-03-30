const CleanupSettings = require('../models/CleanupSettings');
const Post = require('../models/Post');
const postService = require('./postService');
const cron = require('node-cron');
const mongoose = require('mongoose');

class CleanupService {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  async init() {
    try {
      console.log('Initializing cleanup service...');
      // Get or create default settings
      let settings = await this.getSettings();
      
      // Schedule cleanup if enabled
      if (settings.enabled) {
        this.scheduleCleanup(settings.cronSchedule);
      }
      
      console.log(`Cleanup service initialized. Enabled: ${settings.enabled}, Schedule: ${settings.cronSchedule}`);
    } catch (error) {
      console.error('Error initializing cleanup service:', error);
    }
  }

  // Get or create settings if they don't exist
  async getSettings() {
    let settings = await CleanupSettings.findOne();
    
    if (!settings) {
      settings = new CleanupSettings();
      await settings.save();
    }
    
    return settings;
  }

  // Schedule cleanup task using cron
  scheduleCleanup(cronExpression) {
    // Stop existing task if running
    this.stopScheduler();
    
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      console.error('Invalid cron expression:', cronExpression);
      return false;
    }
    
    // Schedule new task
    this.task = cron.schedule(cronExpression, () => {
      this.performCleanup();
    });
    
    console.log(`Cleanup scheduled with cron: ${cronExpression}`);
    return true;
  }

  // Stop the scheduler
  stopScheduler() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('Cleanup scheduler stopped');
    }
  }

  // Update settings and reschedule if needed
  async updateSettings(newSettings) {
    try {
      const settings = await this.getSettings();
      
      // Update with new values
      if (newSettings.enabled !== undefined) settings.enabled = newSettings.enabled;
      if (newSettings.cronSchedule) settings.cronSchedule = newSettings.cronSchedule;
      
      // Update rules if provided
      if (newSettings.rules) {
        // Deep merge rules
        if (newSettings.rules.olderThan) {
          if (newSettings.rules.olderThan.enabled !== undefined) 
            settings.rules.olderThan.enabled = newSettings.rules.olderThan.enabled;
          if (newSettings.rules.olderThan.hours !== undefined) 
            settings.rules.olderThan.hours = newSettings.rules.olderThan.hours;
        }
        
        if (newSettings.rules.lowViewRate) {
          if (newSettings.rules.lowViewRate.enabled !== undefined) 
            settings.rules.lowViewRate.enabled = newSettings.rules.lowViewRate.enabled;
          if (newSettings.rules.lowViewRate.threshold !== undefined) 
            settings.rules.lowViewRate.threshold = newSettings.rules.lowViewRate.threshold;
        }
        
        if (newSettings.rules.lowEngagement) {
          if (newSettings.rules.lowEngagement.enabled !== undefined) 
            settings.rules.lowEngagement.enabled = newSettings.rules.lowEngagement.enabled;
          if (newSettings.rules.lowEngagement.minLikes !== undefined) 
            settings.rules.lowEngagement.minLikes = newSettings.rules.lowEngagement.minLikes;
          if (newSettings.rules.lowEngagement.minComments !== undefined) 
            settings.rules.lowEngagement.minComments = newSettings.rules.lowEngagement.minComments;
          if (newSettings.rules.lowEngagement.minReposts !== undefined) 
            settings.rules.lowEngagement.minReposts = newSettings.rules.lowEngagement.minReposts;
        }
        
        if (newSettings.rules.duplicateMedia) {
          if (newSettings.rules.duplicateMedia.enabled !== undefined) 
            settings.rules.duplicateMedia.enabled = newSettings.rules.duplicateMedia.enabled;
        }
        
        if (newSettings.rules.specificCommunities) {
          if (newSettings.rules.specificCommunities.enabled !== undefined) 
            settings.rules.specificCommunities.enabled = newSettings.rules.specificCommunities.enabled;
          if (newSettings.rules.specificCommunities.communities) 
            settings.rules.specificCommunities.communities = newSettings.rules.specificCommunities.communities;
          if (newSettings.rules.specificCommunities.exclude !== undefined) 
            settings.rules.specificCommunities.exclude = newSettings.rules.specificCommunities.exclude;
        }
      }
      
      settings.updatedAt = new Date();
      await settings.save();
      
      // Reschedule if enabled
      if (settings.enabled) {
        this.scheduleCleanup(settings.cronSchedule);
      } else {
        this.stopScheduler();
      }
      
      return settings;
    } catch (error) {
      console.error('Error updating cleanup settings:', error);
      throw error;
    }
  }

  // Run cleanup based on current settings
  async performCleanup() {
    if (this.isRunning) {
      console.log('Cleanup is already running, skipping...');
      return { skipped: true };
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    console.log('Starting cleanup process...');
    
    try {
      // Get current settings
      const settings = await this.getSettings();
      
      // Build query based on rules
      const query = {};
      const rules = settings.rules;
      
      // Rule: Posts older than X hours
      if (rules.olderThan && rules.olderThan.enabled) {
        const olderThanDate = new Date();
        olderThanDate.setHours(olderThanDate.getHours() - rules.olderThan.hours);
        query.date = { $lt: olderThanDate };
      }
      
      // Rule: Posts with low view rate
      if (rules.lowViewRate && rules.lowViewRate.enabled) {
        query.viewRate = { $lt: rules.lowViewRate.threshold };
      }
      
      // Rule: Posts with low engagement
      if (rules.lowEngagement && rules.lowEngagement.enabled) {
        if (rules.lowEngagement.minLikes > 0) {
          query.likes = { $lt: rules.lowEngagement.minLikes };
        }
        if (rules.lowEngagement.minComments > 0) {
          query.comments = { $lt: rules.lowEngagement.minComments };
        }
        if (rules.lowEngagement.minReposts > 0) {
          query.reposts = { $lt: rules.lowEngagement.minReposts };
        }
      }
      
      // Rule: Posts from specific communities
      if (rules.specificCommunities && rules.specificCommunities.enabled && 
          rules.specificCommunities.communities.length > 0) {
        
        if (rules.specificCommunities.exclude) {
          // Exclude these communities
          query.communityId = { $nin: rules.specificCommunities.communities };
        } else {
          // Only include these communities
          query.communityId = { $in: rules.specificCommunities.communities };
        }
      }
      
      // Additional handling for duplicate media (more complex query)
      let postsToDelete = [];
      // логируем какие правила для удаления используются
      console.log('Applying rules:', JSON.stringify(rules, null, 2));
      // Find all posts that match our query
      postsToDelete = await Post.find(query).select('_id');
      
      // Special handling for duplicate media if enabled
      if (rules.duplicateMedia && rules.duplicateMedia.enabled) {
        const mediaDuplicates = await this.findDuplicateMediaPosts();
        
        // Get IDs from media duplicates
        const duplicateIds = mediaDuplicates.map(post => post._id.toString());
        
        // Only add new IDs not already in postsToDelete
        const existingIds = new Set(postsToDelete.map(post => post._id.toString()));
        for (const id of duplicateIds) {
          if (!existingIds.has(id)) {
            postsToDelete.push({ _id: mongoose.Types.ObjectId(id) });
          }
        }
      }
      
      // Delete posts
      let deletedCount = 0;
      console.log(`Found ${postsToDelete.length} posts to delete`);
      
      // Delete posts in batches
      for (const postDoc of postsToDelete) {
        try {
          await postService.deletePost(postDoc._id);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting post ${postDoc._id}:`, error);
        }
      }
      await postService.cleanupOrphanedMedia();
      
      // Update statistics
      const duration = Date.now() - startTime;
      settings.statistics.lastRun = new Date();
      settings.statistics.totalCleanups += 1;
      settings.statistics.totalPostsDeleted += deletedCount;
      settings.statistics.lastCleanupPostsDeleted = deletedCount;
      
      // Add to history
      settings.statistics.history.push({
        date: new Date(),
        postsDeleted: deletedCount,
        duration
      });
      
      // Trim history to last 100 entries if it gets too long
      if (settings.statistics.history.length > 100) {
        settings.statistics.history = settings.statistics.history.slice(-100);
      }
      
      await settings.save();
      
      console.log(`Cleanup process completed. Deleted ${deletedCount} posts in ${duration}ms`);
      
      return {
        deletedCount,
        duration,
        date: new Date()
      };
    } catch (error) {
      console.error('Error performing cleanup:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
  
  // Helper method to find duplicate media posts
  async findDuplicateMediaPosts() {
    try {
      // This is a simplified example - in a real implementation,
      // you might want a more sophisticated approach to detect duplicates
      
      // Find posts with duplicate media download URLs
      const duplicateMedia = await Post.aggregate([
        // Unwind the mediaDownloads array
        { $unwind: { path: "$mediaDownloads", preserveNullAndEmptyArrays: false } },
        // Group by the URL and collect posts with the same URL
        { $group: {
            _id: "$mediaDownloads.s3Url",
            count: { $sum: 1 },
            posts: { $push: { id: "$_id", date: "$date" } }
          }
        },
        // Filter only groups with more than 1 post (i.e., duplicates)
        { $match: { count: { $gt: 1 } } },
        // Sort by newest first
        { $sort: { "posts.date": -1 } }
      ]);
      
      // Extract only the older posts from each duplicate group
      // (keep the newest, delete the rest)
      const postsToDelete = [];
      
      for (const group of duplicateMedia) {
        if (group.posts.length > 1) {
          // Sort by date (newest first)
          group.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
          
          // Skip the first one (newest), add the rest to delete list
          for (let i = 1; i < group.posts.length; i++) {
            postsToDelete.push({ _id: group.posts[i].id });
          }
        }
      }
      
      return postsToDelete;
    } catch (error) {
      console.error('Error finding duplicate media posts:', error);
      return [];
    }
  }
  
  // Run cleanup manually
  async runCleanupManually() {
    return this.performCleanup();
  }
}

module.exports = new CleanupService();
