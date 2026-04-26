export type BackupSchedule = {
  enabled: boolean;
  /** 0–23 */
  hour: number;
  /** 0–59 */
  minute: number;
  /** 0=Sun … 6=Sat; empty array = every day */
  daysOfWeek: number[];
  /** How many backup files to retain (oldest deleted automatically) */
  maxKeep: number;
  /** If non-empty, backup files are encrypted with AES-256-GCM using this password */
  encryptionPassword: string;
};
