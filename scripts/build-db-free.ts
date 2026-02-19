#!/usr/bin/env tsx
/**
 * Build free-tier database for Japan Law MCP.
 * This is an alias for build-db.ts since the free tier includes the same
 * core statutes — just without cabinet orders, ministerial ordinances, and PPC guidelines.
 *
 * Usage: npm run build:db:free
 */

import './build-db.js';
