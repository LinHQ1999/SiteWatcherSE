import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from './db/schema.js';
import { desc, eq } from "drizzle-orm";
import { diff } from "./utils.js";
import { TSiteQuery } from "./scraper.js";

// 确保环境变量存在
if (!process.env.SWATCHER_DB_FILE_NAME) {
    throw new Error('Set SWATCHER_DB_FILE_NAME please!');
}

const db = drizzle({
    connection: {
        url: process.env.SWATCHER_DB_FILE_NAME
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

export default db;
