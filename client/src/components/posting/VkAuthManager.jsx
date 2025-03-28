import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Paper, Box, Button, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Card, CardContent, Avatar, Alert, CircularProgress,
  Snackbar, Tooltip, Link as MuiLink
} from '@mui/material';
import {
  VpnKey as KeyIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenIcon,
  BlockOutlined as BlockIcon,
  CheckCircleOutlined as UnblockIcon,
  Assistant as AssistantIcon
} from '@mui/icons-material';
import axios from 'axios';
import { 
  generateCodeVerifier, 
  generateCodeChallenge, 
  storePkceParams,
  getPkceVerifier,
  cleanupPkceParams 
} from '../../utils/pkceUtils';

const VkAuthManager = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [tokenActions, setTokenActions] = useState({});
  const [pkceError, setPkceError] = useState(null);

  // Wrap fetchTokens in useCallback
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/vk-auth/tokens');
      setTokens(response.data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      showSnackbar('Ошибка при загрузке токенов', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // Add showSnackbar to dependencies if needed

  useEffect(() => {
    const initData = async () => {
      await fetchTokens();
      // We'll make this non-blocking and handle errors better
      try {
        await fetchAuthUrl();
      } catch (error) {
        console.log('Initial auth URL fetch failed, will retry when needed', error);
        // We don't show error here to avoid confusion on page load
      }
    };
    
    initData();
  }, [fetchTokens]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]); // Add fetchTokens as dependency

  // Helper function to correctly parse the scope from any format
  const parseScopes = (scope) => {
    if (!scope) return [];
    
    // Handle array that contains a string with space-separated permissions in the first element
    if (Array.isArray(scope)) {
      return scope.flatMap(item => typeof item === 'string' ? item.split(' ') : item);
    }
    
    // Handle string with space-separated permissions
    if (typeof scope === 'string') {
      return scope.split(' ');
    }
    
    return [];
  };

  // Modify the fetchAuthUrl function to be simpler since we generate the URL on the frontend
  const fetchAuthUrl = async () => {
    // We no longer need to fetch the URL from the backend during initialization
    // Just return a success - we'll generate the URL when needed in handleAuthButtonClick
    console.log('Auth URL will be generated when needed');
    return true;
  };

  const handleDeleteToken = async () => {
    try {
      await axios.delete(`/api/vk-auth/tokens/${tokenToDelete}`);
      setTokens(tokens.filter(token => token.id !== tokenToDelete));
      showSnackbar('Токен удален', 'success');
    } catch (error) {
      console.error('Error deleting token:', error);
      showSnackbar('Ошибка при удалении токена', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setTokenToDelete(null);
    }
  };

  const handleToggleTokenActive = async (tokenId, isActive, token) => {
    try {
      setTokenActions(prev => ({ ...prev, [tokenId]: 'loading' }));
      
      const endpoint = isActive 
        ? `/api/vk-auth/tokens/${tokenId}/deactivate`
        : `/api/vk-auth/tokens/${tokenId}/activate`;
      
      await axios.patch(endpoint);
      
      // Update the token status in our local state
      setTokens(tokens.map(token => {
        if (token.id === tokenId) {
          return { ...token, isActive: !isActive };
        }
        return token;
      }));
      
      showSnackbar(`Токен ${isActive ? 'деактивирован' : 'активирован'}`, 'success');
    } catch (error) {
      console.error('Error toggling token status:', error);
      showSnackbar('Ошибка при изменении статуса токена', 'error');
    } finally {
      setTokenActions(prev => ({ ...prev, [tokenId]: null }));
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не задано';
    return new Date(dateString).toLocaleString();
  };

  const isTokenExpired = (expiresAt) => {
    return Math.floor(Date.now() / 1000) >= expiresAt;
  };

  const getExpiryInfo = (expiresAt) => {
    if (!expiresAt) return { text: 'Не задано', color: 'default' };
    
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = expiresAt - now;
    
    if (timeLeft <= 0) {
      return { text: 'Истек', color: 'error' };
    }
    
    const daysLeft = Math.floor(timeLeft / (60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (60 * 60 * 24)) / (60 * 60));
    
    if (daysLeft > 0) {
      return { 
        text: `${daysLeft} д. ${hoursLeft} ч.`, 
        color: daysLeft < 2 ? 'warning' : 'success' 
      };
    } else if (hoursLeft > 0) {
      return { 
        text: `${hoursLeft} ч.`, 
        color: hoursLeft < 6 ? 'warning' : 'success' 
      };
    } else {
      const minutesLeft = Math.floor((timeLeft % (60 * 60)) / 60);
      return { 
        text: `${minutesLeft} мин.`, 
        color: 'warning' 
      };
    }
  };

  const handleAuthButtonClick = async () => {
    // Clear previous auth errors if any
    setPkceError(null);
    
    // Show the important warning right away
    showSnackbar('ВАЖНО! Необходимо разрешить ВСЕ запрашиваемые права доступа для корректной работы приложения!', 'warning');
    
    try {
      // Generate PKCE parameters
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Store the code verifier for later use
      storePkceParams(state, codeVerifier);
      
      console.log('Generated PKCE parameters:', {
        state,
        codeVerifier: codeVerifier.substring(0, 10) + '...',
        codeChallenge: codeChallenge.substring(0, 10) + '...'
      });
      
      // Generate the auth URL on the client side or get it from the backend
      // depending on your application's needs
      let authUrl;
      
      try {
        // Get the VK ID auth URL with our PKCE parameters
        const response = await axios.get('/api/vk-auth/auth-url', {
          params: {
            state,
            codeChallenge,
            codeChallengeMethod: 'S256'
          }
        });
        
        authUrl = response.data.authUrl;
      } catch (error) {
        console.error('Error fetching auth URL from backend:', error);
        // Fallback to a client-side generated URL if your API supports it
        showSnackbar('Ошибка получения URL авторизации. Попробуйте обновить страницу.', 'error');
        return;
      }
      
      console.log('Using VK auth URL with PKCE parameters:', authUrl);
      
      if (!authUrl) {
        showSnackbar('Ошибка получения URL авторизации. Попробуйте обновить страницу.', 'error');
        return;
      }
      
      // Open the authorization window with the URL
      const authWindow = window.open(
        authUrl, 
        'VK Authorization', 
        'width=1200,height=800,top=50,left=50,scrollbars=yes,status=yes'
      );
      
      // Track authorization status
      let authCheckInterval;
      let authTimeout;
    
      // Define the handleAuthCallback function here, inside handleAuthButtonClick
      // so it has access to the current closure variables (state, codeVerifier, authWindow, etc.)
      const handleAuthCallback = function(event) {
        // Check if the message is from our application and contains auth data
        if (event.data && event.data.type === 'vk-auth-callback') {
          // Remove the event listener
          window.removeEventListener('message', handleAuthCallback);
          
          const { code, state: returnedState, device_id } = event.data;
          
          // Verify the state parameter matches
          if (state !== returnedState) {
            showSnackbar('Ошибка авторизации: несовпадение state параметра.', 'error');
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            return;
          }
          
          // Get the code verifier
          const verifier = getPkceVerifier(returnedState);
          if (!verifier) {
            showSnackbar('Ошибка авторизации: невозможно найти code verifier. Возможно, истек срок действия сессии.', 'error');
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
            return;
          }
          
          // Exchange code for token on backend
          axios.post('/api/vk-auth/exchange-token', {
            code,
            state: returnedState,
            codeVerifier: verifier,
            deviceId: device_id
          })
          .then(response => {
            // Token exchange was successful
            console.log('Token exchange successful:', response.data);
            cleanupPkceParams(returnedState);
            
            // Handle success...
            fetchTokens().then(() => {
              showSnackbar('Авторизация успешно выполнена!', 'success');
            });
            
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
          })
          .catch(error => {
            console.error('Token exchange error:', error);
            cleanupPkceParams(returnedState);
            
            // Handle the error
            showSnackbar(`Ошибка получения токена: ${error.response?.data?.error || error.message}`, 'error');
            
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
          });
        }
      };
      
      // Add event listener for auth callback
      window.addEventListener('message', handleAuthCallback);
      
      // Check every second if window closed without sending message
      authCheckInterval = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(authCheckInterval);
          clearTimeout(authTimeout);
          window.removeEventListener('message', handleAuthCallback);
          
          // Clean up PKCE params
          cleanupPkceParams(state);
          
          // Reload token list
          fetchTokens();
        }
      }, 1000);
      
      // Set a timeout for the whole operation
      authTimeout = setTimeout(() => {
        clearInterval(authCheckInterval);
        window.removeEventListener('message', handleAuthCallback);
        
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
        
        // Clean up PKCE params
        cleanupPkceParams(state);
        
        showSnackbar('Время авторизации истекло. Попробуйте снова.', 'error');
      }, 300000); // 5 minutes timeout
      
    } catch (error) {
      console.error('Error starting auth process:', error);
      showSnackbar('Ошибка при инициализации авторизации', 'error');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom component="h1">
          Управление авторизацией ВКонтакте
        </Typography>
        <Box>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<KeyIcon />}
            onClick={handleAuthButtonClick}
            // Remove the disabled condition so the button is always clickable
            sx={{ mr: 2 }}
          >
            Новая авторизация
          </Button>
          <Button 
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchTokens}
          >
            Обновить
          </Button>
        </Box>
      </Box>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <AssistantIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Как авторизоваться
          </Typography>
          <Typography variant="body1" paragraph>
            Для публикации постов необходим активный токен пользователя ВКонтакте с <strong>правильными разрешениями</strong>.
            <strong> Необходимо разрешить ВСЕ запрашиваемые права доступа!</strong>
          </Typography>
          <Typography variant="body1" paragraph>
            1. Нажмите кнопку "Новая авторизация"
          </Typography>
          <Typography variant="body1" paragraph sx={{ color: 'error.main', fontWeight: 'bold' }}>
            2. В открывшемся окне <strong>обязательно отметьте все галочки и нажмите "Разрешить"</strong>
          </Typography>
          <Typography variant="body1" paragraph>
            3. Если вы ранее отказали в каких-то правах, необходимо удалить токен и авторизоваться заново
          </Typography>
          <Typography variant="body2" paragraph color="primary" sx={{ fontWeight: 'bold', mt: 2 }}>
            Критически важные разрешения для публикации в сообществах:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Chip label="wall (стена)" color="success" variant="outlined" />
            <Chip label="photos (фотографии)" color="success" variant="outlined" />
            <Chip label="groups (сообщества)" color="success" variant="outlined" />
          </Box>
          
          {/* Add information about the new VK ID flow */}
          <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2">Об авторизации VK ID</Typography>
            <Typography variant="body2">
              Приложение использует новую систему авторизации VK ID. После авторизации VK ID возвращает набор токенов:
              Access token (для доступа к API), Refresh token (для обновления доступа) и ID token.
            </Typography>
          </Alert>
          
          <Typography variant="body2" paragraph sx={{ fontStyle: 'italic', mt: 2 }}>
            Запрашиваемые разрешения: доступ к стене, фотографиям, видео, документам, управлению сообществами
          </Typography>
          {tokens.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              У вас нет активных токенов. Без токена публикация постов невозможна!
            </Alert>
          )}
          {tokens.some(token => {
            // Parse scopes correctly from the complex format
            const tokenScopes = parseScopes(token.scope);
            
            // Updated required scopes - removed 'manage' as it's not needed for user tokens
            const requiredScopes = ['wall', 'photos', 'groups'];
            const missingScopes = requiredScopes.filter(scope => !tokenScopes.includes(scope));
            
            return token.isActive && missingScopes.length > 0;
          }) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Обнаружен токен с недостаточными правами!</Typography>
              <Typography variant="body2">
                Для работы публикации в сообществах необходимы права: wall, photos, groups. Пожалуйста, удалите текущий токен и авторизуйтесь заново.
              </Typography>
            </Alert>
          )}
          
          {/* Add specific help for PKCE errors */}
          {pkceError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Произошла ошибка PKCE аутентификации</Typography>
              <Typography variant="body2">
                {pkceError}. Рекомендуется очистить cookies и кэш браузера перед повторной попыткой.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tokens.length === 0 ? (
            <Alert severity="warning">
              У вас нет токенов авторизации. Необходимо авторизоваться в ВКонтакте для публикации постов.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Пользователь</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Срок действия</TableCell>
                    <TableCell>Последнее использование</TableCell>
                    <TableCell>Последнее обновление</TableCell>
                    <TableCell>Разрешения</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tokens.map((token) => {
                    const expired = isTokenExpired(token.expiresAt);
                    const expiryInfo = getExpiryInfo(token.expiresAt);
                    
                    return (
                      <TableRow key={token.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar 
                              src={token.userInfo?.photo_200}
                              alt={token.vkUserName}
                              sx={{ mr: 2 }}
                            />
                            <Box>
                              <Typography variant="subtitle2">
                                {token.vkUserName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                ID: {token.vkUserId}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={token.isActive ? (expired ? 'Истек' : 'Активен') : 'Неактивен'}
                            color={token.isActive ? (expired ? 'error' : 'success') : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={expiryInfo.text}
                            color={expiryInfo.color}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {token.lastUsed ? formatDate(token.lastUsed) : 'Не использовался'}
                        </TableCell>
                        <TableCell>
                          {token.lastRefreshed ? formatDate(token.lastRefreshed) : 'Не обновлялся'}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(() => {
                              // Parse scopes correctly from the complex format
                              const scopes = parseScopes(token.scope);
                              
                              return scopes.slice(0, 5).map((scope, index) => (
                                <Chip
                                  key={index}
                                  label={scope}
                                  size="small"
                                  variant="outlined"
                                  color={['wall', 'photos', 'groups'].includes(scope) ? 'success' : 'default'}
                                />
                              ));
                            })()}
                            {(() => {
                              const scopes = parseScopes(token.scope);
                              
                              return scopes.length > 5 && (
                                <Chip
                                  label={`+${scopes.length - 5}`}
                                  size="small"
                                  variant="outlined"
                                />
                              );
                            })()}
                            {(() => {
                              const scopes = parseScopes(token.scope);
                              
                              // Updated required scopes - removed 'manage'
                              const requiredScopes = ['wall', 'photos', 'groups'];
                              const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
                              
                              return missingScopes.length > 0 && (
                                <Tooltip title={`Отсутствуют права: ${missingScopes.join(', ')}`}>
                                  <Chip
                                    label="Недостаточно прав"
                                    size="small"
                                    color="error"
                                  />
                                </Tooltip>
                              );
                            })()}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex' }}>
                            <Tooltip title={token.isActive ? "Деактивировать" : "Активировать"}>
                              <IconButton
                                size="small"
                                color={token.isActive ? "warning" : "success"}
                                onClick={() => handleToggleTokenActive(token._id, token.isActive, token)}
                                disabled={tokenActions[token.id] === 'loading'}
                              >
                                {tokenActions[token.id] === 'loading' ? (
                                  <CircularProgress size={24} />
                                ) : (
                                  token.isActive ? <BlockIcon /> : <UnblockIcon />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setTokenToDelete(token.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Открыть профиль ВК">
                              <IconButton
                                size="small"
                                color="primary"
                                component={MuiLink}
                                href={`https://vk.com/id${token.vkUserId}`}
                                target="_blank"
                              >
                                <OpenIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы действительно хотите удалить этот токен авторизации? Это действие невозможно отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleDeleteToken} color="error" autoFocus>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default VkAuthManager;
