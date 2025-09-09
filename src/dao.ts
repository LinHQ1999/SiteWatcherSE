import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from './db/schema.js';
import { count, desc, eq, gte } from "drizzle-orm";
import { DB, diff } from "./utils.js";
import { TSiteQuery } from "./scraper.js";

// 确保环境变量存在
if (!DB) {
    throw new Error('Set SWATCHER_DB_FILE_NAME please!');
}

const db = drizzle({
    connection: {
        url: DB
    },
    schema
});

export async function diffLatest(siteInfo: TSiteQuery) {
    const [latest, last] = await db.query.siteTable.findMany({
        columns: {
            parsed: true,
            timestamp: true
        },
        orderBy: [desc(schema.siteTable.timestamp)],
        where: eq(schema.siteTable.site, siteInfo.site),
        limit: 2
    });
    if (!latest || !last) {
        return console.log(siteInfo.site, " 没有足够历史数据用于 diff，跳过");
    };

    return await diff(last.parsed, latest.parsed);
}

export async function getProfileState(path: string) {
    const res = await db.query.stateTable.findFirst({
        where: eq(schema.stateTable.profile, path)
    });
    return res?.state ?? '{}';
}

export async function saveProfileState(path: string, value: string) {
    return db.insert(schema.stateTable).values({
        profile: path,
        state: value,
    }).onConflictDoUpdate({
        target: [schema.stateTable.profile],
        set: { state: value }
    });
}

/**
 * 只返回有两条记录以上的
 */
export function getSites() {
    return db.select({
        site: schema.siteTable.site,
    }).from(schema.siteTable)
        .groupBy(schema.siteTable.site)
        .having(gte(count(), 2));
}

export function getSiteHist(site: string) {
    return db.query.siteTable.findMany({
        where: eq(schema.siteTable.site, site)
    });
}

export default db;
