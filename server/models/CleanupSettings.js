const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CleanupSettingsSchema = new Schema({
  // General settings
  enabled: {
    type: Boolean,
    default: false
  },
  cronSchedule: {
    type: String,
    default: '0 3 * * *' // Default: 3 AM daily
  },
  // Cleanup rules
  rules: {
    // Rule: Delete posts older than X hours
    olderThan: {
      enabled: {
        type: Boolean,
        default: true
      },
      hours: {
        type: Number,
        default: 168 // 7 days
      }
    },
    // Rule: Delete posts with low view rate
    lowViewRate: {
      enabled: {
        type: Boolean,
        default: false
      },
      threshold: {
        type: Number,
        default: 0.5
      }
    },
    // Rule: Delete posts with low engagement
    lowEngagement: {
      enabled: {
        type: Boolean,
        default: false
      },
      minLikes: {
        type: Number,
        default: 5
      },
      minComments: {
        type: Number,
        default: 0
      },
      minReposts: {
        type: Number,
        default: 0
      }
    },
    // Rule: Delete duplicate media posts
    duplicateMedia: {
      enabled: {
        type: Boolean,
        default: false
      }
    },
    // Rule: Delete from specific communities
    specificCommunities: {
      enabled: {
        type: Boolean,
        default: false
      },
      communities: {
        type: [String],
        default: []
      },
      exclude: {
        type: Boolean,
        default: false // If true, delete from all communities EXCEPT listed
      }
    }
  },
  // Statistics
  statistics: {
    lastRun: {
      type: Date
    },
    totalCleanups: {
      type: Number,
      default: 0
    },
    totalPostsDeleted: {
      type: Number,
      default: 0
    },
    lastCleanupPostsDeleted: {
      type: Number,
      default: 0
    },
    history: [{
      date: Date,
      postsDeleted: Number,
      duration: Number // in milliseconds
    }]
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt field
CleanupSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CleanupSettings', CleanupSettingsSchema);
