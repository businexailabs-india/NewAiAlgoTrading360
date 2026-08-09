import { getMaEngine } from '../engine';

/** Ensure DEMO-labeled seed exists for local Market Analytics. */
export function ensureMaDemoSeed(): void {
  getMaEngine();
}
