import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Paper, Box, Button, Card, CardContent, CardActions,
  Grid, TextField, FormControlLabel, Switch, Chip, IconButton, Alert,
  CircularProgress, Divider, Snackbar, Accordion, AccordionSummary,
  AccordionDetails, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  PlayArrow as TestIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Code as CodeIcon,
  ContentPaste as ContentIcon
} from '@mui/icons-material';
import axios from 'axios';

const ContentGeneratorManager = () => {
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenerator, setSelectedGenerator] = useState(null);
  const [testParams, setTestParams] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    fetchGenerators();
  }, []);

  const fetchGenerators = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/publishing/generators');
      setGenerators(response.data);
    } catch (error) {
      console.error('Error fetching generators:', error);
      showSnackbar('Ошибка при загрузке генераторов контента', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGenerator = (generator) => {
    setSelectedGenerator(generator);
    
    // Инициализируем testParams значениями по умолчанию из генератора
    const initialParams = {};
    generator.params.forEach(param => {
      initialParams[param.name] = param.defaultValue;
    });
    setTestParams(initialParams);
    
    // Сбрасываем результат тестирования
    setTestResult(null);
  };

  const handleParamChange = (paramName, value) => {
    setTestParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleTestGeneration = async () => {
    if (!selectedGenerator) return;
    
    setTestLoading(true);
    setTestResult(null);
    
    try {
      const response = await axios.post('/api/publishing/publish-generated', {
        generatorId: selectedGenerator.id,
        params: testParams,
        communityId: '-1', // Тестовый ID сообщества (не используется при тестировании)
        options: {
          test: true // Специальный флаг для тестирования (только вернуть результат без публикации)
        }
      });
      
      setTestResult(response.data.content || response.data);
      showSnackbar('Контент успешно сгенерирован', 'success');
    } catch (error) {
      console.error('Error testing content generation:', error);
      showSnackbar('Ошибка при тестировании генератора', 'error');
    } finally {
      setTestLoading(false);
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

  const getParamInput = (param) => {
    switch (param.type) {
      case 'string':
        return (
          <TextField
            fullWidth
            label={param.name}
            value={testParams[param.name] || ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            helperText={param.description}
            margin="normal"
          />
        );
      
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={param.name}
            value={testParams[param.name] || 0}
            onChange={(e) => handleParamChange(param.name, Number(e.target.value))}
            helperText={param.description}
            margin="normal"
          />
        );
      
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={testParams[param.name] || false}
                onChange={(e) => handleParamChange(param.name, e.target.checked)}
              />
            }
            label={param.description || param.name}
            sx={{ my: 2 }}
          />
        );
      
      default:
        return (
          <TextField
            fullWidth
            label={param.name}
            value={testParams[param.name] || ''}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            helperText={param.description}
            margin="normal"
          />
        );
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="h1">
        Генераторы контента
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Список генераторов */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Доступные генераторы
              </Typography>
              
              {generators.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Не найдено доступных генераторов контента
                </Alert>
              ) : (
                <List>
                  {generators.map((generator) => (
                    <ListItem
                      button
                      key={generator.id}
                      onClick={() => handleSelectGenerator(generator)}
                      selected={selectedGenerator?.id === generator.id}
                    >
                      <ListItemText
                        primary={generator.name}
                        secondary={`ID: ${generator.id} | Параметров: ${generator.params.length}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleSelectGenerator(generator)}
                        >
                          <EditIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
          
          {/* Детали генератора */}
          <Grid item xs={12} md={8}>
            {selectedGenerator ? (
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {selectedGenerator.name}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  ID: {selectedGenerator.id}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Параметры генератора
                </Typography>
                
                <Box sx={{ mt: 2 }}>
                  {selectedGenerator.params.map((param) => (
                    <Box key={param.name}>
                      {getParamInput(param)}
                    </Box>
                  ))}
                </Box>
                
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={testLoading ? <CircularProgress size={24} /> : <TestIcon />}
                    onClick={handleTestGeneration}
                    disabled={testLoading}
                  >
                    Тестировать генератор
                  </Button>
                </Box>
                
                {testResult && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle1" gutterBottom>
                      Результат тестирования
                    </Typography>
                    
                    <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'background.paper' }}>
                      <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        {typeof testResult === 'object' 
                          ? JSON.stringify(testResult, null, 2) 
                          : testResult}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </Paper>
            ) : (
              <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <ContentIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Выберите генератор контента из списка
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
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

export default ContentGeneratorManager;
