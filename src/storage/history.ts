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

export class DiagnosticHistory {
  private static initialized = false;

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
      console.error("Failed to initialize history storage:", err);
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

  private static async writeItems(items: HistoryItem[]): Promise<void> {
    await this.ensureInitialized();
    await fs.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2), "utf-8");
  }

  public static async saveRun(report: DiagnosticReport): Promise<HistoryItem> {
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

    // Keep latest 100 runs
    items.unshift(item);
    if (items.length > 100) {
      items.pop();
    }

    await this.writeItems(items);
    return item;
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
    await this.writeItems([]);
  }
}
