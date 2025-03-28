import React, { useState, useEffect } from 'react';
import { Container, Grid, Paper, Typography, Box, CircularProgress, List, ListItem, ListItemText, Button } from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TasksSummary from './dashboard/TasksSummary';
import PostsStatistics from './dashboard/PostsStatistics';
import RecentActivity from './dashboard/RecentActivity';
import MetricsChart from './dashboard/MetricsChart';
import CommunityDistribution from './dashboard/CommunityDistribution';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [filterTemplates, setFilterTemplates] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Добавляем обработку ошибок для каждого запроса
        const [statsResponse, tasksResponse, postsResponse] = await Promise.allSettled([
          axios.get('/api/posts/stats/overview'),
          axios.get('/api/tasks'),
          axios.get('/api/posts', {
            params: {
              limit: 5,
              sortBy: 'publishedAt',
              sortOrder: 'desc'
            }
          })
        ]);

        // Обрабатываем результаты с проверкой на ошибки
        if (statsResponse.status === 'fulfilled') {
          setStats(statsResponse.value.data);
        }
        if (tasksResponse.status === 'fulfilled') {
          setTasks(tasksResponse.value.data);
        }
        if (postsResponse.status === 'fulfilled') {
          setRecentPosts(postsResponse.value.data.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    fetchFilterTemplates();
  }, []);

  const fetchFilterTemplates = async () => {
    try {
      const res = await axios.get('/api/filter-templates');
      setFilterTemplates(res.data);
    } catch (err) {
      console.error('Error fetching filter templates:', err);
    }
  };

  const renderFilterTemplateStats = () => {
    if (filterTemplates.length === 0) {
      return <Typography variant="body2">Нет шаблонов фильтрации</Typography>;
    }

    return (
      <List dense>
        {filterTemplates.slice(0, 5).map(template => (
          <ListItem key={template._id}>
            <ListItemText 
              primary={template.name}
              secondary={
                <React.Fragment>
                  {template.description && (
                    <Typography variant="caption" component="span">
                      {template.description}
                    </Typography>
                  )}
                  <Typography variant="caption" component="div">
                    Фильтры: {`Фото: ${template.mediaFilters?.photos?.min || 0}+, `}
                    {`Видео: ${template.mediaFilters?.videos?.min || 0}+`}
                  </Typography>
                </React.Fragment>
              }
            />
          </ListItem>
        ))}
        {filterTemplates.length > 5 && (
          <ListItem>
            <ListItemText 
              primary={`и ещё ${filterTemplates.length - 5} шаблонов...`}
              primaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
        )}
      </List>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1" color="textPrimary">
        Панель управления
      </Typography>
      
      <Grid container spacing={3}>
        {/* Верхний ряд с основными метриками */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 140,
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Всего постов
                </Typography>
                <Typography variant="h3" component="div">
                  {stats?.totalPosts || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 140,
                  background: 'linear-gradient(45deg, #4CAF50 30%, #81C784 90%)',
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Активные задачи
                </Typography>
                <Typography variant="h3" component="div">
                  {tasks?.filter(t => t.schedule.active).length || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 140,
                  background: 'linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)',
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Сообществ
                </Typography>
                <Typography variant="h3" component="div">
                  {stats?.communityCounts?.length || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  height: 140,
                  background: 'linear-gradient(45deg, #F44336 30%, #E57373 90%)',
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Медиафайлов
                </Typography>
                <Typography variant="h3" component="div">
                  {stats?.metrics?.totalMediaFiles || 0}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Сводка по задачам */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 340,
            }}
          >
            <TasksSummary tasks={tasks} />
          </Paper>
        </Grid>
        
        {/* Статистика по постам */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 340,
            }}
          >
            <PostsStatistics stats={stats} />
          </Paper>
        </Grid>
        
        {/* Последняя активность */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 340,
              overflowY: 'auto',
            }}
          >
            <RecentActivity recentPosts={recentPosts} />
          </Paper>
        </Grid>
        
        {/* График метрик постов */}
        <Grid item xs={12} lg={8}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 400,
            }}
          >
            <MetricsChart data={stats?.postsByDay || []} />
          </Paper>
        </Grid>
        
        {/* Распределение постов по сообществам */}
        <Grid item xs={12} lg={4}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 400,
            }}
          >
            <CommunityDistribution communities={stats?.communityCounts || []} />
          </Paper>
        </Grid>

        {/* Шаблоны фильтрации */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 240,
            }}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Шаблоны фильтрации
            </Typography>
            {renderFilterTemplateStats()}
            <Button 
              variant="text" 
              color="primary" 
              onClick={() => navigate('/filter-templates')}
              sx={{ mt: 'auto' }}
            >
              Управление шаблонами фильтрации
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
