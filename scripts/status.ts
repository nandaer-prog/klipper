import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { WORK } from "./config";

const FILE = path.join(WORK, "status.json");

export type Status = { file: string; stage: string; detail?: string };

let current: Status | null = null;

/** Tulis status proses yang sedang berjalan agar bisa dibaca dashboard. */
export const setStatus = async (patch: Partial<Status> & { file?: string }) => {
  current = { file: "", stage: "", ...current, ...patch };
  await mkdir(WORK, { recursive: true });
  await writeFile(FILE, JSON.stringify({ ...current, updatedAt: Date.now() }));
};

export const clearStatus = async () => {
  current = null;
  await rm(FILE, { force: true });
};
