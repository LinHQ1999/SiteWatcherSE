import { Chalk } from "chalk";
import { type ExecException, spawn } from "child_process";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

export class CliError implements Error {
  public message;
  public name = "CustomCliError";

  constructor(message: string, name?: string) {
    this.message = message;
    if (name) this.name = name;
  }

  log() {
    console.log(c.redBright(this.message));
  }
}

function isExecErr(e: any): e is ExecException {
  return typeof e.stderr === 'string';
}

export const c = new Chalk({ level: 3 });

export const DB = process.env.SWATCHER_DB_FILE_NAME;

export async function diff(strA: string | null, strB: string | null) {
  if (!strA || !strB) return;

  try {
    const tmp = await mkdtemp(join(tmpdir(), 'swatcher-'));

    const strATmpPath = join(tmp, `strA`);
    const strBTmpPath = join(tmp, `strB`);

    await Promise.all([
      writeFile(strATmpPath, strA, 'utf8'),
      writeFile(strBTmpPath, strB, 'utf8')
    ]);

    return await promisify(spawn)("delta", ["-s", "--true-color", "always", strATmpPath, strBTmpPath], { stdio: "inherit" });
  } catch (e) {
    if (isExecErr(e)) {
      console.log(e.stderr);
    }
    process.exit(1);
  }
}
