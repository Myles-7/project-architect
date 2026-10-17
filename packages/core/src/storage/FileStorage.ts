import { mkdir, readFile, writeFile, rm, access, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

export class FileStorage {
  /**
   * Ensures that a directory and all parent directories exist.
   */
  async ensureDir(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  /**
   * Checks if a file or directory exists.
   */
  async exists(targetPath: string): Promise<boolean> {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely reads and parses a JSON file.
   */
  async readJson<T>(filePath: string): Promise<T> {
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content) as T;
    } catch (err: any) {
      throw new Error(`Failed to read JSON at ${filePath}: ${err.message}`);
    }
  }

  /**
   * Writes data as formatted JSON.
   */
  async writeJson(filePath: string, data: unknown): Promise<void> {
    await this.ensureDir(dirname(filePath));
    const content = JSON.stringify(data, null, 2) + '\n';
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, 'utf8');
      await rename(temporary, filePath);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  /**
   * Reads raw string content.
   */
  async readText(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
  }

  /**
   * Writes raw string content.
   */
  async writeText(filePath: string, content: string): Promise<void> {
    await this.ensureDir(dirname(filePath));
    await writeFile(filePath, content, 'utf8');
  }

  /**
   * Reads binary buffer content.
   */
  async readBuffer(filePath: string): Promise<Buffer> {
    return readFile(filePath);
  }

  /**
   * Writes binary buffer content.
   */
  async writeBuffer(filePath: string, buffer: Buffer): Promise<void> {
    await this.ensureDir(dirname(filePath));
    await writeFile(filePath, buffer);
  }

  /**
   * Removes a file or directory recursively.
   */
  async remove(targetPath: string): Promise<void> {
    await rm(targetPath, { recursive: true, force: true });
  }

  /**
   * Lists file and directory entries within a directory.
   */
  async listFiles(dirPath: string): Promise<string[]> {
    try {
      const { readdir } = await import('node:fs/promises');
      return await readdir(dirPath);
    } catch {
      return [];
    }
  }

  /**
   * Checks if a path points to a directory.
   */
  async isDirectory(targetPath: string): Promise<boolean> {
    try {
      const { stat } = await import('node:fs/promises');
      const res = await stat(targetPath);
      return res.isDirectory();
    } catch {
      return false;
    }
  }
}
