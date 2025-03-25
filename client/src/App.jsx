import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import PostList from './components/PostList';
import VideoDownloadList from './components/VideoDownloadList';
import Settings from './components/Settings';
import FilterTemplatesPanel from './components/FilterTemplatesPanel';
import TopRatedPosts from './components/TopRatedPosts';

// Импортируем компоненты для постинга
import PostingDashboard from './components/posting/PostingDashboard';
import PublishTaskList from './components/posting/PublishTaskList';
import PublishHistoryList from './components/posting/PublishHistoryList';
import PublishTaskForm from './components/posting/PublishTaskForm';
import ManualPublishing from './components/posting/ManualPublishing';
import VkAuthManager from './components/posting/VkAuthManager';
import ContentGeneratorManager from './components/posting/ContentGeneratorManager';

// Импортируем темный режим
import { ThemeProvider } from './theme/ThemeContext';
import { useTheme } from './theme/ThemeContext';
import createAppTheme from './theme/theme';

// Компонент-обертка для применения текущей темы
const ThemedApp = () => {
  const { mode } = useTheme();
  const theme = createAppTheme(mode);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppLayout>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: { xs: 1, sm: 2 } }}>
            <Routes>
              {/* Существующие маршруты */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<TaskList />} />
              <Route path="/posts" element={<PostList />} />
              <Route path="/videos" element={<VideoDownloadList />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/filter-templates" element={<FilterTemplatesPanel />} />
              <Route path="/top-rated-posts" element={<TopRatedPosts />} />
              
              {/* Маршруты для постинга */}
              <Route path="/posting" element={<PostingDashboard />} />
              <Route path="/posting/tasks" element={<PublishTaskList />} />
              <Route path="/posting/tasks/new" element={<PublishTaskForm />} />
              <Route path="/posting/tasks/edit/:id" element={<PublishTaskForm />} />
              <Route path="/posting/history" element={<PublishHistoryList />} />
              <Route path="/posting/manual" element={<ManualPublishing />} />
              <Route path="/posting/auth" element={<VkAuthManager />} />
              <Route path="/posting/generators" element={<ContentGeneratorManager />} />
            </Routes>
          </Box>
        </AppLayout>
      </Router>
    </MuiThemeProvider>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
};

export default App;
