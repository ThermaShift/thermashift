#!/usr/bin/env python3
"""
ThermaShift Monitoring Agent
Collects server/workstation thermal and performance data.
Works on Linux, Windows, and macOS.

Usage:
  python thermashift-agent.py                    # Single snapshot to CSV
  python thermashift-agent.py --interval 60      # Continuous monitoring every 60 seconds
  python thermashift-agent.py --output report.csv # Custom output file
  python thermashift-agent.py --rack-name A1     # Set rack identifier
  python thermashift-agent.py --json             # Output as JSON instead of CSV

Requirements:
  pip install psutil
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

try:
    import psutil
except ImportError:
    print("ERROR: psutil is required. Install it with: pip install psutil")
    sys.exit(1)

# Optional GPU support
try:
    import GPUtil
    HAS_GPU = True
except ImportError:
    HAS_GPU = False


def get_cpu_temp():
    """Get CPU temperature (platform-specific)."""
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return None

        # Linux: look for coretemp, k10temp, or any available sensor
        for name in ['coretemp', 'k10temp', 'cpu_thermal', 'acpitz', 'zenpower']:
            if name in temps:
                readings = temps[name]
                if readings:
                    return round(max(r.current for r in readings), 1)

        # Fallback: use first available sensor
        for name, readings in temps.items():
            if readings:
                return round(max(r.current for r in readings), 1)
    except Exception:
        pass

    # Windows: try WMI
    if platform.system() == 'Windows':
        try:
            import subprocess
            result = subprocess.run(
                ['powershell', '-Command',
                 'Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi 2>$null | Select -First 1 -Expand CurrentTemperature'],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                # WMI returns temp in tenths of Kelvin
                kelvin_tenths = float(result.stdout.strip())
                celsius = (kelvin_tenths / 10.0) - 273.15
                if 0 < celsius < 120:
                    return round(celsius, 1)
        except Exception:
            pass

    # macOS: try powermetrics (requires sudo) or smckit
    if platform.system() == 'Darwin':
        try:
            import subprocess
            result = subprocess.run(
                ['sudo', 'powermetrics', '--samplers', 'smc', '-i1', '-n1'],
                capture_output=True, text=True, timeout=10
            )
            for line in result.stdout.split('\n'):
                if 'CPU die temperature' in line:
                    temp = float(line.split(':')[1].strip().replace(' C', ''))
                    return round(temp, 1)
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
        # Check battery info for laptops (gives power draw directly)
        battery = psutil.sensors_battery()
        if battery and battery.power_plugged:
            # Estimate based on CPU usage
            pass

        # Estimate from CPU usage + base power
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()

        # Rough TDP estimation
        # Desktop CPU: ~65-125W TDP, Server CPU: ~150-350W TDP
        base_tdp = 125 if cpu_count >= 8 else 65
        cpu_power = base_tdp * (cpu_percent / 100.0)

        # Memory power (~3W per 8GB DIMM)
        mem = psutil.virtual_memory()
        mem_power = (mem.total / (8 * 1024**3)) * 3

        # Base system power (motherboard, fans, PSU inefficiency)
        base_power = 50

        # GPU power (rough estimate if no GPUtil)
        gpu_power = 0
        if HAS_GPU:
            try:
                gpus = GPUtil.getGPUs()
                for g in gpus:
                    gpu_power += g.load * 300  # Rough: max 300W per GPU
            except Exception:
                pass

        total = cpu_power + mem_power + base_power + gpu_power
        return round(total, 0)
    except Exception:
        return None


def collect_data(rack_name=None):
    """Collect a single data point."""
    hostname = socket.gethostname()
    cpu_temp = get_cpu_temp()
    gpu_temp = get_gpu_temp()
    power = get_power_draw()
    cpu_percent = psutil.cpu_percent(interval=0)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    # Estimate inlet/outlet temps
    # Inlet is typically ambient (20-25C), outlet is CPU temp + overhead
    inlet_temp = 22.0  # Assume standard cold aisle temp
    outlet_temp = cpu_temp if cpu_temp else 35.0

    # Convert power from watts to kW for the platform
    power_kw = round((power or 0) / 1000, 2)

    return {
        'timestamp': datetime.now().isoformat(),
        'rack_name': rack_name or hostname,
        'hostname': hostname,
        'os': f"{platform.system()} {platform.release()}",
        'power_kw': power_kw,
        'inlet_temp_c': inlet_temp,
        'outlet_temp_c': outlet_temp or 35.0,
        'cpu_temp_c': cpu_temp or 'N/A',
        'gpu_temp_c': gpu_temp or 'N/A',
        'cpu_percent': cpu_percent,
        'memory_percent': round(mem.percent, 1),
        'memory_total_gb': round(mem.total / (1024**3), 1),
        'disk_percent': round(disk.percent, 1),
        'cpu_cores': psutil.cpu_count(),
        'cooling_type': 'Air',  # Default, user can override
    }


def write_csv(data_points, output_file, append=False):
    """Write data points to CSV file."""
    mode = 'a' if append else 'w'
    file_exists = os.path.exists(output_file) and append

    with open(output_file, mode, newline='') as f:
        writer = csv.DictWriter(f, fieldnames=data_points[0].keys())
        if not file_exists:
            writer.writeheader()
        writer.writerows(data_points)


def write_platform_csv(data_points, output_file):
    """Write CSV in ThermaShift platform import format."""
    with open(output_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['rack_name', 'power_kw', 'inlet_temp_c', 'outlet_temp_c', 'cooling_type'])
        for dp in data_points:
            writer.writerow([
                dp['rack_name'],
                dp['power_kw'],
                dp['inlet_temp_c'],
                dp['outlet_temp_c'],
                dp['cooling_type'],
            ])


def print_summary(data):
    """Print a human-readable summary."""
    print(f"\n{'='*50}")
    print(f"  ThermaShift Agent - {data['timestamp']}")
    print(f"{'='*50}")
    print(f"  Host:        {data['hostname']} ({data['os']})")
    print(f"  Rack ID:     {data['rack_name']}")
    print(f"  CPU Temp:    {data['cpu_temp_c']}°C")
    if data['gpu_temp_c'] != 'N/A':
        print(f"  GPU Temp:    {data['gpu_temp_c']}°C")
    print(f"  Power Draw:  {data['power_kw']} kW ({int(data['power_kw']*1000)}W)")
    print(f"  CPU Usage:   {data['cpu_percent']}%")
    print(f"  Memory:      {data['memory_percent']}% of {data['memory_total_gb']} GB")
    print(f"  Disk:        {data['disk_percent']}%")
    print(f"  Inlet Temp:  {data['inlet_temp_c']}°C (assumed)")
    print(f"  Outlet Temp: {data['outlet_temp_c']}°C")
    print(f"{'='*50}\n")


def main():
    parser = argparse.ArgumentParser(
        description='ThermaShift Monitoring Agent - Collects server thermal and performance data'
    )
    parser.add_argument('--rack-name', '-r', help='Rack identifier (default: hostname)')
    parser.add_argument('--output', '-o', default='thermashift_data.csv', help='Output CSV file')
    parser.add_argument('--interval', '-i', type=int, help='Collection interval in seconds (continuous mode)')
    parser.add_argument('--platform-format', '-p', action='store_true',
                        help='Output in ThermaShift platform import format')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')
    parser.add_argument('--quiet', '-q', action='store_true', help='Suppress console output')
    parser.add_argument('--cooling-type', '-c', default='Air',
                        choices=['Air', 'RDHX', 'D2C', 'Immersion', 'Hybrid'],
                        help='Cooling type for this server')

    args = parser.parse_args()

    print("ThermaShift Monitoring Agent v1.0")
    print(f"Platform: {platform.system()} {platform.release()}")
    print(f"Output: {args.output}")
    if args.interval:
        print(f"Mode: Continuous (every {args.interval}s)")
    else:
        print("Mode: Single snapshot")
    print()

    try:
        if args.interval:
            # Continuous monitoring
            print(f"Collecting data every {args.interval} seconds. Press Ctrl+C to stop.\n")
            while True:
                data = collect_data(args.rack_name)
                data['cooling_type'] = args.cooling_type

                if not args.quiet:
                    print_summary(data)

                if args.json:
                    with open(args.output, 'a') as f:
                        f.write(json.dumps(data) + '\n')
                elif args.platform_format:
                    write_platform_csv([data], args.output)
                else:
                    write_csv([data], args.output, append=True)

                print(f"Data written to {args.output}")
                time.sleep(args.interval)
        else:
            # Single snapshot
            data = collect_data(args.rack_name)
            data['cooling_type'] = args.cooling_type

            if not args.quiet:
                print_summary(data)

            if args.json:
                output = json.dumps(data, indent=2)
                with open(args.output.replace('.csv', '.json'), 'w') as f:
                    f.write(output)
                print(f"JSON written to {args.output.replace('.csv', '.json')}")
            elif args.platform_format:
                write_platform_csv([data], args.output)
                print(f"Platform CSV written to {args.output}")
            else:
                write_csv([data], args.output)
                print(f"CSV written to {args.output}")

            print("\nTo import into ThermaShift platform:")
            print(f"  1. Use --platform-format flag for compatible CSV")
            print(f"  2. Go to thermashift.net/admin -> Monitor -> Import CSV")

    except KeyboardInterrupt:
        print("\nAgent stopped.")
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
