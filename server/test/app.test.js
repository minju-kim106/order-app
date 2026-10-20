import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";

async function startServer(database) {
  const server = createApp(database).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, baseUrl: `http://localhost:${server.address().port}` };
}

test("health endpoint checks the database and allows the frontend origin", async () => {
  const database = { query: async () => ({ rows: [{ "?column?": 1 }] }) };
  const { server, baseUrl } = await startServer(database);
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "http://localhost:5173" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.deepEqual(await response.json(), { status: "ok", database: "connected" });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("health endpoint returns 503 when the database is unavailable", async () => {
  const database = { query: async () => { throw Object.assign(new Error(), { code: "ECONNREFUSED" }); } };
  const { server, baseUrl } = await startServer(database);
  try {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "error", database: "unavailable" });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("unknown routes return a JSON 404 response", async () => {
  const database = { query: async () => ({ rows: [] }) };
  const { server, baseUrl } = await startServer(database);
  try {
    const response = await fetch(`${baseUrl}/api/not-found`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "요청한 리소스를 찾을 수 없습니다.",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
