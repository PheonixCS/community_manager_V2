const express = require('express');
const router = express.Router();
const FilterTemplate = require('../../models/FilterTemplate');

// Получить все шаблоны
router.get('/', async (req, res) => {
  try {
    const templates = await FilterTemplate.find().sort('-createdAt');
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать шаблон
router.post('/', async (req, res) => {
  try {
    // Валидация и подготовка данных
    const templateData = { ...req.body };
    
    // Проверяем наличие mediaFilters и добавляем значения по умолчанию
    if (!templateData.mediaFilters) {
      templateData.mediaFilters = {
        photos: { min: 0, max: -1 },
        videos: { min: 0, max: -1 },
        documents: { min: 0, max: -1 },
        audio: { min: 0, max: -1 }
      };
    } else {
      // Проверяем каждый тип медиа и устанавливаем значения по умолчанию, если не указаны
      ['photos', 'videos', 'documents', 'audio'].forEach(type => {
        if (!templateData.mediaFilters[type]) {
          templateData.mediaFilters[type] = { min: 0, max: -1 };
        } else {
          // Преобразуем строковые значения в числовые для корректного сравнения
          if (templateData.mediaFilters[type].min !== undefined) {
            templateData.mediaFilters[type].min = Number(templateData.mediaFilters[type].min);
          } else {
            templateData.mediaFilters[type].min = 0;
          }
          
          if (templateData.mediaFilters[type].max !== undefined) {
            templateData.mediaFilters[type].max = Number(templateData.mediaFilters[type].max);
          } else {
            templateData.mediaFilters[type].max = -1;
          }
        }
      });
    }

    const template = new FilterTemplate(templateData);
    await template.save();
    
    console.log('Created new filter template:', {
      name: template.name,
      mediaFilters: template.mediaFilters
    });
    
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating filter template:', error);
    res.status(400).json({ error: error.message });
  }
});

// Обновить шаблон
router.put('/:id', async (req, res) => {
  try {
    // Валидация и подготовка данных
    const templateData = { ...req.body, updatedAt: new Date() };
    
    // Тот же код обработки mediaFilters, что и при создании
    if (templateData.mediaFilters) {
      ['photos', 'videos', 'documents', 'audio'].forEach(type => {
        if (!templateData.mediaFilters[type]) {
          templateData.mediaFilters[type] = { min: 0, max: -1 };
        } else {
          if (templateData.mediaFilters[type].min !== undefined) {
            templateData.mediaFilters[type].min = Number(templateData.mediaFilters[type].min);
          } else {
            templateData.mediaFilters[type].min = 0;
          }
          
          if (templateData.mediaFilters[type].max !== undefined) {
            templateData.mediaFilters[type].max = Number(templateData.mediaFilters[type].max);
          } else {
            templateData.mediaFilters[type].max = -1;
          }
        }
      });
    }

    const template = await FilterTemplate.findByIdAndUpdate(
      req.params.id,
      templateData,
      { new: true }
    );
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    console.log('Updated filter template:', {
      name: template.name,
      mediaFilters: template.mediaFilters
    });
    
    res.json(template);
  } catch (error) {
    console.error('Error updating filter template:', error);
    res.status(400).json({ error: error.message });
  }
});

// Удалить шаблон
router.delete('/:id', async (req, res) => {
  try {
    const template = await FilterTemplate.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
