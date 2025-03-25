import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, List, ListItem,
  ListItemText, ListItemSecondary, IconButton,
  Box, Divider, Card, CardContent, CardActions,
  Grid, Switch, FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import axios from 'axios';

const FilterTemplateManager = ({ open, onClose, onSelect }) => {
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/api/filter-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
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
    setIsNewTemplate(true);
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
    setIsNewTemplate(false);
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
      
      if (isNewTemplate) {
        await axios.post('/api/filter-templates', preparedTemplate);
      } else {
        await axios.put(`/api/filter-templates/${preparedTemplate._id}`, preparedTemplate);
      }
      fetchTemplates();
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот шаблон?')) {
      try {
        await axios.delete(`/api/filter-templates/${templateId}`);
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };

  const formatMaxValue = (value) => {
    return value === -1 ? 'Не ограничено' : value;
  };

  const handleMediaFilterChange = (mediaType, limitType) => (event) => {
    const value = event.target.value === '' ? 
      (limitType === 'max' ? -1 : 0) : 
      Number(event.target.value);
    
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Управление шаблонами фильтров
        <Button
          startIcon={<AddIcon />}
          onClick={handleCreateTemplate}
          sx={{ float: 'right' }}
        >
          Создать шаблон
        </Button>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          {/* Список шаблонов */}
          <Grid item xs={12} md={6}>
            <List>
              {templates.map(template => (
                <Card key={template._id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6">{template.name}</Typography>
                    {template.description && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {template.description}
                      </Typography>
                    )}
                    <Typography variant="subtitle2" gutterBottom>
                      Фильтры медиа:
                    </Typography>
                    {template.mediaFilters && Object.entries(template.mediaFilters).map(([type, filter]) => (
                      <Typography key={type} variant="body2">
                        {type}: мин. {filter.min}, макс. {formatMaxValue(filter.max)}
                      </Typography>
                    ))}
                    {template.skipExternalLinks && (
                      <Typography variant="body2">
                        Пропускать посты с внешними ссылками
                      </Typography>
                    )}
                    {template.containsText && (
                      <Typography variant="body2">
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
                    <Button
                      size="small"
                      onClick={() => onSelect(template)}
                    >
                      Применить
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </List>
          </Grid>

          {/* Форма редактирования */}
          {editingTemplate && (
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>
                  {isNewTemplate ? 'Новый шаблон' : 'Редактирование шаблона'}
                </Typography>
                <TextField
                  fullWidth
                  label="Название шаблона"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Описание"
                  value={editingTemplate.description || ''}
                  multiline
                  rows={2}
                  onChange={(e) => setEditingTemplate(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  sx={{ mb: 2 }}
                />
                
                <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                  Фильтры медиа
                </Typography>

                {Object.entries(editingTemplate.mediaFilters).map(([type, filter]) => (
                  <Box key={type} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
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
                          value={filter.min}
                          onChange={handleMediaFilterChange(type, 'min')}
                          InputProps={{ 
                            inputProps: { min: 0 }
                          }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Максимум"
                          value={filter.max === -1 ? '' : filter.max}
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
                      checked={editingTemplate.skipExternalLinks || false}
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
                  value={editingTemplate.containsText || ''}
                  onChange={(e) => setEditingTemplate(prev => ({
                    ...prev,
                    containsText: e.target.value
                  }))}
                  helperText="Пост должен содержать этот текст (оставьте пустым для любого текста)"
                  sx={{ mb: 2 }}
                />
                
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveTemplate}
                    fullWidth
                  >
                    Сохранить шаблон
                  </Button>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilterTemplateManager;
