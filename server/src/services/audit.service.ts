import fs from "node:fs";
import path from "node:path";
import { AuditEvent } from "../types/audit.js";

export class AuditService {
  private logDir: string;
  private retentionDays: number;

  constructor(logDir: string, retentionDays: number) {
    this.logDir = logDir;
    this.retentionDays = retentionDays;
    fs.mkdirSync(this.logDir, { recursive: true });
  }

  log(event: Omit<AuditEvent, "timestamp">): void {
    const entry: AuditEvent = {
      timestamp: new Date().toISOString(),
      ...event,
    };
    const line = JSON.stringify(entry) + "\n";
    const logFile = this.currentLogFile();
    fs.appendFileSync(logFile, line, "utf-8");
  }

  private currentLogFile(): string {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this.logDir, `audit-${date}.jsonl`);
  }

  purgeOldLogs(): void {
    const cutoff = Date.now() - this.retentionDays * 86400 * 1000;
    const files = fs.existsSync(this.logDir) ? fs.readdirSync(this.logDir) : [];
    for (const file of files) {
      if (!file.startsWith("audit-") || !file.endsWith(".jsonl")) continue;
      const filePath = path.join(this.logDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    }
  }
}
