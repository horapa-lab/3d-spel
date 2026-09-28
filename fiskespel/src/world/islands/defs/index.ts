import type { IslandDef } from './types';
import { driftwood } from './driftwood';
import { coral } from './coral';
import { sunspire } from './sunspire';
import { turtleback } from './turtleback';
import { stoneArch } from './stonearch';
import { mirewood } from './mirewood';
import { frostpeak } from './frostpeak';
import { wreckers } from './wreckers';
import { elder } from './elder';
import { glimmer } from './glimmer';
import { keepers } from './keepers';
import { ashen } from './ashen';

export const ISLAND_DEFS: IslandDef[] = [driftwood, coral, sunspire, turtleback, stoneArch, mirewood, frostpeak, wreckers, elder, glimmer, keepers, ashen];
export const DEF_BY_ID: Record<string, IslandDef> = Object.fromEntries(ISLAND_DEFS.map((d) => [d.id, d]));
