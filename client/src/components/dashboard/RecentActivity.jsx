import React from 'react';
import { 
  Typography, Box, List, ListItem, ListItemText, 
  ListItemAvatar, Avatar, Divider, Link, Tooltip 
} from '@mui/material';
import { Favorite as LikeIcon, Description as PostIcon } from '@mui/icons-material';

const RecentActivity = ({ recentPosts }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getVkPostUrl = (postId) => {
    if (!postId) return '#';
    const [communityId, id] = postId.split('_');
    return `https://vk.com/wall${communityId}_${id}`;
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return 'Нет текста';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (!recentPosts || recentPosts.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom component="div">
          Последние посты
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Пока нет собранных постов.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom component="div">
        Последние посты
      </Typography>
      
      <List sx={{ width: '100%', maxWidth: 360, p: 0 }}>
        {recentPosts.map((post, index) => (
          <React.Fragment key={post._id}>
            <ListItem alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemAvatar>
                <Avatar>
                  <PostIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Link 
                    href={getVkPostUrl(post.postId)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    underline="hover"
                  >
                    {post.postId}
                  </Link>
                }
                secondary={
                  <>
                    <Typography
                      sx={{ display: 'block' }}
                      component="span"
                      variant="body2"
                      color="text.primary"
                    >
                      {truncateText(post.text)}
                    </Typography>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mt={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(post.date)}
                      </Typography>
                      <Tooltip title="Лайки">
                        <Box display="flex" alignItems="center">
                          <LikeIcon fontSize="small" color="error" sx={{ mr: 0.5 }} />
                          <Typography variant="caption">{post.likes}</Typography>
                        </Box>
                      </Tooltip>
                    </Box>
                  </>
                }
              />
            </ListItem>
            {index < recentPosts.length - 1 && <Divider variant="inset" component="li" />}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default RecentActivity;
