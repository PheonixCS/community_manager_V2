import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Switch, FormControlLabel, Box, Tooltip,
  RadioGroup, Radio, FormControl, FormLabel, InputLabel, Select, MenuItem, Checkbox, ListItemText, List, ListItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  Pause as PauseIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  TagOutlined as IdIcon,
  WebOutlined as DomainIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTask, setCurrentTask] = useState({
    name: '',
    communities: [],
    filters: {
      count: 100,
      offset: 0,
      filter: 'all',
      extended: true,
      skipExternalLinks: false
    },
    schedule: {
      interval: 60,
      active: true
    }
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [communityInput, setCommunityInput] = useState('');
  const [communityType, setCommunityType] = useState('id');
  const [filterTemplates, setFilterTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [filterTemplateDialogOpen, setFilterTemplateDialogOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
    fetchFilterTemplates();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks');
      
      // Преобразование старого формата в новый, если необходимо
      const updatedTasks = response.data.map(task => {
        if (!Array.isArray(task.communities) || 
            (task.communities.length > 0 && typeof task.communities[0] === 'string')) {
          // Конвертируем старый формат в новый
          task.communities = task.communities.map(community => ({
            value: community,
            type: 'id'
          }));
        }
        return task;
      });
      
      setTasks(updatedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchFilterTemplates = async () => {
    try {
      const response = await axios.get('/api/filter-templates');
      setFilterTemplates(response.data);
    } catch (error) {
      console.error('Error fetching filter templates:', error);
    }
  };

  const handleOpenDialog = (task = null) => {
    if (task) {
      // Проверяем и преобразуем старый формат communities, если нужно
      if (task.communities.length > 0 && typeof task.communities[0] === 'string') {
        task.communities = task.communities.map(community => ({
          value: community,
          type: 'id'
        }));
      }
      
      setCurrentTask(task);
      setIsEditMode(true);
    } else {
      setCurrentTask({
        name: '',
        communities: [],
        filters: {
          count: 100,
          offset: 0,
          filter: 'all',
          extended: true,
          skipExternalLinks: false
        },
        schedule: {
          interval: 60,
          active: true
        }
      });
      setIsEditMode(false);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setCurrentTask({
        ...currentTask,
        [parent]: {
          ...currentTask[parent],
          [child]: value
        }
      });
    } else {
      setCurrentTask({
        ...currentTask,
        [name]: value
      });
    }
  };

  const handleSwitchChange = (e) => {
    const { name, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setCurrentTask({
        ...currentTask,
        [parent]: {
          ...currentTask[parent],
          [child]: checked
        }
      });
    } else {
      setCurrentTask({
        ...currentTask,
        [name]: checked
      });
    }
  };

  const handleCommunityTypeChange = (e) => {
    setCommunityType(e.target.value);
  };

  const handleAddCommunity = () => {
    if (communityInput.trim()) {
      const newCommunity = {
        value: communityInput.trim(),
        type: communityType
      };
      
      // Проверяем, не добавлено ли уже такое сообщество
      const isDuplicate = currentTask.communities.some(
        c => c.value === newCommunity.value && c.type === newCommunity.type
      );
      
      if (!isDuplicate) {
        setCurrentTask({
          ...currentTask,
          communities: [...currentTask.communities, newCommunity]
        });
      }
      
      setCommunityInput('');
    }
  };

  const handleRemoveCommunity = (index) => {
    const newCommunities = [...currentTask.communities];
    newCommunities.splice(index, 1);
    
    setCurrentTask({
      ...currentTask,
      communities: newCommunities
    });
  };

  const handleSaveTask = async () => {
    try {
      if (isEditMode) {
        await axios.put(`/api/tasks/${currentTask._id}`, currentTask);
      } else {
        await axios.post('/api/tasks', currentTask);
      }
      handleCloseDialog();
      fetchTasks();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleDeleteTask = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту задачу?')) {
      try {
        await axios.delete(`/api/tasks/${id}`);
        fetchTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleToggleTask = async (id) => {
    try {
      await axios.patch(`/api/tasks/${id}/toggle`);
      fetchTasks();
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleRunTask = async (id) => {
    try {
      await axios.post(`/api/tasks/${id}/run`);
      // alert('Задача запущена успешно!');
      fetchTasks();
    } catch (error) {
      console.error('Error running task:', error);
      alert('Произошла ошибка при запуске задачи');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не запланировано';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getCommunityDisplay = (community) => {
    if (typeof community === 'string') {
      // Старый формат
      return (
        <Chip 
          key={community} 
          icon={<IdIcon />}
          label={community} 
          size="small" 
          color="primary" 
          variant="outlined"
        />
      );
    } else {
      // Новый формат с типом
      return (
        <Chip 
          key={`${community.type}-${community.value}`} 
          icon={community.type === 'id' ? <IdIcon /> : <DomainIcon />}
          label={community.value} 
          size="small" 
          color="primary" 
          variant="outlined"
        />
      );
    }
  };

  const loadFilterTemplates = async () => {
    try {
      const response = await axios.get('/api/filter-templates');
      setFilterTemplates(response.data);
    } catch (error) {
      console.error('Error loading filter templates:', error);
    }
  };

  const handleApplyFilterTemplate = (template) => {
    // Применяем настройки из шаблона к текущим фильтрам
    setFilters(prev => {
      const newFilters = { ...prev };
      
      // Применяем медиа-фильтры
      if (template.mediaFilters) {
        // Конвертируем медиа-фильтры в обычные фильтры интерфейса
        Object.entries(template.mediaFilters).forEach(([type, limits]) => {
          if (type === 'photos' && limits.min > 0) {
            newFilters.hasPhotos = true;
          }
          if (type === 'videos' && limits.min > 0) {
            newFilters.hasVideos = true;
          }
          if (type === 'documents' && limits.min > 0) {
            newFilters.hasDocuments = true;
          }
          if (type === 'audio' && limits.min > 0) {
            newFilters.hasAudio = true;
          }
        });
      }
      
      // Применяем другие фильтры
      if (template.skipExternalLinks) {
        newFilters.skipExternalLinks = true;
      }
      
      if (template.containsText) {
        newFilters.search = template.containsText;
      }
      
      return newFilters;
    });
    
    // Закрываем диалог
    setFilterTemplateDialogOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom component="h1">
          Управление задачами
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Создать задачу
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Название</TableCell>
              <TableCell>Сообщества</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Интервал (мин)</TableCell>
              <TableCell>Посл. запуск</TableCell>
              <TableCell>След. запуск</TableCell>
              <TableCell>Статистика</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TableRow key={task._id}>
                  <TableCell>{task.name}</TableCell>
                  <TableCell>
                    {task.communities && task.communities.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {task.communities.map((community, index) => (
                          getCommunityDisplay(community)
                        ))}
                      </Box>
                    ) : (
                      'Нет сообществ'
                    )}
                  </TableCell>
                  <TableCell>
                    {task.schedule.active ? (
                      <Chip 
                        icon={<ActiveIcon />} 
                        label="Активна" 
                        color="success" 
                        size="small"
                      />
                    ) : (
                      <Chip 
                        icon={<InactiveIcon />} 
                        label="Неактивна" 
                        color="error" 
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>{task.schedule.interval}</TableCell>
                  <TableCell>{formatDate(task.schedule.lastRun)}</TableCell>
                  <TableCell>{formatDate(task.schedule.nextRun)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      Всего: {task.statistics.totalPosts}
                    </Typography>
                    <Typography variant="body2">
                      Новых: {task.statistics.newPostsLastRun}
                    </Typography>
                    <Typography variant="body2">
                      Обновлено: {task.statistics.updatedPostsLastRun}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex' }}>
                      <Tooltip title="Редактировать">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleOpenDialog(task)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDeleteTask(task._id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Запустить сейчас">
                        <IconButton 
                          size="small" 
                          color="success"
                          onClick={() => handleRunTask(task._id)}
                        >
                          <RunIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={task.schedule.active ? "Остановить" : "Активировать"}>
                        <IconButton 
                          size="small" 
                          color={task.schedule.active ? "warning" : "success"}
                          onClick={() => handleToggleTask(task._id)}
                        >
                          {task.schedule.active ? <PauseIcon /> : <RunIcon />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Задачи не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{isEditMode ? 'Редактировать задачу' : 'Создать новую задачу'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Название задачи"
            type="text"
            fullWidth
            variant="outlined"
            value={currentTask.name}
            onChange={handleInputChange}
            sx={{ mb: 3 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Шаблоны фильтров</InputLabel>
            <Select
              multiple
              value={currentTask.filterTemplates || []}
              onChange={(e) => handleInputChange({ 
                target: { 
                  name: 'filterTemplates', 
                  value: e.target.value 
                } 
              })}
              label="Шаблоны фильтров"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((templateId) => {
                    const template = filterTemplates.find(t => t._id === templateId);
                    return (
                      <Chip 
                        key={templateId} 
                        label={template?.name || 'Unknown'} 
                        size="small" 
                      />
                    );
                  })}
                </Box>
              )}
            >
              {filterTemplates.map(template => (
                <MenuItem key={template._id} value={template._id}>
                  <Checkbox checked={(currentTask.filterTemplates || []).includes(template._id)} />
                  <ListItemText 
                    primary={template.name}
                    secondary={`Медиа фильтры: ${Object.entries(template.filters.mediaFilters)
                      .map(([type, filter]) => 
                        `${type} (${filter.min}-${filter.max || '∞'})`
                      ).join(', ')}`}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="subtitle1" gutterBottom>
            Сообщества
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <FormControl component="fieldset" sx={{ mb: 1 }}>
              <FormLabel component="legend">Тип идентификатора</FormLabel>
              <RadioGroup
                row
                name="communityType"
                value={communityType}
                onChange={handleCommunityTypeChange}
              >
                <FormControlLabel 
                  value="id" 
                  control={<Radio />} 
                  label="ID" 
                />
                <FormControlLabel 
                  value="domain" 
                  control={<Radio />} 
                  label="Домен" 
                />
              </RadioGroup>
            </FormControl>
          </Box>
          
          <Box sx={{ display: 'flex', mb: 2 }}>
            <TextField
              margin="dense"
              label={communityType === 'id' ? "ID сообщества" : "Домен сообщества"}
              type="text"
              fullWidth
              variant="outlined"
              value={communityInput}
              onChange={(e) => setCommunityInput(e.target.value)}
              placeholder={communityType === 'id' 
                ? "Например: 1234567 или -1234567" 
                : "Например: mygroup или publicsciencetop"}
            />
            <Button 
              variant="contained" 
              sx={{ ml: 1, mt: 1 }}
              onClick={handleAddCommunity}
            >
              Добавить
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
            {currentTask.communities.map((community, index) => (
              <Chip 
                key={index} 
                icon={community.type === 'id' ? <IdIcon /> : <DomainIcon />}
                label={`${community.value} (${community.type === 'id' ? 'ID' : 'Домен'})`}
                onDelete={() => handleRemoveCommunity(index)}
                color="primary"
              />
            ))}
          </Box>

          <Typography variant="subtitle1" gutterBottom>
            Настройки фильтрации
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <TextField
              margin="dense"
              name="filters.count"
              label="Количество постов"
              type="number"
              variant="outlined"
              value={currentTask.filters.count}
              onChange={handleInputChange}
              sx={{ width: '30%' }}
            />
            <TextField
              margin="dense"
              name="filters.offset"
              label="Смещение"
              type="number"
              variant="outlined"
              value={currentTask.filters.offset}
              onChange={handleInputChange}
              sx={{ width: '30%' }}
            />
            <TextField
              margin="dense"
              name="filters.filter"
              label="Фильтр постов"
              select
              SelectProps={{ native: true }}
              variant="outlined"
              value={currentTask.filters.filter}
              onChange={handleInputChange}
              sx={{ width: '30%' }}
            >
              <option value="all">Все посты</option>
              <option value="owner">Записи владельца</option>
              <option value="others">Записи других</option>
              <option value="postponed">Отложенные</option>
              <option value="suggests">Предложенные</option>
            </TextField>
          </Box>

          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={currentTask.filters.extended}
                  onChange={handleSwitchChange}
                  name="filters.extended"
                  color="primary"
                />
              }
              label="Расширенная информация"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={currentTask.filters.skipExternalLinks}
                  onChange={handleSwitchChange}
                  name="filters.skipExternalLinks"
                  color="primary"
                />
              }
              label="Пропускать посты с внешними ссылками"
            />
          </Box>

          <Typography variant="subtitle1" gutterBottom>
            Дополнительные фильтры
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <TextField
              margin="dense"
              name="filters.depth"
              label="Глубина выборки (часов)"
              type="number"
              variant="outlined"
              value={currentTask.filters.depth}
              onChange={handleInputChange}
              InputProps={{
                inputProps: { min: 1, max: 720 }
              }}
              helperText="От 1 до 720 часов (30 дней)"
              sx={{ width: '30%' }}
            />
            <TextField
              margin="dense"
              name="filters.containsText"
              label="Содержит текст"
              variant="outlined"
              value={currentTask.filters.containsText || ''}
              onChange={handleInputChange}
              sx={{ width: '30%' }}
            />
          </Box>

          <Typography variant="subtitle1" gutterBottom>
            Настройки расписания
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <TextField
              margin="dense"
              name="schedule.interval"
              label="Интервал (мин)"
              type="number"
              variant="outlined"
              value={currentTask.schedule.interval}
              onChange={handleInputChange}
              sx={{ width: '30%', mr: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={currentTask.schedule.active}
                  onChange={handleSwitchChange}
                  name="schedule.active"
                  color="primary"
                />
              }
              label="Активна"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button onClick={handleSaveTask} variant="contained" color="primary">
            {isEditMode ? 'Обновить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button 
          variant="outlined" 
          startIcon={<FilterListIcon />}
          onClick={() => setFilterTemplateDialogOpen(true)}
        >
          Применить шаблон фильтра
        </Button>
        <Button 
          variant="contained" 
          startIcon={<SearchIcon />}
          onClick={handleApplyFilters}
        >
          Применить фильтры
        </Button>
      </Box>

      {/* Диалог выбора шаблона фильтра */}
      <Dialog
        open={filterTemplateDialogOpen}
        onClose={() => setFilterTemplateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Выберите шаблон фильтра</DialogTitle>
        <DialogContent>
          <List>
            {filterTemplates.map(template => (
              <ListItem
                key={template._id}
                button
                onClick={() => handleApplyFilterTemplate(template)}
              >
                <ListItemText
                  primary={template.name}
                  secondary={
                    <React.Fragment>
                      {template.description && (
                        <Typography variant="body2" component="span">
                          {template.description}
                        </Typography>
                      )}
                      <Typography variant="caption" component="div">
                        {Object.entries(template.mediaFilters || {})
                          .filter(([_, filter]) => filter.min > 0 || filter.max === 0)
                          .map(([type, filter]) => 
                            `${type === 'photos' ? 'Фото' : 
                               type === 'videos' ? 'Видео' : 
                               type === 'documents' ? 'Документы' : 'Аудио'}: 
                            ${filter.min > 0 ? `мин. ${filter.min}` : ''}
                            ${filter.max === 0 ? 'точно 0' : 
                              filter.max > 0 ? `макс. ${filter.max}` : ''}`
                          ).join(', ')}
                        {template.skipExternalLinks ? ', без внешних ссылок' : ''}
                        {template.containsText ? `, содержит: "${template.containsText}"` : ''}
                      </Typography>
                    </React.Fragment>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterTemplateDialogOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TaskList;