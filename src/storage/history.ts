import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DiagnosticReport } from "../diagnostics/types.js";

export interface HistoryItem {
  id: string;
  timestamp: string;
  targetHost: string;
  targetPort?: number;
  targetUrl?: string;
  hasErrors: boolean;
  findingsCount: number;
  report: DiagnosticReport;
}

const STORAGE_DIR = path.resolve(process.cwd(), "data");
const HISTORY_FILE = path.join(STORAGE_DIR, "history.json");

/**
 * Concurrency-Safe, Atomically-Persisted History Store
 * 
 * Features:
 * 1. Serialized Write Queue: Protects against race conditions from concurrent incoming requests.
 * 2. Atomic Writes: Writes to a temporary staging file first, then atomically renames to prevent partial write corruption.
 * 3. FIFO Capacity Limiting: Retains latest 100 diagnostic runs.
 */
export class DiagnosticHistory {
  private static initialized = false;
  private static writeQueue: Promise<any> = Promise.resolve();

  private static async ensureInitialized() {
    if (this.initialized) return;
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      try {
        await fs.access(HISTORY_FILE);
      } catch {
        await fs.writeFile(HISTORY_FILE, JSON.stringify([], null, 2), "utf-8");
      }
      this.initialized = true;
    } catch (err) {
      console.error("Failed to initialize history storage directory:", err);
    }
  }

  private static async readItems(): Promise<HistoryItem[]> {
    await this.ensureInitialized();
    try {
      const content = await fs.readFile(HISTORY_FILE, "utf-8");
      return JSON.parse(content || "[]");
    } catch {
      return [];
    }
  }

  /**
   * Atomic file write using write-to-temp + rename pattern
   */
  private static async atomicWriteItems(items: HistoryItem[]): Promise<void> {
    await this.ensureInitialized();
    const tempFile = path.join(STORAGE_DIR, `history.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`);
    const payload = JSON.stringify(items, null, 2);

    await fs.writeFile(tempFile, payload, "utf-8");
    try {
      await fs.rename(tempFile, HISTORY_FILE);
    } catch {
      // Windows-specific fallback if file is briefly locked
      await fs.copyFile(tempFile, HISTORY_FILE);
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  /**
   * Enqueues writes sequentially to guarantee zero concurrency overwrites
   */
  public static async saveRun(report: DiagnosticReport): Promise<HistoryItem> {
    return new Promise<HistoryItem>((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          const items = await this.readItems();
          const id = Buffer.from(`${Date.now()}-${Math.random().toString(36).substring(2, 7)}`).toString("base64url");

          const item: HistoryItem = {
            id,
            timestamp: report.timestamp,
            targetHost: report.target.host,
            targetPort: report.target.port,
            targetUrl: report.target.url,
            hasErrors: report.findings.some((f) => String(f.severity).toUpperCase() === "CRITICAL"),
            findingsCount: report.findings.length,
            report,
          };

          items.unshift(item);
          if (items.length > 100) {
            items.pop();
          }

          await this.atomicWriteItems(items);
          resolve(item);
        })
        .catch(reject);
    });
  }

  public static async getRuns(limit = 20): Promise<HistoryItem[]> {
    const items = await this.readItems();
    return items.slice(0, limit);
  }

  public static async getRunById(id: string): Promise<HistoryItem | undefined> {
    const items = await this.readItems();
    return items.find((item) => item.id === id);
  }

  public static async clearHistory(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          await this.atomicWriteItems([]);
          resolve();
        })
        .catch(reject);
    });
  }
}
