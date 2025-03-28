import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Paper, Box, Button, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, InputLabel, Select, MenuItem, Grid, Tooltip,
  CircularProgress, Alert, Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  Pause as PauseIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Schedule as ScheduleIcon,
  AccessTime as OneTimeIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Replay as TotalExecutionsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PublishTaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: '',
    active: ''
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Remove navigate if not used, or use it somewhere
  // const navigate = useNavigate(); 

  // Define showSnackbar first with useCallback
  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  }, []); // No dependencies since it just uses setState
  
  // Now define fetchTasks after showSnackbar
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.type) params.type = filter.type;
      if (filter.active !== '') params.active = filter.active;
      
      const response = await axios.get('/api/publishing/tasks', { params });
      setTasks(response.data.data);
    } catch (error) {
      console.error('Error fetching publish tasks:', error);
      showSnackbar('Ошибка при загрузке задач', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, showSnackbar]); // Add showSnackbar as dependency

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleFilterChange = (e) => {
    setFilter({
      ...filter,
      [e.target.name]: e.target.value
    });
  };

  const applyFilters = () => {
    fetchTasks();
  };

  const resetFilters = () => {
    setFilter({
      type: '',
      active: ''
    });
    // Note: we don't call fetchTasks here, it will be called when the Apply button is clicked
  };

  const handleDeleteTask = async () => {
    try {
      await axios.delete(`/api/publishing/tasks/${taskToDelete}`);
      setTasks(tasks.filter(task => task._id !== taskToDelete));
      showSnackbar('Задача удалена', 'success');
    } catch (error) {
      console.error('Error deleting task:', error);
      showSnackbar('Ошибка при удалении задачи', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleToggleTask = async (id, isActive) => {
    try {
      // Find the task
      const task = tasks.find(task => task._id === id);
      if (!task) return;
      
      // Prepare the update data
      const updateData = {
        ...task,
        schedule: {
          ...task.schedule,
          active: !isActive
        }
      };
      
      await axios.put(`/api/publishing/tasks/${id}`, updateData);
      
      // Update local state
      setTasks(tasks.map(task => {
        if (task._id === id) {
          return {
            ...task,
            schedule: {
              ...task.schedule,
              active: !isActive
            }
          };
        }
        return task;
      }));
      
      showSnackbar(`Задача ${!isActive ? 'активирована' : 'деактивирована'}`, 'success');
    } catch (error) {
      console.error('Error toggling task:', error);
      showSnackbar('Ошибка при изменении статуса задачи', 'error');
    }
  };

  const handleRunTask = async (id) => {
    try {
      setTasks(tasks.map(task => {
        if (task._id === id) {
          return { ...task, isRunning: true };
        }
        return task;
      }));
      
      const response = await axios.post(`/api/publishing/tasks/${id}/execute`);
      
      setTasks(tasks.map(task => {
        if (task._id === id) {
          return { ...task, isRunning: false };
        }
        return task;
      }));
      
      showSnackbar(`Задача выполнена: ${response.data.message}`, 'success');
    } catch (error) {
      console.error('Error running task:', error);
      
      setTasks(tasks.map(task => {
        if (task._id === id) {
          return { ...task, isRunning: false };
        }
        return task;
      }));
      
      showSnackbar('Ошибка при выполнении задачи', 'error');
    }
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

  const getTaskStatusInfo = (task) => {
    if (task.type === 'schedule') {
      return {
        icon: task.schedule.active ? <ActiveIcon /> : <InactiveIcon />,
        color: task.schedule.active ? 'success' : 'error',
        label: task.schedule.active ? 'Активна' : 'Неактивна'
      };
    } else {
      return {
        icon: task.oneTime.executed ? <ActiveIcon /> : <InactiveIcon />,
        color: task.oneTime.executed ? 'default' : 'warning',
        label: task.oneTime.executed ? 'Выполнена' : 'Ожидает'
      };
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom component="h1">
          Задачи публикации
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          component={Link}
          to="/posting/tasks/new"
        >
          Новая задача
        </Button>
      </Box>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Фильтры
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Тип задачи</InputLabel>
              <Select
                name="type"
                value={filter.type}
                onChange={handleFilterChange}
                label="Тип задачи"
              >
                <MenuItem value="">Все типы</MenuItem>
                <MenuItem value="schedule">По расписанию</MenuItem>
                <MenuItem value="one_time">Разовые</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                name="active"
                value={filter.active}
                onChange={handleFilterChange}
                label="Статус"
              >
                <MenuItem value="">Все статусы</MenuItem>
                <MenuItem value="true">Активные</MenuItem>
                <MenuItem value="false">Неактивные</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<FilterIcon />}
                onClick={applyFilters}
              >
                Применить
              </Button>
              <Button 
                variant="outlined"
                onClick={resetFilters}
              >
                Сбросить
              </Button>
              <Tooltip title="Обновить список">
                <IconButton onClick={fetchTasks} color="primary">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          {tasks.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">
                Не найдено задач публикации. Создайте новую задачу для начала работы.
              </Alert>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Целевые группы</TableCell>
                    <TableCell>След. запуск</TableCell>
                    <TableCell>Статистика</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((task) => {
                    const statusInfo = getTaskStatusInfo(task);
                    return (
                      <TableRow key={task._id}>
                        <TableCell>
                          <Box sx={{ fontWeight: 'bold' }}>
                            {task.name}
                          </Box>
                          {task.description && (
                            <Typography variant="body2" color="text.secondary">
                              {task.description.length > 50 
                                ? `${task.description.substring(0, 50)}...` 
                                : task.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={task.type === 'schedule' ? <ScheduleIcon /> : <OneTimeIcon />}
                            label={task.type === 'schedule' ? 'По расписанию' : 'Разовая'}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {task.useContentGenerator && (
                            <Chip
                              label="Генератор"
                              size="small"
                              color="secondary"
                              variant="outlined"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={statusInfo.icon}
                            label={statusInfo.label}
                            size="small"
                            color={statusInfo.color}
                          />
                        </TableCell>
                        <TableCell>
                          {task.targetGroups.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {task.targetGroups.slice(0, 3).map((group, index) => (
                                <Chip
                                  key={index}
                                  label={group.name || group.groupId}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                              {task.targetGroups.length > 3 && (
                                <Chip
                                  label={`+${task.targetGroups.length - 3}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Нет групп
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.type === 'schedule' && task.statistics?.nextExecutionAt ? (
                            formatDate(task.statistics.nextExecutionAt)
                          ) : (
                            task.type === 'one_time' && task.oneTime?.scheduledAt ? (
                              formatDate(task.oneTime.scheduledAt)
                            ) : (
                              'Не запланировано'
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Tooltip title="Успешные публикации">
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <SuccessIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
                                <Typography variant="body2">
                                  {task.statistics?.successfulPublications || 0}
                                </Typography>
                              </Box>
                            </Tooltip>
                            
                            <Tooltip title="Ошибки публикации">
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <ErrorIcon color="error" fontSize="small" sx={{ mr: 0.5 }} />
                                <Typography variant="body2">
                                  {task.statistics?.failedPublications || 0}
                                </Typography>
                              </Box>
                            </Tooltip>
                            
                            <Tooltip title="Всего запусков">
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <TotalExecutionsIcon color="primary" fontSize="small" sx={{ mr: 0.5 }} />
                                <Typography variant="body2">
                                  {task.statistics?.totalExecutions || 0}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex' }}>
                            <Tooltip title="Редактировать">
                              <IconButton
                                size="small"
                                color="primary"
                                component={Link}
                                to={`/posting/tasks/edit/${task._id}`}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setTaskToDelete(task._id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                            {task.type === 'schedule' && (
                              <Tooltip title={task.schedule.active ? "Деактивировать" : "Активировать"}>
                                <IconButton
                                  size="small"
                                  color={task.schedule.active ? "warning" : "success"}
                                  onClick={() => handleToggleTask(task._id, task.schedule.active)}
                                >
                                  {task.schedule.active ? <PauseIcon /> : <RunIcon />}
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Выполнить сейчас">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleRunTask(task._id)}
                                disabled={task.isRunning}
                              >
                                {task.isRunning ? <CircularProgress size={24} /> : <RunIcon />}
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
        </Paper>
      )}
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы действительно хотите удалить эту задачу? Это действие невозможно отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleDeleteTask} color="error" autoFocus>
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

export default PublishTaskList;
