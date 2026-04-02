import { useState } from 'react';
import { Calendar, Copy, Check, RefreshCw, Link as LinkIcon, TrendingUp, Zap, Leaf, Thermometer, BarChart3, FileText } from 'lucide-react';

const POST_LIBRARY = [
  {
    category: 'Industry Stats',
    icon: BarChart3,
    posts: [
      {
        title: 'Cooling = 40% of DC energy',
        content: `Did you know cooling accounts for 40% of total data center energy consumption?\n\nWith AI workloads pushing rack densities past 100kW, traditional air cooling simply can't keep up.\n\nThe math is simple:\n- Air cooling: effective up to 25kW/rack\n- Rear-door HX: handles 25-40kW/rack\n- Direct-to-chip: supports 40-100kW/rack\n- Immersion: handles 100kW+ per rack\n\nIf your PUE is above 1.4, you're leaving money on the table.\n\n#DataCenter #Cooling #EnergyEfficiency #AI #Sustainability`,
      },
      {
        title: '$1.3T cooling investment by 2030',
        content: `McKinsey estimates $5.2 TRILLION in AI data center infrastructure by 2030.\n\n25% of that — $1.3 trillion — goes to cooling and power.\n\nThe liquid cooling market alone is projected to grow from $2B to $18B+ by 2030 (27% CAGR).\n\nThis isn't a trend. It's a fundamental shift in how we manage thermal output.\n\nIs your facility ready?\n\n#DataCenter #LiquidCooling #AI #Infrastructure #McKinsey`,
      },
      {
        title: 'PUE benchmark reality check',
        content: `Industry average PUE: 1.58 (Uptime Institute 2023)\nBest-in-class: 1.10\nYour facility: ???\n\nEvery 0.1 improvement in PUE saves roughly 7% on your total energy bill.\n\nFor a 200-rack facility at 20kW/rack:\n- PUE 1.58 → 1.40 = $245K/year savings\n- PUE 1.58 → 1.20 = $520K/year savings\n\nThe technology exists. The ROI is clear. The question is timing.\n\nFree PUE assessment: thermashift.net/contact\n\n#DataCenter #PUE #EnergyEfficiency #CostReduction`,
      },
    ],
  },
  {
    category: 'Thought Leadership',
    icon: TrendingUp,
    posts: [
      {
        title: 'Waste heat is not waste',
        content: `Every data center is a power plant hiding in plain sight.\n\n95% of all electricity consumed by IT equipment becomes heat. Most facilities vent this directly into the atmosphere.\n\nBut that "waste" heat is 32-45°C — perfect for:\n\n🌱 Greenhouse heating\n🏘️ District heating networks\n🧪 Algae bioreactors (carbon capture)\n🏊 Swimming pool heating\n🍺 Industrial processes\n\nIn Germany, data centers will be REQUIRED to reuse heat by 2026.\n\nThe US market is wide open. First movers will capture the revenue.\n\nAt ThermaShift, we broker waste heat into revenue streams.\n\n#WasteHeat #Sustainability #DataCenter #CircularEconomy #ESG`,
      },
      {
        title: 'The AI cooling crisis nobody talks about',
        content: `NVIDIA's Blackwell Ultra rack: 140kW of heat per rack.\n\nTraditional air cooling maxes out at 25kW.\n\nThat's a 5.6x gap between what AI demands and what most facilities can deliver.\n\nThis isn't a future problem. It's happening NOW:\n\n- Hyperscalers are deploying liquid cooling at scale\n- Colo providers are losing AI deals because they can't cool the racks\n- 70% of data center outages involve power or cooling failures\n\nThe facilities that solve cooling first will win the AI infrastructure race.\n\n#AI #DataCenter #LiquidCooling #NVIDIA #Blackwell`,
      },
      {
        title: 'ESG is not optional anymore',
        content: `3 regulatory shifts data center operators can't ignore:\n\n1. EU Energy Efficiency Directive — mandates waste heat reuse by 2026\n2. SEC Climate Disclosure Rules — public companies must report climate risks\n3. Customer demands — 78% of enterprise buyers now require ESG data from their DC providers\n\nIf you're not tracking PUE, WUE, and carbon emissions today, you're already behind.\n\nThe good news: real-time monitoring makes compliance automatic, not painful.\n\nWe help facilities go from "we should track this" to "here's our quarterly ESG report" in under a week.\n\n#ESG #DataCenter #Compliance #Sustainability #CarbonReporting`,
      },
    ],
  },
  {
    category: 'Product / Service',
    icon: Thermometer,
    posts: [
      {
        title: 'Free cooling efficiency review',
        content: `Offering free 30-minute cooling efficiency reviews for data center operators in the Charlotte, Research Triangle, and Northern Virginia markets.\n\nWhat you get:\n✅ PUE baseline assessment\n✅ Liquid cooling options for your rack density\n✅ Waste heat monetization estimate\n✅ ESG compliance gap analysis\n✅ Actionable next steps\n\nNo obligation. No sales pitch. Just data.\n\n30 minutes could save your facility $200K+ per year.\n\nBook yours: thermashift.net/contact\n\n#DataCenter #Cooling #FreeAssessment #Charlotte #RTP #NoVA`,
      },
      {
        title: 'AI-powered thermal monitoring',
        content: `We just launched the ThermaShift Thermal Intelligence Platform.\n\nWhat it does:\n🔍 Real-time monitoring of every rack in your facility\n🧠 AI predicts hotspots BEFORE they happen\n📊 PUE/WUE/Carbon reporting on autopilot\n🚨 Instant alerts when thresholds are breached\n📈 Cooling optimization recommendations with ROI\n\nStarts at $10/rack/month. No hardware required — our lightweight agent installs in 5 minutes.\n\nSee it in action: thermashift.net/dashboard\n\n#DataCenter #Monitoring #AI #ThermalIntelligence #SaaS`,
      },
      {
        title: 'Case study template: cooling ROI',
        content: `Just ran the numbers for a 200-rack facility in Charlotte:\n\nCurrent state:\n- PUE: 1.58\n- Annual cooling cost: $1.4M\n- Waste heat: vented to atmosphere\n\nAfter ThermaShift optimization:\n- PUE: 1.20\n- Annual cooling cost: $880K\n- Waste heat revenue: $150K/year\n- Carbon reduction: 2,400 tonnes CO₂/year\n\nTotal annual value: $670K\nPayback period: 8 months\n\nThese aren't projections. This is what liquid cooling + thermal intelligence delivers.\n\nRun your own numbers: thermashift.net/calculator\n\n#DataCenter #ROI #Cooling #Sustainability #CaseStudy`,
      },
    ],
  },
  {
    category: 'Tips & Education',
    icon: Zap,
    posts: [
      {
        title: '5 signs your DC needs liquid cooling',
        content: `5 signs your data center needs liquid cooling (yesterday):\n\n1️⃣ Rack densities exceeding 25kW — air can't keep up\n2️⃣ Hot spots that won't go away despite containment\n3️⃣ PUE stuck above 1.4 with no improvement path\n4️⃣ Clients requesting AI/GPU workload support\n5️⃣ Cooling system running at 90%+ capacity\n\nIf you checked 2 or more, it's time to evaluate.\n\nThe transition doesn't have to be all-or-nothing. Start with rear-door heat exchangers on your hottest racks.\n\n#DataCenter #LiquidCooling #Infrastructure #Tips`,
      },
      {
        title: 'ASHRAE thermal guidelines',
        content: `ASHRAE TC 9.9 recommended operating ranges for data centers:\n\n🌡️ Inlet temperature: 18-27°C (64-80°F)\n💧 Humidity: 8-60% RH\n📊 Recommended class: A1\n\nMost facilities run cold aisles at 18-20°C "just to be safe."\n\nRaising your cold aisle to 25-27°C can reduce cooling energy by 15-20% with ZERO hardware changes.\n\nIt's the easiest PUE improvement you'll ever make.\n\n#DataCenter #ASHRAE #EnergyEfficiency #CoolingTips`,
      },
      {
        title: 'PUE explained simply',
        content: `PUE explained in 30 seconds:\n\nPUE = Total Facility Power / IT Equipment Power\n\nPUE 1.0 = Perfect (impossible)\nPUE 1.2 = Excellent\nPUE 1.5 = Average\nPUE 2.0 = Half your power is wasted on cooling\n\nWhy it matters:\n- Every 0.1 PUE improvement = ~7% energy savings\n- A 1MW facility at PUE 1.5 vs 1.2 wastes $263K/year\n- Investors, clients, and regulators all ask for PUE\n\nWhat's your number?\n\nFree PUE assessment: thermashift.net/contact\n\n#DataCenter #PUE #EnergyEfficiency #101`,
      },
    ],
  },
  {
    category: 'Sustainability',
    icon: Leaf,
    posts: [
      {
        title: 'Data centers and water usage',
        content: `A single large data center can consume 3-5 million gallons of water PER DAY for cooling.\n\nThat's equivalent to the daily water usage of a city of 30,000-50,000 people.\n\nLiquid cooling (direct-to-chip, immersion) uses closed-loop systems that reduce water consumption by up to 90%.\n\nWUE (Water Usage Effectiveness) is becoming as important as PUE.\n\nAre you tracking yours?\n\n#DataCenter #Water #Sustainability #WUE #ESG`,
      },
      {
        title: 'Carbon footprint of cooling',
        content: `The carbon footprint of data center cooling in the US:\n\n- 0.42 kg CO₂ per kWh (EPA grid average)\n- A 1MW facility at PUE 1.5 generates ~2,760 tonnes CO₂/year from cooling alone\n- That's equivalent to 600 cars on the road\n\nReducing PUE from 1.5 to 1.2 eliminates ~1,100 tonnes CO₂/year.\n\nCooling optimization isn't just about cost savings. It's about environmental responsibility.\n\n#DataCenter #Carbon #Sustainability #ClimateAction #ESG`,
      },
    ],
  },
];

