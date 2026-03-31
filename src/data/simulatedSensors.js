// Simulated sensor data generator for the Thermal Intelligence Dashboard

const rackNames = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function generateRackData() {
  return rackNames.map((name) => {
    const isGPU = Math.random() > 0.6;
    const basePower = isGPU ? rand(40, 120) : rand(8, 25);
    const inletTemp = rand(18, 24);
    const deltaT = basePower * 0.15 + rand(2, 8);
    const outletTemp = inletTemp + deltaT;
    const flowRate = rand(2, 12); // L/min
    const isHotspot = outletTemp > 45;
    const coolingType = isGPU
      ? (Math.random() > 0.5 ? 'd2c' : 'immersion')
      : (Math.random() > 0.7 ? 'rdhx' : 'air');

    return {
      name,
      power: Math.round(basePower * 10) / 10,
      inletTemp: Math.round(inletTemp * 10) / 10,
      outletTemp: Math.round(outletTemp * 10) / 10,
      deltaT: Math.round(deltaT * 10) / 10,
      flowRate: Math.round(flowRate * 10) / 10,
      coolingType,
      isGPU,
      isHotspot,
      utilization: Math.round(rand(40, 98)),
    };
  });
}

function generateTimeSeriesData(hours = 24) {
  const data = [];
  const now = Date.now();
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now - i * 3600000);
    const hourOfDay = time.getHours();
    // Simulate daily load pattern
    const loadFactor = 0.6 + 0.4 * Math.sin((hourOfDay - 6) * Math.PI / 12);

    const totalITPower = rand(800, 1200) * loadFactor;
    const totalFacilityPower = totalITPower * rand(1.08, 1.25);
    const pue = totalFacilityPower / totalITPower;
    const waterUsage = totalITPower * rand(0.5, 1.8) / 1000; // m3/hour
    const wue = waterUsage / (totalITPower / 1000);
    const carbonIntensity = rand(0.35, 0.50); // kgCO2/kWh
    const carbonEmissions = totalFacilityPower * carbonIntensity / 1000;

    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: time.getTime(),
      totalITPower: Math.round(totalITPower),
      totalFacilityPower: Math.round(totalFacilityPower),
      pue: Math.round(pue * 100) / 100,
      wue: Math.round(wue * 100) / 100,
      waterUsage: Math.round(waterUsage * 100) / 100,
      carbonEmissions: Math.round(carbonEmissions * 10) / 10,
      avgInletTemp: Math.round(rand(19, 23) * 10) / 10,
      avgOutletTemp: Math.round(rand(32, 42) * 10) / 10,
    });
  }
  return data;
}

function generateFacilityMetrics() {
  const totalITPower = rand(900, 1100);
  const pue = rand(1.08, 1.22);
  const totalPower = totalITPower * pue;
  const coolingPower = totalPower - totalITPower;

  return {
    totalITPower: Math.round(totalITPower),
    totalFacilityPower: Math.round(totalPower),
    coolingPower: Math.round(coolingPower),
    pue: Math.round(pue * 100) / 100,
    wue: Math.round(rand(0.5, 1.2) * 100) / 100,
    pce: Math.round(rand(82, 94) * 10) / 10,
    activeRacks: rackNames.length,
    gpuRacks: Math.round(rackNames.length * 0.4),
    hotspots: Math.round(rand(0, 4)),
    avgInletTemp: Math.round(rand(19, 23) * 10) / 10,
    avgOutletTemp: Math.round(rand(34, 41) * 10) / 10,
    coolingCapacity: Math.round(totalITPower * 1.3),
    wasteHeatRecoverable: Math.round(totalITPower * 0.95 * 0.6),
    annualCarbonTonnes: Math.round(totalPower * 8760 * 0.42 / 1000000 * 100) / 100,
    uptime: 99.97,
  };
}

export { generateRackData, generateTimeSeriesData, generateFacilityMetrics };
