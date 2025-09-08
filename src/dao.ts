import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from './db/schema.js';
import { desc, eq } from "drizzle-orm";
import { tmpdir } from 'os';
import { mkdtemp, writeFile } from "fs/promises";
import { join } from "path";
import { spawn, type ExecException } from "child_process";
import { promisify } from "util";
import { TSiteQuery } from "./scraper.js";

// 确保环境变量存在
if (!process.env.DB_FILE_NAME) {
    throw new Error('No such db file!');
}

const db = drizzle({
    connection: {
        url: process.env.DB_FILE_NAME
    },
    schema
});

function isExecErr(e: any): e is ExecException {
    return typeof e.stderr === 'string';
}

export async function diffLatest(siteInfo: TSiteQuery) {
    try {
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

        const tmp = await mkdtemp(join(tmpdir(), 'swatcher-'));
        const latestFname = join(tmp, `latest-${Date.now()}`);
        const lastFname = join(tmp, `last-${Date.now()}`);
        await Promise.all([
            writeFile(lastFname, last.parsed ?? '', 'utf8'),
            writeFile(latestFname, latest.parsed ?? '', 'utf8')
        ]);

        await promisify(spawn)("delta", [lastFname, latestFname], { stdio: "inherit" });
    } catch (e) {
        if (isExecErr(e) && e.code === 1) {
            console.log(e.stderr);
            process.exit(e.code);
        } else {
            process.exit(1);
        }
    }
}

export default db;
