import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Paper, Box, Button, CircularProgress,
  TextField, Grid, FormControl, InputLabel, Select, MenuItem,
  Tabs, Tab, Divider, Alert, AlertTitle, Snackbar, Chip, 
  FormControlLabel, Switch, Card, CardContent
} from '@mui/material';
import {
  Publish as PublishIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';

// Group selection component with better error handling and fallback
const GroupSelection = ({ 
  selectedGroupId, 
  handleGroupSelect, 
  targetGroups, 
  groupsLoading, 
  error 
}) => {
  return (
    <FormControl fullWidth margin="normal">
      <InputLabel id="group-select-label">Выберите целевую группу</InputLabel>
      <Select
        labelId="group-select-label"
        value={selectedGroupId}
        onChange={handleGroupSelect}
        label="Выберите целевую группу"
        disabled={groupsLoading}
        startAdornment={groupsLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
        error={!!error}
      >
        <MenuItem value="">
          <em>Выберите группу</em>
        </MenuItem>
        {targetGroups.length > 0 ? (
          targetGroups.map((group) => (
            <MenuItem key={group.id} value={group.id}>
              {group.name || group.id}
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>Нет доступных групп</MenuItem>
        )}
      </Select>
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
    </FormControl>
  );
};

const ManualPublishing = () => {
  // Tab state
  const [tabValue, setTabValue] = useState(0);
  
  // Existing post publishing states
  const [posts, setPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [targetGroups, setTargetGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [postsLoading, setPostsLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  
  // Generated content publishing states
  const [generators, setGenerators] = useState([]);
  const [selectedGenerator, setSelectedGenerator] = useState('');
  const [generatorParams, setGeneratorParams] = useState({});
  const [generatorMetadata, setGeneratorMetadata] = useState(null);
  const [generatorLoading, setGeneratorLoading] = useState(false);
  
  // Common states
  const [publishOptions, setPublishOptions] = useState({
    fromGroup: true,
    pinned: false,
    markedAsAds: false
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [publishingInProgress, setPublishingInProgress] = useState(false);
  const [authStatus, setAuthStatus] = useState({ hasActiveToken: false });
  
  // Add state for error tracking
  const [groupError, setGroupError] = useState(null);
  
  // Wrap functions in useCallback to prevent recreation on each render
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/vk-auth/tokens');
      setAuthStatus({
        hasActiveToken: response.data.some(token => 
          token.isActive && !isTokenExpired(token.expiresAt)
        )
      });
    } catch (error) {
      console.error('Error checking auth status:', error);
      // Add more detailed error logging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received:', error.request);
      }
      
      // Use the status endpoint as a fallback
      try {
        const statusResponse = await axios.get('/api/vk-auth/status');
        setAuthStatus({
          hasActiveToken: statusResponse.data.authenticated
        });
      } catch (fallbackError) {
        console.error('Fallback auth check also failed:', fallbackError);
        setAuthStatus({ 
          hasActiveToken: false,
          error: 'Failed to check authentication status. Server may be unavailable.'
        });
      }
    }
  }, []); // Empty dependency array or add dependencies if needed
  
  const isTokenExpired = (expiresAt) => {
    return Math.floor(Date.now() / 1000) >= expiresAt;
  };
  
  const fetchTopPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const response = await axios.get('/api/posts', {
        params: { 
          limit: 50, 
          sortBy: 'viewRate', 
          sortOrder: 'desc' 
        }
      });
      setPosts(response.data.data);
    } catch (error) {
      console.error('Error fetching top posts:', error);
      showSnackbar('Ошибка при загрузке постов', 'error');
    } finally {
      setPostsLoading(false);
    }
  }, []); // Add showSnackbar to dependencies if needed
  
  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupError(null);
    
    try {
      // First try to get groups from VK API through our backend
      const response = await axios.get('/api/vk-auth/groups');
      
      if (response.data && Array.isArray(response.data.items) && response.data.items.length > 0) {
        // Format the groups data from VK API (the items are in response.items due to VK API format)
        const formattedGroups = response.data.items.map(group => ({
          id: `-${group.id}`, // Ensure ID is negative and a string
          name: group.name
        }));
        
        setTargetGroups(formattedGroups);
        console.log('Loaded groups from VK API:', formattedGroups);
        
        // Save to localStorage as backup
        localStorage.setItem('vkTargetGroups', JSON.stringify(formattedGroups));
      } else {
        // Try alternate endpoints
        await fetchGroupsAlternate();
      }
    } catch (error) {
      console.error('Error fetching groups from VK API:', error);
      await fetchGroupsAlternate();
    } finally {
      setGroupsLoading(false);
    }  
  }, []); // Add dependencies if needed
  
  const fetchGroupsAlternate = async () => {
    try {
      // Fallback to settings if no groups from VK API
      const settingsResponse = await axios.get('/api/settings');
      
      if (settingsResponse.data && settingsResponse.data.vkGroups && 
          Array.isArray(settingsResponse.data.vkGroups) && 
          settingsResponse.data.vkGroups.length > 0) {
        
        setTargetGroups(settingsResponse.data.vkGroups);
        console.log('Loaded groups from settings:', settingsResponse.data.vkGroups);
        return;
      }
      
      // If still no groups, check if we have any saved groups in local storage
      const savedGroups = localStorage.getItem('vkTargetGroups');
      if (savedGroups) {
        try {
          const parsedGroups = JSON.parse(savedGroups);
          if (Array.isArray(parsedGroups) && parsedGroups.length > 0) {
            setTargetGroups(parsedGroups);
            console.log('Loaded groups from local storage:', parsedGroups);
            return;
          }
        } catch (e) {
          console.error('Failed to parse saved groups', e);
        }
      }
      
      // If all else fails, show an error
      setGroupError('Не удалось загрузить список групп. Убедитесь, что вы авторизованы в ВКонтакте и имеете права администратора хотя бы в одном сообществе.');
      setTargetGroups([]);
      
    } catch (error) {
      console.error('Error in fallback group loading:', error);
      setGroupError('Ошибка при загрузке групп: ' + (error.response?.data?.error || error.message));
      setTargetGroups([]);
    }
  };
  
  const fetchGenerators = useCallback(async () => {
    setGeneratorLoading(true);
    try {
      const response = await axios.get('/api/publishing/generators');
      setGenerators(response.data);
    } catch (error) {
      console.error('Error fetching generators:', error);
      showSnackbar('Ошибка при загрузке генераторов контента', 'error');
    } finally {
      setGeneratorLoading(false);
    }
  }, []); // Add dependencies like showSnackbar if needed
  
  // Add debug output
  useEffect(() => {
    console.log('Target groups state:', targetGroups);
  }, [targetGroups]);

  useEffect(() => {
    checkAuthStatus();
    fetchGenerators();
    fetchGroups();
  }, [checkAuthStatus, fetchGenerators, fetchGroups]); // Add missing dependencies
  
  useEffect(() => {
    fetchTopPosts();
  }, [fetchTopPosts]); // Add fetchTopPosts as dependency
  
  // When tab changes, clear form and fetch appropriate data
  useEffect(() => {
    if (tabValue === 0) {
      fetchTopPosts();
    } else {
      setSelectedPostId('');
    }
  }, [tabValue, fetchTopPosts]); // Add fetchTopPosts as a dependency
  
  // When generator changes, update params
  useEffect(() => {
    if (selectedGenerator) {
      const generator = generators.find(g => g.id === selectedGenerator);
      if (generator) {
        setGeneratorMetadata(generator);
        
        // Initialize params with default values
        const initialParams = {};
        generator.params.forEach(param => {
          initialParams[param.name] = param.defaultValue;
        });
        setGeneratorParams(initialParams);
      }
    } else {
      setGeneratorMetadata(null);
      setGeneratorParams({});
    }
  }, [selectedGenerator, generators]);
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  const handlePostSelect = (event) => {
    setSelectedPostId(event.target.value);
  };
  
  const handleGroupSelect = (event) => {
    setSelectedGroupId(event.target.value);
  };
  
  const handleGeneratorSelect = (event) => {
    setSelectedGenerator(event.target.value);
  };
  
  const handleParamChange = (paramName, value) => {
    setGeneratorParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };
  
  const handleOptionChange = (option, value) => {
    setPublishOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };
  
  const handlePublishPost = async () => {
    if (!selectedPostId || !selectedGroupId) {
      showSnackbar('Выберите пост и целевую группу', 'warning');
      return;
    }
    
    if (!authStatus.hasActiveToken) {
      showSnackbar('Требуется авторизация в ВКонтакте', 'error');
      return;
    }
    
    setPublishingInProgress(true);
    
    try {
      const response = await axios.post('/api/publishing/publish-post', {
        postId: selectedPostId,
        communityId: selectedGroupId,
        options: publishOptions,
      });
      
      if (response.data.status === 'success') {
        showSnackbar('Пост успешно опубликован', 'success');
        
        // Reset form
        setSelectedPostId('');
      } else {
        showSnackbar(`Ошибка при публикации: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Error publishing post:', error);
      showSnackbar(`Ошибка при публикации: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setPublishingInProgress(false);
    }
  };
  
  const handlePublishGenerated = async () => {
    if (!selectedGenerator || !selectedGroupId) {
      showSnackbar('Выберите генератор и целевую группу', 'warning');
      return;
    }
    
    if (!authStatus.hasActiveToken) {
      showSnackbar('Требуется авторизация в ВКонтакте', 'error');
      return;
    }
    
    setPublishingInProgress(true);
    
    try {
      const response = await axios.post('/api/publishing/publish-generated', {
        generatorId: selectedGenerator,
        params: generatorParams,
        communityId: selectedGroupId,
        options: publishOptions
      });
      
      if (response.data.status === 'success') {
        showSnackbar('Сгенерированный контент успешно опубликован', 'success');
      } else {
        showSnackbar(`Ошибка при публикации: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Error publishing generated content:', error);
      showSnackbar(`Ошибка при публикации: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setPublishingInProgress(false);
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
  
  const getParamInput = (param) => {
    switch (param.type) {
      case 'string':
        return (
          <TextField
            fullWidth
            label={param.name}
            value={generatorParams[param.name] || ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            helperText={param.description}
            margin="normal"
          />
        );
      
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={param.name}
            value={generatorParams[param.name] || 0}
            onChange={(e) => handleParamChange(param.name, Number(e.target.value))}
            helperText={param.description}
            margin="normal"
          />
        );
      
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={generatorParams[param.name] || false}
                onChange={(e) => handleParamChange(param.name, e.target.checked)}
              />
            }
            label={param.description || param.name}
            sx={{ my: 2 }}
          />
        );
      
      default:
        return (
          <TextField
            fullWidth
            label={param.name}
            value={generatorParams[param.name] || ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            helperText={param.description}
            margin="normal"
          />
        );
    }
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Ручная публикация постов
      </Typography>
      
      {!authStatus.hasActiveToken && (
        <Alert 
          severity="warning" 
          sx={{ mb: 4 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              href="/posting/auth"
            >
              Авторизоваться
            </Button>
          }
        >
          <AlertTitle>Внимание</AlertTitle>
          У вас нет активных токенов авторизации ВКонтакте. Публикация может быть недоступна.
        </Alert>
      )}
      
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Публикация существующего поста" />
          <Tab label="Публикация сгенерированного контента" />
        </Tabs>
      </Paper>
      
      {/* Публикация существующего поста */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Публикация существующего поста
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="post-select-label">Выберите пост для публикации</InputLabel>
                <Select
                  labelId="post-select-label"
                  value={selectedPostId}
                  onChange={handlePostSelect}
                  label="Выберите пост для публикации"
                  disabled={postsLoading}
                  startAdornment={postsLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                >
                  <MenuItem value="">
                    <em>Выберите пост</em>
                  </MenuItem>
                  {posts.map((post) => (
                    <MenuItem key={post._id} value={post._id}>
                      {post.text ? (
                        post.text.length > 50 
                          ? `${post.text.substring(0, 50)}...` 
                          : post.text
                      ) : `Пост ID: ${post._id}`}
                      <Chip 
                        label={`Рейтинг: ${post.viewRate?.toFixed(6) || 0}`} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                        sx={{ ml: 1 }}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={fetchTopPosts}
                  disabled={postsLoading}
                >
                  Обновить список постов
                </Button>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              {/* Replace simple FormControl with our enhanced component */}
              <GroupSelection
                selectedGroupId={selectedGroupId}
                handleGroupSelect={handleGroupSelect}
                targetGroups={targetGroups}
                groupsLoading={groupsLoading}
                error={groupError}
              />
              {/* Add a refresh button specifically for groups */}
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={fetchGroups}
                  disabled={groupsLoading}
                >
                  Обновить список групп
                </Button>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Настройки публикации
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={publishOptions.fromGroup}
                        onChange={(e) => handleOptionChange('fromGroup', e.target.checked)}
                      />
                    }
                    label="Публиковать от имени группы"
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={publishOptions.pinned}
                        onChange={(e) => handleOptionChange('pinned', e.target.checked)}
                      />
                    }
                    label="Закрепить пост"
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={publishOptions.markedAsAds}
                        onChange={(e) => handleOptionChange('markedAsAds', e.target.checked)}
                      />
                    }
                    label="Пометить как рекламу"
                  />
                </Grid>
              </Grid>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!selectedPostId || !selectedGroupId || publishingInProgress || !authStatus.hasActiveToken}
                  onClick={handlePublishPost}
                  startIcon={publishingInProgress ? <CircularProgress size={24} /> : <PublishIcon />}
                  size="large"
                >
                  Опубликовать пост
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {/* Публикация сгенерированного контента */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Публикация сгенерированного контента
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="generator-select-label">Выберите генератор контента</InputLabel>
                <Select
                  labelId="generator-select-label"
                  value={selectedGenerator}
                  onChange={handleGeneratorSelect}
                  label="Выберите генератор контента"
                  disabled={generatorLoading}
                  startAdornment={generatorLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                >
                  <MenuItem value="">
                    <em>Выберите генератор</em>
                  </MenuItem>
                  {generators.map((generator) => (
                    <MenuItem key={generator.id} value={generator.id}>
                      {generator.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {generatorMetadata && (
                <Card variant="outlined" sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Параметры генератора
                    </Typography>
                     
                    {generatorMetadata.params.map((param) => (
                      <Box key={param.name}>
                        {getParamInput(param)}
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              {/* Replace simple FormControl with our enhanced component */}              
              <GroupSelection
                selectedGroupId={selectedGroupId}
                handleGroupSelect={handleGroupSelect}
                targetGroups={targetGroups}
                groupsLoading={groupsLoading}
                error={groupError}
              />
              {/* Add a refresh button specifically for groups */}
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={fetchGroups}
                  disabled={groupsLoading}
                >
                  Обновить список групп
                </Button>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Настройки публикации
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={publishOptions.fromGroup}
                        onChange={(e) => handleOptionChange('fromGroup', e.target.checked)}
                      />
                    }
                    label="Публиковать от имени группы"
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={publishOptions.pinned}
                        onChange={(e) => handleOptionChange('pinned', e.target.checked)}
                      />
                    }
                    label="Закрепить пост"
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={publishOptions.markedAsAds}
                        onChange={(e) => handleOptionChange('markedAsAds', e.target.checked)}
                      />
                    }
                    label="Пометить как рекламу"
                  />
                </Grid>
              </Grid>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!selectedGenerator || !selectedGroupId || publishingInProgress || !authStatus.hasActiveToken}
                  onClick={handlePublishGenerated}
                  startIcon={publishingInProgress ? <CircularProgress size={24} /> : <SendIcon />}
                  size="large"
                >
                  Сгенерировать и опубликовать
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
      
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

export default ManualPublishing;
