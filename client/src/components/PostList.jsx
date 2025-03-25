import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Grid, Card, CardContent,
  CardActions, Button, TextField, MenuItem, IconButton,
  Pagination, Chip, Divider, Paper, Select, FormControl,
  InputLabel, Slider, Stack, CardMedia, Link, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Snackbar, Alert, Tooltip, TableContainer, Table, TableHead, TableRow, TableCell, TableSortLabel, TableBody
} from '@mui/material';
import {
  Favorite as LikeIcon,
  ChatBubble as CommentIcon,
  Share as RepostIcon,
  Visibility as ViewIcon,
  OpenInNew as ExternalLinkIcon,
  FilterList as FilterIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  VideoLibrary as VideoIcon,
  DateRange as DateIcon,
  TextFields as TextIcon,
  Tag as IdIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import axios from 'axios';

const PostList = () => {
  // Добавляем состояние для постов
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPosts, setTotalPosts] = useState(0);
  const [filters, setFilters] = useState({
    communityId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    sortBy: 'publishedAt',
    sortOrder: 'desc'
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [videoDownloadStatus, setVideoDownloadStatus] = useState({});
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc'); // Добавляем состояние для порядка сортировки

  useEffect(() => {
    fetchPosts();
  }, [page, limit, filters]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/posts', {
        params: {
          page,
          limit,
          ...filters,
          sort: {
            field: filters.sortBy,
            order: filters.sortOrder
          }
        }
      });
      setPosts(response.data.data);
      setTotalPosts(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setSnackbar({
        open: true,
        message: 'Ошибка при загрузке постов',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  const handleResetFilters = () => {
    setFilters({
      communityId: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getAttachmentPreview = (post) => {
    if (post.attachments && post.attachments.length > 0) {
      const attachment = post.attachments[0];
      if (attachment.type === 'photo') {
        return attachment.photo.sizes[0].url;
      }
    }
    return null;
  };

  const getVkPostUrl = (postId) => {
    const [communityId, postIdPart] = postId.split('_');
    
    return `https://vk.com/wall${communityId}_${postIdPart}`;
  };

  const handleClearAllPosts = async () => {
    setConfirmDialogOpen(false);
    try {
      setLoading(true);
      // Изменяем URL для очистки базы
      const response = await axios.delete('/api/posts/clear');
      setSnackbar({
        open: true,
        message: response.data.message,
        severity: 'success'
      });
      setPosts([]);
      setTotalPosts(0);
    } catch (error) {
      console.error('Error clearing posts database:', error);
      setSnackbar({
        open: true,
        message: `Ошибка при очистке базы данных: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadVideos = async (postId) => {
    try {
      setVideoDownloadStatus({
        ...videoDownloadStatus,
        [postId]: 'loading'
      });
      
      const response = await axios.post(`/api/posts/${postId}/download-videos`);
      
      setVideoDownloadStatus({
        ...videoDownloadStatus,
        [postId]: 'success'
      });
      
      if (response.data.status === 'no_videos') {
        setSnackbar({
          open: true,
          message: 'В посте нет видео для скачивания',
          severity: 'info'
        });
      } else {
        const successCount = response.data.results?.filter(r => r.status === 'success').length || 0;
        const alreadyDownloaded = response.data.results?.filter(r => r.status === 'already_downloaded').length || 0;
        const errorCount = response.data.results?.filter(r => r.status === 'error').length || 0;
        
        let message = `Видео обработаны: ${successCount} скачано`;
        if (alreadyDownloaded > 0) message += `, ${alreadyDownloaded} уже было скачано ранее`;
        if (errorCount > 0) message += `, ${errorCount} с ошибками`;
        
        setSnackbar({
          open: true,
          message,
          severity: successCount > 0 ? 'success' : 'info'
        });
      }
    } catch (error) {
      console.error(`Error downloading videos from post ${postId}:`, error);
      setVideoDownloadStatus({
        ...videoDownloadStatus,
        [postId]: 'error'
      });
      setSnackbar({
        open: true,
        message: `Ошибка при скачивании видео: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  const getVideoDownloadButton = (post) => {
    const status = videoDownloadStatus[post._id];
    
    // Проверяем, есть ли в посте видео-вложения
    const hasVideo = post.attachments && post.attachments.some(
      attachment => attachment.type === 'video'
    );
    
    if (!hasVideo) return null;
    
    return (
      <Tooltip title="Скачать видео">
        <IconButton
          size="small"
          color="primary"
          onClick={() => handleDownloadVideos(post._id)}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <CircularProgress size={20} />
          ) : (
            <VideoIcon />
          )}
        </IconButton>
      </Tooltip>
    );
  };

  const handleSortChange = (field) => {
    if (sortField === field) {
      // Если уже сортируем по этому полю, меняем направление сортировки
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      // Иначе сортируем по новому полю в порядке по умолчанию (для рейтинга - по убыванию)
      setSortField(field);
      setSortOrder(field === 'viewRate' ? 'desc' : 'desc');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Посты
      </Typography>

      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="subtitle1">
          Всего постов в базе: {totalPosts}
        </Typography>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setConfirmDialogOpen(true)}
        >
          Очистить базу постов
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="ID сообщества"
              name="communityId"
              value={filters.communityId}
              onChange={handleFilterChange}
              fullWidth
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Дата от"
              name="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              fullWidth
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Дата до"
              name="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={handleFilterChange}
              fullWidth
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Поиск"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              fullWidth
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Сортировать по</InputLabel>
              <Select
                label="Сортировать по"
                name="sortBy"
                value={filters.sortBy}
                onChange={handleFilterChange}
              >
                <MenuItem value="publishedAt">Дата публикации</MenuItem>
                <MenuItem value="likes">Лайки</MenuItem>
                <MenuItem value="comments">Комментарии</MenuItem>
                <MenuItem value="reposts">Репосты</MenuItem>
                <MenuItem value="views">Просмотры</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Порядок</InputLabel>
              <Select
                label="Порядок"
                name="sortOrder"
                value={filters.sortOrder}
                onChange={handleFilterChange}
              >
                <MenuItem value="asc">По возрастанию</MenuItem>
                <MenuItem value="desc">По убыванию</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<FilterIcon />}
              onClick={fetchPosts}
              fullWidth
              sx={{ mt: 1 }}
            >
              Применить
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleResetFilters}
              fullWidth
              sx={{ mt: 1 }}
            >
              Сбросить
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
            Найдено постов: {totalPosts}
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {/* Заменяем текстовые заголовки на иконки с тултипами */}
                  <TableCell>
                    <Tooltip title="ID поста">
                      <IdIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Дата публикации">
                      <DateIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Текст поста">
                      <TextIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Количество лайков">
                      <LikeIcon />
                    </Tooltip>
                  </TableCell>
                  {/* <TableCell>
                    <Tooltip title="Количество комментариев">
                      <CommentIcon />
                    </Tooltip>
                  </TableCell> */}
                  <TableCell>
                    <Tooltip title="Количество репостов">
                      <RepostIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Количество просмотров">
                      <ViewIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'viewRate'}
                      direction={sortOrder}
                      onClick={() => handleSortChange('viewRate')}
                    >
                      <Tooltip title="Рейтинг (просмотры/сек)">
                        <TrendingUpIcon />
                      </Tooltip>
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post._id}>
                    <TableCell>{post.postId}</TableCell>
                    <TableCell>{formatDate(post.date)}</TableCell>
                    <TableCell>{post.text || 'Нет текста'}</TableCell>
                    <TableCell>{post.likes}</TableCell>
                    {/* <TableCell>{post.comments}</TableCell> */}
                    <TableCell>{post.reposts}</TableCell>
                    <TableCell>{post.views}</TableCell>
                    <TableCell>{post.viewRate ? post.viewRate.toFixed(6) : '0'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPosts > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination 
                count={Math.ceil(totalPosts / limit)} 
                page={page} 
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}

      {/* Диалог подтверждения очистки базы данных */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Подтверждение очистки базы данных</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы действительно хотите очистить базу данных постов? Эта операция не может быть отменена.
            Все собранные посты будут удалены.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleClearAllPosts} color="error" variant="contained">
            Очистить базу данных
          </Button>
        </DialogActions>
      </Dialog>

      {/* Уведомление об операциях */}
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

export default PostList;