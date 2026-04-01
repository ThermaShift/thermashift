import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, Thermometer, Droplets, Zap, Leaf, AlertTriangle,
  Server, Wind, RefreshCw, Gauge, Plus, Trash2, Edit3, Check, X,
  Building, Eye, ArrowLeft, Bell, Download, Upload, FileSpreadsheet,
  Brain, TrendingUp, TrendingDown, ShieldAlert, Wrench, ArrowUpRight,
} from 'lucide-react';

// Generate simulated data based on facility parameters
function generateFacilityData(facility) {
  const rand = (min, max) => +(min + Math.random() * (max - min)).toFixed(2);
  const rackCount = parseInt(facility.rackCount) || 50;
  const avgPower = parseFloat(facility.avgPowerPerRack) || 20;
  const basePUE = parseFloat(facility.targetPUE) || parseFloat(facility.currentPUE) || 1.5;

  const totalIT = rackCount * avgPower;
  const pue = rand(basePUE - 0.08, basePUE + 0.05);
  const totalFacility = totalIT * pue;
  const coolingPower = totalFacility - totalIT;

  // Generate racks
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
  const racks = [];
  const actualRackCount = Math.min(rackCount, 48); // cap visual at 48
  for (let i = 0; i < actualRackCount; i++) {
    const row = rows[Math.floor(i / 8) % rows.length];
    const col = (i % 8) + 1;
    const power = rand(avgPower * 0.6, avgPower * 1.4);
    const inletTemp = rand(18, 24);
    const outletTemp = rand(28, power > avgPower * 1.2 ? 48 : 42);
    racks.push({
      name: `${row}${col}`,
      power: +power.toFixed(0),
      inletTemp: +inletTemp.toFixed(1),
      outletTemp: +outletTemp.toFixed(1),
      isHotspot: outletTemp > (parseFloat(facility.alertTempThreshold) || 45),
      coolingType: facility.coolingType || 'Air',
    });
  }

  // Generate 24h time series
  const timeSeries = [];
  for (let h = 0; h < 24; h++) {
    const hour = `${String(h).padStart(2, '0')}:00`;
    const loadFactor = 0.7 + 0.3 * Math.sin((h - 6) * Math.PI / 12);
    const itPower = totalIT * loadFactor * rand(0.95, 1.05);
    const facPower = itPower * rand(basePUE - 0.05, basePUE + 0.05);
    timeSeries.push({
      time: hour,
      totalITPower: +itPower.toFixed(0),
      totalFacilityPower: +facPower.toFixed(0),
      pue: +(facPower / itPower).toFixed(3),
      avgInletTemp: +rand(18, 23).toFixed(1),
      avgOutletTemp: +rand(30, 40).toFixed(1),
      carbonEmissions: +(facPower * 0.42 / 1000).toFixed(2),
    });
  }

  const hotspots = racks.filter(r => r.isHotspot);
  const avgOutletTemp = racks.length > 0 ? +(racks.reduce((s, r) => s + r.outletTemp, 0) / racks.length).toFixed(1) : 0;
  const wasteHeatRecoverable = +(totalIT * 0.95 * 0.6).toFixed(0);

  return {
    metrics: {
      pue: pue.toFixed(2),
      totalITPower: totalIT,
      coolingPower: +coolingPower.toFixed(0),
      avgOutletTemp,
      hotspots: hotspots.length,
      annualCarbonTonnes: +((totalFacility * 8760 * 0.42) / 1000000).toFixed(1),
      uptime: rand(99.95, 99.999).toFixed(3),
      wasteHeatRecoverable,
      wue: rand(0.5, 1.8).toFixed(2),
    },
    racks,
    timeSeries,
    hotspots,
  };
}

