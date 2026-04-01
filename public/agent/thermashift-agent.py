#!/usr/bin/env python3
"""
ThermaShift Monitoring Agent v2.0
Collects server thermal and performance data and sends it to the
ThermaShift Thermal Intelligence Platform.

Setup:
  python thermashift-agent.py --setup

Usage:
  python thermashift-agent.py                         # Single snapshot
  python thermashift-agent.py --daemon                # Run continuously using config
  python thermashift-agent.py --interval 60           # Override polling interval
  python thermashift-agent.py --rack-name A1          # Override rack identifier
  python thermashift-agent.py --export report.csv     # Export to CSV only

Requirements:
  pip install psutil requests
  (Optional) pip install GPUtil   # For GPU temperature monitoring
"""

import sys
import os
import csv
import json
import time
import socket
import platform
import argparse
from datetime import datetime
from pathlib import Path
import urllib.request
import urllib.error

try:
    import psutil
except ImportError:
    print("ERROR: psutil is required. Install it with: pip install psutil")
    sys.exit(1)

try:
    import GPUtil
    HAS_GPU = True
except ImportError:
    HAS_GPU = False

# Config file location
CONFIG_DIR = Path.home() / '.thermashift'
CONFIG_FILE = CONFIG_DIR / 'config.json'
LOG_FILE = CONFIG_DIR / 'agent.log'

DEFAULT_CONFIG = {
    'facility_id': '',
    'facility_name': '',
    'rack_name': '',
    'cooling_type': 'Air',
    'polling_interval': 300,       # seconds (5 minutes default)
    'endpoint_url': '',            # webhook URL to POST data to
    'api_key': '',                 # authentication token
    'inlet_temp_override': None,   # manual inlet temp if no sensor
    'log_locally': True,           # also save data to local CSV
    'local_csv_path': str(CONFIG_DIR / 'thermashift_data.csv'),
    'max_local_rows': 10000,       # rotate local CSV at this many rows
}

POLLING_PRESETS = {
    '1': ('Real-time (30 seconds)', 30),
    '2': ('Frequent (1 minute)', 60),
    '3': ('Standard (5 minutes)', 300),
    '4': ('Conservative (15 minutes)', 900),
    '5': ('Hourly', 3600),
}


def load_config():
    """Load configuration from file."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                saved = json.load(f)
            config = {**DEFAULT_CONFIG, **saved}
            return config
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)


def save_config(config):
    """Save configuration to file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)


