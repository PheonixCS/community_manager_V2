import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Paper, Box, Button, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, InputLabel, Select, MenuItem, TextField, Grid, Tooltip,
  Pagination, CircularProgress, Alert, Snackbar
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  DateRange as DateIcon,
  AssignmentTurnedIn as TaskIcon
} from '@mui/icons-material';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PublishHistoryList = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    targetGroupId: '',
    taskId: ''
  });
  const [publishTasks, setPublishTasks] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    fetchHistory();
    fetchPublishTasks();
  }, [page, limit]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        ...filter
      };
      
      const response = await axios.get('/api/publishing/history', { params });
      setHistory(response.data.data || response.data);
      setTotal(response.data.pagination?.total || response.data.length || 0);
    } catch (error) {
      console.error('Error fetching publish history:', error);
      showSnackbar('Ошибка при загрузке истории публикаций', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPublishTasks = async () => {
    try {
      const response = await axios.get('/api/publishing/tasks');
      setPublishTasks(response.data.data || []);
    } catch (error) {
      console.error('Error fetching publish tasks:', error);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleFilterChange = (e) => {
    setFilter({
      ...filter,
      [e.target.name]: e.target.value
    });
  };

  const applyFilters = () => {
    fetchHistory();
  };

  const resetFilters = () => {
    setFilter({
      status: '',
      dateFrom: '',
      dateTo: '',
      targetGroupId: '',
      taskId: ''
    });
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusChip = (status) => {
    if (status === 'success') {
      return (
        <Chip
          icon={<SuccessIcon />}
          label="Успешно"
          color="success"
          size="small"
        />
      );
    } else {
      return (
        <Chip
          icon={<ErrorIcon />}
          label="Ошибка"
          color="error"
          size="small"
        />
      );
    }
  };

  const getTaskName = (taskId) => {
    if (!taskId) return 'Ручная публикация';
    
    const task = publishTasks.find(t => t._id === taskId);
    return task ? task.name : `Задача ID: ${taskId}`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom component="h1">
          История публикаций
        </Typography>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />}
          onClick={fetchHistory}
        >
          Обновить
        </Button>
      </Box>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Фильтры
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Статус публикации</InputLabel>
              <Select
                name="status"
                value={filter.status}
                onChange={handleFilterChange}
                label="Статус публикации"
              >
                <MenuItem value="">Все статусы</MenuItem>
                <MenuItem value="success">Успешные</MenuItem>
                <MenuItem value="failed">Неудачные</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="dateFrom"
              label="С даты"
              type="date"
              value={filter.dateFrom}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="dateTo"
              label="По дату"
              type="date"
              value={filter.dateTo}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="targetGroupId"
              label="ID целевой группы"
              value={filter.targetGroupId}
              onChange={handleFilterChange}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Задача публикации</InputLabel>
              <Select
                name="taskId"
                value={filter.taskId}
                onChange={handleFilterChange}
                label="Задача публикации"
              >
                <MenuItem value="">Все задачи</MenuItem>
                <MenuItem value="manual">Ручная публикация</MenuItem>
                {publishTasks.map(task => (
                  <MenuItem key={task._id} value={task._id}>
                    {task.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
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
          {history.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">
                История публикаций пуста или не найдено записей, соответствующих фильтрам.
              </Alert>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Дата публикации</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Исходная группа</TableCell>
                      <TableCell>Целевая группа</TableCell>
                      <TableCell>ID поста</TableCell>
                      <TableCell>Задача</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((record) => (
                      <TableRow key={record._id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <DateIcon sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                            {formatDate(record.publishedAt)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {getStatusChip(record.status)}
                          {record.status === 'failed' && record.errorMessage && (
                            <Typography variant="caption" color="error" display="block">
                              {record.errorMessage}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{record.sourceGroupId}</TableCell>
                        <TableCell>{record.targetGroupId}</TableCell>
                        <TableCell>
                          <Link to={`/posts/${record.postId}`} style={{ textDecoration: 'none' }}>
                            {record.sourcePostId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {record.publishTaskId ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <TaskIcon sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                              <Link to={`/posting/tasks/edit/${record.publishTaskId}`} style={{ textDecoration: 'none' }}>
                                {getTaskName(record.publishTaskId)}
                              </Link>
                            </Box>
                          ) : (
                            'Ручная публикация'
                          )}
                        </TableCell>
                        <TableCell>
                          {record.targetPostUrl && (
                            <Tooltip title="Открыть пост ВКонтакте">
                              <IconButton
                                size="small"
                                color="primary"
                                href={record.targetPostUrl}
                                target="_blank"
                              >
                                <OpenIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <Pagination
                  count={Math.ceil(total / limit)}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  showFirstButton
                  showLastButton
                />
              </Box>
            </>
          )}
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

export default PublishHistoryList;
