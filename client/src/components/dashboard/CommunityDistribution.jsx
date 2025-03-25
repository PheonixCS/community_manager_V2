import React from 'react';
import { Typography, Box, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CommunityDistribution = ({ communities }) => {
  const theme = useTheme();
  console.log('CommunityDistribution:', communities);
  if (!communities || communities.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom component="div">
          Распределение по сообществам
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Нет данных для отображения.
        </Typography>
      </Box>
    );
  }

  // Форматируем данные для графика
  const chartData = communities.map(item => ({
    name: item._id,
    value: item.count
  }));

  // Цвета для графика
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.info.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#FF8042'
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom component="div">
        Распределение по сообществам
      </Typography>
      
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ 
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 4
            }}
            formatter={(value, name) => [`${value} постов`, `Сообщество: ${name}`]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default CommunityDistribution;
