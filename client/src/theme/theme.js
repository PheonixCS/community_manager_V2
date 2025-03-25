import { createTheme } from '@mui/material/styles';

// Fix: Export the function correctly
const createAppTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'dark' ? '#90caf9' : '#2196f3',
      light: mode === 'dark' ? '#a6d4fa' : '#64b5f6',
      dark: mode === 'dark' ? '#648dae' : '#1976d2',
      contrastText: mode === 'dark' ? '#000000' : '#ffffff',
    },
    secondary: {
      main: mode === 'dark' ? '#f48fb1' : '#f50057',
      light: mode === 'dark' ? '#f6a5c0' : '#ff4081',
      dark: mode === 'dark' ? '#aa647b' : '#c51162',
      contrastText: mode === 'dark' ? '#000000' : '#ffffff',
    },
    error: {
      main: mode === 'dark' ? '#f44336' : '#d32f2f',
      light: mode === 'dark' ? '#e57373' : '#ef5350',
      dark: mode === 'dark' ? '#d32f2f' : '#c62828',
    },
    warning: {
      main: mode === 'dark' ? '#ffa726' : '#ed6c02',
      light: mode === 'dark' ? '#ffb74d' : '#ff9800',
      dark: mode === 'dark' ? '#f57c00' : '#e65100',
    },
    info: {
      main: mode === 'dark' ? '#29b6f6' : '#0288d1',
      light: mode === 'dark' ? '#4fc3f7' : '#03a9f4',
      dark: mode === 'dark' ? '#0288d1' : '#01579b',
    },
    success: {
      main: mode === 'dark' ? '#66bb6a' : '#2e7d32',
      light: mode === 'dark' ? '#81c784' : '#4caf50',
      dark: mode === 'dark' ? '#388e3c' : '#1b5e20',
    },
    text: {
      primary: mode === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
      secondary: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
      disabled: mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.38)',
    },
    divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    background: {
      default: mode === 'dark' ? '#121212' : '#f5f5f5',
      paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
    },
    action: {
      active: mode === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.54)',
      hover: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      selected: mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
      disabled: mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.26)',
      disabledBackground: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#272727' : undefined,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'dark' ? '#272727' : undefined,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : undefined,
        },
        head: {
          fontWeight: 600,
          backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : undefined,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        outlined: {
          borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : undefined,
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : undefined,
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : undefined,
          minWidth: 40,
        },
      },
    },
  },
});

// Export the function as default
export default createAppTheme;
