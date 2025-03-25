import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Grid, Paper, Typography, Box, Divider } from '@mui/material';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PostDetail = () => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await axios.get(`/api/posts/${id}`);
        setPost(response.data);
      } catch (error) {
        console.error('Error fetching post:', error);
      }
    };

    const fetchStats = async () => {
      try {
        const response = await axios.get('/api/posts/stats/overview');
        setStats(response.data.metrics);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchPost();
    fetchStats();
  }, [id]);

  if (!post) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom component="h1">
          Загрузка...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Детали поста
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {post.text}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Опубликовано: {new Date(post.date).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Лайки: {post.likes}, Комментарии: {post.comments}, Репосты: {post.reposts}, Просмотры: {post.views}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Аналитика поста
            </Typography>
            <Typography variant="body1">
              Рейтинг: <strong>{post.viewRate?.toFixed(6) || '0'}</strong> просмотров/секунду
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Рассчитано на основе {post.views || 0} просмотров за {
                Math.floor(((new Date()) - new Date(post.date)) / (1000 * 60 * 60))
              } часов
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            {post.viewRate > 0 && (
              <Box sx={{ height: 200, mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Сравнение с другими постами
                </Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { name: 'Мин.', value: stats?.minViewRate || 0 },
                      { name: 'Сред.', value: stats?.avgViewRate || 0 },
                      { name: 'Пост', value: post.viewRate },
                      { name: 'Макс.', value: stats?.maxViewRate || 0 }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PostDetail;