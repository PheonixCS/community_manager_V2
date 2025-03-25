const cron = require('node-cron');
const ScrapingTask = require('../models/ScrapingTask');
const scrapingService = require('./scrapingService');

class SchedulerService {
  constructor() {
    this.scheduledTasks = new Map();
    this.minuteCheck = null;
  }

  // Инициализация планировщика
  init() {
    console.log('Initializing scheduler service');
    
    // Проверяем задачи каждую минуту
    this.minuteCheck = cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        
        // Ищем задачи, которые нужно запустить
        const tasksToRun = await ScrapingTask.find({
          'schedule.active': true,
          'schedule.nextRun': { $lte: now }
        });
        
        console.log(`Found ${tasksToRun.length} tasks to run`);
        
        // Запускаем каждую задачу
        for (const task of tasksToRun) {
          try {
            await scrapingService.executeTask(task._id);
            console.log(`Successfully executed task ${task._id}`);
          } catch (error) {
            console.error(`Error executing task ${task._id}:`, error.message);
          }
        }
      } catch (error) {
        console.error('Error in scheduler check:', error.message);
      }
    });
    
    console.log('Scheduler initialized');
  }

  // Остановка планировщика
  stop() {
    if (this.minuteCheck) {
      this.minuteCheck.stop();
    }
    console.log('Scheduler stopped');
  }

  // Перезапуск задачи
  async rescheduleTask(taskId) {
    const task = await ScrapingTask.findById(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // Обновляем время следующего запуска
    const nextRunTime = new Date();
    nextRunTime.setMinutes(nextRunTime.getMinutes() + task.schedule.interval);
    
    task.schedule.nextRun = nextRunTime;
    await task.save();
    
    return nextRunTime;
  }
}

module.exports = new SchedulerService();
