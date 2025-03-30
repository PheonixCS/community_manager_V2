import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Grid, Paper, Box, Button,
  List, ListItem, ListItemText, Divider, Card, CardContent,
  CardActions, Alert, AlertTitle, CircularProgress, Chip
} from '@mui/material';
import {
  Add as AddIcon, 
  Publish as PublishIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PieChart, Pie, ResponsiveContainer, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';



const PostingDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [authStatus, setAuthStatus] = useState({ hasActiveToken: false, error: null });

  // Wrap fetchData in useCallback
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Parallelize API calls
      const [tasksResponse, historyResponse, tokensResponse] = await Promise.all([
        axios.get('/api/publishing/tasks?limit=100'),
        axios.get('/api/publishing/history?limit=100'),
        axios.get('/api/vk-auth/tokens')
      ]);

      setTasks(tasksResponse.data.data || []);
      setRecentHistory(historyResponse.data.data || []); // Fix to properly access paginated data

      // Properly handle token validation
      const tokens = tokensResponse.data || [];
      const hasActiveToken = tokens.some(token => {
        // Check if token is active and not expired
        const isActive = token.isActive;
        const isExpired = token.expiresAt && Math.floor(Date.now() / 1000) >= token.expiresAt;
        return isActive && !isExpired;
      });
      
      setAuthStatus({
        hasActiveToken,
        error: null
      });
      
      // Calculate stats with proper data handling
      calculateStats(tasksResponse.data.data || [], historyResponse.data.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setAuthStatus({
        hasActiveToken: false,
        error: 'Ошибка при проверке статуса авторизации'
      });
    } finally {
      setLoading(false);
    }
  }, []); // Add dependencies if needed

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Add fetchData as dependency

  // Remove the redundant isTokenExpired function since we're doing the check inline

  const calculateStats = (tasks, history) => {
    // Ensure we have arrays
    const tasksArray = Array.isArray(tasks) ? tasks : [];
    const historyArray = Array.isArray(history) ? history : [];
    
    const publishedCount = historyArray.filter(item => item && item.status === 'success').length;
    const failedCount = historyArray.filter(item => item && item.status === 'failed').length;
    
    const taskStats = {
      totalTasks: tasksArray.length,
      activeTasks: tasksArray.filter(task => 
        task && ((task.type === 'schedule' && task.schedule?.active) || 
        (task.type === 'one_time' && !task.oneTime?.executed))
      ).length,
      scheduleTasks: tasksArray.filter(task => task && task.type === 'schedule').length,
      oneTimeTasks: tasksArray.filter(task => task && task.type === 'one_time').length,
      withGenerator: tasksArray.filter(task => task && task.useContentGenerator).length
    };
    
    const publishStats = {
      totalPublished: publishedCount,
      totalFailed: failedCount,
      successRate: publishedCount + failedCount > 0 
        ? Math.round((publishedCount / (publishedCount + failedCount)) * 100) 
        : 0
    };
    
    setStats({
      tasks: taskStats,
      publishing: publishStats
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Дашборд публикации постов
        </Typography>
        <Button 
          component={Link} 
          to="/posting/tasks/new"
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
        >
          Новая задача
        </Button>
      </Box>
      
      {!authStatus.hasActiveToken && (
        <Alert 
          severity="warning" 
          sx={{ mb: 4 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              component={Link} 
              to="/posting/auth"
            >
              Авторизоваться
            </Button>
          }
        >
          <AlertTitle>Внимание</AlertTitle>
          У вас нет активных токенов авторизации ВКонтакте. Публикация постов может быть недоступна.
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
                <Typography variant="h6" gutterBottom component="div">
                  Задачи публикации
                </Typography>
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" component="div">
                      {stats?.tasks.totalTasks || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Всего
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" component="div">
                      {stats?.tasks.activeTasks || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Активных
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
                <Typography variant="h6" gutterBottom component="div">
                  Публикации
                </Typography>
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" component="div">
                      {stats?.publishing.totalPublished || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Успешных
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" component="div" color="error">
                      {stats?.publishing.totalFailed || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Неудачных
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom component="div">
                  Распределение задач
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'По расписанию', value: stats?.tasks.scheduleTasks || 0 },
                        { name: 'Разовые', value: stats?.tasks.oneTimeTasks || 0 },
                        { name: 'С генератором', value: stats?.tasks.withGenerator || 0 },
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8" name="Количество задач" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Recent Tasks and History */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom component="div">
              Успешность публикаций
            </Typography>
            <Box sx={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {(stats?.publishing.totalPublished || 0) + (stats?.publishing.totalFailed || 0) > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Успешные', value: stats?.publishing.totalPublished || 0 },
                          { name: 'Неудачные', value: stats?.publishing.totalFailed || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#4caf50" />
                        <Cell fill="#f44336" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
                  Нет данных о публикациях
                </Typography>
              )}
            </Box>
          </Paper>
          
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" component="div">
                Последние публикации
              </Typography>
              <Button 
                component={Link} 
                to="/posting/history"
                size="small" 
                endIcon={<HistoryIcon />}
              >
                Все
              </Button>
            </Box>
            <List 
              dense
              sx={{ 
                maxHeight: 300, // или любое другое значение, которое вам подходит
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              {recentHistory.length > 0 ? (
                recentHistory.map((item, index) => (
                  <React.Fragment key={item._id || index}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {item.status === 'success' ? (
                              <SuccessIcon sx={{ color: 'success.main', mr: 1 }} fontSize="small" />
                            ) : (
                              <ErrorIcon sx={{ color: 'error.main', mr: 1 }} fontSize="small" />
                            )}
                            {`В группу ${item.targetGroupId}`}
                          </Box>
                        }
                        secondary={formatDate(item.publishedAt)}
                      />
                      {item.targetPostUrl && item.status === 'success' && (
                        <Button 
                          size="small" 
                          variant="outlined" 
                          href={item.targetPostUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          Просмотр
                        </Button>
                      )}
                    </ListItem>
                    {index < recentHistory.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="Нет истории публикаций" />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>
        
        {/* Recent Tasks */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" component="div">
                Последние задачи публикации
              </Typography>
              <Button 
                component={Link} 
                to="/posting/tasks"
                endIcon={<PublishIcon />}
              >
                Все задачи
              </Button>
            </Box>
            <Box sx={{ 
              maxHeight: 500, // или другое значение по вашему усмотрению
              overflowY: 'auto',
              pr: 1, // добавляем отступ для скроллбара
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#888',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: '#555',
              }
            }}>
              <Grid container spacing={2}>
                {tasks.length > 0 ? (
                  tasks.map(task => (
                    <Grid item xs={12} sm={6} md={4} key={task._id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" component="div" noWrap>
                            {task.name}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              label={task.type === 'schedule' ? 'По расписанию' : 'Разовая'} 
                              size="small" 
                              color="primary" 
                              variant="outlined" 
                              sx={{ mr: 1 }}
                            />
                            <Chip 
                              label={
                                task.type === 'schedule' 
                                  ? (task.schedule.active ? 'Активна' : 'Неактивна')
                                  : (task.oneTime.executed ? 'Выполнена' : 'Ожидает')
                              }
                              size="small" 
                              color={
                                (task.type === 'schedule' && task.schedule.active) || 
                                (task.type === 'one_time' && !task.oneTime.executed)
                                  ? 'success' 
                                  : 'error'
                              }
                              variant="outlined" 
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Публикаций: {(task.statistics?.successfulPublications || 0) + (task.statistics?.failedPublications || 0)}
                          </Typography>
                          {task.type === 'schedule' && task.statistics?.nextExecutionAt && (
                            <Typography variant="body2" color="text.secondary">
                              След. запуск: {formatDate(task.statistics.nextExecutionAt)}
                            </Typography>
                          )}
                          {task.type === 'one_time' && task.oneTime?.scheduledAt && (
                            <Typography variant="body2" color="text.secondary">
                              Запланирован на: {formatDate(task.oneTime.scheduledAt)}
                            </Typography>
                          )}
                        </CardContent>
                        <CardActions>
                          <Button 
                            size="small"
                            component={Link}
                            to={`/posting/tasks/edit/${task._id}`}
                          >
                            Подробнее
                          </Button>
                          <Button 
                            size="small"
                            color="primary"
                            onClick={() => {
                              axios.post(`/api/publishing/tasks/${task._id}/execute`)
                                .then(() => {
                                  alert('Задача запущена на выполнение');
                                })
                                .catch(error => {
                                  console.error('Error executing task:', error);
                                  alert('Ошибка при запуске задачи');
                                });
                            }}
                          >
                            Выполнить
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))
                ) : (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      Нет активных задач публикации. Создайте новую задачу, чтобы начать публикацию постов.
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default PostingDashboard;
