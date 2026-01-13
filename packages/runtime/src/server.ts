/**
 * Reminix Runtime Server
 */

import type { BaseAdapter } from './adapters/base.js';

export interface ServeOptions {
  port?: number;
  host?: string;
}

/**
 * Serve agents via REST API.
 *
 * @param agents - List of wrapped agents (adapters).
 * @param options - Server options.
 */
export function serve(
  agents: BaseAdapter[],
  options: ServeOptions = {}
): void {
  const { port = 8080, host = '0.0.0.0' } = options;

  // TODO: Implement server
  throw new Error('serve() is not yet implemented');
}