// Parse CSV rack data into dashboard format
function parseCSVData(csvText, facility) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  // Parse a CSV line handling quoted fields
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }

  // Parse header — find column indices
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const findCol = (...names) => header.findIndex(h => names.some(n => h === n || h.startsWith(n)));

  const nameCol = findCol('rack', 'name', 'id', 'rackname', 'rackid');
  const powerCol = findCol('power', 'powerkw', 'kw', 'load', 'watts');
  const inletCol = findCol('inlet', 'inlettemp', 'inlettempc', 'supply');
  const outletCol = findCol('outlet', 'outlettemp', 'outlettempc', 'return', 'exhaust');
  const coolingCol = findCol('cooling', 'coolingtype', 'cooltype');

  if (powerCol === -1 && outletCol === -1) return null; // need at least power or temp

  const alertThreshold = parseFloat(facility.alertTempThreshold) || 45;
  const racks = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2 || cols.every(c => !c)) continue;

    const name = nameCol >= 0 ? (cols[nameCol] || `R${i}`) : `R${i}`;
    const power = powerCol >= 0 ? Math.max(0, parseFloat(cols[powerCol]) || 0) : 0;
    const inletTemp = inletCol >= 0 ? Math.max(-10, Math.min(60, parseFloat(cols[inletCol]) || 20)) : 20;
    const outletTemp = outletCol >= 0 ? Math.max(-10, Math.min(80, parseFloat(cols[outletCol]) || 30)) : 30;
    const coolingType = coolingCol >= 0 ? (cols[coolingCol] || 'Air') : facility.coolingType || 'Air';

    // Skip rows where all numeric values are zero/default (likely empty row)
    if (power === 0 && inletTemp === 20 && outletTemp === 30 && powerCol >= 0) continue;

    racks.push({
      name,
      power: +power.toFixed(0),
      inletTemp: +inletTemp.toFixed(1),
      outletTemp: +outletTemp.toFixed(1),
      isHotspot: outletTemp > alertThreshold,
      coolingType,
    });
  }

  if (racks.length === 0) return null;

  // Calculate metrics from real data
  const totalITPower = racks.reduce((s, r) => s + r.power, 0);
  const avgOutletTemp = +(racks.reduce((s, r) => s + r.outletTemp, 0) / racks.length).toFixed(1);
  const avgInletTemp = +(racks.reduce((s, r) => s + r.inletTemp, 0) / racks.length).toFixed(1);
  const currentPUE = parseFloat(facility.currentPUE) || 1.5;
  const totalFacility = totalITPower * currentPUE;
  const coolingPower = totalFacility - totalITPower;
  const hotspots = racks.filter(r => r.isHotspot);
  const wasteHeatRecoverable = +(totalITPower * 0.95 * 0.6).toFixed(0);

  // Generate time series from the imported snapshot (flat line with slight variation)
  const rand = (min, max) => +(min + Math.random() * (max - min)).toFixed(2);
  const timeSeries = [];
  for (let h = 0; h < 24; h++) {
    const hour = `${String(h).padStart(2, '0')}:00`;
    const variance = rand(0.97, 1.03);
    timeSeries.push({
      time: hour,
      totalITPower: +(totalITPower * variance).toFixed(0),
      totalFacilityPower: +(totalFacility * variance).toFixed(0),
      pue: +(currentPUE * rand(0.98, 1.02)).toFixed(3),
      avgInletTemp: +(avgInletTemp * rand(0.95, 1.05)).toFixed(1),
      avgOutletTemp: +(avgOutletTemp * rand(0.95, 1.05)).toFixed(1),
      carbonEmissions: +(totalFacility * variance * 0.42 / 1000).toFixed(2),
    });
  }

  return {
    metrics: {
      pue: currentPUE.toFixed(2),
      totalITPower,
      coolingPower: +coolingPower.toFixed(0),
      avgOutletTemp,
      hotspots: hotspots.length,
      annualCarbonTonnes: +((totalFacility * 8760 * 0.42) / 1000000).toFixed(1),
      uptime: '—',
      wasteHeatRecoverable,
      wue: '—',
    },
    racks,
    timeSeries,
    hotspots,
  };
}

