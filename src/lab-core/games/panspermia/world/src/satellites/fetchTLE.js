const CACHE_DURATION = 60 * 60 * 1000 // 1 hora

import { REGISTRY } from './registry.js'

/**
 * Parsea texto TLE (grupos de 3 líneas: nombre, line1, line2)
 * @param {string} text
 * @returns {Array<{ OBJECT_NAME: string, TLE_LINE1: string, TLE_LINE2: string }>}
 */
function parseTLEText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const records = []
    for (let i = 0; i + 2 < lines.length; i += 3) {
        records.push({
            OBJECT_NAME: lines[i],
            TLE_LINE1:   lines[i + 1],
            TLE_LINE2:   lines[i + 2],
        })
    }
    return records
}

/**
 * Fetch TLE data for a group from CelesTrak.
 * Results are cached in sessionStorage for 1 hour.
 * @param {string} group - key from GROUPS
 * @returns {Promise<Array>} array of GP objects with TLE_LINE1, TLE_LINE2, OBJECT_NAME
 */
export async function fetchTLE(group) {
    const cacheKey = `tle_cache_v2_${group}` // v2 = formato tle texto

    try {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
            const { data, timestamp } = JSON.parse(cached)
            if (Date.now() - timestamp < CACHE_DURATION) {
                console.log(`[fetchTLE] "${group}" loaded from cache (${data.length} sats)`)
                return data
            }
        }
    } catch (_) {
        // sessionStorage not available or corrupt — continue to fetch
    }

    const config = REGISTRY[group]
    if (!config) throw new Error(`Unknown satellite group: "${group}"`)
    const url = config.url

    console.log(`[fetchTLE] Fetching "${group}" from CelesTrak...`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`CelesTrak fetch failed: ${response.status}`)

    const text = await response.text()
    const data = parseTLEText(text)
    console.log(`[fetchTLE] "${group}" fetched (${data.length} sats)`)

    try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }))
    } catch (_) {
        // sessionStorage full — skip cache
    }

    return data
}
