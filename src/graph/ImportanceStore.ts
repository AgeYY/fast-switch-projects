import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Importance } from './importance';

// Kept in Git's common directory: shared by worktrees, never part of a code commit.
// One atomic file per branch avoids losing edits to other branches in another window.
export class ImportanceStore {

	private readonly directory: string;

	constructor (commonDirectory: string) {

		this.directory = join(commonDirectory, 'fast-switch-projects', 'importance');

	}

	async read (): Promise<Map<string, Importance>> {

		let files: string[];
		try {
			files = await fs.readdir(this.directory);
		} catch (error) {
			if (error.code === 'ENOENT') return new Map();
			throw error;
		}
		const records = await Promise.all(files.filter((file) => /^[a-f0-9]{64}\.json$/.test(file)).sort().map(async (file) => {

			try {
				const record = <{ branch?: unknown; importance?: unknown }>JSON.parse(await fs.readFile(join(this.directory, file), 'utf8'));
				if (typeof record.branch === 'string' && (record.importance === 'important' || record.importance === 'archived')) {
					return <[string, Importance]>[record.branch, record.importance];
				}
			} catch (error) {
				if (error.code !== 'ENOENT') throw error;
			}
			return undefined;

		}));
		return new Map(records.filter(Boolean));

	}

	async set (branch: string, importance: Importance): Promise<void> {

		const name = `${createHash('sha256').update(branch).digest('hex')}.json`;
		const destination = join(this.directory, name);
		if (importance === 'normal') {
			try {
				await fs.unlink(destination);
			} catch (error) {
				if (error.code !== 'ENOENT') throw error;
			}
			return;
		}
		await fs.mkdir(this.directory, { recursive: true });
		const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
		try {
			await fs.writeFile(temporary, `${JSON.stringify({ branch, importance })}\n`, { flag: 'wx', mode: 0o600 });
			await fs.rename(temporary, destination);
		} finally {
			await fs.unlink(temporary).catch(() => undefined);
		}

	}

}