function downloadCSVTemplate() {
  const template = `rack_name,power_kw,inlet_temp_c,outlet_temp_c,cooling_type
A1,22,20.5,35.2,Air
A2,28,21.0,38.1,Air
A3,45,19.8,42.5,RDHX
A4,18,20.2,33.0,Air
A5,52,20.0,41.8,D2C
B1,30,21.5,36.7,Air
B2,25,20.8,34.9,Air
B3,65,19.5,44.2,D2C
B4,20,21.0,32.5,Air
B5,40,20.3,39.8,RDHX`;
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'thermashift_rack_data_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// AI Thermal Intelligence Engine
function analyzeFacility(racks, metrics, facility) {
  const alertThreshold = parseFloat(facility.alertTempThreshold) || 45;
  const targetPUE = parseFloat(facility.targetPUE) || 1.2;
  const currentPUE = parseFloat(metrics.pue) || 1.5;
  const recommendations = [];

  if (racks.length === 0) return { score: 0, grade: '—', recommendations: [] };

  // Sort racks by risk
  const sortedByTemp = [...racks].sort((a, b) => b.outletTemp - a.outletTemp);
  const sortedByPower = [...racks].sort((a, b) => b.power - a.power);
  const avgPower = racks.reduce((s, r) => s + r.power, 0) / racks.length;
  const avgOutlet = racks.reduce((s, r) => s + r.outletTemp, 0) / racks.length;
  const maxTemp = sortedByTemp[0]?.outletTemp || 0;
  const maxPower = sortedByPower[0]?.power || 0;
  const hotspots = racks.filter(r => r.outletTemp > alertThreshold);
  const warningRacks = racks.filter(r => r.outletTemp > alertThreshold - 5 && r.outletTemp <= alertThreshold);
  const highDensity = racks.filter(r => r.power > avgPower * 1.3);
  const deltaTs = racks.map(r => r.outletTemp - r.inletTemp);
  const avgDeltaT = deltaTs.reduce((s, d) => s + d, 0) / deltaTs.length;
  const maxDeltaT = Math.max(...deltaTs);

  // Scoring (0-100)
  let score = 100;
  score -= hotspots.length * 12;
  score -= warningRacks.length * 5;
  score -= Math.max(0, (currentPUE - targetPUE) * 30);
  score -= Math.max(0, (avgOutlet - 38) * 3);
  score -= Math.max(0, (maxDeltaT - 25) * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  // CRITICAL: Active hotspots
  if (hotspots.length > 0) {
    const names = hotspots.map(r => r.name).join(', ');
    recommendations.push({
      severity: 'critical',
      icon: ShieldAlert,
      title: `${hotspots.length} rack${hotspots.length > 1 ? 's' : ''} above ${alertThreshold}°C threshold`,
      detail: `Racks ${names} require immediate cooling intervention. Sustained temperatures above ${alertThreshold}°C risk hardware damage and unplanned downtime.`,
      action: hotspots.some(r => r.power > 40)
        ? 'Deploy direct-to-chip or immersion cooling for these high-density racks immediately.'
        : 'Increase airflow to affected zones. Consider rear-door heat exchangers as a retrofit solution.',
    });
  }

  // WARNING: Racks approaching threshold
  if (warningRacks.length > 0) {
    const names = warningRacks.map(r => `${r.name} (${r.outletTemp}°C)`).join(', ');
    recommendations.push({
      severity: 'warning',
      icon: TrendingUp,
      title: `${warningRacks.length} rack${warningRacks.length > 1 ? 's' : ''} approaching thermal threshold`,
      detail: `Racks ${names} are within 5°C of the ${alertThreshold}°C alert threshold. These will likely become hotspots under peak load.`,
      action: 'Redistribute workloads away from these racks during peak hours, or proactively upgrade cooling before next load increase.',
    });
  }

  // HIGH DENSITY: Racks that need liquid cooling
  if (highDensity.length > 0) {
    const airCooledHigh = highDensity.filter(r => r.coolingType === 'Air' || r.coolingType === 'air');
    if (airCooledHigh.length > 0) {
      const names = airCooledHigh.map(r => `${r.name} (${r.power}kW)`).join(', ');
      recommendations.push({
        severity: 'warning',
        icon: Wrench,
        title: `${airCooledHigh.length} high-density rack${airCooledHigh.length > 1 ? 's' : ''} still on air cooling`,
        detail: `Racks ${names} are drawing ${Math.round(avgPower * 1.3)}+ kW but rely on air cooling. Air cooling is typically effective only up to 25kW per rack.`,
        action: airCooledHigh.some(r => r.power > 50)
          ? 'These racks are candidates for immersion cooling (PUE target: 1.03-1.06). ROI payback: 18-24 months.'
          : 'Retrofit with rear-door heat exchangers for 30-50% cooling improvement at lower cost than full liquid cooling.',
      });
    }
  }

  // PUE OPTIMIZATION
  if (currentPUE > targetPUE + 0.1) {
    const wastedPower = (racks.reduce((s, r) => s + r.power, 0)) * (currentPUE - targetPUE);
    const annualWaste = wastedPower * 8760 * 0.10;
    recommendations.push({
      severity: 'info',
      icon: TrendingDown,
      title: `PUE ${currentPUE} is ${(currentPUE - targetPUE).toFixed(2)} above target of ${targetPUE}`,
      detail: `Current cooling overhead is higher than optimal. This represents approximately ${Math.round(wastedPower)} kW of wasted cooling power, costing ~$${(annualWaste / 1000).toFixed(0)}K/year in excess energy.`,
      action: 'Implement hot/cold aisle containment if not already in place. Raise cold aisle temperature to ASHRAE recommended 27°C. Consider free cooling economizer hours.',
    });
  }

  // THERMAL IMBALANCE
  const tempStdDev = Math.sqrt(racks.reduce((s, r) => s + Math.pow(r.outletTemp - avgOutlet, 2), 0) / racks.length);
  if (tempStdDev > 5) {
    const coldest = sortedByTemp[sortedByTemp.length - 1];
    const hottest = sortedByTemp[0];
    recommendations.push({
      severity: 'info',
      icon: ArrowUpRight,
      title: 'Significant thermal imbalance detected across facility',
      detail: `Temperature spread: ${coldest.name} at ${coldest.outletTemp}°C vs ${hottest.name} at ${hottest.outletTemp}°C (${(hottest.outletTemp - coldest.outletTemp).toFixed(1)}°C delta). Standard deviation: ${tempStdDev.toFixed(1)}°C.`,
      action: 'Rebalance airflow distribution. Cold zones may have overcooled racks wasting energy while hot zones are underserved. Consider variable-speed fan drives for targeted cooling.',
    });
  }

  // COOLING TYPE UPGRADE PATH
  const airOnly = racks.filter(r => r.coolingType === 'Air' || r.coolingType === 'air');
  if (airOnly.length === racks.length && avgPower > 15) {
    recommendations.push({
      severity: 'info',
      icon: Wrench,
      title: 'Facility is 100% air-cooled — liquid cooling transition recommended',
      detail: `At ${avgPower.toFixed(0)} kW average per rack, this facility is at the upper limit of effective air cooling. Industry data shows liquid cooling delivers 30-50% energy savings at these densities.`,
      action: `Phase 1: Deploy rear-door HX on the top ${Math.min(10, Math.round(racks.length * 0.2))} highest-temperature racks. Phase 2: Evaluate direct-to-chip for racks above 40kW. Estimated annual savings: $${(racks.reduce((s, r) => s + r.power, 0) * 0.15 * 8760 * 0.10 / 1000).toFixed(0)}K.`,
    });
  }

  // POSITIVE: Everything looks good
  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'success',
      icon: TrendingDown,
      title: 'Facility thermal performance is optimal',
      detail: `All ${racks.length} racks within safe temperature ranges. PUE of ${currentPUE} meets target. No immediate action required.`,
      action: 'Continue monitoring. Consider waste heat recovery to generate additional revenue from thermal output.',
    });
  }

  return { score, grade, recommendations };
}

