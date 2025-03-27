/**
 * Service Initializer
 * Handles initialization of all backend services in the correct order
 */
const contentGeneratorService = require('./contentGeneratorService');
const s3Service = require('./s3Service');
const vkApiService = require('./vkApiService');
const vkAuthService = require('./vkAuthService');
const vkPostingService = require('./vkPostingService');
const videoDownloadService = require('./videoDownloadService');
const mediaDownloadService = require('./mediaDownloadService');

class ServiceInitializer {
  constructor() {
    this.services = [
      { name: 'S3Service', service: s3Service, initialized: false },
      { name: 'VkApiService', service: vkApiService, initialized: false },
      { name: 'VkAuthService', service: vkAuthService, initialized: false },
      { name: 'VkPostingService', service: vkPostingService, initialized: false },
      { name: 'VideoDownloadService', service: videoDownloadService, initialized: false },
      { name: 'MediaDownloadService', service: mediaDownloadService, initialized: false },
      { name: 'ContentGeneratorService', service: contentGeneratorService, initialized: false }
    ];
    
    this.initializationComplete = false;
  }
  
  /**
   * Initialize all services in the correct order
   */
  async initialize() {
    console.log('Starting service initialization...');
    
    for (const serviceInfo of this.services) {
      try {
        const { name, service } = serviceInfo;
        console.log(`Initializing ${name}...`);
        
        // Check if the service has an initialize method
        if (typeof service.initialize === 'function') {
          await service.initialize();
          serviceInfo.initialized = true;
          console.log(`✓ ${name} initialized successfully`);
        } else {
          // If no initialize method exists, consider it initialized
          serviceInfo.initialized = true;
          console.log(`✓ ${name} has no initialization method, assuming ready`);
        }
      } catch (error) {
        console.error(`Failed to initialize ${serviceInfo.name}:`, error);
        throw new Error(`Service initialization failed: ${serviceInfo.name}`);
      }
    }
    
    this.initializationComplete = true;
    console.log('All services initialized successfully');
  }
  
  /**
   * Check if all services are initialized
   */
  isInitialized() {
    return this.initializationComplete;
  }
  
  /**
   * Get initialization status of all services
   */
  getStatus() {
    return this.services.map(({ name, initialized }) => ({
      name,
      initialized
    }));
  }
}

// Create singleton instance
const serviceInitializer = new ServiceInitializer();

module.exports = serviceInitializer;
