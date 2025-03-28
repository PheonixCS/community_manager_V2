import React from 'react';
import { Typography, Box, useTheme } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MetricsChart = ({ data }) => {
  const theme = useTheme();
  console.log("Raw chart data:", data);
  if (!data || data.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom component="div">
          Динамика сбора постов
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Недостаточно данных для построения графика.
        </Typography>
      </Box>
    );
  }

  // Форматируем данные для графика
  const chartData = data.map(item => ({
    date: item._id,
    posts: item.count
  }));

  // Получаем максимальное значение для настройки оси Y
  // const maxPosts = Math.max(...chartData.map(item => item.posts));
  // const yAxisMax = Math.ceil(maxPosts * 1.1); // Увеличиваем максимум на 10% для отступа

  return (
    <Box>
      <Typography variant="h6" gutterBottom component="div" sx={{ color: 'text.primary' }}>
        Динамика сбора постов
      </Typography>
      
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis 
            dataKey="date" 
            stroke={theme.palette.text.secondary}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            }}
          />
          <YAxis 
            stroke={theme.palette.text.secondary}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
              boxShadow: theme.shadows[3]
            }}
            formatter={(value) => [`${value} постов`, 'Количество']}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="posts"
            name="Количество постов"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={{ fill: theme.palette.primary.main }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default MetricsChart;