const SCHEDULES = ['Monday 9am', 'Tuesday 10am', 'Wednesday 9am', 'Thursday 10am', 'Friday 9am'];

export default function Content() {
  const [copied, setCopied] = useState(null);
  const [scheduled, setScheduled] = useState(() => {
    try {
      const saved = localStorage.getItem('thermashift_content_schedule');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [selectedCategory, setSelectedCategory] = useState('all');

  const copyPost = (post) => {
    navigator.clipboard.writeText(post.content);
    setCopied(post.title);
    setTimeout(() => setCopied(null), 2000);
  };

  const schedulePost = (post, day) => {
    const entry = { ...post, scheduledFor: day, addedAt: new Date().toISOString() };
    const updated = [...scheduled, entry];
    setScheduled(updated);
    try { localStorage.setItem('thermashift_content_schedule', JSON.stringify(updated)); } catch {}
  };

  const removeScheduled = (idx) => {
    const updated = scheduled.filter((_, i) => i !== idx);
    setScheduled(updated);
    try { localStorage.setItem('thermashift_content_schedule', JSON.stringify(updated)); } catch {}
  };

  const filteredLibrary = selectedCategory === 'all'
    ? POST_LIBRARY
    : POST_LIBRARY.filter(cat => cat.category === selectedCategory);

  return (
    <main style={{ paddingTop: '72px', minHeight: '100vh' }}>
      <section style={{ padding: '40px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <LinkIcon size={28} style={{ color: '#0a66c2' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>LinkedIn Content Hub</h1>
            <span style={{ padding: '2px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}>INTERNAL</span>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            Pre-written LinkedIn posts ready to copy and paste. Each post is optimized for engagement with industry hashtags.
          </p>

          {/* Content Calendar */}
          {scheduled.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--accent)' }} /> Content Calendar ({scheduled.length} scheduled)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {scheduled.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 16px', background: 'var(--primary)', borderRadius: '6px',
                    border: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.title}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginLeft: '12px' }}>{item.scheduledFor}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => copyPost(item)} style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                        color: copied === item.title ? 'var(--success)' : 'var(--text-muted)',
                        padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer',
                      }}>
                        {copied === item.title ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                      </button>
                      <button onClick={() => removeScheduled(i)} style={{
                        background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px',
                      }}>&times;</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '6px 14px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600,
                background: selectedCategory === 'all' ? 'var(--accent)' : 'var(--surface)',
                color: selectedCategory === 'all' ? 'var(--primary)' : 'var(--text-muted)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >All ({POST_LIBRARY.reduce((s, c) => s + c.posts.length, 0)})</button>
            {POST_LIBRARY.map(cat => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                style={{
                  padding: '6px 14px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600,
                  background: selectedCategory === cat.category ? 'var(--accent)' : 'var(--surface)',
                  color: selectedCategory === cat.category ? 'var(--primary)' : 'var(--text-muted)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >{cat.category} ({cat.posts.length})</button>
            ))}
          </div>

          {/* Post Library */}
          {filteredLibrary.map(category => (
            <div key={category.category} style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <category.icon size={18} style={{ color: 'var(--accent)' }} /> {category.category}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                {category.posts.map((post, i) => (
                  <div key={i} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>{post.title}</h4>
                    <pre style={{
                      fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.7,
                      whiteSpace: 'pre-wrap', wordWrap: 'break-word',
                      background: 'var(--primary)', padding: '14px', borderRadius: '6px',
                      border: '1px solid var(--border)', flex: 1, marginBottom: '12px',
                      fontFamily: 'inherit', maxHeight: '200px', overflowY: 'auto',
                    }}>{post.content}</pre>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => copyPost(post)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem', flex: 1, justifyContent: 'center' }}>
                        {copied === post.title ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
                      </button>
                      <select
                        onChange={(e) => { if (e.target.value) { schedulePost(post, e.target.value); e.target.value = ''; } }}
                        style={{ padding: '8px 12px', fontSize: '0.8rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <option value="">Schedule...</option>
                        {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tips */}
          <div className="card" style={{ padding: '24px', marginTop: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>LinkedIn Posting Tips</h3>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 2, paddingLeft: '20px' }}>
              <li><strong>Best times to post:</strong> Tuesday-Thursday, 9-10am EST</li>
              <li><strong>Frequency:</strong> 3-5 posts per week for maximum reach</li>
              <li><strong>Engagement hack:</strong> Reply to every comment within 1 hour</li>
              <li><strong>Hook formula:</strong> Start with a surprising stat or bold statement</li>
              <li><strong>CTA:</strong> Always end with a question or link to thermashift.net</li>
              <li><strong>Hashtags:</strong> Use 3-5 relevant hashtags (already included in posts)</li>
              <li><strong>Personal touch:</strong> Add 1-2 sentences about your own experience before posting</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
