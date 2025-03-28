const express = require('express');
const router = express.Router();
const ScrapingTask = require('../../models/ScrapingTask');
const scrapingService = require('../../services/scrapingService');
const schedulerService = require('../../services/schedulerService');

// Получить все задачи
router.get('/', async (req, res) => {
  try {
    const tasks = await ScrapingTask.find().sort({ createdAt: -1 });
    // Добавим логирование для отладки
    // console.log(`Returning ${tasks.length} scraping tasks`);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching scraping tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить задачу по ID
router.get('/:id', async (req, res) => {
  try {
    const task = await ScrapingTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать новую задачу
router.post('/', async (req, res) => {
  try {
    const newTask = new ScrapingTask(req.body);
    
    // Установка времени следующего запуска
    const nextRunTime = new Date();
    nextRunTime.setMinutes(nextRunTime.getMinutes() + newTask.schedule.interval);
    newTask.schedule.nextRun = nextRunTime;
    
    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Обновить существующую задачу
router.put('/:id', async (req, res) => {
  try {
    const updatedTask = await ScrapingTask.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Обновляем время следующего запуска, если изменился интервал
    if (req.body.schedule && req.body.schedule.interval !== undefined) {
      await schedulerService.rescheduleTask(updatedTask._id);
    }
    
    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Удалить задачу
router.delete('/:id', async (req, res) => {
  try {
    const deletedTask = await ScrapingTask.findByIdAndDelete(req.params.id);
    
    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Запустить задачу вручную
router.post('/:id/run', async (req, res) => {
  try {
    const result = await scrapingService.executeTask(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Включить/выключить задачу
router.patch('/:id/toggle', async (req, res) => {
  try {
    const task = await ScrapingTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    task.schedule.active = !task.schedule.active;
    
    // Если задача активирована, устанавливаем время следующего запуска
    if (task.schedule.active) {
      const nextRunTime = new Date();
      nextRunTime.setMinutes(nextRunTime.getMinutes() + task.schedule.interval);
      task.schedule.nextRun = nextRunTime;
    }
    
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
