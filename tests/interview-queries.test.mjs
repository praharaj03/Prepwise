import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./load-module.mjs";

const missingIndex = () => Object.assign(new Error("9 FAILED_PRECONDITION: The query requires an index."), { code: 9 });

function fixture(records, { indexedError = missingIndex(), fallbackError } = {}) {
  const reads = [];
  function query(filters = [], ordering = [], limit, cursor) {
    return {
      where: (...filter) => query([...filters, filter], ordering, limit, cursor),
      orderBy: (...order) => query(filters, [...ordering, order], limit, cursor),
      limit: (value) => query(filters, ordering, value, cursor),
      startAfter: (document) => query(filters, ordering, limit, document.id),
      get: async () => {
        reads.push({ filters, ordering, limit, cursor });
        if (filters.length && ordering.length && indexedError) throw indexedError;
        if ((!filters.length || !ordering.length) && fallbackError) throw fallbackError;
        let matches = records.filter((record) => filters.every(([field, operation, value]) =>
          field in record && (operation === "==" ? record[field] === value : record[field] !== value),
        ) && ordering.every(([field]) => field in record));
        matches = [...matches].sort((a, b) => {
          for (const [field, direction] of [...ordering, ["id", ordering.at(-1)?.[1] ?? "asc"]]) {
            const comparison = String(a[field]).localeCompare(String(b[field]));
            if (comparison) return direction === "desc" ? -comparison : comparison;
          }
          return 0;
        });
        if (cursor) matches = matches.slice(matches.findIndex((record) => record.id === cursor) + 1);
        if (limit) matches = matches.slice(0, limit);
        const docs = matches.map(({ id, ...data }) => ({ id, data: () => data }));
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  return {
    ...loadModule("lib/actions/general.action.ts", {
      "server-only": {},
      "@/firebase/admin": { db: { collection: () => query() } },
    }),
    reads,
  };
}

const record = (id, overrides = {}) => ({
  id, userId: "another-user", createdAt: "2026-11-15T12:00:00.000Z", finalized: true, ...overrides,
});

test("owned interviews remain newest first without a composite index", async () => {
  const db = fixture([
    record("older", { userId: "me", createdAt: "2026-11-14T12:00:00.000Z" }),
    record("unrelated"),
    record("newer", { userId: "me" }),
    { id: "undated", userId: "me" },
  ]);
  assert.deepEqual((await db.getInterviewsByUserId("me")).map(({ id }) => id), ["newer", "older"]);
  assert.equal(db.reads.length, 2);
  assert.deepEqual(db.reads[1].ordering, []);
});

test("available interviews paginate beyond excluded records and fill the requested count", async () => {
  const excluded = Array.from({ length: 50 }, (_, index) => record(`excluded-${index}`, {
    userId: index % 2 ? "me" : "another-user",
    finalized: index % 2 === 1,
  }));
  const db = fixture([
    ...excluded,
    record("eligible-newest", { createdAt: "2026-11-14T12:00:00.000Z" }),
    record("eligible-next", { createdAt: "2026-11-13T12:00:00.000Z" }),
    record("eligible-oldest", { createdAt: "2026-11-12T12:00:00.000Z" }),
  ]);
  const result = await db.getLatestInterviews({ userId: "me", limit: 2 });
  assert.deepEqual(result.map(({ id }) => id), ["eligible-newest", "eligible-next"]);
  assert.equal(db.reads.length, 3);
  assert.ok(db.reads[2].cursor);
  assert.ok(db.reads.slice(1).every(({ filters, limit }) => !filters.length && limit === 50));
});

test("pagination handles equal timestamps without skipping eligible records", async () => {
  const records = Array.from({ length: 55 }, (_, index) => record(String(index).padStart(3, "0"), {
    userId: index >= 5 ? "me" : "another-user",
  }));
  const db = fixture(records);
  const result = await db.getLatestInterviews({ userId: "me", limit: 5 });
  assert.deepEqual(result.map(({ id }) => id), ["004", "003", "002", "001", "000"]);
  assert.equal(new Set(result.map(({ id }) => id)).size, 5);
});

test("empty or entirely excluded interview lists return null", async () => {
  const db = fixture(Array.from({ length: 50 }, (_, index) => record(String(index), { finalized: false })));
  assert.equal(await db.getInterviewsByUserId("me"), null);
  assert.equal(await db.getLatestInterviews({ userId: "me" }), null);
  assert.ok(db.reads.at(-1).cursor);
});

test("the default limit is applied after filtering and malformed ownership is excluded", async () => {
  const db = fixture([
    record("malformed-owner", { userId: undefined }),
    ...Array.from({ length: 25 }, (_, index) => record(String(index))),
  ]);
  const result = await db.getLatestInterviews({ userId: "me" });
  assert.equal(result.length, 20);
  assert.ok(result.every(({ userId }) => userId === "another-user"));
});

test("ready composite indexes use one efficient query per list", async () => {
  const db = fixture([record("mine", { userId: "me" }), record("available"), record("draft", { finalized: false })], {
    indexedError: null,
  });
  assert.deepEqual((await db.getInterviewsByUserId("me")).map(({ id }) => id), ["mine"]);
  assert.deepEqual((await db.getLatestInterviews({ userId: "me" })).map(({ id }) => id), ["available"]);
  assert.equal(db.reads.length, 2);
});

test("permissions and unrelated failed preconditions are not swallowed", async () => {
  for (const indexedError of [
    Object.assign(new Error("Permission denied"), { code: 7 }),
    Object.assign(new Error("Database is not configured"), { code: 9 }),
  ]) {
    const db = fixture([], { indexedError });
    await assert.rejects(db.getLatestInterviews({ userId: "me" }), (error) => error === indexedError);
    await assert.rejects(db.getInterviewsByUserId("me"), (error) => error === indexedError);
    assert.equal(db.reads.length, 2);
  }
});

test("fallback connection failures still surface", async () => {
  const fallbackError = Object.assign(new Error("Unavailable"), { code: 14 });
  const db = fixture([], { fallbackError });
  await assert.rejects(db.getLatestInterviews({ userId: "me" }), (error) => error === fallbackError);
  await assert.rejects(db.getInterviewsByUserId("me"), (error) => error === fallbackError);
});

test("invalid limits are rejected before querying Firestore", async () => {
  const db = fixture([]);
  for (const limit of [0, -1, 1.5, Infinity, NaN]) {
    await assert.rejects(db.getLatestInterviews({ userId: "me", limit }), RangeError);
  }
  assert.equal(db.reads.length, 0);
});
