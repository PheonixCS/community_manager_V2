import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Paper, Grid, Button,
  TextField, Card, CardContent, CardActions,
  Divider, Box, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar, FormControlLabel, Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import axios from 'axios';

const FilterTemplatesPanel = () => {
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/api/filter-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      showSnackbar('Ошибка при загрузке шаблонов', 'error');
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate({
      name: '',
      description: '',
      skipExternalLinks: false,
      containsText: '',
      mediaFilters: {
        photos: { min: 0, max: -1 },
        videos: { min: 0, max: -1 },
        documents: { min: 0, max: -1 },
        audio: { min: 0, max: -1 }
      }
    });
    setDialogOpen(true);
  };

  const handleEditTemplate = (template) => {
    // Убедимся, что у шаблона есть все необходимые поля
    const templateToEdit = {
      ...template,
      mediaFilters: template.mediaFilters || {
        photos: { min: 0, max: -1 },
        videos: { min: 0, max: -1 },
        documents: { min: 0, max: -1 },
        audio: { min: 0, max: -1 }
      },
      skipExternalLinks: template.skipExternalLinks || false,
      containsText: template.containsText || ''
    };
    
    setEditingTemplate(templateToEdit);
    setDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      // Обеспечиваем числовой формат для min и max в mediaFilters
      const preparedTemplate = {
        ...editingTemplate,
        mediaFilters: Object.entries(editingTemplate.mediaFilters).reduce((acc, [type, filter]) => {
          return {
            ...acc,
            [type]: {
              min: Number(filter.min),
              max: filter.max === '' ? -1 : Number(filter.max)
            }
          };
        }, {})
      };
      
      if (editingTemplate._id) {
        await axios.put(`/api/filter-templates/${editingTemplate._id}`, preparedTemplate);
      } else {
        await axios.post('/api/filter-templates', preparedTemplate);
      }
      fetchTemplates();
      setDialogOpen(false);
      showSnackbar('Шаблон успешно сохранен', 'success');
    } catch (error) {
      console.error('Error saving template:', error);
      showSnackbar('Ошибка при сохранении шаблона', 'error');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот шаблон?')) {
      try {
        await axios.delete(`/api/filter-templates/${templateId}`);
        fetchTemplates();
        showSnackbar('Шаблон успешно удален', 'success');
      } catch (error) {
        console.error('Error deleting template:', error);
        showSnackbar('Ошибка при удалении шаблона', 'error');
      }
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const formatMaxValue = (value) => {
    if (value === -1 || value === null || value === undefined) return 'Не ограничено';
    return value.toString();
  };

  const handleMediaFilterChange = (mediaType, limitType) => (event) => {
    let value = event.target.value === '' ? -1 : parseInt(event.target.value, 10);
    
    // Для максимального значения:
    // - пустая строка = -1 (неограничено)
    // - 0 воспринимается как 0 (точное значение)
    // - значение меньше -1 = -1
    if (limitType === 'max') {
      if (isNaN(value)) {
        value = -1;
      } else if (value < -1) {
        value = -1;
      }
      // Теперь 0 сохраняется как 0
    }
    
    // Для минимального значения:
    if (limitType === 'min') {
      if (isNaN(value) || value < 0) {
        value = 0;
      }
    }
    
    setEditingTemplate(prev => ({
      ...prev,
      mediaFilters: {
        ...prev.mediaFilters,
        [mediaType]: {
          ...prev.mediaFilters[mediaType],
          [limitType]: value
        }
      }
    }));
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Управление шаблонами фильтров
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTemplate}
        >
          Создать шаблон
        </Button>
      </Box>

      <Grid container spacing={3}>
        {templates.map(template => (
          <Grid item xs={12} sm={6} md={4} key={template._id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {template.name}
                </Typography>
                {template.description && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {template.description}
                  </Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Фильтры медиа:
                </Typography>
                {template.mediaFilters && Object.entries(template.mediaFilters).map(([type, limits]) => (
                  <Typography variant="body2" key={type}>
                    {type === 'photos' ? 'Фото' : 
                     type === 'videos' ? 'Видео' : 
                     type === 'documents' ? 'Документы' : 'Аудио'}: 
                    {limits.min} - {formatMaxValue(limits.max)}
                  </Typography>
                ))}
                
                {template.skipExternalLinks && (
                  <Typography variant="body2" mt={1}>
                    Пропускать посты с внешними ссылками
                  </Typography>
                )}
                
                {template.containsText && (
                  <Typography variant="body2" mt={1}>
                    Содержит текст: {template.containsText}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEditTemplate(template)}
                >
                  Изменить
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDeleteTemplate(template._id)}
                >
                  Удалить
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTemplate?._id ? 'Редактирование шаблона' : 'Новый шаблон'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Название шаблона"
            value={editingTemplate?.name || ''}
            onChange={(e) => setEditingTemplate(prev => ({
              ...prev,
              name: e.target.value
            }))}
            sx={{ my: 2 }}
          />
          
          <TextField
            fullWidth
            label="Описание"
            value={editingTemplate?.description || ''}
            multiline
            rows={2}
            onChange={(e) => setEditingTemplate(prev => ({
              ...prev,
              description: e.target.value
            }))}
            sx={{ mb: 2 }}
          />
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Фильтры медиа
          </Typography>
          
          {editingTemplate && Object.entries(editingTemplate.mediaFilters).map(([type, limits]) => (
            <Box key={type} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {type === 'photos' ? 'Фото' : 
                 type === 'videos' ? 'Видео' : 
                 type === 'documents' ? 'Документы' : 'Аудио'}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Минимум"
                    value={limits.min}
                    onChange={handleMediaFilterChange(type, 'min')}
                    InputProps={{ 
                      inputProps: { min: 0 }
                    }}
                    helperText="Минимальное количество"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Максимум"
                    value={limits.max === -1 ? '' : limits.max}
                    onChange={handleMediaFilterChange(type, 'max')}
                    placeholder="Не ограничено"
                    helperText="Пусто = без ограничений, 0 = точное совпадение"
                  />
                </Grid>
              </Grid>
            </Box>
          ))}
          
          <Divider sx={{ my: 2 }} />
          
          <FormControlLabel
            control={
              <Switch
                checked={editingTemplate?.skipExternalLinks || false}
                onChange={(e) => setEditingTemplate(prev => ({
                  ...prev,
                  skipExternalLinks: e.target.checked
                }))}
              />
            }
            label="Пропускать посты с внешними ссылками"
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Содержит текст"
            value={editingTemplate?.containsText || ''}
            onChange={(e) => setEditingTemplate(prev => ({
              ...prev,
              containsText: e.target.value
            }))}
            helperText="Пост должен содержать этот текст (оставьте пустым для любого текста)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={handleSaveTemplate} 
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default FilterTemplatesPanel;