def setup_wizard():
    """Interactive setup wizard for configuring the agent."""
    print("\n" + "=" * 55)
    print("  ThermaShift Agent Setup Wizard")
    print("=" * 55 + "\n")

    config = load_config()

    # Facility info
    print("-- FACILITY INFO --\n")
    config['facility_name'] = input(f"  Company/Facility name [{config.get('facility_name', '')}]: ").strip() or config.get('facility_name', '')
    config['facility_id'] = input(f"  Facility ID (from ThermaShift platform) [{config.get('facility_id', '')}]: ").strip() or config.get('facility_id', '')
    config['rack_name'] = input(f"  Rack/Server name [{socket.gethostname()}]: ").strip() or socket.gethostname()

    # Cooling type
    print("\n  Cooling type:")
    print("    1. Air Cooling")
    print("    2. Rear-Door Heat Exchanger (RDHX)")
    print("    3. Direct-to-Chip (D2C)")
    print("    4. Immersion")
    print("    5. Hybrid")
    cooling_map = {'1': 'Air', '2': 'RDHX', '3': 'D2C', '4': 'Immersion', '5': 'Hybrid'}
    choice = input(f"  Select [1-5, default 1]: ").strip() or '1'
    config['cooling_type'] = cooling_map.get(choice, 'Air')

    # Polling interval
    print("\n-- POLLING INTERVAL --\n")
    print("  How often should data be collected and sent?\n")
    for key, (label, seconds) in POLLING_PRESETS.items():
        marker = ' <-- current' if seconds == config.get('polling_interval', 300) else ''
        print(f"    {key}. {label}{marker}")
    print(f"    6. Custom interval")
    choice = input(f"\n  Select [1-6, default 3]: ").strip() or '3'
    if choice == '6':
        custom = input("  Enter interval in seconds: ").strip()
        config['polling_interval'] = max(10, int(custom) if custom.isdigit() else 300)
    elif choice in POLLING_PRESETS:
        config['polling_interval'] = POLLING_PRESETS[choice][1]

    # Endpoint
    print("\n-- DATA DELIVERY --\n")
    print("  Where should monitoring data be sent?\n")
    print("    1. ThermaShift Cloud (recommended)")
    print("    2. Custom webhook URL")
    print("    3. Local only (CSV export)\n")
    delivery = input(f"  Select [1-3, default 1]: ").strip() or '1'
    if delivery == '1':
        config['endpoint_url'] = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1/sensor_readings'
        config['supabase_anon_key'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4'
        config['api_key'] = input("  Enter your Client API Key (provided by ThermaShift): ").strip()
        if not config['api_key']:
            print("  WARNING: No API key entered. Data will be rejected by the server.")
            print("  Contact your ThermaShift administrator to get your API key.")
        else:
            print("  Connected to ThermaShift Cloud.")
    elif delivery == '2':
        config['endpoint_url'] = input(f"  Webhook URL [{config.get('endpoint_url', '')}]: ").strip() or config.get('endpoint_url', '')
        if config['endpoint_url']:
            config['api_key'] = input(f"  API key/token [{config.get('api_key', '')}]: ").strip() or config.get('api_key', '')
    else:
        config['endpoint_url'] = ''
        config['api_key'] = ''

    # Local logging
    config['log_locally'] = input(f"\n  Also save data locally? [Y/n]: ").strip().lower() != 'n'

    # Inlet temp
    print(f"\n  Inlet temperature: The agent tries to read sensors automatically.")
    override = input(f"  Override inlet temp? (e.g. 22) [blank = auto]: ").strip()
    config['inlet_temp_override'] = float(override) if override else None

    # Save
    save_config(config)

    print(f"\n{'=' * 55}")
    print(f"  Configuration saved to {CONFIG_FILE}")
    print(f"{'=' * 55}")
    print(f"\n  Facility:  {config['facility_name']}")
    print(f"  Rack:      {config['rack_name']}")
    print(f"  Cooling:   {config['cooling_type']}")
    print(f"  Polling:   every {config['polling_interval']} seconds")
    print(f"  Endpoint:  {config['endpoint_url'] or 'Local only (no endpoint configured)'}")
    print(f"  Local CSV: {config['local_csv_path'] if config['log_locally'] else 'Disabled'}")
    print(f"\n  To start monitoring:")
    print(f"    python thermashift-agent.py --daemon")
    print(f"\n  To reconfigure:")
    print(f"    python thermashift-agent.py --setup\n")

    return config


def get_cpu_temp():
    """Get CPU temperature (platform-specific)."""
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for name in ['coretemp', 'k10temp', 'cpu_thermal', 'acpitz', 'zenpower']:
                if name in temps and temps[name]:
                    return round(max(r.current for r in temps[name]), 1)
            for name, readings in temps.items():
                if readings:
                    return round(max(r.current for r in readings), 1)
    except Exception:
        pass

    if platform.system() == 'Windows':
        try:
            import subprocess
            result = subprocess.run(
                ['powershell', '-Command',
                 'Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi 2>$null | Select -First 1 -Expand CurrentTemperature'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                kelvin_tenths = float(result.stdout.strip())
                celsius = (kelvin_tenths / 10.0) - 273.15
                if 0 < celsius < 120:
                    return round(celsius, 1)
        except Exception:
            pass

    if platform.system() == 'Darwin':
        try:
            import subprocess
            result = subprocess.run(
                ['sudo', 'powermetrics', '--samplers', 'smc', '-i1', '-n1'],
                capture_output=True, text=True, timeout=10
            )
            for line in result.stdout.split('\n'):
                if 'CPU die temperature' in line:
                    return round(float(line.split(':')[1].strip().replace(' C', '')), 1)
        except Exception:
            pass

    return None


def get_gpu_temp():
    """Get GPU temperature if available."""
    if HAS_GPU:
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                return round(max(g.temperature for g in gpus), 1)
        except Exception:
            pass
    return None


def get_power_draw():
    """Estimate system power draw in watts."""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        base_tdp = 125 if cpu_count >= 8 else 65
        cpu_power = base_tdp * (cpu_percent / 100.0)
        mem = psutil.virtual_memory()
        mem_power = (mem.total / (8 * 1024**3)) * 3
        base_power = 50
        gpu_power = 0
        if HAS_GPU:
            try:
                for g in GPUtil.getGPUs():
                    gpu_power += g.load * 300
            except Exception:
                pass
        return round(cpu_power + mem_power + base_power + gpu_power, 0)
    except Exception:
        return None


def collect_data(config):
    """Collect a single data point."""
    hostname = socket.gethostname()
    cpu_temp = get_cpu_temp()
    gpu_temp = get_gpu_temp()
    power = get_power_draw()
    cpu_percent = psutil.cpu_percent(interval=0)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    inlet_temp = config.get('inlet_temp_override') or 22.0
    outlet_temp = cpu_temp if cpu_temp else 35.0
    power_kw = round((power or 0) / 1000, 2)

    return {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'facility_id': config.get('facility_id', ''),
        'facility_name': config.get('facility_name', ''),
        'rack_name': config.get('rack_name') or hostname,
        'hostname': hostname,
        'os': f"{platform.system()} {platform.release()}",
        'power_kw': power_kw,
        'inlet_temp_c': round(float(inlet_temp), 1),
        'outlet_temp_c': round(outlet_temp, 1),
        'cpu_temp_c': cpu_temp,
        'gpu_temp_c': gpu_temp,
        'cpu_percent': cpu_percent,
        'memory_percent': round(mem.percent, 1),
        'memory_total_gb': round(mem.total / (1024**3), 1),
        'disk_percent': round(disk.percent, 1),
        'cpu_cores': psutil.cpu_count(),
        'cooling_type': config.get('cooling_type', 'Air'),
        'agent_version': '2.0',
    }


def send_data(data, config):
    """Send data to the configured endpoint (Supabase or custom webhook)."""
    url = config.get('endpoint_url', '')
    if not url:
        return False, 'No endpoint configured'

    try:
        # Remove non-serializable or null values
        clean_data = {k: v for k, v in data.items() if v is not None}
        # Remove 'timestamp' key — Supabase uses 'created_at' auto-column
        clean_data.pop('timestamp', None)

        # Include client API key in the payload for authorization
        client_key = config.get('api_key', '')
        if client_key:
            clean_data['client_api_key'] = client_key

        payload = json.dumps(clean_data).encode('utf-8')
        req = urllib.request.Request(url, data=payload, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('User-Agent', 'ThermaShift-Agent/2.0')
        req.add_header('Prefer', 'return=minimal')

        # Use Supabase anon key for HTTP auth (required by Supabase)
        THERMASHIFT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4'
        supabase_key = config.get('supabase_anon_key', '')
        # Auto-detect ThermaShift cloud endpoint
        if 'auqklthrpvsqyelfjood.supabase.co' in url:
            supabase_key = THERMASHIFT_ANON
        if supabase_key:
            req.add_header('apikey', supabase_key)
            req.add_header('Authorization', f"Bearer {supabase_key}")
        elif client_key:
            req.add_header('apikey', client_key)
            req.add_header('Authorization', f"Bearer {client_key}")

        with urllib.request.urlopen(req, timeout=30) as resp:
            return True, f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        return False, f"HTTP {e.code}: {body}"
    except urllib.error.URLError as e:
        return False, f"Connection error: {e.reason}"
    except Exception as e:
        return False, str(e)


def log_locally(data, config):
    """Append data point to local CSV file."""
    csv_path = config.get('local_csv_path', str(CONFIG_DIR / 'thermashift_data.csv'))
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    file_exists = os.path.exists(csv_path)

    # Rotate file if too large
    max_rows = config.get('max_local_rows', 10000)
    if file_exists:
        try:
            with open(csv_path) as f:
                row_count = sum(1 for _ in f) - 1
            if row_count >= max_rows:
                # Keep last half of rows
                import tempfile
                with open(csv_path) as f:
                    lines = f.readlines()
                keep = lines[:1] + lines[len(lines)//2:]
                with open(csv_path, 'w') as f:
                    f.writelines(keep)
        except Exception:
            pass

    with open(csv_path, 'a', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=data.keys())
        if not file_exists:
            writer.writeheader()
        writer.writerow(data)


def write_platform_csv(data_points, output_file):
    """Write CSV in ThermaShift platform import format."""
    with open(output_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['rack_name', 'power_kw', 'inlet_temp_c', 'outlet_temp_c', 'cooling_type'])
        for dp in data_points:
            writer.writerow([
                dp['rack_name'], dp['power_kw'],
                dp['inlet_temp_c'], dp['outlet_temp_c'],
                dp['cooling_type'],
            ])


def log_message(msg, config=None):
    """Log a message to console and log file."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{timestamp}] {msg}"
    print(line)
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, 'a') as f:
            f.write(line + '\n')
    except Exception:
        pass


def print_summary(data):
    """Print a human-readable summary."""
    print(f"\n{'='*55}")
    print(f"  ThermaShift Agent - {data['timestamp']}")
    print(f"{'='*55}")
    print(f"  Facility:    {data['facility_name'] or 'Not configured'}")
    print(f"  Rack ID:     {data['rack_name']}")
    print(f"  Host:        {data['hostname']} ({data['os']})")
    print(f"  CPU Temp:    {data['cpu_temp_c'] or 'N/A'}°C")
    if data['gpu_temp_c']:
        print(f"  GPU Temp:    {data['gpu_temp_c']}°C")
    print(f"  Power Draw:  {data['power_kw']} kW ({int(data['power_kw']*1000)}W)")
    print(f"  CPU Usage:   {data['cpu_percent']}%")
    print(f"  Memory:      {data['memory_percent']}% of {data['memory_total_gb']} GB")
    print(f"  Disk:        {data['disk_percent']}%")
    print(f"  Inlet:       {data['inlet_temp_c']}°C")
    print(f"  Outlet:      {data['outlet_temp_c']}°C")
    print(f"{'='*55}")


def print_status(config):
    """Print current agent configuration status."""
    print(f"\n{'='*55}")
    print(f"  ThermaShift Agent Status")
    print(f"{'='*55}")
    print(f"  Config file:  {CONFIG_FILE}")
    print(f"  Facility:     {config.get('facility_name') or 'Not configured'}")
    print(f"  Facility ID:  {config.get('facility_id') or 'Not set'}")
    print(f"  Rack name:    {config.get('rack_name') or socket.gethostname()}")
    print(f"  Cooling:      {config.get('cooling_type', 'Air')}")
    print(f"  Polling:      every {config.get('polling_interval', 300)} seconds")
    print(f"  Endpoint:     {config.get('endpoint_url') or 'None (local only)'}")
    print(f"  Local CSV:    {config.get('local_csv_path') if config.get('log_locally') else 'Disabled'}")
    print(f"  Log file:     {LOG_FILE}")
    print(f"{'='*55}\n")


def run_daemon(config):
    """Run the agent in continuous monitoring mode."""
    interval = config.get('polling_interval', 300)
    has_endpoint = bool(config.get('endpoint_url'))

    log_message(f"Agent starting in daemon mode")
    log_message(f"Facility: {config.get('facility_name', 'Unknown')}")
    log_message(f"Rack: {config.get('rack_name', socket.gethostname())}")
    log_message(f"Polling interval: {interval} seconds")
    log_message(f"Endpoint: {config.get('endpoint_url') or 'Local only'}")
    print(f"\nCollecting data every {interval} seconds. Press Ctrl+C to stop.\n")

    consecutive_failures = 0

    while True:
        try:
            data = collect_data(config)
            print_summary(data)

            # Send to endpoint
            if has_endpoint:
                success, msg = send_data(data, config)
                if success:
                    log_message(f"Data sent successfully ({msg})")
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    log_message(f"Send failed: {msg} (attempt {consecutive_failures})")
                    if consecutive_failures >= 5:
                        log_message("WARNING: 5 consecutive send failures. Check endpoint configuration.")

            # Log locally
            if config.get('log_locally', True):
                log_locally(data, config)
                log_message(f"Saved to local CSV")

            log_message(f"Next collection in {interval} seconds...")
            time.sleep(interval)

        except KeyboardInterrupt:
            log_message("Agent stopped by user")
            break
        except Exception as e:
            log_message(f"ERROR: {e}")
            time.sleep(min(interval, 60))


def main():
    parser = argparse.ArgumentParser(
        description='ThermaShift Monitoring Agent v2.0 - Collect and send server thermal data'
    )
    parser.add_argument('--setup', action='store_true', help='Run interactive setup wizard')
    parser.add_argument('--daemon', '-d', action='store_true', help='Run in continuous monitoring mode')
    parser.add_argument('--status', action='store_true', help='Show current configuration')
    parser.add_argument('--rack-name', '-r', help='Override rack identifier')
    parser.add_argument('--interval', '-i', type=int, help='Override polling interval (seconds)')
    parser.add_argument('--export', '-e', help='Export single snapshot to platform CSV file')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')
    parser.add_argument('--quiet', '-q', action='store_true', help='Suppress console output')
    parser.add_argument('--cooling-type', '-c',
                        choices=['Air', 'RDHX', 'D2C', 'Immersion', 'Hybrid'],
                        help='Override cooling type')
    parser.add_argument('--facility-id', '-f', help='Override facility ID')
    parser.add_argument('--endpoint', help='Override endpoint URL')
    parser.add_argument('--api-key', help='Override API key')

    args = parser.parse_args()
    config = load_config()

    # Apply overrides
    if args.rack_name:
        config['rack_name'] = args.rack_name
    if args.interval:
        config['polling_interval'] = args.interval
    if args.cooling_type:
        config['cooling_type'] = args.cooling_type
    if args.facility_id:
        config['facility_id'] = args.facility_id
    if args.endpoint:
        config['endpoint_url'] = args.endpoint
    if args.api_key:
        config['api_key'] = args.api_key

    print("ThermaShift Monitoring Agent v2.0")
    print(f"Platform: {platform.system()} {platform.release()}")

    # Commands
    if args.setup:
        setup_wizard()
        return

    if args.status:
        print_status(config)
        return

    if args.daemon:
        if not config.get('facility_name') and not config.get('rack_name'):
            print("\nNo configuration found. Running setup wizard first...\n")
            config = setup_wizard()
        run_daemon(config)
        return

    # Single snapshot mode
    data = collect_data(config)

    if not args.quiet:
        print_summary(data)

    if args.export:
        write_platform_csv([data], args.export)
        print(f"Platform CSV written to {args.export}")
    elif args.json:
        output = json.dumps(data, indent=2)
        print(output)
    else:
        # Send to endpoint if configured
        if config.get('endpoint_url'):
            success, msg = send_data(data, config)
            print(f"Send: {'OK' if success else 'FAILED'} ({msg})")

        # Log locally
        if config.get('log_locally', True):
            log_locally(data, config)
            print(f"Saved to {config.get('local_csv_path')}")

    print(f"\nTip: Run 'python thermashift-agent.py --setup' to configure")
    print(f"     Run 'python thermashift-agent.py --daemon' for continuous monitoring")


if __name__ == '__main__':
    main()
