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
      // Get the PKCE parameters from the frontend
      const { state, codeChallenge, codeChallengeMethod } = req.query;
      
      if (!state || !codeChallenge) {
        return res.status(400).json({ 
          error: 'Missing required PKCE parameters: state and codeChallenge are required'
        });
      }
      
      // Get the correct redirect URI from configuration
      const redirectUri = config.vk.redirectUri || 'https://krazu-group.tech/api/vk-auth/callback';
      const vkAppId = config.vk.appId;
      
      if (!vkAppId) {
        throw new Error('VK App ID not configured');
      }
      
      // Define required scopes for VK ID
      const scopeValue = "wall,photos,groups,video,offline,docs,manage";
      
      // Build the auth URL with frontend-provided PKCE parameters
      const authUrl = `https://id.vk.com/authorize?` +
        `client_id=${vkAppId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&display=page` +
        `&scope=${scopeValue}` +
        `&response_type=code` +
        `&state=${state}` + 
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=${codeChallengeMethod || 'S256'}` +
        `&v=5.131`;
      
      // Log the complete URL for debugging
      console.log('Generated VK auth URL with frontend PKCE parameters:', authUrl);
      
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle the VK auth callback and pass data to frontend
   */
  async handleCallback(req, res) {
    try {
      const { code, state, device_id, error, error_description } = req.query;
      
      // Log the incoming request parameters
      console.log('VK auth callback received with params:', req.query);
      
      // Handle errors
      if (error) {
        console.error('VK auth error:', error, error_description);
        
        // Instead of responding with JSON, redirect with error or render HTML with script
        res.send(`
          <html>
          <head><title>Authorization Callback</title></head>
          <body>
            <script>
              window.opener.postMessage({
                type: 'vk-auth-callback',
                error: "${error}",
                errorDescription: "${error_description || ''}",
              }, "*");
              window.close();
            </script>
            <p>Please close this window and return to the application.</p>
          </body>
          </html>
        `);
        return;
      }
      
      if (!code) {
        res.send(`
          <html>
          <head><title>Authorization Callback</title></head>
          <body>
            <script>
              window.opener.postMessage({
                type: 'vk-auth-callback',
                error: "missing_code",
                errorDescription: "Authorization code not provided"
              }, "*");
              window.close();
            </script>
            <p>Please close this window and return to the application.</p>
          </body>
          </html>
        `);
        return;
      }
      
      // Send the code, state, and device_id back to the frontend to continue the flow
      res.send(`
        <html>
        <head><title>Authorization Callback</title></head>
        <body>
          <script>
            window.opener.postMessage({
              type: 'vk-auth-callback',
              code: "${code}",
              state: "${state}",
              device_id: "${device_id || ''}"
            }, "*");
            window.close();
          </script>
          <p>Authorization successful. Please close this window and return to the application.</p>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error processing auth callback:', error);
      
      res.send(`
        <html>
        <head><title>Authorization Callback</title></head>
        <body>
          <script>
            window.opener.postMessage({
              type: 'vk-auth-callback',
              error: "server_error",
              errorDescription: "${error.message}"
            }, "*");
            window.close();
          </script>
          <p>An error occurred. Please close this window and try again.</p>
        </body>
        </html>
      `);
    }
  }

  /**
   * Exchange the authorization code for a token
   */
  async exchangeToken(req, res) {
    try {
      const { code, state, codeVerifier, deviceId } = req.body;
      
      if (!code || !state || !codeVerifier) {
        return res.status(400).json({
          error: 'Missing required parameters. Code, state, and codeVerifier are required.'
        });
      }
      
      // Use the configured redirect URI
      const redirectUri = config.vk.redirectUri || 'https://krazu-group.tech/api/vk-auth/callback';
      
      // Exchange the code for token
      const result = await vkAuthService.exchangeTokenWithVerifier(
        code, 
        redirectUri, 
        codeVerifier, 
        deviceId
      );
      
      // Return result
      res.json({
        status: 'success',
        message: 'Authorization successful',
        user: result.user,
        scope: result.token.scope
      });
    } catch (error) {
      console.error('Error exchanging token:', error);
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
