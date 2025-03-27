import React from 'react';
import { Drawer, List, Divider, ListSubheader } from '@mui/material';
import { 
  Home as HomeIcon, 
  Settings as SettingsIcon, 
  DeleteSweep as CleanupIcon,
  CleaningServices as CleanupIcon 
} from '@mui/icons-material';
import ListItemLink from './ListItemLink';

function Sidebar({ open, handleDrawerClose }) {
  return (
    <Drawer open={open} onClose={handleDrawerClose}>
      <div>
        <List>
          <ListItemLink to="/" primary="Home" icon={<HomeIcon />} />
          <Divider />
          <ListSubheader>Настройки</ListSubheader>
          <ListItemLink to="/settings" primary="Settings" icon={<SettingsIcon />} />
          <ListItemLink to="/cleanup-settings" primary="Очистка постов" icon={<CleanupIcon />} />
          <ListItemLink to="/cleanup" primary="Очистка базы" icon={<CleanupIcon />} />
        </List>
      </div>
    </Drawer>
  );
}

export default Sidebar;
