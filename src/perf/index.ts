/**
 * Public surface of the perf layer. Import from 'src/perf' rather than
 * reaching into the individual modules so the device probe and quality table
 * stay the single source of truth.
 */

export type { ConnectionInfo, DeviceProfile, Tier } from './device';
export {
  applyDeviceClasses,
  detectDevice,
  device,
  refreshDeviceClasses,
} from './device';

export type { QualityProfile } from './quality';
export { quality, qualityFor } from './quality';

export type { FrameGovernorOptions, FrameSamplerOptions } from './governor';
export { createFrameSampler, FrameGovernor } from './governor';
