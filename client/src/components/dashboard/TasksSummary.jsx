import React from 'react';
import { Typography, Box, Divider, Chip, Stack } from '@mui/material';
import { CheckCircle as ActiveIcon, Cancel as InactiveIcon } from '@mui/icons-material';

const TasksSummary = ({ tasks }) => {
  if (!tasks || tasks.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom component="div">
          Задачи скрапинга
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Задачи не найдены. Создайте новую задачу.
        </Typography>
      </Box>
    );
  }

  const activeTasks = tasks.filter(task => task.schedule.active);
  const inactiveTasks = tasks.filter(task => !task.schedule.active);
  
  // Находим задачу с наибольшим количеством собранных постов
  const topTask = [...tasks].sort((a, b) => b.statistics.totalPosts - a.statistics.totalPosts)[0];
  
  // Считаем общее количество постов
  const totalPosts = tasks.reduce((sum, task) => sum + task.statistics.totalPosts, 0);
  
  // Считаем общее количество мониторящихся сообществ
  const uniqueCommunities = new Set();
  tasks.forEach(task => {
    task.communities.forEach(community => {
      uniqueCommunities.add(community);
    });
  });
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom component="div">
        Задачи скрапинга
      </Typography>
      
      <Stack spacing={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Всего задач:</Typography>
          <Typography variant="body1" fontWeight="bold">{tasks.length}</Typography>
        </Box>
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <ActiveIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="body2">Активные:</Typography>
          </Box>
          <Typography variant="body1" fontWeight="bold">{activeTasks.length}</Typography>
        </Box>
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <InactiveIcon color="error" fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="body2">Неактивные:</Typography>
          </Box>
          <Typography variant="body1" fontWeight="bold">{inactiveTasks.length}</Typography>
        </Box>
        
        <Divider />
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Сообществ отслеживается:</Typography>
          <Typography variant="body1" fontWeight="bold">{uniqueCommunities.size}</Typography>
        </Box>
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Собрано постов:</Typography>
          <Typography variant="body1" fontWeight="bold">{totalPosts}</Typography>
        </Box>
        
        {topTask && (
          <Box mt={1}>
            <Typography variant="body2" color="text.secondary">
              Самая эффективная задача:
            </Typography>
            <Typography variant="body2" fontWeight="medium" noWrap>
              {topTask.name} ({topTask.statistics.totalPosts} постов)
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default TasksSummary;
