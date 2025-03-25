# VK Authorization and Token Acquisition Process

This document outlines the complete flow for authorizing users with VK (VKontakte) and obtaining access tokens for API operations.

## Authorization Flow Architecture

The authorization process follows the OAuth 2.0 authorization code flow with the new VK ID system:

1. **Frontend Initiates Auth**: User clicks "New Authorization" button in the VkAuthManager component
2. **Backend Generates Auth URL**: With correct permissions and redirect URI using VK ID endpoint
3. **User Authenticates with VK ID**: In a popup window, grants permissions to the app
4. **VK Redirects to Callback URL**: With authorization code
5. **Backend Exchanges Code for Token**: Makes POST request to get access, refresh, and ID tokens
6. **Token Storage**: Saves token in MongoDB with permissions and user info
7. **Token Management**: Frontend displays and manages tokens (activate/deactivate/delete)

## Required Permissions (Scopes)

Critical permissions needed for posting to communities:

- `wall` - Access to post on walls
- `photos` - Permission to upload photos
- `groups` - Access to group management features
- `manage` - Permission to manage community content
- `docs` - Access to upload documents
- `video` - Access to video content
- `offline` - Allows obtaining a token that doesn't expire

## Detailed Authorization Steps

### 1. Frontend Initiates Authorization

The VkAuthManager component initiates the process when the user clicks "New Authorization":

```javascript
const handleAuthButtonClick = () => {
  if (!authUrl) {
    showSnackbar('URL авторизации не получен...', 'error');
    return;
  }
  
  // Important warning
  showSnackbar('ВАЖНО! Необходимо разрешить ВСЕ запрашиваемые права доступа...', 'warning');
  
  // Open auth window
  const authWindow = window.open(
    authUrl, 
    'VK Authorization', 
    'width=1200,height=800,top=50,left=50,scrollbars=yes,status=yes'
  );
  
  // Monitor window closing
  const checkWindowClosed = setInterval(() => {
    if (authWindow && authWindow.closed) {
      clearInterval(checkWindowClosed);
      fetchTokens();
      setTimeout(() => {
        showSnackbar('Проверьте, что токен получил все необходимые разрешения в таблице ниже', 'info');
      }, 2000);
    }
  }, 1000);
};
```

### 2. Backend Generates Auth URL with VK ID Endpoint

The backend generates the authorization URL with appropriate permissions using the VK ID auth endpoint:

