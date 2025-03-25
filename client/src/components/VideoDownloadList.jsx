import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Grid, Card, CardContent,
  CardActions, Button, TextField, IconButton, Paper,
  List, ListItem, ListItemText, ListItemAvatar, Avatar,
  ListItemSecondary, Divider, FormControl, InputLabel,
  Select, MenuItem, CircularProgress, Chip, Snackbar, Alert
} from '@mui/material';
import {
  Videocam as VideoIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

const VideoDownloadList = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [communityId, setCommunityId] = useState('');
  const [communities, setCommunities] = useState([]);
  const [downloadStatus, setDownloadStatus] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchPostsWithVideos();
  }, []);

  useEffect(() => {
    // Фильтрация постов по выбранному сообществу
    if (!communityId) {
      setFilteredPosts(posts);
    } else {
      setFilteredPosts(posts.filter(post => post.communityId === communityId));
    }
  }, [communityId, posts]);

  const fetchPostsWithVideos = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/posts', {
        params: {
          limit: 1000,
          // Добавляем параметры для фильтрации только постов с видео
          hasAttachments: 'video'
        }
      });

      // Убедимся, что у нас есть данные и они правильно структурированы
      const allPosts = response.data.data || [];
      const postsWithVideos = allPosts.filter(post => 
        post.attachments?.some(a => a.type === 'video')
      );

      setPosts(postsWithVideos);
      
      // Формируем список уникальных сообществ
      const uniqueCommunities = [...new Set(postsWithVideos.map(post => post.communityId))];
      setCommunities(uniqueCommunities);
    } catch (error) {
      console.error('Error fetching posts with videos:', error);
      setSnackbar({
        open: true,
        message: `Ошибка при загрузке постов с видео: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Добавим улучшенный обработчик скачивания видео
  const handleDownloadVideos = async (postId) => {
    try {
      setDownloadStatus({
        ...downloadStatus,
        [postId]: 'loading'
      });
      
      const response = await axios.post(`/api/posts/${postId}/download-videos`);
      
      if (response.data) {
        setDownloadStatus({
          ...downloadStatus,
          [postId]: 'success'
        });

        // Обновляем информацию о посте после скачивания
        setPosts(prevPosts => prevPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              downloadedVideos: response.data.downloadedVideos || [] // Используем обновленный список из ответа
            };
          }
          return post;
        }));

        setSnackbar({
          open: true,
          message: `Видео успешно скачаны: ${response.data.downloadedCount} файлов`,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error(`Error downloading videos from post ${postId}:`, error);
      setDownloadStatus({
        ...downloadStatus,
        [postId]: 'error'
      });
      setSnackbar({
        open: true,
        message: `Ошибка при скачивании видео: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    }
  };

  const handleDownloadAllFromCommunity = async () => {
    if (!communityId) {
      setSnackbar({
        open: true,
        message: 'Выберите сообщество для скачивания видео',
        severity: 'warning'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`/api/posts/download-videos/community/${communityId}`);
      
      setSnackbar({
        open: true,
        message: `Скачивание видео завершено: обработано ${response.data.processedPosts} постов, скачано ${response.data.downloadedVideos} видео`,
        severity: 'success'
      });
      
      // Обновляем список постов
      fetchPostsWithVideos();
    } catch (error) {
      console.error(`Error downloading videos from community ${communityId}:`, error);
      setSnackbar({
        open: true,
        message: `Ошибка при скачивании видео: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };
  
  // Фиксим функцию проверки скачанных видео
  const getPostVideoInfo = (post) => {
    const videoAttachments = post.attachments?.filter(a => a.type === 'video') || [];
    const downloadedMedia = post.mediaDownloads || [];
    
    const downloadedVideoIds = downloadedMedia
      .filter(m => m.type === 'video')
      .map(m => m.mediaId);
    
    return {
      total: videoAttachments.length,
      downloaded: downloadedVideoIds.length,
      videos: videoAttachments.map(a => ({
        ...a.video,
        downloaded: downloadedVideoIds.includes(a.video.id.toString())
      }))
    };
  };

  const isVideoDownloaded = (post, videoId) => {
    const downloadedMedia = post.mediaDownloads || [];
    return downloadedMedia
      .filter(m => m.type === 'video')
      .some(m => m.mediaId === videoId.toString());
  };

  // Update the render part for video status
  const renderVideoStatus = (video, post) => {
    const downloaded = isVideoDownloaded(post, video.id);
    return (
      <Chip 
        label={downloaded ? "Скачано" : "Не скачано"} 
        size="small"
        color={downloaded ? "success" : "default"}
        variant="outlined"
      />
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Управление видео
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="community-select-label">Сообщество</InputLabel>
              <Select
                labelId="community-select-label"
                value={communityId}
                label="Сообщество"
                onChange={(e) => setCommunityId(e.target.value)}
              >
                <MenuItem value="">Все сообщества</MenuItem>
                {communities.map(community => (
                  <MenuItem key={community} value={community}>
                    {community}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadAllFromCommunity}
              disabled={!communityId || loading}
              fullWidth
            >
              Скачать все видео из сообщества
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchPostsWithVideos}
              disabled={loading}
              fullWidth
            >
              Обновить список
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="subtitle1" mb={2}>
            Найдено постов с видео: {filteredPosts.length}
          </Typography>

          <List>
            {filteredPosts.length > 0 ? (
              filteredPosts.map(post => {
                const videoInfo = getPostVideoInfo(post);
                return (
                  <React.Fragment key={post._id}>
                    <Paper sx={{ mb: 2 }}>
                      <ListItem
                        secondaryAction={
                          <IconButton
                            edge="end"
                            color="primary"
                            onClick={() => handleDownloadVideos(post._id)}
                            disabled={downloadStatus[post._id] === 'loading'}
                          >
                            {downloadStatus[post._id] === 'loading' ? (
                              <CircularProgress size={24} />
                            ) : (
                              <DownloadIcon />
                            )}
                          </IconButton>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar>
                            <VideoIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle1">
                                {post.communityId}
                              </Typography>
                              <Chip 
                                label={`${videoInfo.downloaded}/${videoInfo.total} скачано`} 
                                size="small"
                                color={videoInfo.downloaded === videoInfo.total ? "success" : "primary"}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" component="span" color="text.primary">
                                {post.content ? post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '') : 'Нет текста'}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Опубликовано: {formatDate(post.publishedAt)}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                      <Divider />
                      <Box p={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Видео в посте:
                        </Typography>
                        <List dense>
                          {videoInfo.videos.map((video, index) => (
                            <ListItem key={video.id}>
                              <ListItemText
                                primary={`${index + 1}. ${video.title || 'Без названия'}`}
                                secondary={isVideoDownloaded(post, video.id) ? 'Скачано' : 'Не скачано'}
                              />
                              {renderVideoStatus(video, post)}
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    </Paper>
                  </React.Fragment>
                );
              })
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1">
                  Посты с видео не найдены
                </Typography>
              </Paper>
            )}
          </List>
        </>
      )}

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

export default VideoDownloadList;
