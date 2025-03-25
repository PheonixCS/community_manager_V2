import React, { useState, useEffect } from 'react';
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

const VkAuthManager = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authUrl, setAuthUrl] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [tokenActions, setTokenActions] = useState({});

  useEffect(() => {
    const initData = async () => {
      await fetchTokens();
      await fetchAuthUrl();
    };
    
    initData();
  }, []);

  const fetchTokens = async () => {
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
  };

  const fetchAuthUrl = async () => {
    try {
      const response = await axios.get('/api/vk-auth/auth-url');
      setAuthUrl(response.data.authUrl);
      
      // Log the auth URL to help with debugging
      console.log('Received VK auth URL:', response.data.authUrl);
    } catch (error) {
      console.error('Error fetching auth URL:', error);
      showSnackbar('Ошибка при получении URL авторизации', 'error');
    }
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

  const handleToggleTokenActive = async (tokenId, isActive) => {
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

  const handleAuthButtonClick = () => {
    if (!authUrl) {
      showSnackbar('URL авторизации не получен. Попробуйте обновить страницу.', 'error');
      return;
    }
    
    // Показываем важное предупреждение пользователю
    showSnackbar('ВАЖНО! Необходимо разрешить ВСЕ запрашиваемые права доступа для корректной работы приложения!', 'warning');
    
    // Открываем окно авторизации достаточно большого размера
    const authWindow = window.open(
      authUrl, 
      'VK Authorization', 
      'width=1200,height=800,top=50,left=50,scrollbars=yes,status=yes'
    );
    
    // Track authorization status
    let authCheckInterval;
    let authTimeout;
  
    // Check every second if window closed
    authCheckInterval = setInterval(() => {
      if (authWindow && authWindow.closed) {
        clearInterval(authCheckInterval);
        clearTimeout(authTimeout);
        
        // Reload token list
        fetchTokens().then(() => {
          // Check if new token was received with permissions
          if (tokens.length > 0) {
            const latestToken = tokens[0];
            const criticalScopes = ['wall', 'photos', 'groups', 'manage'];
            const missingScopes = criticalScopes.filter(
              scope => !latestToken.scope.includes(scope)
            );
            
            if (missingScopes.length > 0) {
              showSnackbar(
                `Токен получен, но отсутствуют важные разрешения: ${missingScopes.join(', ')}. Рекомендуется удалить токен и авторизоваться снова.`,
                'error'
              );
            } else {
              showSnackbar('Авторизация успешно выполнена! Все необходимые разрешения получены.', 'success');
            }
          } else {
            showSnackbar('Не удалось получить токен. Попробуйте авторизоваться снова.', 'error');
          }
        });
      }
    }, 1000);
    
    // Set a timeout for the whole operation
    authTimeout = setTimeout(() => {
      clearInterval(authCheckInterval);
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      showSnackbar('Время авторизации истекло. Попробуйте снова.', 'error');
    }, 300000); // 5 minutes timeout
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
            disabled={!authUrl}
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
            <Chip label="manage (управление сообществом)" color="success" variant="outlined" />
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
          {tokens.some(token => token.isActive && (!token.scope.includes('wall') || !token.scope.includes('photos') || !token.scope.includes('groups') || !token.scope.includes('manage'))) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Обнаружен токен с недостаточными правами!</Typography>
              <Typography variant="body2">
                Для работы публикации в сообществах необходимы права: wall, photos, groups, manage. Пожалуйста, удалите текущий токен и авторизуйтесь заново.
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
                              src={token.userInfo?.photo}
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
                            {token.scope.slice(0, 5).map((scope, index) => (
                              <Chip
                                key={index}
                                label={scope}
                                size="small"
                                variant="outlined"
                                color={
                                  ['wall', 'photos', 'groups'].includes(scope) 
                                    ? 'success' 
                                    : 'default'
                                }
                              />
                            ))}
                            {token.scope.length > 5 && (
                              <Chip
                                label={`+${token.scope.length - 5}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {['wall', 'photos', 'groups'].some(required => !token.scope.includes(required)) && (
                              <Tooltip title="Отсутствуют необходимые права для публикации">
                                <Chip
                                  label="Недостаточно прав"
                                  size="small"
                                  color="error"
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex' }}>
                            <Tooltip title={token.isActive ? "Деактивировать" : "Активировать"}>
                              <IconButton
                                size="small"
                                color={token.isActive ? "warning" : "success"}
                                onClick={() => handleToggleTokenActive(token.id, token.isActive)}
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
