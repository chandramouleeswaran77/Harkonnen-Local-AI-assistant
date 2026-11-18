import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let prevCpuInfo = null;
let lastCpuPercent = null;
let gpuCache = { timestamp: 0, data: null };
const GPU_CACHE_TTL_MS = 2500;

function sampleCpuPercent() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return null;

  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  if (prevCpuInfo) {
    const idleDiff = idle - prevCpuInfo.idle;
    const totalDiff = total - prevCpuInfo.total;
    if (totalDiff > 0) {
      const usage = 100 - (100 * idleDiff) / totalDiff;
      lastCpuPercent = Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
    }
  }

  prevCpuInfo = { idle, total };
  return lastCpuPercent;
}

// Take initial baseline reading on module load (no heavy work, just os.cpus() snapshot)
sampleCpuPercent();

async function queryNvidiaGpu() {
  const now = Date.now();
  if (gpuCache.data && now - gpuCache.timestamp < GPU_CACHE_TTL_MS) {
    return gpuCache.data;
  }

  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      [
        '--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu',
        '--format=csv,noheader,nounits',
      ],
      { timeout: 2000, windowsHide: true }
    );

    const line = stdout.trim().split('\n')[0];
    if (!line) throw new Error('Empty nvidia-smi output');

    const parts = line.split(',').map((s) => s.trim());
    const name = parts[0] || null;
    const util = Number(parts[1]);
    const memUsedMiB = Number(parts[2]);
    const memTotalMiB = Number(parts[3]);
    const tempC = Number(parts[4]);

    const result = {
      available: true,
      name: name || 'NVIDIA GPU',
      utilizationPercent: Number.isFinite(util) ? util : null,
      memoryUsedMB: Number.isFinite(memUsedMiB) ? Math.round(memUsedMiB) : null,
      memoryTotalMB: Number.isFinite(memTotalMiB) ? Math.round(memTotalMiB) : null,
      memoryPercent:
        Number.isFinite(memUsedMiB) && Number.isFinite(memTotalMiB) && memTotalMiB > 0
          ? Math.round((memUsedMiB / memTotalMiB) * 1000) / 10
          : null,
      temperatureC: Number.isFinite(tempC) ? tempC : null,
    };

    gpuCache = { timestamp: now, data: result };
    return result;
  } catch {
    const unavailable = {
      available: false,
      name: null,
      utilizationPercent: null,
      memoryUsedMB: null,
      memoryTotalMB: null,
      memoryPercent: null,
      temperatureC: null,
    };
    gpuCache = { timestamp: now, data: unavailable };
    return unavailable;
  }
}

export async function getSystemHardwareSnapshot() {
  const totalRamBytes = os.totalmem();
  const freeRamBytes = os.freemem();
  const usedRamBytes = Math.max(0, totalRamBytes - freeRamBytes);

  const cpuPercent = sampleCpuPercent();
  const cpus = os.cpus() || [];
  const gpu = await queryNvidiaGpu();

  return {
    platform: os.platform(),
    arch: os.arch(),
    cpu: {
      available: cpus.length > 0,
      model: cpus[0]?.model?.trim() || 'Unavailable',
      cores: cpus.length,
      usagePercent: cpuPercent, // null until two samples exist -> frontend shows "Unavailable" or "--"
    },
    ram: {
      available: totalRamBytes > 0,
      totalGB: Math.round((totalRamBytes / 1024 ** 3) * 100) / 100,
      usedGB: Math.round((usedRamBytes / 1024 ** 3) * 100) / 100,
      freeGB: Math.round((freeRamBytes / 1024 ** 3) * 100) / 100,
      usagePercent:
        totalRamBytes > 0 ? Math.round((usedRamBytes / totalRamBytes) * 1000) / 10 : null,
    },
    gpu,
    sampledAt: new Date().toISOString(),
  };
}
