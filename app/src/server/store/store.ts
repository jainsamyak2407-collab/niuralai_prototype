import type { ScenarioId, ScenarioState } from "@/lib/contracts/domain";
import { seedScenario } from "@/server/domain/seed";

// Repository interface. UI and domain code never depend on the storage implementation.
export interface ScenarioStore {
  readonly mode: string;
  readonly durable: boolean;
  load(id: ScenarioId): Promise<ScenarioState>;
  /** Append the next revision. Throws ConflictError if another writer took that revision. */
  commit(state: ScenarioState): Promise<void>;
  putFile(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getFile(path: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

export class ConflictError extends Error {}
export class StoreUnavailableError extends Error {}

const pad = (n: number) => String(n).padStart(8, "0");

/**
 * Supabase Storage (private buckets) as an append-only, revision-numbered document store.
 * Each scenario is one JSON document per revision: scenarios/{id}/rev-00000042.json.
 * Creating an object that already exists fails, which gives compare-and-create
 * semantics: two concurrent writers cannot both commit the same revision.
 * Chosen because the environment has the Supabase secret key but no SQL/migration
 * access. Durable across Vercel serverless instances.
 */
export class SupabaseStorageStore implements ScenarioStore {
  readonly mode = "Supabase Storage (private buckets, append-only revisions)";
  readonly durable = true;
  private ready: Promise<void> | null = null;
  constructor(
    private url: string,
    private key: string,
    private stateBucket = "qle-state",
    private fileBucket = "qle-evidence",
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, ...extra };
  }

  private async ensureBuckets() {
    this.ready ??= (async () => {
      for (const id of [this.stateBucket, this.fileBucket]) {
        const res = await fetch(`${this.url}/storage/v1/bucket`, {
          method: "POST",
          headers: this.headers({ "content-type": "application/json" }),
          body: JSON.stringify({ id, name: id, public: false, file_size_limit: 10 * 1024 * 1024 }),
        });
        if (!res.ok) {
          const body = await res.text();
          if (!/already exists|Duplicate/i.test(body)) throw new StoreUnavailableError(`Storage bucket check failed (${res.status}).`);
        }
      }
    })().catch((e) => {
      this.ready = null;
      throw e;
    });
    return this.ready;
  }

  private async latestRev(id: ScenarioId): Promise<number | null> {
    const res = await fetch(`${this.url}/storage/v1/object/list/${this.stateBucket}`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({ prefix: `scenarios/${id}/`, limit: 1, offset: 0, sortBy: { column: "name", order: "desc" } }),
      cache: "no-store",
    });
    if (!res.ok) throw new StoreUnavailableError(`Could not list scenario revisions (${res.status}).`);
    const items = (await res.json()) as { name: string }[];
    const m = items[0]?.name.match(/rev-(\d+)\.json/);
    return m ? Number(m[1]) : null;
  }

  async load(id: ScenarioId): Promise<ScenarioState> {
    await this.ensureBuckets();
    for (let i = 0; i < 3; i++) {
      const rev = await this.latestRev(id);
      if (rev === null) {
        const seed = seedScenario(id, new Date().toISOString());
        seed.rev = 1;
        try {
          await this.write(seed);
          return seed;
        } catch (e) {
          if (e instanceof ConflictError) continue;
          throw e;
        }
      }
      const res = await fetch(`${this.url}/storage/v1/object/${this.stateBucket}/scenarios/${id}/rev-${pad(rev)}.json`, { headers: this.headers(), cache: "no-store" });
      if (!res.ok) throw new StoreUnavailableError(`Could not read scenario ${id} (${res.status}).`);
      return (await res.json()) as ScenarioState;
    }
    throw new StoreUnavailableError("Could not initialize the scenario.");
  }

  private async write(state: ScenarioState) {
    const res = await fetch(`${this.url}/storage/v1/object/${this.stateBucket}/scenarios/${state.scenarioId}/rev-${pad(state.rev)}.json`, {
      method: "POST",
      headers: this.headers({ "content-type": "application/json", "x-upsert": "false" }),
      body: JSON.stringify(state),
    });
    if (res.ok) return;
    const body = await res.text();
    if (/Duplicate|already exists|KeyAlreadyExists/i.test(body)) throw new ConflictError("Revision already exists.");
    throw new StoreUnavailableError(`Could not save (${res.status}).`);
  }

  async commit(state: ScenarioState) {
    await this.ensureBuckets();
    await this.write(state);
  }

  async putFile(path: string, bytes: Uint8Array, contentType: string) {
    await this.ensureBuckets();
    const res = await fetch(`${this.url}/storage/v1/object/${this.fileBucket}/${path}`, {
      method: "POST",
      headers: this.headers({ "content-type": contentType, "x-upsert": "false" }),
      body: Buffer.from(bytes),
    });
    if (!res.ok) throw new StoreUnavailableError(`Could not store the file (${res.status}).`);
  }

  async getFile(path: string) {
    await this.ensureBuckets();
    const res = await fetch(`${this.url}/storage/v1/object/${this.fileBucket}/${path}`, { headers: this.headers(), cache: "no-store" });
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }
}

/** In-memory store for tests only. Not durable; never used for a hosted preview. */
export class MemoryStore implements ScenarioStore {
  readonly mode = "In-memory (tests only, not durable)";
  readonly durable = false;
  private revs = new Map<string, ScenarioState[]>();
  private files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  constructor(private autopilot = true) {}
  async load(id: ScenarioId) {
    const list = this.revs.get(id);
    if (!list?.length) {
      const seed = seedScenario(id, new Date().toISOString());
      seed.autopilot = this.autopilot;
      seed.rev = 1;
      this.revs.set(id, [structuredClone(seed)]);
      return seed;
    }
    return structuredClone(list[list.length - 1]);
  }
  async commit(state: ScenarioState) {
    const list = this.revs.get(state.scenarioId) ?? [];
    if (list.some((s) => s.rev === state.rev)) throw new ConflictError("Revision already exists.");
    list.push(structuredClone(state));
    this.revs.set(state.scenarioId, list);
  }
  async putFile(path: string, bytes: Uint8Array, contentType: string) {
    this.files.set(path, { bytes, contentType });
  }
  async getFile(path: string) {
    return this.files.get(path) ?? null;
  }
}

let store: ScenarioStore | null = null;
export function getStore(): ScenarioStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) store = new SupabaseStorageStore(url.replace(/\/$/, ""), key);
  else if (process.env.QLE_TEST_MEMORY_STORE === "1") store = new MemoryStore();
  else throw new StoreUnavailableError("Persistence is not configured: SUPABASE_URL and SUPABASE_SECRET_KEY are required. The app never falls back silently to a non-durable store.");
  return store;
}
export function setStoreForTests(s: ScenarioStore) {
  store = s;
}