function MetricCard({ icon: Icon, label, value, unit, color, sub }) {
  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: color || 'var(--text)' }}>{value}</span>
            {unit && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{unit}</span>}
          </div>
          {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>{sub}</div>}
        </div>
        <Icon size={18} style={{ color: color || 'var(--accent)' }} />
      </div>
    </div>
  );
}

function RackHeatMap({ racks, threshold }) {
  const getColor = (temp) => {
    if (temp > (threshold || 45)) return '#ef4444';
    if (temp > 40) return '#f59e0b';
    if (temp > 35) return '#06b6d4';
    return '#10b981';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px' }}>
      {racks.map((rack) => (
        <div
          key={rack.name}
          style={{
            padding: '10px 6px', borderRadius: '6px',
            background: `${getColor(rack.outletTemp)}15`,
            border: `1px solid ${getColor(rack.outletTemp)}40`,
            textAlign: 'center', cursor: 'pointer',
          }}
          title={`${rack.name}: ${rack.power}kW | ${rack.outletTemp}°C`}
        >
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{rack.name}</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: getColor(rack.outletTemp) }}>{rack.outletTemp}°</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>{rack.power}kW</div>
          {rack.isHotspot && <AlertTriangle size={10} style={{ color: '#ef4444', marginTop: '2px' }} />}
        </div>
      ))}
    </div>
  );
}

