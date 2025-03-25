import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, Switch,
  FormControl, FormControlLabel, FormGroup,
  Button, Snackbar, Alert, Divider,
  Radio, RadioGroup, CircularProgress, TextField,
  IconButton, InputAdornment
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import axios from 'axios';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [showToken, setShowToken] = useState(false);
  const [serviceToken, setServiceToken] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setSnackbar({
        open: true,
        message: 'Ошибка при загрузке настроек',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      const settingsToSave = {
        ...settings,
        vkApi: {
          ...settings.vkApi,
          serviceToken: serviceToken || settings.vkApi.serviceToken
        }
      };
      
      await axios.put('/api/settings', settingsToSave);
      setSnackbar({
        open: true,
        message: 'Настройки успешно сохранены',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSnackbar({
        open: true,
        message: 'Ошибка при сохранении настроек',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (path) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setSettings(prevSettings => {
      const newSettings = { ...prevSettings };
      const parts = path.split('.');
      let current = newSettings;
      
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = value;
      return newSettings;
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Настройки
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Настройки VK API
        </Typography>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Сервисный ключ VK API"
            type={showToken ? 'text' : 'password'}
            value={serviceToken}
            onChange={(e) => setServiceToken(e.target.value)}
            sx={{ mt: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowToken(!showToken)}
                    edge="end"
                  >
                    {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText="Сервисный ключ можно получить в настройках приложения ВКонтакте"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Скачивание медиа-контента
        </Typography>

        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={settings.downloadMedia.enabled}
                onChange={handleChange('downloadMedia.enabled')}
              />
            }
            label="Автоматическое скачивание медиа-контента"
          />

          <Box sx={{ ml: 3, mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Типы медиа для скачивания:
            </Typography>
            <FormControlLabel
              disabled={!settings.downloadMedia.enabled}
              control={
                <Switch
                  checked={settings.downloadMedia.types.photos}
                  onChange={handleChange('downloadMedia.types.photos')}
                />
              }
              label="Фотографии"
            />
            <FormControlLabel
              disabled={!settings.downloadMedia.enabled}
              control={
                <Switch
                  checked={settings.downloadMedia.types.videos}
                  onChange={handleChange('downloadMedia.types.videos')}
                />
              }
              label="Видео"
            />
            <FormControlLabel
              disabled={!settings.downloadMedia.enabled}
              control={
                <Switch
                  checked={settings.downloadMedia.types.documents}
                  onChange={handleChange('downloadMedia.types.documents')}
                />
              }
              label="Документы"
            />
            <FormControlLabel
              disabled={!settings.downloadMedia.enabled}
              control={
                <Switch
                  checked={settings.downloadMedia.types.audio}
                  onChange={handleChange('downloadMedia.types.audio')}
                />
              }
              label="Аудио"
            />
          </Box>
        </FormGroup>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Хранилище
        </Typography>

        <FormControl>
          <RadioGroup
            value={settings.storage.type}
            onChange={handleChange('storage.type')}
          >
            <FormControlLabel 
              value="s3" 
              control={<Radio />} 
              label="S3-совместимое хранилище (MinIO)" 
            />
            <FormControlLabel 
              value="local" 
              control={<Radio />} 
              label="Локальное хранилище" 
            />
          </RadioGroup>
        </FormControl>

        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.storage.keepLocalCopy}
                onChange={handleChange('storage.keepLocalCopy')}
              />
            }
            label="Сохранять локальную копию файлов"
          />
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Settings;
