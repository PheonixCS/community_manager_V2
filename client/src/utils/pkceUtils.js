/**
 * PKCE (Proof Key for Code Exchange) utilities for VK OAuth
 * Based on VK ID requirements: https://id.vk.com/about/business/go/docs/ru/vkid/authorize
 */

/**
 * Generate a random string for PKCE code_verifier
 * Per spec, must be between 43-128 chars
 * @param {number} length - Length of string to generate, defaults to 64
 * @returns {string} Random string for code_verifier
 */
export const generateCodeVerifier = (length = 64) => {
  // Use only allowed chars: a-z, A-Z, 0-9, _, -
  const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const values = new Uint8Array(length);
  window.crypto.getRandomValues(values);
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += allowedChars[values[i] % allowedChars.length];
  }
  return result;
};

/**
 * Generate a code challenge from the code verifier using S256 method
 * @param {string} codeVerifier - Code verifier string
 * @returns {Promise<string>} Code challenge
 */
export const generateCodeChallenge = async (codeVerifier) => {
  // Convert string to ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  
  // Generate SHA-256 hash
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  
  // Convert ArrayBuffer to Base64Url string
  // First to regular base64
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  
  // Then to base64url (replace + with -, / with _, and remove =)
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Store PKCE parameters in localStorage for later use
 * @param {string} state - State parameter 
 * @param {string} codeVerifier - Code verifier string
 */
export const storePkceParams = (state, codeVerifier) => {
  localStorage.setItem(`pkce_verifier_${state}`, codeVerifier);
  
  // Set expiration (10 minutes from now)
  const expires = Date.now() + (10 * 60 * 1000);
  localStorage.setItem(`pkce_expires_${state}`, expires.toString());
};

/**
 * Retrieve stored PKCE parameters by state
 * @param {string} state - State parameter
 * @returns {string|null} Code verifier or null if expired/not found 
 */
export const getPkceVerifier = (state) => {
  const verifier = localStorage.getItem(`pkce_verifier_${state}`);
  const expires = localStorage.getItem(`pkce_expires_${state}`);
  
  if (!verifier || !expires) {
    return null;
  }
  
  // Check if expired
  if (Date.now() > parseInt(expires, 10)) {
    // Clean up expired items
    localStorage.removeItem(`pkce_verifier_${state}`);
    localStorage.removeItem(`pkce_expires_${state}`);
    return null;
  }
  
  return verifier;
};

/**
 * Clean up stored PKCE parameters after use
 * @param {string} state - State parameter
 */
export const cleanupPkceParams = (state) => {
  localStorage.removeItem(`pkce_verifier_${state}`);
  localStorage.removeItem(`pkce_expires_${state}`);
};
