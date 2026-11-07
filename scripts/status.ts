import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { WORK } from "./config";

const FILE = path.join(WORK, "jobs.json");

/** Satu video yang sedang berada di salah satu tahap pipeline. */
export type JobStatus = {
  id: string;
  file: string;
  stage: string;
  detail: string;
};

const jobs = new Map<string, JobStatus>();
let chain: Promise<void> = Promise.resolve();

// Tulis berurutan agar beberapa pembaruan bersamaan tidak saling menimpa
const flush = () => {
  chain = chain
    .then(async () => {
      await mkdir(WORK, { recursive: true });
      await writeFile(
        FILE,
        JSON.stringify({ jobs: [...jobs.values()], updatedAt: Date.now() }),
      );
    })
    .catch(() => undefined);
  return chain;
};

export const setJob = (id: string, patch: Partial<Omit<JobStatus, "id">>) => {
  jobs.set(id, { id, file: "", stage: "", detail: "", ...jobs.get(id), ...patch });
  return flush();
};

export const removeJob = (id: string) => {
  jobs.delete(id);
  return flush();
};

export const clearJobs = async () => {
  jobs.clear();
  await chain;
  await rm(FILE, { force: true });
};
