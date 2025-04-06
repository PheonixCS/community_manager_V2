import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button,
  Chip, Pagination, Box, TextField, Grid, Tooltip
} from '@mui/material';
import { 
  Visibility as ViewIcon, 
  ThumbUp as LikeIcon, 
  Share as ShareIcon,
  TrendingUp as TrendingUpIcon,
  DateRange as DateIcon,
  TextFields as TextIcon,
  Business as CommunityIcon,
  MoreVert as ActionsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { Link } from 'react-router-dom';

const TopRatedPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    communityId: '',
    dateFrom: '',
    dateTo: '',
    minViewRate: ''
  });

  // Wrap fetchTopRatedPosts in useCallback
  const fetchTopRatedPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/posts/top-rated', {
        params: {
          page,
          limit: 20,
          ...filters
        }
      });
      
      setPosts(response.data.data);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching top rated posts:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filters]); // Add the missing dependencies

  useEffect(() => {
    fetchTopRatedPosts();
  }, [fetchTopRatedPosts]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setPage(1); // Сбрасываем на первую страницу
    fetchTopRatedPosts();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Топ постов по рейтингу просмотров
      </Typography>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Фильтры
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              name="communityId"
              label="ID сообщества"
              fullWidth
              value={filters.communityId}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              name="dateFrom"
              label="С даты"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dateFrom}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              name="dateTo"
              label="По дату"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dateTo}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              name="minViewRate"
              label="Мин. рейтинг"
              type="number"
              fullWidth
              inputProps={{ step: 0.000001 }}
              value={filters.minViewRate}
              onChange={handleFilterChange}
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            variant="contained" 
            onClick={handleApplyFilters}
          >
            Применить фильтры
          </Button>
        </Box>
      </Paper>
      
      {loading ? (
        <Typography>Загрузка...</Typography>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
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
                    <Tooltip title="Сообщество">
                      <CommunityIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Рейтинг (просмотры/сек)">
                      <TrendingUpIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Просмотры">
                      <ViewIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Лайки">
                      <LikeIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Репосты">
                      <ShareIcon />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Действия">
                      <ActionsIcon />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <TableRow key={post._id}>
                      <TableCell>{formatDate(post.date)}</TableCell>
                      <TableCell>
                        {post.text ? (
                          post.text.length > 100 
                            ? `${post.text.substring(0, 100)}...` 
                            : post.text
                        ) : 'Нет текста'}
                      </TableCell>
                      <TableCell>{post.communityId}</TableCell>
                      <TableCell>
                        <Chip 
                          icon={<TrendingUpIcon />}
                          label={post.viewRate? post.viewRate.toFixed(6) : 0}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ViewIcon sx={{ mr: 1 }} />
                          {post.views}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LikeIcon sx={{ mr: 1 }} />
                          {post.likes}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <ShareIcon sx={{ mr: 1 }} />
                          {post.reposts}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Button 
                          component={Link} 
                          to={`/posts/${post._id}`}
                          size="small" 
                          variant="outlined"
                        >
                          Подробнее
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      Посты не найдены
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={handlePageChange} 
              color="primary" 
            />
          </Box>
        </>
      )}
    </Container>
  );
};

export default TopRatedPosts;
