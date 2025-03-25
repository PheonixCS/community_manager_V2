const vkAuthService = require('../services/vkAuthService');
const config = require('../config/config');

/**
 * VK Authentication Controller
 * Handles VK Auth related logic
 */
class VkAuthController {
  /**
   * Generate auth URL for VK authentication
   */
  generateAuthUrl(req, res) {
    try {
      // Get the correct redirect URI from configuration or environment
      const redirectUri = config.vk.redirectUri || 'https://krazu-group.tech/api/vk-auth/callback';
      
      // Generate auth URL with PKCE implementation
      const authUrl = vkAuthService.getAuthUrl(redirectUri);
      
      // Log the complete URL for debugging
      console.log('Generated complete VK auth URL:', authUrl);
      
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle the VK auth callback
   */
  async handleCallback(req, res) {
    try {
      const { code, state, error, error_description } = req.query;
      
      // Log the incoming request parameters
      console.log('VK auth callback received with params:', req.query);
      
      // Check for errors from VK ID
      if (error) {
        console.error('VK auth error:', error, error_description);
        
        // Handle PKCE specific errors
        if (error === 'invalid_request' && error_description?.includes('code_challenge')) {
          return res.status(400).json({ 
            error: 'PKCE authentication failed. The authorization code challenge is invalid or missing.',
            details: error_description,
            suggestion: 'Please try again. If the problem persists, clear your browser cookies and cache.'
          });
        }
        
        return res.status(400).json({ error: error_description || error });
      }
      
      if (!code) {
        throw new Error('Authorization code not provided');
      }
      
      // Use the exact same redirect URI as in the auth URL request
      const redirectUri = config.vk.redirectUri || 'https://krazu-group.tech/api/vk-auth/callback';
      
      // Pass the state to token exchange to validate it and retrieve stored params
      const result = await vkAuthService.getTokenByCode(code, state, redirectUri);
      
      // Log the received token scope for debugging
      console.log('Received token with scope:', result.token.scope);
      
      // Special handling for token without critical permissions
      const criticalScopes = ['wall', 'photos', 'groups', 'manage'];
      const missingScopes = criticalScopes.filter(scope => !result.token.scope.includes(scope));
      
      if (missingScopes.length > 0) {
        console.warn(`Token is missing critical permissions: ${missingScopes.join(', ')}`);
      }
      
      // Return success response with token information
      res.json({
        status: 'success',
        message: 'Authorization successful',
        user: result.user,
        scope: result.token.scope,
        missingScopes: missingScopes.length > 0 ? missingScopes : null
      });
    } catch (error) {
      console.error('Error processing auth callback:', error);
      
      // Provide more specific error message for auth issues
      if (error.message.includes('state parameter') || error.message.includes('code_verifier')) {
        return res.status(400).json({
          error: error.message,
          details: 'The authentication session may have expired or been tampered with.',
          suggestion: 'Please try authenticating again from the beginning.'
        });
      }
      
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all tokens
   */
  async getAllTokens(req, res) {
    try {
      const tokens = await vkAuthService.getAllTokens();
      
      // Don't return actual tokens in API response for security
      const safeTokens = tokens.map(token => ({
        id: token._id,
        vkUserId: token.vkUserId,
        vkUserName: token.vkUserName,
        isActive: token.isActive,
        expiresAt: token.expiresAt,
        lastUsed: token.lastUsed,
        lastRefreshed: token.lastRefreshed,
        scope: token.scope,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        userInfo: {
          firstName: token.userInfo?.first_name,
          lastName: token.userInfo?.last_name,
          photo: token.userInfo?.photo_200,
          screenName: token.userInfo?.screen_name
        }
      }));
      
      res.json(safeTokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Deactivate a token
   */
  async deactivateToken(req, res) {
    try {
      const success = await vkAuthService.deactivateToken(req.params.id);
      
      if (!success) {
        return res.status(404).json({ error: 'Token not found or could not be deactivated' });
      }
      
      res.json({ 
        status: 'success',
        message: 'Token deactivated successfully' 
      });
    } catch (error) {
      console.error(`Error deactivating token ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Activate a token
   */
  async activateToken(req, res) {
    try {
      const success = await vkAuthService.activateToken(req.params.id);
      
      if (!success) {
        return res.status(404).json({ error: 'Token not found or could not be activated' });
      }
      
      res.json({ 
        status: 'success',
        message: 'Token activated successfully' 
      });
    } catch (error) {
      console.error(`Error activating token ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete a token
   */
  async deleteToken(req, res) {
    try {
      const success = await vkAuthService.deleteToken(req.params.id);
      
      if (!success) {
        return res.status(404).json({ error: 'Token not found or could not be deleted' });
      }
      
      res.json({ 
        status: 'success',
        message: 'Token deleted successfully' 
      });
    } catch (error) {
      console.error(`Error deleting token ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new VkAuthController();