```javascript
// In vkAuthService.js
getAuthUrl(redirectUri) {
  const vkAppId = config.vk.appId || this.getAppIdFromSettings();
  
  // Set required permissions
  const scopeValue = "wall,photos,groups,video,offline,docs,manage";
  
  // Build Auth URL for VK ID
  return `https://id.vk.com/authorize?` +
    `client_id=${vkAppId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&display=page` +
    `&scope=${scopeValue}` +
    `&response_type=code` +
    `&state=${state}` +
    `&v=5.131`;
}
```

### 3. User Authentication with VK ID

The user logs in through VK ID system in the popup window and grants the requested permissions. The authorization screen shows all the requested permissions as checkboxes.

### 4. VK Redirects to Callback URL

After permission grant, VK redirects to the callback URL with an authorization code:
```
https://your-redirect-uri.com/api/vk-auth/callback?code=abcdef123456&state=xyz
```

### 5. Backend Exchanges Code for Tokens

The backend receives the code and exchanges it for tokens using a POST request as required by VK ID:

```javascript
// In vkAuthService.js
async getTokenByCode(code, state, redirectUri) {
  // Create form data for POST request
  const formData = new URLSearchParams();
  formData.append('client_id', appId);
  formData.append('client_secret', appSecret);
  formData.append('redirect_uri', redirectUri);
  formData.append('code', code);
  formData.append('grant_type', 'authorization_code');
  
  // Make POST request to VK ID token endpoint
  const response = await axios.post('https://oauth.vk.com/access_token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  
  // Process response (includes access_token, refresh_token, and id_token)
  // Get user info
  const userInfo = await this.getUserInfo(response.data.access_token);
  
  // Create token data
  const tokenData = {
    vkUserId: response.data.user_id.toString(),
    vkUserName: `${userInfo.first_name} ${userInfo.last_name}`,
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + (response.data.expires_in || 86400),
    scope: response.scope || ["wall", "photos", "groups", "video", "offline", "docs"],
    isActive: true,
    lastUsed: new Date(),
    userInfo: userInfo
  };
  
  // Save token
  let token = await VkUserToken.findOne({ vkUserId: tokenData.vkUserId });
  if (token) {
    Object.assign(token, tokenData);
    await token.save();
  } else {
    token = await VkUserToken.create(tokenData);
  }
  
  return { token, user: userInfo };
}
```

### 6. Token Storage and Management

The token is stored in MongoDB and is accessible from the frontend for management. The VkUserToken model defines the structure:

```javascript
const VkUserTokenSchema = new Schema({
  vkUserId: { type: String, required: true, unique: true },
  vkUserName: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  expiresAt: { type: Number },
  scope: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  lastUsed: { type: Date },
  lastRefreshed: { type: Date },
  userInfo: { type: Schema.Types.Mixed }
}, { timestamps: true });
```

## Token Selection For API Operations

When the application needs to make an API call, it selects the best token with the appropriate permissions:

```javascript
// In vkAuthService.js
async getActiveToken(requiredScope) {
  const scopeArray = Array.isArray(requiredScope) ? requiredScope : [requiredScope];
  
  // Find active non-expired tokens
  const activeTokens = await VkUserToken.find({ 
    isActive: true,
    expiresAt: { $gt: Math.floor(Date.now() / 1000) }
  });
  
  // For wall posting, specifically need wall + manage permissions
  if (scopeArray.includes('wall') && scopeArray.includes('manage')) {
    const wallAndManageTokens = activeTokens.filter(token => {
      return token.scope && 
             token.scope.includes('wall') && 
             token.scope.includes('manage');
    });
    
    if (wallAndManageTokens.length > 0) {
      const token = wallAndManageTokens[0];
      token.lastUsed = new Date();
      await token.save();
      return token;
    }
  }
  
  // Find best matching token if no perfect match
  // ...
}
```

## Token Refresh Process

When a token expires, the application uses the refresh token to obtain a new access token using a similar POST request:

```javascript
// In tokenRefreshService.js
async refreshToken(vkUserId) {
  // Get token from database
  const token = await VkUserToken.findOne({ vkUserId });
  
  if (!token || !token.refreshToken) {
    throw new Error(`No token or refresh token found for user ${vkUserId}`);
  }
  
  // Create form data for POST request
  const formData = new URLSearchParams();
  formData.append('client_id', appId);
  formData.append('client_secret', appSecret);
  formData.append('refresh_token', token.refreshToken);
  formData.append('grant_type', 'refresh_token');
  
  // Make POST request to refresh endpoint
  const response = await axios.post('https://oauth.vk.com/access_token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  
  // Update token data
  token.accessToken = response.data.access_token;
  if (response.data.refresh_token) {
    token.refreshToken = response.data.refresh_token;
  }
  token.expiresAt = Math.floor(Date.now() / 1000) + (response.data.expires_in || 86400);
  token.lastRefreshed = new Date();
  
  await token.save();
  return token;
}
```

## PKCE Implementation

As of 2023, VK ID requires PKCE (Proof Key for Code Exchange) for enhanced security. Our implementation uses the following PKCE flow:

### 1. Generate Code Verifier and Challenge

When generating the authorization URL, we create a code verifier and code challenge:

```javascript
// In vkAuthService.js
const codeVerifier = this.generateRandomString(64); // Random string for PKCE
const codeChallenge = this.generateCodeChallenge(codeVerifier); // For simple implementation we use plain transformation

// Store the verifier for later use
this.storeAuthParams(state, { codeVerifier, redirectUri });

// Add PKCE parameters to the URL
return `https://id.vk.com/authorize?` +
  // ...other parameters...
  `&code_challenge=${codeChallenge}` +
  `&code_challenge_method=plain` +
  // ...other parameters...
```

### 2. Pass Code Verifier During Token Exchange

When exchanging the authorization code for tokens, we include the code verifier:

```javascript
async getTokenByCode(code, state, redirectUri) {
  // Retrieve the previously stored code verifier
  const storedParams = this.getAuthParams(state);
  
  // Include code_verifier in the token request
  const formData = new URLSearchParams();
  formData.append('client_id', appId);
  formData.append('client_secret', appSecret);
  formData.append('redirect_uri', finalRedirectUri);
  formData.append('code', code);
  formData.append('code_verifier', storedParams.codeVerifier);
  formData.append('grant_type', 'authorization_code');
  
  // Make the token request
  const response = await axios.post('https://oauth.vk.com/access_token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
}
```

## Device ID Management

VK ID requires handling a device_id parameter during the authorization and token refresh flow:

1. When redirecting to the callback URL, VK ID includes a device_id parameter
2. This device_id must be saved and used for subsequent token refresh operations
3. The deviceId is stored with the token in our database

The implementation captures the device_id like this:

```javascript
// In callback handler
const { code, state, device_id } = req.query;

// Pass to token exchange
const result = await vkAuthService.getTokenByCode(code, state, redirectUri, device_id);

// In token exchange
const deviceId = device_id || 'web_default_device';
formData.append('device_id', deviceId);

// In token refresh
formData.append('device_id', token.deviceId || 'web_default_device');
```

This ensures proper device tracking for VK ID's security requirements.

### Security Considerations

- In production, it's recommended to use the S256 method for code challenge generation, which involves SHA-256 hashing
- The code verifier should be stored securely, ideally in a distributed cache like Redis for stateless servers
- The code verifier should only be valid for a short period (typically 10 minutes)

## Common Authorization Issues

1. **Missing Permissions**: If the user doesn't grant all requested permissions, API calls may fail with "Access denied" errors (especially for wall posting)
2. **Token Expiration**: If tokens expire without proper refresh, new authorization is needed
3. **API Rate Limits**: Too many requests can trigger "Too many requests per second" errors
4. **VK ID vs Old OAuth**: VK is transitioning to VK ID, which requires different endpoints and parameters

## Troubleshooting

1. **Permission Denied Errors**: Check token scopes in the database; ensure it has the `wall` and `manage` permissions
2. **Token Refresh Failures**: Check if refresh_token is available and App ID/Secret are correct
3. **Rate Limiting**: Implement rate limiting and retry logic for API calls
4. **Authorization Flow Errors**: Ensure POST requests are used for token exchange with the correct Content-Type header
5. **VK ID Specific Issues**: Check documentation for any changes to VK ID flows at https://id.vk.com/dev
