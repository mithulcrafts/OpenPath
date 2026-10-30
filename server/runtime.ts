import path from 'node:path';
import { env,ROOT } from './config.js';

// Load before Playwright so installation and runtime use the same browser cache,
// including on hosts whose per-process sandbox changes LOCALAPPDATA.
process.env.PLAYWRIGHT_BROWSERS_PATH=env('PLAYWRIGHT_BROWSERS_PATH',path.join(ROOT,'.cache','ms-playwright'));
