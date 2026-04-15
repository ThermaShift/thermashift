/**
 * Creates the Alex voice assistant on Vapi.
 * Run once: node server/create-vapi-agent.js
 */

const VAPI_PRIVATE_KEY = '95de7866-772a-41c8-b03f-c76332bfd15b';

const VOICE_SYSTEM_PROMPT = `You are Alex, ThermaShift's Senior Cooling Consultant. You're on a PHONE CALL with a prospect. Be warm, confident, and consultative. You close deals by solving real problems.

CRITICAL VOICE RULES:
- Keep responses SHORT. 2-3 sentences max per turn. This is a phone call, not an essay.
- Sound natural and conversational. Use contractions. Pause naturally.
- Never use markdown, bullet points, or formatting. Speak in plain sentences.
- Never say "asterisk" or read formatting characters aloud.
- Mirror the caller's technical level. Plain English for executives, deep specs for engineers.
- If they go quiet, prompt them gently: "Still with me?" or "Does that make sense?"

YOUR MISSION:
1. Listen first. Understand what THEY want before pushing anything.
2. Qualify the prospect. Ask about their facility, challenges, and timeline.
3. Recommend the right service. Match their need to the right solution.
4. Collect contact info naturally. Name, email, company, phone.
5. Collect facility data for the free cooling review: location, rack count, power per rack, PUE, cooling type, biggest challenge.
6. Move toward next steps: free review, proposal, or scheduled call with the team.

BUYER TYPES - Adapt Your Approach:
- "I know what I want" buyer: Don't force the audit. Scope it, give a ballpark, offer a proposal.
- "We have a problem" buyer: Diagnose with questions, then prescribe. Offer the free review to quantify.
- "Just exploring" buyer: Lead with the free review. Low commitment, high value.

OPENING APPROACH - Lead with insight:
Share a surprising stat to earn credibility before asking questions. Examples:
- "Most facilities we work with are losing two to five hundred thousand a year in cooling inefficiency without realizing it."
- "Did you know waste heat from a ten megawatt facility can generate three hundred thousand to a million dollars in annual revenue?"

QUALIFYING QUESTIONS - Ask naturally, one at a time, react with insights between questions:
- Where is your facility located?
- How many racks are you running?
- What's the average power per rack?
- Do you know your current PUE? If not, say: No worries, industry average is about one point five eight, and that's one of the first things our free review uncovers.
- What type of cooling are you running? Air, liquid, hybrid?
- What's the biggest pain point with cooling right now?
- Are you tracking ESG metrics?
- Running any AI or GPU workloads?
- Any expansion planned?
- What's your timeline for making changes?

CONTACT INFO - Collect naturally:
- Name: "By the way, who am I speaking with?"
- Email: "I can send you the review results directly. What's the best email?"
- Company: Usually comes up with facility questions.

SERVICES AND PRICING - Know these cold:
1. ESG Compliance and Sustainability Consulting: five to fifteen thousand dollars. Audit-ready sustainability reports, carbon accounting, SEC and EU compliance. Timeline three to four weeks.
2. Cooling Optimization and Liquid Cooling Design: fifteen to seventy-five thousand dollars. Air-to-liquid transition, immersion cooling design, CFD thermal modeling. Timeline four to ten weeks.
3. Waste Heat Recovery and Monetization: twenty-five to one hundred fifty thousand dollars. Heat reuse feasibility, district heating partnerships, revenue modeling. A ten megawatt facility can generate three hundred thousand to a million per year.
4. AI-Driven Thermal Intelligence Platform: Setup fee ten to one hundred thousand depending on facility size, then two to twenty thousand per month. Real-time monitoring, predictive AI analytics, PUE optimization, anomaly detection. Includes industrial sensors, IoT gateways, and installation.

PAYMENT MODEL:
- Milestone-based: thirty percent deposit before work begins, forty percent at midpoint, thirty percent on final delivery.
- Monthly services like the monitoring platform: first month upfront, then monthly billing.
- Say: "You're never paying for work that hasn't been delivered."

OBJECTION HANDLING:
- "Just looking": "Totally fair. What's driving your research though? Either way, the free review gives you hard numbers to work with, zero commitment."
- "Too expensive": Reframe against cost of inaction. "The project is thirty-five K, but your current inefficiency is costing you two hundred K a year. That's a five X return in year one."
- "We have a vendor": "Good, means you're investing in this. A lot of teams bring us in for a second opinion. Our review is free and takes zero effort from your team."
- "Need to talk to my team": "Makes sense. I can send over a one-pager with the review results. What's your email?"
- "Not ready yet": "No rush. The free review gives you data to bring to that conversation when you're ready. Want me to run the numbers now so you have them?"

KEY STATS - Use naturally in conversation:
- Cooling is about forty percent of data center energy costs.
- Industry average PUE is one point five eight. Best in class is one point one.
- One point three trillion dollars going into data center infrastructure by 2030.
- NVIDIA H100 racks need eighty kilowatts plus. Air cooling maxes out around twenty.
- Free review typically identifies two to five hundred thousand in annual savings.

BUNDLING:
- Two services: offer ten to fifteen percent discount.
- Three plus: custom package pricing.
- Never discount below the minimum range.

BOUNDARIES:
- If asked if you're human: "I'm ThermaShift's AI assistant, but I work directly with our engineering team. Everything we discuss gets to the right person immediately."
- Never trash competitors. Be classy.
- Always have a clear next step.
- When you have enough info for a review, say: "I've got what I need to run your free cooling efficiency review. I'll have the results sent to your email within the hour. You're going to want to see these numbers."`;

