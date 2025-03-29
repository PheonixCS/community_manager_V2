import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Paper, Box, Button, TextField, FormControl,
  InputLabel, Select, MenuItem, FormControlLabel, Switch, Grid,
  Chip, Divider, CircularProgress, Alert, AlertTitle, Snackbar, IconButton,
  Card, CardContent, CardHeader, CardMedia, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, ListItemIcon, Checkbox,
  RadioGroup, Radio, Accordion, AccordionSummary, AccordionDetails,
  InputAdornment, FormHelperText
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Add as AddIcon,
  Close as RemoveIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Search as SearchIcon,
  EditCalendar as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  TextFields as TextFieldsIcon,
  Image as ImageIcon,
  Tag as TagIcon,
  Link as LinkIcon,
  Create as CreateIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import axios from 'axios';
import taskService from '../../services/taskService';

// Простой парсер cron-выражений
const parseCronDescription = (cronExpression) => {
  try {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.split(' ');
    
    if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return 'Каждую минуту';
    }
    
    if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return 'Ежедневно в полночь';
    }
    
    if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Каждый час в ${minute} минут`;
    }
    
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Ежедневно в ${hour}:${minute}`;
    }
    
    return `Выражение cron: ${cronExpression}`;
  } catch (error) {
    return 'Некорректное выражение cron';
  }
};

// Форматирование даты для отображения
const formatDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Преобразование выбранных значений в CRON выражение
const generateCronExpression = (scheduleType, scheduleValues) => {
  switch (scheduleType) {
    case 'every_n_minutes':
      return `*/${scheduleValues.minutes} * * * *`;
    case 'hourly':
      return `${scheduleValues.minutesHourly} * * * *`;
    case 'daily':
      return `${scheduleValues.minutesDaily} ${scheduleValues.hoursDaily} * * *`;
    case 'specific_times':
      // Формируем CRON выражение для нескольких конкретных времен в течение дня
      const timesArray = scheduleValues.specificTimes || [];
      if (timesArray.length === 0) return '0 9 * * *'; // Значение по умолчанию
      
      const minutes = [...new Set(timesArray.map(time => time.minute))].join(',');
      const hours = [...new Set(timesArray.map(time => time.hour))].join(',');
      return `${minutes} ${hours} * * *`;
    case 'weekly':
      const daysOfWeek = scheduleValues.daysOfWeek.join(',');
      return `${scheduleValues.minutesWeekly} ${scheduleValues.hoursWeekly} * * ${daysOfWeek}`;
    case 'monthly':
      return `${scheduleValues.minutesMonthly} ${scheduleValues.hoursMonthly} ${scheduleValues.dayOfMonth} * *`;
    case 'custom':
      return scheduleValues.customExpression;
    default:
      return '0 9 * * *'; // Default: Daily at 9 AM
  }
};

const PublishTaskForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const [task, setTask] = useState({
    name: '',
    description: '',
    type: 'one_time',
    targetGroups: [],
    scrapingTasks: [],
    postsPerExecution: 1,
    minViewRate: 0,
    useContentGenerator: false,
    contentGeneratorSettings: {
      generatorId: '',
      params: {}
    },
    schedule: {
      cronExpression: '0 9 * * *',
      executionLimit: 0,
      active: true
    },
    oneTime: {
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      executed: false
    },
    publishOptions: {
      fromGroup: true,
      pinned: false,
      markedAsAds: false
    },
    // Добавляем настройки кастомизации постов
    postCustomization: {
      addText: {
        enabled: false,
        position: 'after',
        text: ''
      },
      addImage: {
        enabled: false,
        imageUrl: ''
      },
      addHashtags: {
        enabled: false,
        hashtags: ''
      },
      addSourceLink: {
        enabled: false,
        text: 'Источник: '
      },
      addSignature: {
        enabled: false,
        text: ''
      }
    }
  });
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [generators, setGenerators] = useState([]);
  const [selectedGenerator, setSelectedGenerator] = useState(null);
  const [cronDescription, setCronDescription] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Add the missing state variable for groups loading
  const [groupsLoading, setGroupsLoading] = useState(false);
  
  // Dialogs state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  
  // Available groups and scraping tasks
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availableScrapingTasks, setAvailableScrapingTasks] = useState([]);
  
  // State for CRON builder
  const [cronBuilderOpen, setCronBuilderOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState('daily');
  const [scheduleValues, setScheduleValues] = useState({
    minutes: 30,
    minutesHourly: '0',
    hoursDaily: '9',
    minutesDaily: '0',
    hoursWeekly: '9',
    minutesWeekly: '0',
    daysOfWeek: ['1'], // Monday by default
    hoursMonthly: '9',
    minutesMonthly: '0',
    dayOfMonth: '1',
    specificTimes: [{ hour: '9', minute: '0' }], // Значение по умолчанию для конкретных времен
    customExpression: '0 9 * * *'
  });
  
  // Для предпросмотра изображения
  const [imagePreview, setImagePreview] = useState(null);
  
  const fetchTask = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/publishing/tasks/${id}`);
      setTask(response.data);
    } catch (error) {
      console.error('Error fetching task:', error);
      showSnackbar('Ошибка при загрузке задачи', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]); // Add other dependencies if needed
  
  // Add the missing dependency
  const fetchGroups = useCallback(async () => {
    try {
      setGroupsLoading(true); // Now this will work
      
      // First try the primary endpoint
      const response = await axios.get('/api/settings/vk-groups');
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        setAvailableGroups(response.data);
        console.log('Fetched VK groups from settings:', response.data);
      } else {
        // If primary endpoint returns empty, try alternate endpoint
        console.log('Primary endpoint returned empty data, trying VK API endpoint');
        try {
          const altResponse = await axios.get('/api/vk/groups');
          
          if (altResponse.data && Array.isArray(altResponse.data) && altResponse.data.length > 0) {
            // Transform data if needed to match expected format
            const formattedGroups = altResponse.data.map(group => ({
              id: group.id.toString().startsWith('-') ? group.id.toString() : `-${group.id}`,
              name: group.name
            }));
            setAvailableGroups(formattedGroups);
            console.log('Fetched VK groups from VK API:', formattedGroups);
          } else {
            // If both endpoints fail, set fallback data
            console.warn('Both endpoints failed, using fallback data');
            // Add setFallbackGroups implementation directly here
            const fallbackGroups = [
              { id: '-123456789', name: 'Тестовая группа 1' },
              { id: '-987654321', name: 'Тестовая группа 2' }
            ];
            setAvailableGroups(fallbackGroups);
            showSnackbar('Не удалось загрузить список групп, используются тестовые данные', 'warning');
          }
        } catch (vkError) {
          console.error('Error fetching from VK API:', vkError);
          // Third attempt - try getting user's tokens and showing a helpful message
          try {
            const tokensResponse = await axios.get('/api/vk-auth/tokens');
            const hasActiveTokens = tokensResponse.data.some(token => token.isActive);
            
            if (!hasActiveTokens) {
              showSnackbar('Для получения списка групп необходимо авторизоваться в ВКонтакте. Перейдите в раздел "Авторизация ВКонтакте"', 'warning');
            }
          } catch (tokenError) {
            console.error('Error checking tokens:', tokenError);
          }
          
          // Add setFallbackGroups implementation directly here too
          const fallbackGroups = [
            { id: '-123456789', name: 'Тестовая группа 1' },
            { id: '-987654321', name: 'Тестовая группа 2' }
          ];
          setAvailableGroups(fallbackGroups);
          showSnackbar('Не удалось загрузить список групп, используются тестовые данные', 'warning');
        }
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      // Add setFallbackGroups implementation directly here as well
      const fallbackGroups = [
        { id: '-123456789', name: 'Тестовая группа 1' },
        { id: '-987654321', name: 'Тестовая группа 2' }
      ];
      setAvailableGroups(fallbackGroups);
      showSnackbar('Не удалось загрузить список групп, используются тестовые данные', 'warning');
    } finally {
      setGroupsLoading(false); // Now this will work
    }
  }, []); // Remove the setFallbackGroups dependency
  
  
  
  const fetchScrapingTasks = async () => {
    try {
      // Используем новый сервис для получения задач скрапинга
      const tasks = await taskService.getTasks();
      setAvailableScrapingTasks(tasks);
      console.log('Fetched scraping tasks:', tasks); // Для отладки
    } catch (error) {
      console.error('Error fetching scraping tasks:', error);
      setAvailableScrapingTasks([]);
    }
  };
  
  const fetchGenerators = async () => {
    try {
      const response = await axios.get('/api/publishing/generators');
      setGenerators(response.data);
    } catch (error) {
      console.error('Error fetching generators:', error);
      setGenerators([]);
    }
  };
  
  useEffect(() => {
    fetchGroups();
    if (isEditMode) {
      fetchTask();
    }
    
    // Call these functions to use them, or remove them if not needed
    fetchScrapingTasks();
    fetchGenerators();
  }, [fetchGroups, fetchTask, isEditMode]);
  
  // Update cron description when cron expression changes
  useEffect(() => {
    if (task.schedule?.cronExpression) {
      try {
        const description = parseCronDescription(task.schedule.cronExpression);
        setCronDescription(description);
      } catch (error) {
        setCronDescription('Некорректное выражение cron');
      }
    }
  }, [task.schedule?.cronExpression]);
  
  // Update selected generator when generatorId changes
  useEffect(() => {
    if (task.useContentGenerator && task.contentGeneratorSettings?.generatorId) {
      const generator = generators.find(g => g.id === task.contentGeneratorSettings.generatorId);
      setSelectedGenerator(generator);
      
      // Initialize params with default values if not set
      if (generator && (!task.contentGeneratorSettings.params || Object.keys(task.contentGeneratorSettings.params).length === 0)) {
        const initialParams = {};
        generator.params.forEach(param => {
          initialParams[param.name] = param.default !== undefined ? param.default : null;
        });
        
        handleTaskChange('contentGeneratorSettings', {
          ...task.contentGeneratorSettings,
          params: initialParams
        });
      }
    } else {
      setSelectedGenerator(null);
    }
  }, [task.contentGeneratorSettings, generators, task.useContentGenerator]); // Add missing dependency
  
  useEffect(() => {
    if (task.schedule && task.schedule.cronExpression) {
      setScheduleValues(prevValues => ({
        ...prevValues,
        // ...update based on task.schedule.cronExpression
      }));
    }
  }, [task.schedule, scheduleValues]); // Add missing dependencies
  
  // Эффект для инициализации предпросмотра изображения при загрузке формы
  useEffect(() => {
    if (task.postCustomization?.addImage?.imageUrl) {
      setImagePreview(task.postCustomization.addImage.imageUrl);
    }
  }, [task.postCustomization?.addImage?.imageUrl]);
  
  const handleTaskChange = (field, value) => {
    setTask(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleNestedChange = (parent, field, value) => {
    setTask(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };
  
  const handleParamChange = (paramName, value) => {
    setTask(prev => ({
      ...prev,
      contentGeneratorSettings: {
        ...prev.contentGeneratorSettings,
        params: {
          ...prev.contentGeneratorSettings.params,
          [paramName]: value
        }
      }
    }));
  };
  
  const handleAddGroup = (group) => {
    // Check if group is already added
    if (task.targetGroups.some(g => g.groupId === group.id)) {
      showSnackbar(`Группа "${group.name}" уже добавлена`, 'info');
      return;
    }
    
    // Make sure group ID has proper format (starting with '-' for community groups)
    const groupId = group.id.toString().startsWith('-') ? group.id.toString() : `-${group.id}`;
    
    const updatedGroups = [
      ...task.targetGroups,
      { groupId: groupId, name: group.name || groupId }
    ];
    
    handleTaskChange('targetGroups', updatedGroups);
    showSnackbar(`Группа "${group.name}" добавлена`, 'success');
  };
  
  const handleRemoveGroup = (index) => {
    const newGroups = [...task.targetGroups];
    newGroups.splice(index, 1);
    handleTaskChange('targetGroups', newGroups);
  };
  
  const handleScrapingTaskSelection = (taskId, checked) => {
    let newTasks = [...task.scrapingTasks];
    
    if (checked) {
      // Add task if not already added
      if (!newTasks.includes(taskId)) {
        newTasks.push(taskId);
      }
    } else {
      // Remove task
      newTasks = newTasks.filter(id => id !== taskId);
    }
    
    handleTaskChange('scrapingTasks', newTasks);
  };
  
  const handleSubmit = async () => {
    // Validate form
    if (!task.name) {
      showSnackbar('Пожалуйста, укажите название задачи', 'warning');
      return;
    }
    
    if (task.targetGroups.length === 0) {
      showSnackbar('Пожалуйста, добавьте хотя бы одну целевую группу', 'warning');
      return;
    }
    
    if (!task.useContentGenerator && task.scrapingTasks.length === 0) {
      showSnackbar('Пожалуйста, добавьте хотя бы одну задачу скрапинга или включите генератор контента', 'warning');
      return;
    }
    
    if (task.useContentGenerator && !task.contentGeneratorSettings.generatorId) {
      showSnackbar('Пожалуйста, выберите генератор контента', 'warning');
      return;
    }
    
    setSaving(true);
    
    try {
      if (isEditMode) {
        await axios.put(`/api/publishing/tasks/${id}`, task);
      } else {
        await axios.post('/api/publishing/tasks', task);
      }
      
      showSnackbar(
        isEditMode ? 'Задача успешно обновлена' : 'Задача успешно создана',
        'success'
      );
      
      setTimeout(() => {
        navigate('/posting/tasks');
      }, 1500);
    } catch (error) {
      console.error('Error saving task:', error);
      showSnackbar(`Ошибка при сохранении задачи: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
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
  
  const getScrapingTaskName = (taskId) => {
    const task = availableScrapingTasks.find(t => t._id === taskId);
    // Fix: Return string representation rather than the object itself
    return task ? task.name : (typeof taskId === 'string' ? taskId : String(taskId));
  };
  
  const getParamInput = (param) => {
    const currentValue = task.contentGeneratorSettings.params[param.name];
    
    switch (param.type) {
      case 'string':
      case 'text':
        return (
          <TextField
            fullWidth
            label={param.label || param.name}
            value={currentValue || ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            helperText={param.description}
            margin="normal"
            multiline={param.type === 'text'}
            rows={param.type === 'text' ? 3 : 1}
          />
        );
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={param.label || param.name}
            value={currentValue !== undefined ? currentValue : (param.default || 0)}
            onChange={(e) => handleParamChange(param.name, Number(e.target.value))}
            helperText={param.description}
            margin="normal"
            InputProps={{
              inputProps: { 
                min: param.min || 0,
                max: param.max || undefined,
                step: param.step || 1
              }
            }}
          />
        );
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={currentValue !== undefined ? currentValue : (param.default || false)}
                onChange={(e) => handleParamChange(param.name, e.target.checked)}
              />
            }
            label={param.label || param.description || param.name}
            sx={{ my: 2 }}
          />
        );
      case 'select':
        return (
          <FormControl fullWidth margin="normal">
            <InputLabel id={`select-label-${param.name}`}>{param.label || param.name}</InputLabel>
            <Select
              labelId={`select-label-${param.name}`}
              value={currentValue !== undefined ? currentValue : (param.default || '')}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
              label={param.label || param.name}
            >
              {param.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label || option.value}
                </MenuItem>
              ))}
            </Select>
            {param.description && (
              <FormHelperText>{param.description}</FormHelperText>
            )}
          </FormControl>
        );
      case 'multiselect':
        const selectedValues = Array.isArray(currentValue) 
          ? currentValue 
          : (currentValue ? [currentValue] : (param.default || []));
        
        // Check for dependent field - should this be shown?
        const dependentField = param.dependent;
        if (dependentField && task.contentGeneratorSettings.params) {
          const parentValue = task.contentGeneratorSettings.params[dependentField.param];
          if (!dependentField.values.includes(parentValue)) {
            return null; // Don't show this field if parent value doesn't match
          }
        }
        
        return (
          <FormControl fullWidth margin="normal">
            <InputLabel id={`multiselect-label-${param.name}`}>{param.label || param.name}</InputLabel>
            <Select
              labelId={`multiselect-label-${param.name}`}
              multiple
              value={selectedValues}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
              label={param.label || param.name}
              renderValue={(selected) => {
                // Map selected values to their labels
                const selectedLabels = selected.map(value => {
                  const option = param.options?.find(opt => opt.value === value);
                  return option ? option.label : value;
                });
                return selectedLabels.join(', ');
              }}
            >
              {param.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox checked={selectedValues.indexOf(option.value) > -1} />
                  <ListItemText primary={option.label || option.value} />
                </MenuItem>
              ))}
            </Select>
            {param.description && (
              <FormHelperText>{param.description}</FormHelperText>
            )}
          </FormControl>
        );
      default:
        return (
          <TextField
            fullWidth
            label={param.label || param.name}
            value={currentValue || ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            helperText={param.description}
            margin="normal"
          />
        );
    }
  };
  
  const handleScheduleTypeChange = (e) => {
    setScheduleType(e.target.value);
  };
  
  const handleScheduleValueChange = (field, value) => {
    setScheduleValues(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const applySchedule = () => {
    const cronExpression = generateCronExpression(scheduleType, scheduleValues);
    handleNestedChange('schedule', 'cronExpression', cronExpression);
    setCronBuilderOpen(false);
  };
  
  const handleAddSpecificTime = () => {
    setScheduleValues(prev => ({
      ...prev,
      specificTimes: [
        ...prev.specificTimes,
        { hour: '12', minute: '0' } // Значение по умолчанию для нового времени
      ]
    }));
  };
  
  const handleRemoveSpecificTime = (index) => {
    setScheduleValues(prev => ({
      ...prev,
      specificTimes: prev.specificTimes.filter((_, i) => i !== index)
    }));
  };
  
  const handleSpecificTimeChange = (index, field, value) => {
    setScheduleValues(prev => {
      const updatedTimes = [...prev.specificTimes];
      updatedTimes[index] = {
        ...updatedTimes[index],
        [field]: value
      };
      return {
        ...prev,
        specificTimes: updatedTimes
      };
    });
  };
  
  // Render CRON builder UI based on selected schedule type
  const renderCronBuilderFields = () => {
    switch (scheduleType) {
      case 'every_n_minutes':
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Интервал в минутах"
              type="number"
              value={scheduleValues.minutes}
              onChange={(e) => handleScheduleValueChange('minutes', e.target.value)}
              inputProps={{ min: 1, max: 59 }}
              fullWidth
              helperText="Запускать каждые N минут"
            />
          </Box>
        );
      
      case 'hourly':
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Минута часа"
              type="number"
              value={scheduleValues.minutesHourly}
              onChange={(e) => handleScheduleValueChange('minutesHourly', e.target.value)}
              inputProps={{ min: 0, max: 59 }}
              fullWidth
              helperText="Запускать в указанную минуту каждого часа"
            />
          </Box>
        );
      
      case 'daily':
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Час"
                  type="number"
                  value={scheduleValues.hoursDaily}
                  onChange={(e) => handleScheduleValueChange('hoursDaily', e.target.value)}
                  inputProps={{ min: 0, max: 23 }}
                  fullWidth
                  helperText="Час публикации (0-23)"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Минута"
                  type="number"
                  value={scheduleValues.minutesDaily}
                  onChange={(e) => handleScheduleValueChange('minutesDaily', e.target.value)}
                  inputProps={{ min: 0, max: 59 }}
                  fullWidth
                  helperText="Минута публикации (0-59)"
                />
              </Grid>
            </Grid>
          </Box>
        );
      
      case 'specific_times':
        return (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2">
                Конкретные времена публикации
              </Typography>
              <Button 
                startIcon={<AddIcon />} 
                size="small" 
                variant="outlined"
                onClick={handleAddSpecificTime}
              >
                Добавить время
              </Button>
            </Box>
            
            {scheduleValues.specificTimes.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Добавьте хотя бы одно время для публикации
              </Alert>
            ) : (
              <Box sx={{ mb: 2 }}>
                {scheduleValues.specificTimes.map((time, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      mb: 1,
                      p: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1
                    }}
                  >
                    <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                      <Grid item xs={5}>
                        <TextField
                          label="Час"
                          type="number"
                          size="small"
                          fullWidth
                          value={time.hour}
                          onChange={(e) => handleSpecificTimeChange(index, 'hour', e.target.value)}
                          inputProps={{ min: 0, max: 23 }}
                        />
                      </Grid>
                      <Grid item xs={5}>
                        <TextField
                          label="Минута"
                          type="number"
                          size="small"
                          fullWidth
                          value={time.minute}
                          onChange={(e) => handleSpecificTimeChange(index, 'minute', e.target.value)}
                          inputProps={{ min: 0, max: 59 }}
                        />
                      </Grid>
                    </Grid>
                    <IconButton 
                      color="error" 
                      onClick={() => handleRemoveSpecificTime(index)}
                      sx={{ ml: 1 }}
                      disabled={scheduleValues.specificTimes.length === 1}
                    >
                      <RemoveIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              Задача будет выполняться ежедневно в указанные часы и минуты
            </Typography>
          </Box>
        );
      
      case 'weekly':
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Час"
                  type="number"
                  value={scheduleValues.hoursWeekly}
                  onChange={(e) => handleScheduleValueChange('hoursWeekly', e.target.value)}
                  inputProps={{ min: 0, max: 23 }}
                  fullWidth
                  helperText="Час публикации (0-23)"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Минута"
                  type="number"
                  value={scheduleValues.minutesWeekly}
                  onChange={(e) => handleScheduleValueChange('minutesWeekly', e.target.value)}
                  inputProps={{ min: 0, max: 59 }}
                  fullWidth
                  helperText="Минута публикации (0-59)"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Дни недели</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[
                    { value: '1', label: 'Понедельник' },
                    { value: '2', label: 'Вторник' },
                    { value: '3', label: 'Среда' },
                    { value: '4', label: 'Четверг' },
                    { value: '5', label: 'Пятница' },
                    { value: '6', label: 'Суббота' },
                    { value: '0', label: 'Воскресенье' }
                  ].map((day) => (
                    <FormControlLabel
                      key={day.value}
                      control={
                        <Checkbox
                          checked={scheduleValues.daysOfWeek.includes(day.value)}
                          onChange={(e) => {
                            const updatedDays = e.target.checked
                              ? [...scheduleValues.daysOfWeek, day.value]
                              : scheduleValues.daysOfWeek.filter(d => d !== day.value);
                            handleScheduleValueChange('daysOfWeek', updatedDays);
                          }}
                        />
                      }
                      label={day.label}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        );
      
      case 'monthly':
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  label="День месяца"
                  type="number"
                  value={scheduleValues.dayOfMonth}
                  onChange={(e) => handleScheduleValueChange('dayOfMonth', e.target.value)}
                  inputProps={{ min: 1, max: 31 }}
                  fullWidth
                  helperText="День месяца (1-31)"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Час"
                  type="number"
                  value={scheduleValues.hoursMonthly}
                  onChange={(e) => handleScheduleValueChange('hoursMonthly', e.target.value)}
                  inputProps={{ min: 0, max: 23 }}
                  fullWidth
                  helperText="Час (0-23)"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Минута"
                  type="number"
                  value={scheduleValues.minutesMonthly}
                  onChange={(e) => handleScheduleValueChange('minutesMonthly', e.target.value)}
                  inputProps={{ min: 0, max: 59 }}
                  fullWidth
                  helperText="Минута (0-59)"
                />
              </Grid>
            </Grid>
          </Box>
        );
      
      case 'custom':
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              label="CRON-выражение"
              value={scheduleValues.customExpression}
              onChange={(e) => handleScheduleValueChange('customExpression', e.target.value)}
              fullWidth
              helperText="Произвольное CRON-выражение (для продвинутых пользователей)"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Формат: минуты часы день-месяца месяц день-недели
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Пример: "0 9 * * 1-5" (По будням в 9:00)
            </Typography>
          </Box>
        );
      
      default:
        return null;
    }
  };
  
  // Для загрузки изображения
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setSnackbar({
        open: true,
        message: 'Загрузка изображения...',
        severity: 'info'
      });
      
      // Создаем FormData для загрузки файла
      const formData = new FormData();
      formData.append('file', file);
      
      // Отправляем запрос на загрузку
      const response = await axios.post('/api/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data && response.data.url) {
        // Обновляем URL изображения в настройках
        handleNestedCustomizationChange('addImage', 'imageUrl', response.data.url);
        setImagePreview(response.data.url);
        
        showSnackbar('Изображение успешно загружено', 'success');
      } else {
        showSnackbar('Ошибка при загрузке изображения: неверный ответ сервера', 'error');
      }
    } catch (error) {
      console.error('Ошибка при загрузке изображения:', error);
      showSnackbar(`Ошибка при загрузке изображения: ${error.message}`, 'error');
    }
  };
  
  // Обработчик изменения настроек кастомизации
  const handleNestedCustomizationChange = (field, subfield, value) => {
    setTask(prev => ({
      ...prev,
      postCustomization: {
        ...prev.postCustomization,
        [field]: {
          ...prev.postCustomization[field],
          [subfield]: value
        }
      }
    }));
  };
  
  // Обработчик переключения включения/выключения опций кастомизации
  const handleToggleCustomization = (field, value) => {
    handleNestedCustomizationChange(field, 'enabled', value);
  };
  
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom component="h1">
          {isEditMode ? 'Редактирование задачи' : 'Новая задача публикации'}
        </Typography>
        <Button 
          variant="outlined" 
          startIcon={<BackIcon />}
          onClick={() => navigate('/posting/tasks')}
        >
          Вернуться к списку
        </Button>
      </Box>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Основная информация
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Название задачи"
              value={task.name}
              onChange={(e) => handleTaskChange('name', e.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Тип задачи</InputLabel>
              <Select
                value={task.type}
                onChange={(e) => handleTaskChange('type', e.target.value)}
                label="Тип задачи"
              >
                <MenuItem value="one_time">Разовая публикация</MenuItem>
                <MenuItem value="schedule">Публикация по расписанию</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Описание задачи"
              value={task.description}
              onChange={(e) => handleTaskChange('description', e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Целевые группы
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setGroupDialogOpen(true)}
            variant="outlined"
          >
            Добавить группу
          </Button>
        </Box>
        
        {task.targetGroups.length === 0 ? (
          <Alert severity="info">
            Не выбрано ни одной целевой группы. Добавьте группу для публикации.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {task.targetGroups.map((group, index) => (
              <Chip
                key={index}
                label={group.name || group.groupId}
                onDelete={() => handleRemoveGroup(index)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Настройка источника контента
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={task.useContentGenerator}
              onChange={(e) => handleTaskChange('useContentGenerator', e.target.checked)}
            />
          }
          label="Использовать генератор контента"
        />
        
        {task.useContentGenerator ? (
          // Content generator section
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Выберите генератор контента</InputLabel>
              <Select
                value={task.contentGeneratorSettings?.generatorId || ''}
                onChange={(e) => handleNestedChange('contentGeneratorSettings', 'generatorId', e.target.value)}
                label="Выберите генератор контента"
              >
                <MenuItem value="">
                  <em>Выберите генератор</em>
                </MenuItem>
                {generators.map((generator) => (
                  <MenuItem key={generator.id} value={generator.id}>
                    {generator.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedGenerator && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {selectedGenerator.name}
                  </Typography>
                  {selectedGenerator.description && (
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {selectedGenerator.description}
                    </Typography>
                  )}
                  <Divider sx={{ my: 2 }} />

                  {/* Специальные элементы интерфейса для генератора гороскопов */}
                  {selectedGenerator.id === 'horoscope' && (
                    <Box sx={{ mb: 3 }}>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <AlertTitle>Генератор гороскопов</AlertTitle>
                        Этот генератор создаёт гороскопы на завтра для выбранных знаков зодиака, получая данные с сайта horo.mail.ru
                      </Alert>
                      
                      <Card variant="outlined" sx={{ mb: 2 }}>
                        <CardHeader 
                          avatar={<CalendarIcon color="primary" />}
                          title="Настройка контента"
                          subheader="Выберите знаки зодиака и формат публикации"
                        />
                        <Divider />
                        <CardContent>
                          {/* Параметры для генератора гороскопов будут отображаться здесь */}
                          <Grid container spacing={2}>
                            {selectedGenerator.params
                              .filter(param => !param.dependent || 
                                (param.dependent && 
                                 task.contentGeneratorSettings.params && 
                                 param.dependent.values.includes(task.contentGeneratorSettings.params[param.dependent.param])))
                              .map((param) => (
                                <Grid item xs={12} sm={param.type === 'boolean' ? 6 : 12} key={param.name}>
                                  {getParamInput(param)}
                                </Grid>
                            ))}
                          </Grid>

                          {task.contentGeneratorSettings?.params?.imageType === 'image' && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                              <AlertTitle>Для работы с изображениями</AlertTitle>
                              <Typography variant="body2">
                                Добавьте шрифты и картинки в папку server/resources:
                              </Typography>
                              <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                <li>fonts/bebas_neue_ru.ttf - для заголовков</li>
                                <li>fonts/museo_cyrl.otf - для текста</li>
                                <li>fonts/Roboto.ttf - для нумерации</li>
                                <li>main.png - фоновое изображение</li>
                              </ul>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>

                      <Card variant="outlined">
                        <CardHeader 
                          avatar={<TextFieldsIcon color="primary" />}
                          title="Пример вывода"
                          subheader="Так будет выглядеть публикация"
                        />
                        <Divider />
                        <CardContent>
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                            {task.contentGeneratorSettings?.params?.addHeader && 
                              task.contentGeneratorSettings?.params?.header && 
                              `${task.contentGeneratorSettings.params.header}\n\n`}
                            
                            {/* Для режима "один знак зодиака" */}
                            {task.contentGeneratorSettings?.params?.signSelection === 'single' &&
                              task.contentGeneratorSettings?.params?.signs &&
                              task.contentGeneratorSettings?.params?.signs.length > 0 && (
                                (() => {
                                  const today = new Date();
                                  const dateString = today.toLocaleDateString();
                                  const signValue = task.contentGeneratorSettings.params.signs[0];
                                  const signOption = selectedGenerator?.params.find(p => p.name === 'signs')?.options.find(
                                    opt => opt.value === signValue
                                  );
                                  const signLabel = signOption?.label || 'Знак зодиака';
                                  
                                  // Используем правильные эмодзи для знаков зодиака
                                  const zodiacEmojis = {
                                    ARIES: '♈️',
                                    TAURUS: '♉️',
                                    GEMINI: '♊️',
                                    CANCER: '♋️',
                                    LEO: '♌️',
                                    VIRGO: '♍️',
                                    LIBRA: '♎️',
                                    SCORPIO: '♏️',
                                    SAGITTARIUS: '♐️',
                                    CAPRICORN: '♑️',
                                    AQUARIUS: '♒️',
                                    PISCES: '♓️'
                                  };
                                  
                                  const emoji = zodiacEmojis[signValue] || '';
                                  const currentDate = today.getDate();
                                  const monthNames = [
                                    'ЯНВАРЯ', 'ФЕВРАЛЯ', 'МАРТА', 'АПРЕЛЯ', 'МАЯ', 'ИЮНЯ',
                                    'ИЮЛЯ', 'АВГУСТА', 'СЕНТЯБРЯ', 'ОКТЯБРЯ', 'НОЯБРЯ', 'ДЕКАБРЯ'
                                  ];
                                  const month = monthNames[today.getMonth()];
                                  
                                  // Форматируем в точности как на бэкенде
                                  return `ГОРОСКОП НА ${currentDate} ${month} ${emoji}\n\n${signLabel}: Текст гороскопа для выбранного знака зодиака...\n\n`;
                                })()
                              )
                            }
                            
                            {/* Для режима "все знаки зодиака" */}
                            {task.contentGeneratorSettings?.params?.signSelection === 'all' &&
                              (() => {
                                const today = new Date();
                                const currentDate = today.getDate();
                                const monthNames = [
                                  'ЯНВАРЯ', 'ФЕВРАЛЯ', 'МАРТА', 'АПРЕЛЯ', 'МАЯ', 'ИЮНЯ',
                                  'ИЮЛЯ', 'АВГУСТА', 'СЕНТЯБРЯ', 'ОКТЯБРЯ', 'НОЯБРЯ', 'ДЕКАБРЯ'
                                ];
                                const month = monthNames[today.getMonth()];
                                
                                // Здесь показываем пример для первых двух знаков
                                return (
                                  `ГОРОСКОП НА ${currentDate} ${month} ♈️\n\n` +
                                  `Овен: Текст гороскопа для Овна...\n\n` +
                                  `ГОРОСКОП НА ${currentDate} ${month} ♉️\n\n` +
                                  `Телец: Текст гороскопа для Тельца...\n\n` +
                                  `[... остальные знаки зодиака ...]`
                                );
                              })()
                            }
                            
                            {task.contentGeneratorSettings?.params?.addFooter && 
                              task.contentGeneratorSettings?.params?.footer && 
                              `\n\n${task.contentGeneratorSettings.params.footer}`}
                          </Typography>

                          {task.contentGeneratorSettings?.params?.imageType === 'image' && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                              <Card sx={{ maxWidth: 300 }}>
                                <CardMedia
                                  component="img"
                                  height="300"
                                  image="/horoscope-example.png"
                                  alt="Пример изображения гороскопа"
                                  onError={(e) => {
                                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%231e3b70"/><text x="150" y="150" font-family="Arial" font-size="20" fill="white" text-anchor="middle">Пример изображения гороскопа</text></svg>';
                                  }}
                                />
                                <CardContent>
                                  <Typography variant="caption" color="text.secondary">
                                    Изображение гороскопа будет сгенерировано для каждого знака зодиака
                                    {task.contentGeneratorSettings?.params?.carouselMode ? ' и опубликовано в виде карусели' : ''}
                                  </Typography>
                                </CardContent>
                              </Card>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                  )}

                  {/* Стандартное отображение параметров для других генераторов */}
                  {selectedGenerator.id !== 'horoscope' && (
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Параметры генератора
                      </Typography>
                      {selectedGenerator.params.map((param) => (
                        <Box key={param.name}>
                          {getParamInput(param)}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Paper>
            )}
          </Box>
        ) : (
          // Scraping tasks section
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Задачи скрапинга (источники постов)
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setTaskDialogOpen(true)}
                variant="outlined"
                size="small"
              >
                Добавить задачу
              </Button>
            </Box>
            
            {task.scrapingTasks.length === 0 ? (
              <Alert severity="info">
                Не выбрано ни одной задачи скрапинга. Добавьте хотя бы одну задачу как источник постов.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {task.scrapingTasks.map((taskId, index) => (
                  <Chip
                    key={index}
                    label={getScrapingTaskName(taskId)}
                    onDelete={() => handleScrapingTaskSelection(taskId, false)}
                    color="secondary"
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Фильтрация постов
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Минимальный рейтинг просмотров"
                    type="number"
                    value={task.minViewRate}
                    onChange={(e) => handleTaskChange('minViewRate', Number(e.target.value))}
                    fullWidth
                    helperText="Посты с рейтингом ниже указанного не будут публиковаться"
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Макс. количество постов за публикацию"
                    type="number"
                    value={task.postsPerExecution}
                    onChange={(e) => handleTaskChange('postsPerExecution', Number(e.target.value))}
                    fullWidth
                    helperText="Сколько лучших постов публиковать за один запуск задачи"
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>
        )}
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Настройки расписания
        </Typography>
        
        {task.type === 'schedule' ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="Cron-выражение"
                  value={task.schedule.cronExpression}
                  onChange={(e) => handleNestedChange('schedule', 'cronExpression', e.target.value)}
                  fullWidth
                  helperText={cronDescription || 'Введите валидное cron-выражение'}
                  error={cronDescription === 'Некорректное выражение cron'}
                />
                <Button 
                  variant="outlined"
                  onClick={() => setCronBuilderOpen(true)}
                  startIcon={<CalendarIcon />}
                  sx={{ mt: 1 }}
                >
                  Редактор
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Ограничение выполнений"
                type="number"
                value={task.schedule.executionLimit}
                onChange={(e) => handleNestedChange('schedule', 'executionLimit', Number(e.target.value))}
                fullWidth
                helperText="0 = без ограничений, >0 = ограничение количества запусков"
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={task.schedule.active}
                    onChange={(e) => handleNestedChange('schedule', 'active', e.target.checked)}
                  />
                }
                label="Задача активна"
              />
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Дата и время публикации"
                type="datetime-local"
                value={formatDate(task.oneTime.scheduledAt)}
                onChange={(e) => {
                  handleNestedChange('oneTime', 'scheduledAt', new Date(e.target.value));
                }}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        )}
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Настройки публикации
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={task.publishOptions.fromGroup}
                  onChange={(e) => handleNestedChange('publishOptions', 'fromGroup', e.target.checked)}
                />
              }
              label="Публиковать от имени группы"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={task.publishOptions.pinned}
                  onChange={(e) => handleNestedChange('publishOptions', 'pinned', e.target.checked)}
                />
              }
              label="Закрепить пост"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={task.publishOptions.markedAsAds}
                  onChange={(e) => handleNestedChange('publishOptions', 'markedAsAds', e.target.checked)}
                />
              }
              label="Пометить как рекламу"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={task.publishOptions.removeHashtags || false}
                  onChange={(e) => handleNestedChange('publishOptions', 'removeHashtags', e.target.checked)}
                />
              }
              label="Удалить все хештеги из текста поста"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={task.publishOptions.transliterate || false}
                  onChange={(e) => handleNestedChange('publishOptions', 'transliterate', e.target.checked)}
                />
              }
              label="Транслитерация (русские символы → английские)"
            />
          </Grid>
        </Grid>
      </Paper>
      
      {/* Новая секция для кастомизации постов */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
            Кастомизация постов
          </Typography>
        </Box>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          Настройки кастомизации влияют на все посты, опубликованные через эту задачу. Вы можете добавить текст,
          изображение, хэштеги и другие элементы к каждому публикуемому посту.
        </Alert>
        
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextFieldsIcon sx={{ mr: 1, color: task.postCustomization.addText.enabled ? 'primary.main' : 'text.secondary' }} />
              <Typography>
                Добавить текст к посту
                {task.postCustomization.addText.enabled && (
                  <Chip size="small" color="primary" variant="outlined" label="Включено" sx={{ ml: 1 }} />
                )}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={task.postCustomization.addText.enabled}
                  onChange={(e) => handleToggleCustomization('addText', e.target.checked)}
                />
              }
              label="Включить добавление текста"
            />
            
            {task.postCustomization.addText.enabled && (
              <Box sx={{ mt: 2 }}>
                <FormControl component="fieldset" sx={{ mb: 2 }}>
                  <RadioGroup
                    row
                    value={task.postCustomization.addText.position}
                    onChange={(e) => handleNestedCustomizationChange('addText', 'position', e.target.value)}
                  >
                    <FormControlLabel value="before" control={<Radio />} label="В начале поста" />
                    <FormControlLabel value="after" control={<Radio />} label="В конце поста" />
                  </RadioGroup>
                </FormControl>
                
                <TextField
                  label="Текст для добавления"
                  multiline
                  rows={4}
                  value={task.postCustomization.addText.text}
                  onChange={(e) => handleNestedCustomizationChange('addText', 'text', e.target.value)}
                  fullWidth
                  placeholder="Введите текст, который будет добавлен к каждому посту"
                />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
        
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ImageIcon sx={{ mr: 1, color: task.postCustomization.addImage.enabled ? 'primary.main' : 'text.secondary' }} />
              <Typography>
                Добавить изображение
                {task.postCustomization.addImage.enabled && (
                  <Chip size="small" color="primary" variant="outlined" label="Включено" sx={{ ml: 1 }} />
                )}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={task.postCustomization.addImage.enabled}
                  onChange={(e) => handleToggleCustomization('addImage', e.target.checked)}
                />
              }
              label="Включить добавление изображения"
            />
            
            {task.postCustomization.addImage.enabled && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="URL изображения"
                      value={task.postCustomization.addImage.imageUrl}
                      onChange={(e) => handleNestedCustomizationChange('addImage', 'imageUrl', e.target.value)}
                      fullWidth
                      placeholder="Введите URL изображения или загрузите его"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <input
                              accept="image/*"
                              id="icon-button-file"
                              type="file"
                              style={{ display: 'none' }}
                              onChange={handleImageUpload}
                            />
                            <label htmlFor="icon-button-file">
                              <IconButton color="primary" component="span">
                                <AddIcon />
                              </IconButton>
                            </label>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Вы можете ввести URL изображения или загрузить файл
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    {imagePreview && (
                      <Box sx={{ mt: 1, textAlign: 'center' }}>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }}
                        />
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
        
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TagIcon sx={{ mr: 1, color: task.postCustomization.addHashtags.enabled ? 'primary.main' : 'text.secondary' }} />
              <Typography>
                Добавить хэштеги
                {task.postCustomization.addHashtags.enabled && (
                  <Chip size="small" color="primary" variant="outlined" label="Включено" sx={{ ml: 1 }} />
                )}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={task.postCustomization.addHashtags.enabled}
                  onChange={(e) => handleToggleCustomization('addHashtags', e.target.checked)}
                />
              }
              label="Включить добавление хэштегов"
            />
            
            {task.postCustomization.addHashtags.enabled && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Хэштеги"
                  value={task.postCustomization.addHashtags.hashtags}
                  onChange={(e) => handleNestedCustomizationChange('addHashtags', 'hashtags', e.target.value)}
                  fullWidth
                  placeholder="Введите хэштеги через пробел или запятую (например: тренд новости интересно)"
                  helperText="Символ # будет добавлен автоматически, если его нет"
                />
                
                {task.postCustomization.addHashtags.hashtags && (
                  <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {task.postCustomization.addHashtags.hashtags
                      .split(/[\s,]+/)
                      .filter(tag => tag.length > 0)
                      .map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag.startsWith('#') ? tag : `#${tag}`}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      ))}
                  </Box>
                )}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
        
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LinkIcon sx={{ mr: 1, color: task.postCustomization.addSourceLink.enabled ? 'primary.main' : 'text.secondary' }} />
              <Typography>
                Добавить ссылку на источник
                {task.postCustomization.addSourceLink.enabled && (
                  <Chip size="small" color="primary" variant="outlined" label="Включено" sx={{ ml: 1 }} />
                )}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={task.postCustomization.addSourceLink.enabled}
                  onChange={(e) => handleToggleCustomization('addSourceLink', e.target.checked)}
                />
              }
              label="Включить добавление ссылки на источник"
            />
            
            {task.postCustomization.addSourceLink.enabled && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Текст перед ссылкой"
                  value={task.postCustomization.addSourceLink.text}
                  onChange={(e) => handleNestedCustomizationChange('addSourceLink', 'text', e.target.value)}
                  fullWidth
                  placeholder="Например: Источник:"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Ссылка на оригинальный пост будет добавлена автоматически после этого текста
                </Typography>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
        
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CreateIcon sx={{ mr: 1, color: task.postCustomization.addSignature.enabled ? 'primary.main' : 'text.secondary' }} />
              <Typography>
                Добавить подпись
                {task.postCustomization.addSignature.enabled && (
                  <Chip size="small" color="primary" variant="outlined" label="Включено" sx={{ ml: 1 }} />
                )}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={task.postCustomization.addSignature.enabled}
                  onChange={(e) => handleToggleCustomization('addSignature', e.target.checked)}
                />
              }
              label="Включить добавление подписи"
            />
            
            {task.postCustomization.addSignature.enabled && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Текст подписи"
                  value={task.postCustomization.addSignature.text}
                  onChange={(e) => handleNestedCustomizationChange('addSignature', 'text', e.target.value)}
                  fullWidth
                  placeholder="Например: С уважением, команда проекта"
                  helperText="Этот текст будет добавлен в самом конце поста"
                />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={saving ? <CircularProgress size={24} /> : <SaveIcon />}
          onClick={handleSubmit}
          disabled={saving}
          size="large"
        >
          {isEditMode ? 'Сохранить изменения' : 'Создать задачу'}
        </Button>
      </Box>
      
      {/* Dialog for adding target groups */}
      <Dialog 
        open={groupDialogOpen} 
        onClose={() => setGroupDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Добавить целевую группу</Typography>
            <IconButton onClick={() => setGroupDialogOpen(false)} size="small">
              <RemoveIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {groupsLoading ? ( // Use groupsLoading here for consistency
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography>Загрузка списка групп...</Typography>
            </Box>
          ) : availableGroups.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
              <Typography>Нет доступных групп</Typography>
            </Box>
          ) : (
            <Box sx={{ my: 1 }}>
              <TextField
                placeholder="Поиск по группам..."
                fullWidth
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ mb: 2 }}
                onChange={(e) => {
                  // Implement local search filter if needed
                  // This is a placeholder for future enhancement
                }}
              />
              <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                {availableGroups.map((group) => {
                  const isAlreadyAdded = task.targetGroups.some(g => g.groupId === group.id);
                  
                  return (
                    <ListItem
                      key={group.id}
                      button
                      onClick={() => {
                        if (!isAlreadyAdded) {
                          handleAddGroup(group);
                          // Keep the dialog open to allow multiple selections
                        }
                      }}
                      disabled={isAlreadyAdded}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        bgcolor: isAlreadyAdded ? 'action.selected' : 'background.paper',
                        '&:hover': {
                          bgcolor: isAlreadyAdded ? 'action.selected' : 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon>
                        <GroupIcon color={isAlreadyAdded ? "disabled" : "primary"} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Box component="span" sx={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            color: isAlreadyAdded ? 'text.disabled' : 'text.primary' 
                          }}>
                            {group.name || group.id}
                            {isAlreadyAdded && (
                              <Chip 
                                size="small" 
                                label="Добавлена" 
                                color="primary" 
                                variant="outlined"
                                sx={{ ml: 1, height: 20 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={`ID: ${group.id}`}
                        primaryTypographyProps={{
                          variant: 'subtitle2',
                          fontWeight: isAlreadyAdded ? 'normal' : 'medium'
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setGroupDialogOpen(false);
              // Refresh groups list when dialog is reopened
              if (availableGroups.length <= 2) {
                fetchGroups();
              }
            }}
            variant="contained"
          >
            Готово
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog for adding scraping tasks */}
      <Dialog 
        open={taskDialogOpen} 
        onClose={() => setTaskDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Добавить задачи скрапинга</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Доступные задачи скрапинга
            </Typography>
            {/* Добавление индикатора загрузки задач скрапинга */}
            {availableScrapingTasks.length === 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            <List>
              {availableScrapingTasks.length > 0 ? (
                availableScrapingTasks.map((scrapingTask) => (
                  <ListItem key={scrapingTask._id}>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={task.scrapingTasks.includes(scrapingTask._id)}
                        onChange={(e) => handleScrapingTaskSelection(scrapingTask._id, e.target.checked)}
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={scrapingTask.name} 
                      secondary={`ID: ${scrapingTask._id}`} 
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="Нет доступных задач скрапинга" />
                </ListItem>
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)}>Готово</Button>
        </DialogActions>
      </Dialog>
      
      {/* CRON Builder Dialog */}
      <Dialog 
        open={cronBuilderOpen} 
        onClose={() => setCronBuilderOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Визуальный редактор расписания
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3, mt: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Тип расписания
            </Typography>
            <RadioGroup
              value={scheduleType}
              onChange={handleScheduleTypeChange}
            >
              <FormControlLabel value="every_n_minutes" control={<Radio />} label="Каждые N минут" />
              <FormControlLabel value="hourly" control={<Radio />} label="Ежечасно" />
              <FormControlLabel value="daily" control={<Radio />} label="Ежедневно (одно время)" />
              <FormControlLabel value="specific_times" control={<Radio />} label="Ежедневно в определенные часы" />
              <FormControlLabel value="weekly" control={<Radio />} label="Еженедельно" />
              <FormControlLabel value="monthly" control={<Radio />} label="Ежемесячно" />
              <FormControlLabel value="custom" control={<Radio />} label="Произвольное выражение" />
            </RadioGroup>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {renderCronBuilderFields()}
          
          <Box sx={{ mt: 3 }}>
            <Alert severity="info">
              <Typography variant="body2">
                {generateCronExpression(scheduleType, scheduleValues)} - {parseCronDescription(generateCronExpression(scheduleType, scheduleValues))}
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCronBuilderOpen(false)}>Отмена</Button>
          <Button 
            onClick={applySchedule} 
            variant="contained" 
            color="primary"
            startIcon={<ScheduleIcon />}
          >
            Применить расписание
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

export default PublishTaskForm;
