export function localFile(filename: string): { read(): Promise<unknown>; write(entries: unknown[]): Promise<void> };
