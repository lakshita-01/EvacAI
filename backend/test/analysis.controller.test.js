jest.mock('../src/services/external.service', () => ({
  analyzeFrame: jest.fn(),
  getMap: jest.fn(),
  calculateRoute: jest.fn(),
  reroute: jest.fn(),
  resetAllHazards: jest.fn(),
}));
jest.mock('../src/services/alert.service', () => ({ createAlert: jest.fn() }));
jest.mock('../src/models/Detection', () => ({ create: jest.fn() }));
jest.mock('../src/models/Route', () => ({ create: jest.fn() }));

const externalService = require('../src/services/external.service');
const alertService = require('../src/services/alert.service');
const Detection = require('../src/models/Detection');
const Route = require('../src/models/Route');
const { simulate } = require('../src/controllers/analysis.controller');

describe('map-based simulations', () => {
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    externalService.getMap.mockResolvedValue({
      nodes: {
        'ROOM-1': { id: 'ROOM-1', type: 'room' },
        'ROOM-2': { id: 'ROOM-2', type: 'room' },
        'EXIT-1': { id: 'EXIT-1', type: 'exit' },
      },
    });
    externalService.reroute.mockResolvedValue({
      startNode: 'ROOM-1',
      exitNode: 'EXIT-1',
      route: ['ROOM-1', 'ROOM-2', 'EXIT-1'],
      distance: 300,
      risk: 'critical',
      rerouted: true,
    });
    Detection.create.mockResolvedValue({ _id: 'detection-1' });
    Route.create.mockResolvedValue({ _id: 'route-1' });
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('applies a fire simulation to the selected map area', async () => {
    const req = {
      body: { scenario: 'fire', mapId: 'MAP-001', nodeId: 'ROOM-2', startNode: 'ROOM-1' },
      app: { get: jest.fn().mockReturnValue(null) },
    };

    await simulate(req, res, next);

    expect(externalService.resetAllHazards).toHaveBeenCalledWith('MAP-001');
    expect(externalService.reroute).toHaveBeenCalledWith(
      'MAP-001', 'USER-MARKED', 'ROOM-2', 'CRITICAL', 'ROOM-1'
    );
    expect(Detection.create).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 'ROOM-2',
      fireDetected: true,
      smokeDetected: true,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ scenario: 'fire' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a simulation target not present in the selected map', async () => {
    const req = {
      body: { scenario: 'smoke', mapId: 'MAP-001', nodeId: 'UNKNOWN' },
      app: { get: jest.fn().mockReturnValue(null) },
    };

    await simulate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unknown simulation area: UNKNOWN' });
    expect(externalService.resetAllHazards).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('records blocked-area simulations with the supported alert type', async () => {
    const req = {
      body: { scenario: 'blocked', mapId: 'MAP-001', nodeId: 'EXIT-1', startNode: 'ROOM-1' },
      app: { get: jest.fn().mockReturnValue(null) },
    };

    await simulate(req, res, next);

    expect(alertService.createAlert).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ type: 'ROUTE_BLOCKED' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