function FacilityDashboard({ facility, onBack, onRefresh }) {
  const [data, setData] = useState(() => generateFacilityData(facility));
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [dataSource, setDataSource] = useState('simulated');
  const [importError, setImportError] = useState('');

  const refresh = useCallback(() => {
    if (dataSource === 'simulated') {
      setData(generateFacilityData(facility));
      setLastUpdate(new Date());
    }
  }, [facility, dataSource]);

  useEffect(() => {
    if (dataSource !== 'simulated') return;
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh, dataSource]);

  const handleCSVImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImportError('File too large. Maximum size is 5MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setImportError('Failed to read file. Please try again.');
    };
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        setImportError('Could not read file contents.');
        return;
      }

      const parsed = parseCSVData(text, facility);
      if (!parsed) {
        setImportError('Could not parse CSV. Make sure it has columns for rack name, power (kW), and/or temperatures. Download the template for the expected format.');
        return;
      }
      if (parsed.racks.length === 0) {
        setImportError('No valid rack data found in CSV. Check that data rows have numeric values for power or temperature.');
        return;
      }
      setData(parsed);
      setDataSource('imported');
      setLastUpdate(new Date());
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-imported
  };

  const switchToSimulated = () => {
    setDataSource('simulated');
    setData(generateFacilityData(facility));
    setLastUpdate(new Date());
    setImportError('');
  };

  const { metrics, racks, timeSeries, hotspots } = data;
  const alertThreshold = parseFloat(facility.alertTempThreshold) || 45;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{facility.clientName}</h2>
              <span style={{
                padding: '2px 8px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 700,
                background: facility.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: facility.status === 'Active' ? 'var(--success)' : 'var(--warning)',
              }}>{facility.status || 'Active'}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 700,
                background: dataSource === 'imported' ? 'rgba(6,182,212,0.15)' : 'rgba(100,116,139,0.15)',
                color: dataSource === 'imported' ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${dataSource === 'imported' ? 'rgba(6,182,212,0.3)' : 'rgba(100,116,139,0.3)'}`,
              }}>{dataSource === 'imported' ? `IMPORTED (${racks.length} racks)` : 'SIMULATED'}</span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
              {facility.facilityLocation} — Updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={downloadCSVTemplate} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            <Download size={14} /> Template
          </button>
          <label className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
            <Upload size={14} /> Import CSV
            <input type="file" accept=".csv,.txt" onChange={handleCSVImport} style={{ display: 'none' }} />
          </label>
          {dataSource === 'imported' ? (
            <button onClick={switchToSimulated} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Simulated
            </button>
          ) : (
            <button onClick={refresh} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', fontSize: '0.85rem',
        }}>
          {importError}
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <MetricCard icon={Gauge} label="PUE" value={metrics.pue} color={parseFloat(metrics.pue) > 1.4 ? 'var(--warning)' : 'var(--accent)'} sub={`Target: ${facility.targetPUE || '1.20'}`} />
        <MetricCard icon={Zap} label="IT Power" value={metrics.totalITPower} unit="kW" color="var(--warning)" />
        <MetricCard icon={Wind} label="Cooling" value={metrics.coolingPower} unit="kW" color="var(--accent)" />
        <MetricCard icon={Thermometer} label="Avg Outlet" value={metrics.avgOutletTemp} unit="°C" color={metrics.avgOutletTemp > 40 ? 'var(--danger)' : 'var(--success)'} />
        <MetricCard icon={AlertTriangle} label="Hotspots" value={metrics.hotspots} color={metrics.hotspots > 0 ? 'var(--danger)' : 'var(--success)'} sub={`Threshold: ${alertThreshold}°C`} />
        <MetricCard icon={Leaf} label="Carbon" value={metrics.annualCarbonTonnes} unit="kt/yr" color="var(--success)" />
        <MetricCard icon={Droplets} label="WUE" value={metrics.wue} unit="L/kWh" color="var(--accent)" />
        <MetricCard icon={Server} label="Uptime" value={metrics.uptime} unit="%" color="var(--success)" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>PUE Trend (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 9 }} interval={4} />
              <YAxis domain={[1.0, 2.0]} tick={{ fill: 'var(--text-dim)', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem' }} />
              <Line type="monotone" dataKey="pue" stroke="#06b6d4" strokeWidth={2} dot={false} name="PUE" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>Power Load (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 9 }} interval={4} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="totalFacilityPower" fill="rgba(6,182,212,0.1)" stroke="#06b6d4" strokeWidth={2} name="Total (kW)" />
              <Area type="monotone" dataKey="totalITPower" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth={2} name="IT (kW)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>Temperature (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 9 }} interval={4} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem' }} />
              <Line type="monotone" dataKey="avgInletTemp" stroke="#10b981" strokeWidth={2} dot={false} name="Inlet °C" />
              <Line type="monotone" dataKey="avgOutletTemp" stroke="#ef4444" strokeWidth={2} dot={false} name="Outlet °C" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>Carbon Emissions (24h)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fill: 'var(--text-dim)', fontSize: 9 }} interval={4} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="carbonEmissions" fill="rgba(245,158,11,0.1)" stroke="#f59e0b" strokeWidth={2} name="CO₂ (t/h)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rack Heat Map */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Rack Thermal Map ({racks.length} racks)</h3>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.65rem' }}>
            <span><span style={{ color: '#10b981' }}>{'\u25CF'}</span> {'<35°C'}</span>
            <span><span style={{ color: '#06b6d4' }}>{'\u25CF'}</span> 35-40°C</span>
            <span><span style={{ color: '#f59e0b' }}>{'\u25CF'}</span> 40-{alertThreshold}°C</span>
            <span><span style={{ color: '#ef4444' }}>{'\u25CF'}</span> {'>'}{alertThreshold}°C</span>
          </div>
        </div>
        <RackHeatMap racks={racks} threshold={alertThreshold} />
      </div>

      {/* Alerts */}
      {hotspots.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bell size={14} /> Active Alerts ({hotspots.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {hotspots.map((r) => (
              <div key={r.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: '6px',
                border: '1px solid rgba(239,68,68,0.15)', fontSize: '0.85rem', flexWrap: 'wrap', gap: '8px',
              }}>
                <span style={{ fontWeight: 600 }}>Rack {r.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{r.outletTemp}°C | {r.power}kW</span>
                <span style={{
                  padding: '2px 8px', borderRadius: '100px', fontSize: '0.65rem',
                  fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)',
                }}>ABOVE {alertThreshold}°C</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Thermal Intelligence */}
      {(() => {
        const analysis = analyzeFacility(racks, metrics, facility);
        const severityColors = {
          critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', color: '#ef4444', label: 'CRITICAL' },
          warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b', label: 'WARNING' },
          info: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)', color: '#06b6d4', label: 'OPTIMIZE' },
          success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', color: '#10b981', label: 'OPTIMAL' },
        };
        const gradeColors = { A: '#10b981', B: '#06b6d4', C: '#f59e0b', D: '#f97316', F: '#ef4444' };

        return (
          <div className="card" style={{ padding: '20px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, var(--surface) 100%)', borderColor: 'rgba(139,92,246,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={16} style={{ color: '#8b5cf6' }} /> AI Thermal Intelligence
                <span style={{
                  padding: '2px 8px', borderRadius: '100px', fontSize: '0.6rem', fontWeight: 700,
                  background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)',
                }}>PRO</span>
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Health Score</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: gradeColors[analysis.grade] || 'var(--text)' }}>
                    {analysis.score}/100
                  </div>
                </div>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  background: `${gradeColors[analysis.grade] || '#64748b'}20`,
                  border: `2px solid ${gradeColors[analysis.grade] || '#64748b'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', fontWeight: 900, color: gradeColors[analysis.grade] || 'var(--text)',
                }}>
                  {analysis.grade}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {analysis.recommendations.map((rec, i) => {
                const sev = severityColors[rec.severity] || severityColors.info;
                return (
                  <div key={i} style={{
                    padding: '16px', borderRadius: '8px',
                    background: sev.bg, border: `1px solid ${sev.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <rec.icon size={16} style={{ color: sev.color }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: sev.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sev.label}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{rec.title}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '8px' }}>
                      {rec.detail}
                    </p>
                    <div style={{
                      fontSize: '0.8rem', color: sev.color, fontWeight: 600,
                      padding: '8px 12px', background: `${sev.color}10`, borderRadius: '6px',
                      borderLeft: `3px solid ${sev.color}`,
                    }}>
                      Recommended: {rec.action}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Waste Heat */}
      <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, var(--surface) 100%)', borderColor: 'rgba(16,185,129,0.2)' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Leaf size={14} style={{ color: 'var(--success)' }} /> Waste Heat Recovery
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Recoverable Output</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>{metrics.wasteHeatRecoverable} kW</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Est. Annual Revenue</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>${(metrics.wasteHeatRecoverable * 8760 * 0.03 / 1000).toFixed(0)}K</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Outlet Temperature</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)' }}>{metrics.avgOutletTemp}°C</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const INITIAL_FACILITIES = [];

export default function Monitor() {
  const [facilities, setFacilities] = useState(() => {
    try {
      const saved = localStorage.getItem('thermashift_facilities');
      if (!saved) return INITIAL_FACILITIES;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_FACILITIES;
    } catch {
      return INITIAL_FACILITIES;
    }
  });
  const [viewing, setViewing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newFacility, setNewFacility] = useState({
    clientName: '', facilityLocation: '', rackCount: '100', avgPowerPerRack: '20',
    currentPUE: '1.58', targetPUE: '1.20', coolingType: 'Air', alertTempThreshold: '45', status: 'Active',
  });

  const save = (updated) => {
    setFacilities(updated);
    try { localStorage.setItem('thermashift_facilities', JSON.stringify(updated)); } catch {}
  };

  const addFacility = () => {
    if (!newFacility.clientName.trim()) return;
    save([...facilities, { ...newFacility, id: Date.now() }]);
    setNewFacility({
      clientName: '', facilityLocation: '', rackCount: '100', avgPowerPerRack: '20',
      currentPUE: '1.58', targetPUE: '1.20', coolingType: 'Air', alertTempThreshold: '45', status: 'Active',
    });
    setShowAdd(false);
  };

  const deleteFacility = (id) => {
    if (!confirm('Remove this facility?')) return;
    save(facilities.filter(f => f.id !== id));
  };

  const viewedFacility = viewing ? facilities.find(f => f.id === viewing) : null;

  return (
    <main style={{ paddingTop: '72px', background: 'var(--gradient-end)', minHeight: '100vh' }}>
      <section style={{ padding: '24px 0' }}>
        <div className="container">
          {viewedFacility ? (
            <FacilityDashboard facility={viewedFacility} onBack={() => setViewing(null)} />
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <Activity size={22} style={{ color: 'var(--accent)' }} />
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Thermal Intelligence Platform</h1>
                    <span style={{
                      padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700,
                      background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)',
                    }}>INTERNAL</span>
                  </div>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {facilities.length} client {facilities.length === 1 ? 'facility' : 'facilities'} monitored
                  </p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                  <Plus size={18} /> Add Facility
                </button>
              </div>

              {/* Add Form */}
              {showAdd && (
                <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>Add Client Facility</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <label>Client Name *</label>
                      <input value={newFacility.clientName} onChange={(e) => setNewFacility({ ...newFacility, clientName: e.target.value })} placeholder="Flexential" />
                    </div>
                    <div>
                      <label>Location</label>
                      <input value={newFacility.facilityLocation} onChange={(e) => setNewFacility({ ...newFacility, facilityLocation: e.target.value })} placeholder="Charlotte, NC" />
                    </div>
                    <div>
                      <label>Rack Count</label>
                      <input type="number" value={newFacility.rackCount} onChange={(e) => setNewFacility({ ...newFacility, rackCount: e.target.value })} />
                    </div>
                    <div>
                      <label>Avg Power/Rack (kW)</label>
                      <input type="number" value={newFacility.avgPowerPerRack} onChange={(e) => setNewFacility({ ...newFacility, avgPowerPerRack: e.target.value })} />
                    </div>
                    <div>
                      <label>Current PUE</label>
                      <input type="number" step="0.01" value={newFacility.currentPUE} onChange={(e) => setNewFacility({ ...newFacility, currentPUE: e.target.value })} />
                    </div>
                    <div>
                      <label>Target PUE</label>
                      <input type="number" step="0.01" value={newFacility.targetPUE} onChange={(e) => setNewFacility({ ...newFacility, targetPUE: e.target.value })} />
                    </div>
                    <div>
                      <label>Cooling Type</label>
                      <select value={newFacility.coolingType} onChange={(e) => setNewFacility({ ...newFacility, coolingType: e.target.value })}>
                        <option value="Air">Air Cooling</option>
                        <option value="RDHX">Rear-Door HX</option>
                        <option value="D2C">Direct-to-Chip</option>
                        <option value="Immersion">Immersion</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label>Alert Threshold (°C)</label>
                      <input type="number" value={newFacility.alertTempThreshold} onChange={(e) => setNewFacility({ ...newFacility, alertTempThreshold: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={addFacility} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <Check size={16} /> Add Facility
                    </button>
                    <button onClick={() => setShowAdd(false)} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Facility Cards */}
              {facilities.length === 0 ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                  <Building size={48} style={{ color: 'var(--text-dim)', marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>No Facilities Yet</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                    Add a client facility to start monitoring their cooling infrastructure.
                  </p>
                  <button onClick={() => setShowAdd(true)} className="btn btn-primary">
                    <Plus size={18} /> Add Your First Facility
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  {facilities.map(f => {
                    const totalPower = (parseInt(f.rackCount) || 0) * (parseFloat(f.avgPowerPerRack) || 0);
                    return (
                      <div key={f.id} className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{f.clientName}</h3>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{f.facilityLocation}</p>
                          </div>
                          <span style={{
                            padding: '2px 8px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 700,
                            background: f.status === 'Active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            color: f.status === 'Active' ? 'var(--success)' : 'var(--warning)',
                          }}>{f.status}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Racks</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{f.rackCount}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Total IT</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{totalPower} kW</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '2px' }}>PUE</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>{f.currentPUE}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', background: 'var(--primary)', borderRadius: '4px' }}>{f.coolingType}</span>
                          <span style={{ padding: '2px 8px', background: 'var(--primary)', borderRadius: '4px' }}>Target: {f.targetPUE}</span>
                          <span style={{ padding: '2px 8px', background: 'var(--primary)', borderRadius: '4px' }}>Alert: {f.alertTempThreshold}°C</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setViewing(f.id)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem', flex: 1, justifyContent: 'center' }}>
                            <Eye size={14} /> View Dashboard
                          </button>
                          <button onClick={() => deleteFacility(f.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-dim)', padding: '8px', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
