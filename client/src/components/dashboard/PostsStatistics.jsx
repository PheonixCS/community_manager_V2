import React from 'react';
import { Typography, Box, Grid, Divider, CircularProgress } from '@mui/material';
import {
  Favorite as LikeIcon,
  ChatBubble as CommentIcon,
  Share as RepostIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

const PostsStatistics = ({ stats }) => {
  if (!stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  const { totalPosts, metrics } = stats;
  
  const formatNumber = (num) => {
    if (!num) return '0';
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    
    return num.toString();
  };
  
  const formatAvg = (num) => {
    if (!num) return '0';
    return Math.round(num).toString();
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom component="div">
        Статистика постов
      </Typography>
      
      <Typography variant="body1" fontWeight="bold" align="center" sx={{ mb: 2 }}>
        {totalPosts} постов
      </Typography>
      
      <Divider sx={{ mb: 2 }} />
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Box display="flex" alignItems="center" mb={1}>
            <LikeIcon color="error" sx={{ mr: 1 }} />
            <Typography variant="body2">Лайки:</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Всего:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatNumber(metrics?.totalLikes || 0)}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">В среднем:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatAvg(metrics?.avgLikes || 0)}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={6}>
          <Box display="flex" alignItems="center" mb={1}>
            <CommentIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="body2">Комментарии:</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Всего:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatNumber(metrics?.totalComments || 0)}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">В среднем:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatAvg(metrics?.avgComments || 0)}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={6}>
          <Box display="flex" alignItems="center" mb={1}>
            <RepostIcon color="success" sx={{ mr: 1 }} />
            <Typography variant="body2">Репосты:</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Всего:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatNumber(metrics?.totalReposts || 0)}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">В среднем:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatAvg(metrics?.avgReposts || 0)}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={6}>
          <Box display="flex" alignItems="center" mb={1}>
            <ViewIcon color="info" sx={{ mr: 1 }} />
            <Typography variant="body2">Просмотры:</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Всего:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatNumber(metrics?.totalViews || 0)}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">В среднем:</Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatAvg(metrics?.avgViews || 0)}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PostsStatistics;
