/**
 * Reminix Runtime Server
 */

import type { BaseAdapter } from './adapters/base.js';

export interface ServeOptions {
  port?: number;
  hostname?: string;
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
  const { port = 8080, hostname = '0.0.0.0' } = options;

  // TODO: Implement server using Hono
  throw new Error('serve() is not yet implemented');
}
