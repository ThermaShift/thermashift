"""ThermaShift E2E Test Suite"""
import urllib.request, urllib.error, json

SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3NjE5OSwiZXhwIjoyMDkwNjUyMTk5fQ.J83H_6K5-TjjQO5e-ChlUiv1fp5H1HBGP3ftvFb8bQc'
ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4'
BASE = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1'

def api(method, path, data=None, key=None):
    url = f'{BASE}/{path}'
    payload = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=payload, method=method)
    req.add_header('Content-Type', 'application/json')
    req.add_header('apikey', key or ANON_KEY)
    req.add_header('Authorization', f'Bearer {key or ANON_KEY}')
    if method == 'POST':
        req.add_header('Prefer', 'return=representation')
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        body = resp.read().decode()
        return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]

passed = 0
failed = 0

def test(name, condition, detail=''):
    global passed, failed
    if condition:
        passed += 1
        print(f'  PASS: {name}')
    else:
        failed += 1
        print(f'  FAIL: {name} - {detail}')

print('=== THERMASHIFT E2E TEST SUITE ===\n')

# Setup: Create test client
print('[Setup] Creating test client...')
status, result = api('POST', 'clients', {
    'client_name': 'E2E Test Corp',
    'facility_id': 'e2e-test',
    'max_racks': 3,
    'status': 'active',
    'contract_notes': 'Automated test',
}, SERVICE_KEY)
API_KEY = result[0]['api_key'] if status == 201 else ''
test('Create client', status == 201, f'HTTP {status}')
print(f'  API Key: {API_KEY[:20]}...\n')

# Test 1-3: Insert 3 racks (within limit)
print('[Auth] Testing authorized inserts...')
for rack in ['Rack-A1', 'Rack-A2', 'Rack-B1']:
    s, r = api('POST', 'sensor_readings', {
        'facility_id': 'e2e-test',
        'rack_name': rack,
        'power_kw': 0.5,
        'inlet_temp_c': 22.0,
        'outlet_temp_c': 38.5,
        'cpu_temp_c': 55.0,
        'cpu_percent': 45.0,
        'memory_percent': 65.0,
        'cooling_type': 'Air',
        'hostname': f'srv-{rack.lower()}',
        'client_api_key': API_KEY,
    })
    test(f'Insert {rack}', s == 201, f'HTTP {s}: {r}')

# Test 4: Exceed rack limit
print('\n[Limits] Testing rack limit enforcement...')
s, r = api('POST', 'sensor_readings', {
    'facility_id': 'e2e-test',
    'rack_name': 'Rack-C1-OVER-LIMIT',
    'power_kw': 1.0,
    'outlet_temp_c': 35.0,
    'client_api_key': API_KEY,
})
test('4th rack BLOCKED (max=3)', s != 201, f'HTTP {s}')

# Test 5: Update existing rack at limit
s, r = api('POST', 'sensor_readings', {
    'facility_id': 'e2e-test',
    'rack_name': 'Rack-A1',
    'power_kw': 0.8,
    'outlet_temp_c': 42.0,
    'client_api_key': API_KEY,
})
test('Existing rack update at limit', s == 201, f'HTTP {s}: {r}')

# Test 6: Invalid API key
print('\n[Security] Testing unauthorized access...')
s, r = api('POST', 'sensor_readings', {
    'facility_id': 'e2e-test',
    'rack_name': 'Hacker',
    'power_kw': 999,
    'client_api_key': 'fake-invalid-key',
})
test('Invalid API key BLOCKED', s != 201, f'HTTP {s}')

# Test 7: No API key
s, r = api('POST', 'sensor_readings', {
    'facility_id': 'e2e-test',
    'rack_name': 'NoKey',
    'power_kw': 1,
})
test('No API key BLOCKED', s != 201, f'HTTP {s}')

# Test 8: Wrong facility ID
s, r = api('POST', 'sensor_readings', {
    'facility_id': 'wrong-facility',
    'rack_name': 'A1',
    'power_kw': 1,
    'client_api_key': API_KEY,
})
test('Wrong facility ID BLOCKED', s != 201, f'HTTP {s}')

# Test 9: Deactivate client
print('\n[Lifecycle] Testing client deactivation...')
api('PATCH', 'clients?facility_id=eq.e2e-test', {'status': 'inactive'}, SERVICE_KEY)
s, r = api('POST', 'sensor_readings', {
    'facility_id': 'e2e-test',
    'rack_name': 'Rack-A1',
    'power_kw': 0.5,
    'outlet_temp_c': 35.0,
    'client_api_key': API_KEY,
})
test('Inactive client BLOCKED', s != 201, f'HTTP {s}')

# Test 10: Reactivate client
api('PATCH', 'clients?facility_id=eq.e2e-test', {'status': 'active'}, SERVICE_KEY)
s, r = api('POST', 'sensor_readings', {
    'facility_id': 'e2e-test',
    'rack_name': 'Rack-A1',
    'power_kw': 0.6,
    'outlet_temp_c': 36.0,
    'client_api_key': API_KEY,
})
test('Reactivated client ACCEPTED', s == 201, f'HTTP {s}: {r}')

# Test 11: Dashboard read
print('\n[Dashboard] Testing data retrieval...')
s, rows = api('GET', 'sensor_readings?facility_id=eq.e2e-test&select=rack_name,power_kw,outlet_temp_c&order=created_at.desc')
test('Dashboard reads data', s == 200 and len(rows) > 0, f'HTTP {s}, {len(rows) if isinstance(rows, list) else 0} rows')
if isinstance(rows, list):
    racks = set(r['rack_name'] for r in rows)
    test('Correct racks returned', racks == {'Rack-A1', 'Rack-A2', 'Rack-B1'}, f'Got: {racks}')

# Test 12: Client list read
s, clients = api('GET', 'clients?facility_id=eq.e2e-test&select=*', key=SERVICE_KEY)
test('Client management reads', s == 200 and len(clients) == 1, f'HTTP {s}')

# Cleanup
print('\n[Cleanup]...')
api('DELETE', 'sensor_readings?facility_id=eq.e2e-test', key=SERVICE_KEY)
api('DELETE', 'clients?facility_id=eq.e2e-test', key=SERVICE_KEY)
print('  Done.')

print(f'\n=== RESULTS: {passed} passed, {failed} failed ===')
