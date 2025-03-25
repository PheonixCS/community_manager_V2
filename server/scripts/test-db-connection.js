const mongoose = require('mongoose');
const config = require('../config/config');
const Post = require('../models/Post');

async function testConnection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB successfully');
    
    // Try to create a test post
    const testPost = new Post({
      vkId: 'test123',
      postId: 'test123',
      communityId: mongoose.Types.ObjectId(),
      taskId: mongoose.Types.ObjectId(),
      text: 'This is a test post',
      date: new Date(),
      likes: 0,
      reposts: 0,
      views: 0,
      attachments: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    });
    
    console.log('Trying to save test post...');
    const saved = await testPost.save();
    console.log('Test post saved successfully:', saved._id);
    
    // Clean up test data
    await Post.deleteOne({ _id: saved._id });
    console.log('Test post deleted');
    
    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testConnection();
