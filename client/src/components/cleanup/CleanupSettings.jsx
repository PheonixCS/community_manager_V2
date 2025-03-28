import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Paper, Box, Grid, TextField, Switch,
  FormControlLabel, Button, Alert, Snackbar, CircularProgress,
  Card, CardContent, CardHeader, Slider, Chip,
  FormControl, InputLabel, Select, MenuItem, ListItemText, Checkbox,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import {
  ScheduleOutlined as ScheduleIcon,
  PlayArrow as RunIcon,
  Save as SaveIcon, 
  Refresh as RefreshIcon,
  BarChart as StatsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import axios from 'axios';

const CleanupSettings = () => {
  // State for settings
  const [settings, setSettings] = useState(null);
  const [originalSettings, setOriginalSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  // Add a dummy empty array to replace the removed state variable
  const communities = [];
  const [confirmRunDialogOpen, setConfirmRunDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [showCronHelp, setShowCronHelp] = useState(false);
  
  // Wrap fetchSettings in useCallback
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/cleanup/settings');
      setSettings(response.data);
      setOriginalSettings(JSON.parse(JSON.stringify(response.data))); // Deep copy
    } catch (error) {
      console.error('Error fetching cleanup settings:', error);
      showSnackbar('Ошибка при загрузке настроек очистки', 'error');
    } finally {
      setLoading(false);
    }
  }, []);  // Add showSnackbar to dependencies if needed
  
  // Either use fetchCommunities or remove it
  // const fetchCommunities = async () => {
  //   // Implementation or remove
  // };
  
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  
  const handleSaveSettings = async () => {
    try {
      setSaveLoading(true);
      await axios.put('/api/cleanup/settings', settings);
      setOriginalSettings(JSON.parse(JSON.stringify(settings))); // Deep copy
      showSnackbar('Настройки сохранены успешно', 'success');
    } catch (error) {
      console.error('Error saving cleanup settings:', error);
      showSnackbar('Ошибка при сохранении настроек', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRunCleanup = async () => {
    setConfirmRunDialogOpen(false);
    try {
      setRunLoading(true);
      const response = await axios.post('/api/cleanup/run');
      showSnackbar(`Очистка выполнена. Удалено ${response.data.deletedCount} постов`, 'success');
      
      // Refresh settings to get updated statistics
      await fetchSettings();
    } catch (error) {
      console.error('Error running cleanup manually:', error);
      showSnackbar('Ошибка при запуске очистки', 'error');
    } finally {
      setRunLoading(false);
    }
  };

  const handleToggleEnabled = (event) => {
    setSettings({
      ...settings,
      enabled: event.target.checked
    });
  };

  const handleRuleToggle = (rule) => (event) => {
    setSettings({
      ...settings,
      rules: {
        ...settings.rules,
        [rule]: {
          ...settings.rules[rule],
          enabled: event.target.checked
        }
      }
    });
  };

  const handleRuleChange = (rule, field) => (event) => {
    const value = event.target.type === 'checkbox' 
      ? event.target.checked 
      : event.target.value;

    setSettings({
      ...settings,
      rules: {
        ...settings.rules,
        [rule]: {
          ...settings.rules[rule],
          [field]: value
        }
      }
    });
  };

  const handleCronChange = (event) => {
    setSettings({
      ...settings,
      cronSchedule: event.target.value
    });
  };

  const handleCommunitySelectionChange = (event) => {
    setSettings({
      ...settings,
      rules: {
        ...settings.rules,
        specificCommunities: {
          ...settings.rules.specificCommunities,
          communities: event.target.value
        }
      }
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
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return '0 мс';
    
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} сек.`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} мин. ${remainingSeconds} сек.`;
  };

  const hasUnsavedChanges = () => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!settings) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Не удалось загрузить настройки очистки
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom component="h1">
          Настройки автоматической очистки базы постов
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<StatsIcon />}
            onClick={() => setStatsDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Статистика
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RunIcon />}
            onClick={() => setConfirmRunDialogOpen(true)}
            disabled={runLoading}
          >
            {runLoading ? <CircularProgress size={24} /> : 'Запустить очистку'}
          </Button>
        </Box>
      </Box>

      {/* Main Settings Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 1 }} color="primary" />
            <Typography variant="h5">Общие настройки</Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={handleToggleEnabled}
                color={settings.enabled ? 'success' : 'default'}
              />
            }
            label={settings.enabled ? 'Включено' : 'Отключено'}
          />
        </Box>
        
        <Alert severity={settings.enabled ? 'info' : 'warning'} sx={{ mb: 3 }}>
          {settings.enabled 
            ? 'Автоматическая очистка базы постов включена. Система будет удалять старые и неактуальные посты согласно расписанию.' 
            : 'Автоматическая очистка отключена. Никакие посты не будут удаляться по расписанию.'}
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Расписание очистки
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <TextField
                label="Cron-выражение"
                fullWidth
                variant="outlined"
                value={settings.cronSchedule}
                onChange={handleCronChange}
                helperText={
                  <Typography variant="caption" sx={{ cursor: 'pointer', color: 'primary.main' }} onClick={() => setShowCronHelp(!showCronHelp)}>
                    {showCronHelp ? 'Скрыть помощь' : 'Показать формат Cron-выражения'}
                  </Typography>
                }
              />
              {showCronHelp && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    Cron-формат: "минута час день-месяца месяц день-недели"<br />
                    Примеры:<br />
                    "0 3 * * *" - каждый день в 3:00<br />
                    "0 */6 * * *" - каждые 6 часов<br />
                    "0 0 * * 0" - каждое воскресенье в полночь
                  </Typography>
                </Alert>
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Последняя очистка: {formatDate(settings.statistics?.lastRun)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Последнее количество удаленных постов: {settings.statistics?.lastCleanupPostsDeleted || 0}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Cleanup Rules */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Правила очистки
      </Typography>
      
      <Grid container spacing={3}>
        {/* Rule: Older Than */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Старые посты"
              subheader="Удаление постов старше указанного времени"
              action={
                <Switch
                  checked={settings.rules.olderThan.enabled}
                  onChange={handleRuleToggle('olderThan')}
                />
              }
            />
            <CardContent>
              <Box sx={{ width: '100%' }}>
                <Typography gutterBottom>
                  Удалять посты старше (часов):
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs>
                    <Slider
                      value={settings.rules.olderThan.hours}
                      onChange={(e, newValue) => {
                        setSettings({
                          ...settings,
                          rules: {
                            ...settings.rules,
                            olderThan: {
                              ...settings.rules.olderThan,
                              hours: newValue
                            }
                          }
                        });
                      }}
                      min={1}
                      max={720} // 30 days
                      step={1}
                      marks={[
                        { value: 24, label: '1d' },
                        { value: 168, label: '7d' },
                        { value: 720, label: '30d' }
                      ]}
                      disabled={!settings.rules.olderThan.enabled}
                    />
                  </Grid>
                  <Grid item>
                    <TextField
                      value={settings.rules.olderThan.hours}
                      onChange={handleRuleChange('olderThan', 'hours')}
                      type="number"
                      InputProps={{ inputProps: { min: 1, max: 720 } }}
                      disabled={!settings.rules.olderThan.enabled}
                      size="small"
                      sx={{ width: 80 }}
                    />
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary">
                  {Math.floor(settings.rules.olderThan.hours / 24)} дней {settings.rules.olderThan.hours % 24} часов
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Rule: Low View Rate */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Низкая популярность"
              subheader="Удаление постов с низким рейтингом просмотров"
              action={
                <Switch
                  checked={settings.rules.lowViewRate.enabled}
                  onChange={handleRuleToggle('lowViewRate')}
                />
              }
            />
            <CardContent>
              <Box sx={{ width: '100%' }}>
                <Typography gutterBottom>
                  Пороговое значение (просмотров/сек):
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs>
                    <Slider
                      value={settings.rules.lowViewRate.threshold}
                      onChange={(e, newValue) => {
                        setSettings({
                          ...settings,
                          rules: {
                            ...settings.rules,
                            lowViewRate: {
                              ...settings.rules.lowViewRate,
                              threshold: newValue
                            }
                          }
                        });
                      }}
                      min={0}
                      max={5}
                      step={0.1}
                      marks={[
                        { value: 0, label: '0' },
                        { value: 1, label: '1' },
                        { value: 5, label: '5' }
                      ]}
                      disabled={!settings.rules.lowViewRate.enabled}
                    />
                  </Grid>
                  <Grid item>
                    <TextField
                      value={settings.rules.lowViewRate.threshold}
                      onChange={handleRuleChange('lowViewRate', 'threshold')}
                      type="number"
                      InputProps={{ inputProps: { min: 0, step: 0.1 } }}
                      disabled={!settings.rules.lowViewRate.enabled}
                      size="small"
                      sx={{ width: 80 }}
                    />
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary">
                  Будут удалены посты с рейтингом меньше указанного значения
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Rule: Low Engagement */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Низкая вовлеченность"
              subheader="Удаление постов с низкой активностью пользователей"
              action={
                <Switch
                  checked={settings.rules.lowEngagement.enabled}
                  onChange={handleRuleToggle('lowEngagement')}
                />
              }
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Мин. лайков"
                    value={settings.rules.lowEngagement.minLikes}
                    onChange={handleRuleChange('lowEngagement', 'minLikes')}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                    disabled={!settings.rules.lowEngagement.enabled}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Мин. комментариев"
                    value={settings.rules.lowEngagement.minComments}
                    onChange={handleRuleChange('lowEngagement', 'minComments')}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                    disabled={!settings.rules.lowEngagement.enabled}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Мин. репостов"
                    value={settings.rules.lowEngagement.minReposts}
                    onChange={handleRuleChange('lowEngagement', 'minReposts')}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                    disabled={!settings.rules.lowEngagement.enabled}
                    size="small"
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Будут удалены посты, не набравшие минимальные значения (если указано больше 0)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Rule: Duplicate Media */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Дубликаты медиа"
              subheader="Удалять старые посты с дублирующимися медиа-файлами"
              action={
                <Switch
                  checked={settings.rules.duplicateMedia.enabled}
                  onChange={handleRuleToggle('duplicateMedia')}
                />
              }
            />
            <CardContent>
              <Alert severity="info">
                Будут идентифицированы посты с одинаковыми медиа-файлами.
                Из каждой группы дубликатов будет сохранен только самый новый пост.
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Rule: Specific Communities */}
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="Выборочная очистка по сообществам"
              subheader="Удалять посты из указанных сообществ"
              action={
                <Switch
                  checked={settings.rules.specificCommunities.enabled}
                  onChange={handleRuleToggle('specificCommunities')}
                />
              }
            />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.rules.specificCommunities.exclude}
                    onChange={handleRuleChange('specificCommunities', 'exclude')}
                    disabled={!settings.rules.specificCommunities.enabled}
                  />
                }
                label={settings.rules.specificCommunities.exclude 
                  ? "Исключить выбранные сообщества (удалять из всех остальных)" 
                  : "Включить выбранные сообщества (удалять только из них)"}
              />

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Выберите сообщества</InputLabel>
                <Select
                  multiple
                  value={settings.rules.specificCommunities.communities}
                  onChange={handleCommunitySelectionChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  disabled={!settings.rules.specificCommunities.enabled}
                >
                  {communities.map((community) => (
                    <MenuItem key={community.id} value={community.id}>
                      <Checkbox checked={settings.rules.specificCommunities.communities.indexOf(community.id) > -1} />
                      <ListItemText 
                        primary={community.id} 
                        secondary={`${community.count} постов`}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />}
          onClick={fetchSettings}
        >
          Сбросить изменения
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={saveLoading ? <CircularProgress size={24} /> : <SaveIcon />}
          onClick={handleSaveSettings}
          disabled={saveLoading || !hasUnsavedChanges()}
        >
          Сохранить настройки
        </Button>
      </Box>

      {/* Cleanup Statistics Dialog */}
      <Dialog
        open={statsDialogOpen}
        onClose={() => setStatsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Статистика очистки</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Общая статистика
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Всего запусков
                  </Typography>
                  <Typography variant="h4">
                    {settings.statistics.totalCleanups}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Удалено постов
                  </Typography>
                  <Typography variant="h4">
                    {settings.statistics.totalPostsDeleted}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Последний запуск
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(settings.statistics.lastRun)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          <Typography variant="h6" gutterBottom>
            История очисток
          </Typography>
          {settings.statistics.history && settings.statistics.history.length > 0 ? (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Дата</TableCell>
                    <TableCell>Удалено постов</TableCell>
                    <TableCell>Длительность</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...settings.statistics.history]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 10)
                    .map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell>{item.postsDeleted}</TableCell>
                      <TableCell>{formatDuration(item.duration)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              История очисток пуста
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialogOpen(false)}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Run Dialog */}
      <Dialog
        open={confirmRunDialogOpen}
        onClose={() => setConfirmRunDialogOpen(false)}
      >
        <DialogTitle>Подтверждение очистки</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите запустить очистку базы постов прямо сейчас?
            
            Посты будут удалены согласно настроенным правилам без возможности восстановления.
          </DialogContentText>
          {hasUnsavedChanges() && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              У вас есть несохраненные изменения в настройках.
              Будут применены текущие сохраненные настройки, а не те, что отображаются в форме.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRunDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleRunCleanup} color="error" variant="contained">
            Запустить очистку
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

export default CleanupSettings;
