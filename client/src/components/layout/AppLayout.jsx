import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, Divider, IconButton,
  List, ListItem, ListItemIcon, ListItemText, Tooltip,
  ListSubheader, Switch, FormControlLabel, Menu, MenuItem
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  ListAlt as TasksIcon,
  Collections as PostsIcon,
  VideoLibrary as VideosIcon,
  Settings as SettingsIcon,
  FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon,
  RadioButtonChecked as ScrapingIcon,
  Send as PostingIcon,
  ChevronLeft as ChevronLeftIcon,
  AssignmentTurnedIn as PublishTasksIcon,
  History as HistoryIcon,
  Publish as ManualPublishIcon,
  VpnKey as AuthKeysIcon,
  AutoFixHigh as GeneratorsIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useTheme } from '../../theme/ThemeContext';

const drawerWidth = 240;

// Styled components definitions
const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const StyledDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    width: drawerWidth,
    '& .MuiDrawer-paper': {
      width: drawerWidth,
      overflowX: 'hidden',
    },
  }),
  ...(!open && {
    width: theme.spacing(7),
    [theme.breakpoints.up('sm')]: {
      width: theme.spacing(9),
    },
    '& .MuiDrawer-paper': {
      width: theme.spacing(7),
      [theme.breakpoints.up('sm')]: {
        width: theme.spacing(9),
      },
      overflowX: 'hidden',
    },
  }),
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
}));

const StyledToolbar = styled(Toolbar)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '0 8px',
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const AppLayout = ({ children }) => {
  const { mode, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [appMode, setAppMode] = useState('scraping'); // 'scraping' or 'posting'
  const location = useLocation();
  
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  const handleModeChange = () => {
    setAppMode(prevMode => prevMode === 'scraping' ? 'posting' : 'scraping');
  };
  
  // Determine if a nav item is active
  const isActive = (paths) => {
    if (!Array.isArray(paths)) paths = [paths];
    return paths.some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <StyledAppBar position="fixed" open={drawerOpen}>
        <StyledToolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            VK Content Manager
          </Typography>
          
          {/* Добавляем переключатель темы */}
          <IconButton color="inherit" onClick={toggleTheme} sx={{ mr: 1 }}>
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          
          <FormControlLabel
            control={
              <Switch
                checked={appMode === 'posting'}
                onChange={handleModeChange}
                color="default"
              />
            }
            label={appMode === 'posting' ? "Режим постинга" : "Режим скрапинга"}
          />
        </StyledToolbar>
      </StyledAppBar>
      
      <StyledDrawer
        variant="permanent"
        open={drawerOpen}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>
        
        <Divider />
        
        {appMode === 'scraping' ? (
          // Scraping Mode Menu
          <>
            <List>
              <ListItem 
                button 
                component={Link} 
                to="/"
                selected={isActive('/')}
              >
                <ListItemIcon>
                  <DashboardIcon />
                </ListItemIcon>
                <ListItemText primary="Дашборд" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/tasks"
                selected={isActive('/tasks')}
              >
                <ListItemIcon>
                  <TasksIcon />
                </ListItemIcon>
                <ListItemText primary="Задачи" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/posts"
                selected={isActive('/posts')}
              >
                <ListItemIcon>
                  <PostsIcon />
                </ListItemIcon>
                <ListItemText primary="Посты" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/top-rated-posts"
                selected={isActive('/top-rated-posts')}
              >
                <ListItemIcon>
                  <TrendingUpIcon />
                </ListItemIcon>
                <ListItemText primary="Топ постов" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/videos"
                selected={isActive('/videos')}
              >
                <ListItemIcon>
                  <VideosIcon />
                </ListItemIcon>
                <ListItemText primary="Видео" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/filter-templates"
                selected={isActive('/filter-templates')}
              >
                <ListItemIcon>
                  <FilterIcon />
                </ListItemIcon>
                <ListItemText primary="Шаблоны фильтров" />
              </ListItem>
              <ListItem 
                button 
                component={Link} 
                to="/cleanup"
                selected={isActive('/cleanup')}
              >
                <ListItemIcon>
                  <DashboardIcon />
                </ListItemIcon>
                <ListItemText primary="Очистка" />
              </ListItem>
            </List>
          </>
        ) : (
          // Posting Mode Menu
          <>
            <List
              subheader={
                <ListSubheader component="div">
                  Публикация постов
                </ListSubheader>
              }
            >
              <ListItem 
                button 
                component={Link} 
                to="/posting"
                selected={isActive('/posting')}
              >
                <ListItemIcon>
                  <DashboardIcon />
                </ListItemIcon>
                <ListItemText primary="Дашборд постинга" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/posting/tasks"
                selected={isActive('/posting/tasks')}
              >
                <ListItemIcon>
                  <PublishTasksIcon />
                </ListItemIcon>
                <ListItemText primary="Задачи публикации" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/posting/history"
                selected={isActive('/posting/history')}
              >
                <ListItemIcon>
                  <HistoryIcon />
                </ListItemIcon>
                <ListItemText primary="История публикаций" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/posting/manual"
                selected={isActive('/posting/manual')}
              >
                <ListItemIcon>
                  <ManualPublishIcon />
                </ListItemIcon>
                <ListItemText primary="Ручная публикация" />
              </ListItem>
            </List>
            
            <Divider />
            
            <List
              subheader={
                <ListSubheader component="div">
                  Инструменты
                </ListSubheader>
              }
            >
              <ListItem 
                button 
                component={Link} 
                to="/posting/auth"
                selected={isActive('/posting/auth')}
              >
                <ListItemIcon>
                  <AuthKeysIcon />
                </ListItemIcon>
                <ListItemText primary="Авторизация ВК" />
              </ListItem>
              
              <ListItem 
                button 
                component={Link} 
                to="/posting/generators"
                selected={isActive('/posting/generators')}
              >
                <ListItemIcon>
                  <GeneratorsIcon />
                </ListItemIcon>
                <ListItemText primary="Генераторы контента" />
              </ListItem>
            </List>
          </>
        )}
        
        <Divider />
        
        <List>
          <ListItem 
            button 
            component={Link} 
            to="/settings"
            selected={isActive('/settings')}
          >
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="Настройки" />
          </ListItem>
        </List>
      </StyledDrawer>
      
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <DrawerHeader />
        {children}
      </Box>
    </Box>
  );
};

export default AppLayout;
