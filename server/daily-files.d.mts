export interface DailyFiles { read(name: string): unknown; datedFiles(): string[]; }
export function createDailyFiles(directory?: string): DailyFiles;
