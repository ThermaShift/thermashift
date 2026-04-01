import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calculator, DollarSign, Leaf, Thermometer, TrendingDown, Zap, Download } from 'lucide-react';

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];

function fmt(n) {
  if (n <= 0) return '$0';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function CalculatorPage() {
  const [inputs, setInputs] = useState({
    rackCount: '100',
    avgPowerPerRack: '20',
    currentPUE: '1.58',
    electricityRate: '0.10',
    coolingType: 'rdhx',
  });

  const set = (key, val) => setInputs(prev => ({ ...prev, [key]: val }));

  // Parse numeric values for calculations, with sensible defaults
  const rackCount = Math.max(1, parseInt(inputs.rackCount) || 0);
  const avgPowerPerRack = Math.max(1, parseFloat(inputs.avgPowerPerRack) || 0);
  const currentPUE = Math.max(1.0, Math.min(3.0, parseFloat(inputs.currentPUE) || 1.5));
  const electricityRate = Math.max(0.01, parseFloat(inputs.electricityRate) || 0.08);

  // Calculations
  const totalITPower = rackCount * avgPowerPerRack; // kW
  const currentTotalPower = totalITPower * currentPUE; // kW
  const currentCoolingPower = currentTotalPower - totalITPower; // kW
  const annualHours = 8760;
  const currentAnnualEnergy = currentTotalPower * annualHours; // kWh
  const currentAnnualCost = currentAnnualEnergy * electricityRate;
  const currentCoolingCost = currentCoolingPower * annualHours * electricityRate;

  // Target PUE by cooling type (never worse than current)
  const targetPUE = {
    air: currentPUE,
    rdhx: Math.min(currentPUE, Math.max(1.2, currentPUE - 0.15)),
    d2c: Math.min(currentPUE, 1.15),
    immersion: Math.min(currentPUE, 1.06),
  };

  const newPUE = targetPUE[inputs.coolingType];
  const newTotalPower = totalITPower * newPUE;
  const newCoolingPower = newTotalPower - totalITPower;
  const newAnnualEnergy = newTotalPower * annualHours;
  const newAnnualCost = newAnnualEnergy * electricityRate;
  const newCoolingCost = newCoolingPower * annualHours * electricityRate;

  const annualSavings = Math.max(0, currentAnnualCost - newAnnualCost);
  const coolingSavingsPercent = currentCoolingCost > 0 ? Math.max(0, (currentCoolingCost - newCoolingCost) / currentCoolingCost * 100) : 0;

  // Waste heat recovery potential
  const wasteHeatKW = totalITPower * 0.95; // 95% of IT load becomes heat
  const recoverableHeatKW = wasteHeatKW * 0.6; // 60% recoverable
  const heatRevenuePerKWh = 0.03; // conservative $/kWh for district heating
  const annualHeatRevenue = recoverableHeatKW * annualHours * heatRevenuePerKWh;

  // Carbon impact
  const carbonFactor = 0.42; // kg CO2 per kWh (US average)
  const annualCarbonReduction = Math.max(0, (currentAnnualEnergy - newAnnualEnergy) * carbonFactor / 1000); // tonnes

  // 5 year projection
  const fiveYearSavings = annualSavings * 5;
  const fiveYearHeatRevenue = annualHeatRevenue * 5;
  const totalFiveYearValue = fiveYearSavings + fiveYearHeatRevenue;

  const comparisonData = [
    { name: 'Current', cooling: Math.round(currentCoolingCost), total: Math.round(currentAnnualCost) },
    { name: 'After ThermaShift', cooling: Math.round(newCoolingCost), total: Math.round(newAnnualCost) },
  ];

  const savingsBreakdown = [
    { name: 'Energy Savings', value: Math.round(annualSavings) },
    { name: 'Heat Revenue', value: Math.round(annualHeatRevenue) },
  ];

  const yearlyProjection = Array.from({ length: 5 }, (_, i) => ({
    year: `Year ${i + 1}`,
    savings: Math.round(annualSavings * (i + 1)),
    heatRevenue: Math.round(annualHeatRevenue * (i + 1)),
  }));

  return (
    <main style={{ paddingTop: '72px' }}>
      <section style={{ padding: '60px 0 40px' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Calculator size={28} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Cooling ROI Calculator</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', maxWidth: '600px' }}>
            See how much your facility could save with optimized cooling — plus potential revenue from waste heat recovery.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: '80px' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'start' }}>
          {/* Inputs */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '24px' }}>Your Facility</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label>Number of Racks</label>
                <input
                  type="number"
                  value={inputs.rackCount}
                  onChange={(e) => set('rackCount', e.target.value)}
                />
              </div>

              <div>
                <label>Average Power per Rack (kW)</label>
                <input
                  type="number"
                  value={inputs.avgPowerPerRack}
                  onChange={(e) => set('avgPowerPerRack', e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  Traditional: 5-15kW | Mixed: 15-30kW | GPU/AI: 40-140kW
                </span>
              </div>

              <div>
                <label>Current PUE</label>
                <input
                  type="number"
                  step="0.01"
                  value={inputs.currentPUE}
                  onChange={(e) => set('currentPUE', e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  Industry avg: 1.58 (Uptime Institute 2023) | Best-in-class: 1.1
                </span>
              </div>

              <div>
                <label>Electricity Rate ($/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={inputs.electricityRate}
                  onChange={(e) => set('electricityRate', e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  US commercial avg: $0.11/kWh | DC negotiated: $0.05-0.10
                </span>
              </div>

              <div>
                <label>Target Cooling Solution</label>
                <select
                  value={inputs.coolingType}
                  onChange={(e) => set('coolingType', e.target.value)}
                >
                  <option value="air">Air Cooling (baseline)</option>
                  <option value="rdhx">Rear-Door Heat Exchangers</option>
                  <option value="d2c">Direct-to-Chip Liquid Cooling</option>
                  <option value="immersion">Immersion Cooling</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              {[
                { icon: DollarSign, label: 'Annual Energy Savings', value: fmt(annualSavings), color: 'var(--success)' },
                { icon: Thermometer, label: 'Waste Heat Revenue/yr', value: fmt(annualHeatRevenue), color: 'var(--accent)' },
                { icon: Leaf, label: 'Carbon Reduction/yr', value: `${annualCarbonReduction.toFixed(0)} tonnes`, color: 'var(--success)' },
                { icon: TrendingDown, label: 'New PUE', value: newPUE.toFixed(2), color: 'var(--accent)' },
                { icon: Zap, label: 'Cooling Cost Reduction', value: `${coolingSavingsPercent.toFixed(0)}%`, color: 'var(--warning)' },
                { icon: DollarSign, label: '5-Year Total Value', value: fmt(totalFiveYearValue), color: 'var(--success)' },
              ].map((card, i) => (
                <div key={i} className="card" style={{ padding: '20px' }}>
                  <card.icon size={18} style={{ color: card.color, marginBottom: '8px' }} />
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Cost comparison chart */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '24px' }}>Annual Cost Comparison</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}
                    formatter={(v) => fmt(v)}
                  />
                  <Bar dataKey="cooling" name="Cooling Cost" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="Total Energy Cost" fill="#334155" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 5-year projection */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '24px' }}>5-Year Cumulative Value</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={yearlyProjection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}
                    formatter={(v) => fmt(v)}
                  />
                  <Bar dataKey="savings" name="Energy Savings" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="heatRevenue" name="Heat Revenue" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* CTA */}
            <div className="card" style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, var(--surface) 100%)',
              textAlign: 'center',
              padding: '40px',
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
                Your facility could save {fmt(annualSavings)}/year in energy costs
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Plus {fmt(annualHeatRevenue)}/year in waste heat revenue. Let us show you how.
              </p>
              <Link to="/contact" className="btn btn-primary">
                Get Your Custom Analysis <Download size={18} />
              </Link>
            </div>

            {/* Methodology */}
            <div className="card" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>How We Calculate These Numbers</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Energy Savings</div>
                  Savings come from PUE improvement. PUE (Power Usage Effectiveness) measures total facility power divided by IT power.
                  A PUE of 1.58 means 58% overhead goes to cooling, lighting, and losses. Reducing PUE directly reduces your energy bill.
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Target PUE by Cooling Type</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '4px' }}>
                    <span>Rear-Door HX: PUE 1.20-1.40 <span style={{ color: 'var(--text-dim)' }}>(Motivair, CoolIT)</span></span>
                    <span>Direct-to-Chip: PUE 1.10-1.18 <span style={{ color: 'var(--text-dim)' }}>(Google, Microsoft)</span></span>
                    <span>Immersion: PUE 1.02-1.06 <span style={{ color: 'var(--text-dim)' }}>(GRC, LiquidCool)</span></span>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Waste Heat Revenue</div>
                  ~95% of IT power becomes heat (thermodynamics). We assume 60% is recoverable with liquid cooling,
                  valued at $0.03/kWh — a conservative rate based on European district heating markets.
                  US market rates are still emerging.
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Carbon Reduction</div>
                  Based on EPA 2023 US average grid emissions factor of 0.42 kg CO₂/kWh.
                  Actual values vary by region (NC: ~0.35-0.45, VA: ~0.30-0.40 kg/kWh).
                </div>
                <div style={{ padding: '12px 16px', background: 'var(--primary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Note:</span> Energy savings are based on proven, deployed technology and are directly
                  measurable. Waste heat revenue estimates are based on market potential — actual revenue depends on local heat buyers and agreements.
                  These projections are starting points; a site-specific assessment provides precise numbers.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
