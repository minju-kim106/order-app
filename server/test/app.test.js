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

test("public menu responses contain options but never expose stock", async () => {
  const database = {
    query: async () => ({
      rows: [
        {
          id: 1,
          name: "아메리카노",
          description: "커피",
          price: 4000,
          image_url: "",
          stock_quantity: 7,
          option_id: 2,
          option_name: "샷 추가",
          option_price: 500,
        },
      ],
    }),
  };
  const { server, baseUrl } = await startServer(database);
  try {
    const response = await fetch(`${baseUrl}/api/menus`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      menus: [
        {
          id: 1,
          name: "아메리카노",
          description: "커피",
          price: 4000,
          imageUrl: "",
          soldOut: false,
          options: [{ id: 2, name: "샷 추가", price: 500 }],
        },
      ],
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("order creation uses database prices and commits stock deduction atomically", async () => {
  const calls = [];
  const client = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM menus") && sql.includes("FOR UPDATE")) {
        return {
          rows: [{ id: 1, name: "아메리카노", price: 4000, stock_quantity: 5 }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM options")) {
        return { rows: [{ id: 2, menu_id: 1, name: "샷 추가", price: 500 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO orders")) {
        return {
          rows: [
            {
              id: "42",
              ordered_at: "2026-10-20T00:00:00.000Z",
              status: "주문 접수",
              total_amount: 9000,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO order_items")) {
        return { rows: [{ id: "100" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE menus")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const database = { connect: async () => client };
  const { server, baseUrl } = await startServer(database);
  try {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ menuId: 1, quantity: 2, optionIds: [2], price: 1 }],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.order.totalAmount, 9000);
    assert.equal(body.order.items[0].unitPrice, 4000);
    assert.equal(body.order.items[0].totalPrice, 9000);
    assert.deepEqual(
      calls.find((call) => call.sql.includes("INSERT INTO orders")).parameters,
      [9000],
    );
    assert.deepEqual(
      calls.find((call) => call.sql.includes("UPDATE menus")).parameters,
      [1, 2],
    );
    assert.ok(calls.some((call) => call.sql === "COMMIT"));
    assert.ok(!calls.some((call) => call.sql === "ROLLBACK"));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("insufficient stock returns a conflict and rolls back the order", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes("FROM menus")) {
        return {
          rows: [{ id: 1, name: "아메리카노", price: 4000, stock_quantity: 1 }],
          rowCount: 1,
        };
      }
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const { server, baseUrl } = await startServer({ connect: async () => client });
  try {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ menuId: 1, quantity: 2, optionIds: [] }],
      }),
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "재고가 부족합니다.",
      menuId: 1,
      available: 1,
      requested: 2,
    });
    assert.ok(calls.includes("ROLLBACK"));
    assert.ok(!calls.some((sql) => sql.includes("INSERT INTO orders")));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("invalid order input is rejected before opening a transaction", async () => {
  let transactionStarted = false;
  const { server, baseUrl } = await startServer({
    connect: async () => ({
      query: async () => {
        transactionStarted = true;
        return { rows: [], rowCount: 0 };
      },
      release() {},
    }),
  });
  try {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });

    assert.equal(response.status, 400);
    assert.equal(transactionStarted, false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("admin stock endpoint rejects changes below zero and includes stock in listings", async () => {
  const database = {
    async query(sql) {
      if (sql.includes("UPDATE menus")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT id FROM menus")) return { rows: [{ id: 1 }], rowCount: 1 };
      return {
        rows: [
          {
            id: 1,
            name: "아메리카노",
            description: "",
            price: 4000,
            image_url: "",
            stock_quantity: 0,
            option_id: null,
            option_name: null,
            option_price: null,
          },
        ],
        rowCount: 1,
      };
    },
  };
  const { server, baseUrl } = await startServer(database);
  try {
    const listResponse = await fetch(`${baseUrl}/api/admin/menus`);
    assert.equal((await listResponse.json()).menus[0].stockQuantity, 0);

    const publicMenuResponse = await fetch(`${baseUrl}/api/menus`);
    const publicMenu = (await publicMenuResponse.json()).menus[0];
    assert.equal(publicMenu.soldOut, true);
    assert.equal("stockQuantity" in publicMenu, false);

    const stockResponse = await fetch(`${baseUrl}/api/admin/menus/1/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change: -1 }),
    });
    assert.equal(stockResponse.status, 409);
    assert.deepEqual(await stockResponse.json(), {
      error: "재고는 0개 미만이 될 수 없습니다.",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("admin order status endpoint only accepts the next state", async () => {
  const database = {
    async query(sql, parameters) {
      if (sql.includes("UPDATE orders")) {
        assert.deepEqual(parameters, ["42", "제조 중", "주문 접수"]);
        return { rows: [{ id: "42" }], rowCount: 1 };
      }
      return {
        rows: [
          {
            id: "42",
            ordered_at: "2026-10-20T00:00:00.000Z",
            status: "제조 중",
            total_amount: 4500,
            item_id: "100",
            menu_id: 1,
            menu_name: "아메리카노",
            unit_price: 4000,
            quantity: 1,
            order_option_id: "200",
            option_id: 2,
            option_name: "샷 추가",
            option_price: 500,
          },
        ],
        rowCount: 1,
      };
    },
  };
  const { server, baseUrl } = await startServer(database);
  try {
    const response = await fetch(`${baseUrl}/api/admin/orders/42/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "제조 중" }),
    });

    assert.equal(response.status, 200);
    const { order } = await response.json();
    assert.equal(order.status, "제조 중");
    assert.equal(order.items[0].totalPrice, 4500);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
