const { getAIHealth, getMapHealth } = require('../services/external.service');

async function health(req, res, next) {
  try {
    const [ai, map] = await Promise.allSettled([getAIHealth(), getMapHealth()]);
    res.json({
      backend: 'healthy',
      aiService: ai.status === 'fulfilled' ? ai.value : { status: 'unavailable' },
      mapService: map.status === 'fulfilled' ? map.value : { status: 'unavailable' },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { health };
