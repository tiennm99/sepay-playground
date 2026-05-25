import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

// Upstash Redis handle factory.
//
// Returns a `{ client, prefix }` handle so this project can safely share an
// Upstash DB with other portfolio projects (vngeoguessr, store-scraper-bot,
// payos-playground…) without key collisions.
//
// Accepts both env var conventions:
//   UPSTASH_REDIS_REST_URL / _TOKEN  (vanilla Upstash signup)
//   KV_REST_API_URL / _TOKEN         (Vercel Marketplace integration alias)
//
// KEY_PREFIX env (default 'sepay-playground:') is prepended to every physical
// key by the `pkey()` helper. Callers pass logical keys only.

const DEFAULT_KEY_PREFIX = 'sepay-playground:';

/**
 * @typedef {{ client: Redis, prefix: string }} RedisHandle
 */

let handle = /** @type {RedisHandle | null} */ (null);

/**
 * Lazy singleton — built on first access so build-time env-less runs succeed.
 * @returns {RedisHandle}
 */
export function getRedis() {
	if (handle) return handle;
	const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
	if (!url) throw new Error('UPSTASH_REDIS_REST_URL or KV_REST_API_URL is required');
	if (!token) throw new Error('UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN is required');
	const client = new Redis({ url, token });
	const prefix = env.KEY_PREFIX ?? DEFAULT_KEY_PREFIX;
	handle = { client, prefix };
	return handle;
}

/**
 * Build the physical Upstash key from a logical key by prepending the prefix.
 * @param {RedisHandle} h
 * @param {string} logicalKey
 * @returns {string}
 */
export function pkey(h, logicalKey) {
	return `${h.prefix}${logicalKey}`;
}
