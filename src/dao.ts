import { drizzle } from "drizzle-orm/libsql";

// 确保环境变量存在
if (!process.env.DB_FILE_NAME) {
    throw new Error('DB_FILE_NAME environment variable is not set');
}

const db = drizzle(process.env.DB_FILE_NAME);

export default db;