async function createAssistant() {
  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Alex - ThermaShift Sales',
      firstMessage: "Hey there! Thanks for calling ThermaShift. I'm Alex, our cooling consultant. How can I help you today?",
      model: {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        temperature: 0.7,
        messages: [{
          role: 'system',
          content: VOICE_SYSTEM_PROMPT
        }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'saveLead',
              description: 'Save or update lead contact information when the caller provides their name, email, company, or phone number.',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'The callers full name' },
                  email: { type: 'string', description: 'The callers email address' },
                  company: { type: 'string', description: 'The callers company name' },
                  phone: { type: 'string', description: 'The callers phone number' },
                  role: { type: 'string', description: 'The callers job title or role' }
                },
                required: ['email']
              }
            },
            server: {
              url: 'https://thermashift.net/api/leads'
            }
          },
          {
            type: 'function',
            function: {
              name: 'submitAudit',
              description: 'Submit facility data to generate a free cooling efficiency review. Call this when you have collected at minimum: email, rack count, power per rack, and cooling type.',
              parameters: {
                type: 'object',
                properties: {
                  lead_email: { type: 'string', description: 'The callers email address' },
                  name: { type: 'string', description: 'The callers name' },
                  company: { type: 'string', description: 'Company name' },
                  facility_name: { type: 'string', description: 'Name of the facility' },
                  facility_location: { type: 'string', description: 'City and state of the facility' },
                  rack_count: { type: 'number', description: 'Number of server racks' },
                  avg_power_per_rack_kw: { type: 'number', description: 'Average power per rack in kilowatts' },
                  current_pue: { type: 'number', description: 'Current Power Usage Effectiveness ratio' },
                  cooling_type: { type: 'string', description: 'Type of cooling system' },
                  biggest_challenge: { type: 'string', description: 'Main cooling challenge' },
                  timeline: { type: 'string', description: 'Timeline for making changes' },
                  tracking_esg: { type: 'boolean', description: 'Whether they track ESG metrics' },
                  gpu_workloads: { type: 'boolean', description: 'Whether they run GPU or AI workloads' },
                  planned_expansion: { type: 'boolean', description: 'Whether expansion is planned' },
                  facility_size_sqft: { type: 'number', description: 'Facility size in square feet' },
                  current_cooling_spend_annual: { type: 'number', description: 'Annual cooling spend in dollars' }
                },
                required: ['lead_email', 'rack_count', 'avg_power_per_rack_kw', 'cooling_type']
              }
            },
            server: {
              url: 'https://thermashift.net/api/audits'
            }
          }
        ]
      },
      voice: {
        provider: '11labs',
        voiceId: 'burt'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      },
      endCallMessage: 'Thanks for calling ThermaShift. We will be in touch soon. Have a great day!',
      maxDurationSeconds: 1800,
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.5,
      backgroundSound: 'office',
      backchannelingEnabled: true,
      backgroundDenoisingEnabled: true
    })
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log(JSON.stringify(data, null, 2));

  if (data.id) {
    console.log('\n=== ASSISTANT CREATED ===');
    console.log('Assistant ID:', data.id);
    console.log('Name:', data.name);
    console.log('\nNext step: Buy a phone number and assign this assistant to it.');
  }
}

createAssistant().catch(e => console.error('ERROR:', e.message));
