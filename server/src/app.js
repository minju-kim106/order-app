import cors from "cors";
import express from "express";
import pool from "./db.js";

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const orderStatuses = ["주문 접수", "제조 중", "제조 완료"];
const nextOrderStatus = new Map([
  ["주문 접수", "제조 중"],
  ["제조 중", "제조 완료"],
]);

class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 && value <= 2147483647;
}

function validOrderId(value) {
  return /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n;
}

function mapMenus(rows, includeStock = false) {
  const menus = new Map();
  for (const row of rows) {
    let menu = menus.get(row.id);
    if (!menu) {
      menu = {
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        imageUrl: row.image_url,
        options: [],
      };
      if (includeStock) {
        menu.stockQuantity = row.stock_quantity;
      } else {
        menu.soldOut = row.stock_quantity === 0;
      }
      menus.set(row.id, menu);
    }
    if (row.option_id !== null) {
      menu.options.push({
        id: row.option_id,
        name: row.option_name,
        price: row.option_price,
      });
    }
  }
  return [...menus.values()];
}

async function listMenus(database, includeStock = false) {
  const result = await database.query(
    `SELECT m.id, m.name, m.description, m.price, m.image_url, m.stock_quantity,
            o.id AS option_id, o.name AS option_name, o.price AS option_price
     FROM menus m
     LEFT JOIN options o ON o.menu_id = m.id
     WHERE m.is_active = TRUE
     ORDER BY m.id, o.id`,
  );
  return mapMenus(result.rows, includeStock);
}

async function loadOrders(database, orderId) {
  const result = await database.query(
    `SELECT o.id, o.ordered_at, o.status, o.total_amount,
            oi.id AS item_id, oi.menu_id, oi.menu_name, oi.unit_price, oi.quantity,
            oio.id AS order_option_id, oio.option_id, oio.option_name, oio.option_price
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN order_item_options oio ON oio.order_item_id = oi.id
     ${orderId === undefined ? "" : "WHERE o.id = $1"}
     ORDER BY o.ordered_at DESC, o.id DESC, oi.id, oio.id`,
    orderId === undefined ? [] : [orderId],
  );
  const orders = new Map();
  for (const row of result.rows) {
    let order = orders.get(row.id);
    if (!order) {
      order = {
        id: row.id,
        orderedAt: row.ordered_at,
        status: row.status,
        totalAmount: row.total_amount,
        items: [],
        itemMap: new Map(),
      };
      orders.set(row.id, order);
    }
    if (row.item_id === null) continue;
    let item = order.itemMap.get(row.item_id);
    if (!item) {
      item = {
        menuId: row.menu_id,
        name: row.menu_name,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        totalPrice: row.unit_price * row.quantity,
        options: [],
      };
      order.itemMap.set(row.item_id, item);
      order.items.push(item);
    }
    if (row.order_option_id !== null) {
      item.options.push({
        id: row.option_id,
        name: row.option_name,
        price: row.option_price,
      });
      item.totalPrice += row.option_price * row.quantity;
    }
  }
  return [...orders.values()].map(({ itemMap, ...order }) => order);
}

function validateOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "주문 항목을 하나 이상 입력해 주세요.");
  }
  for (const item of items) {
    if (
      !item ||
      !positiveInteger(item.menuId) ||
      !positiveInteger(item.quantity) ||
      item.quantity > 2147483647 ||
      !Array.isArray(item.optionIds) ||
      item.optionIds.some((id) => !positiveInteger(id)) ||
      new Set(item.optionIds).size !== item.optionIds.length
    ) {
      throw new ApiError(400, "주문 항목의 메뉴, 수량 또는 옵션 형식이 올바르지 않습니다.");
    }
  }
}

export function createApp(database = pool) {
  const app = express();

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());

  app.get("/api/menus", async (_request, response) => {
    response.json({ menus: await listMenus(database) });
  });

  app.get("/api/admin/menus", async (_request, response) => {
    response.json({ menus: await listMenus(database, true) });
  });

  app.patch("/api/admin/menus/:menuId/stock", async (request, response) => {
    const menuId = Number(request.params.menuId);
    const { change } = request.body ?? {};
    if (!positiveInteger(menuId) || ![-1, 1].includes(change)) {
      throw new ApiError(400, "메뉴 ID와 재고 변경 수량을 확인해 주세요.");
    }
    const updated = await database.query(
      `UPDATE menus
       SET stock_quantity = stock_quantity + $2
       WHERE id = $1 AND is_active = TRUE AND stock_quantity + $2 >= 0
       RETURNING id, name, stock_quantity`,
      [menuId, change],
    );
    if (updated.rowCount === 0) {
      const exists = await database.query(
        "SELECT id FROM menus WHERE id = $1 AND is_active = TRUE",
        [menuId],
      );
      if (exists.rowCount === 0) throw new ApiError(404, "메뉴를 찾을 수 없습니다.");
      throw new ApiError(409, "재고는 0개 미만이 될 수 없습니다.");
    }
    response.json({
      menu: {
        id: updated.rows[0].id,
        name: updated.rows[0].name,
        stockQuantity: updated.rows[0].stock_quantity,
      },
    });
  });

  app.post("/api/orders", async (request, response) => {
    const { items } = request.body ?? {};
    validateOrderItems(items);

    const requestedMenuIds = [...new Set(items.map((item) => item.menuId))];
    const requestedOptionIds = [...new Set(items.flatMap((item) => item.optionIds))];
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const menuResult = await client.query(
        `SELECT id, name, price, stock_quantity
         FROM menus
         WHERE id = ANY($1::int[]) AND is_active = TRUE
         ORDER BY id
         FOR UPDATE`,
        [requestedMenuIds],
      );
      const menus = new Map(menuResult.rows.map((menu) => [menu.id, menu]));
      if (menus.size !== requestedMenuIds.length) {
        throw new ApiError(404, "주문에 포함된 메뉴를 찾을 수 없습니다.");
      }

      const optionResult = requestedOptionIds.length
        ? await client.query(
            `SELECT id, menu_id, name, price
             FROM options
             WHERE id = ANY($1::int[])`,
            [requestedOptionIds],
          )
        : { rows: [] };
      const options = new Map(optionResult.rows.map((option) => [option.id, option]));
      const inventoryRequired = new Map();
      const orderItems = items.map((item) => {
        const menu = menus.get(item.menuId);
        const selectedOptions = item.optionIds.map((optionId) => {
          const option = options.get(optionId);
          if (!option || option.menu_id !== item.menuId) {
            throw new ApiError(404, "메뉴에 연결된 옵션을 찾을 수 없습니다.");
          }
          return option;
        });
        const unitPrice = menu.price;
        const itemTotal =
          (unitPrice + selectedOptions.reduce((total, option) => total + option.price, 0)) *
          item.quantity;
        if (!Number.isSafeInteger(itemTotal) || itemTotal > 2147483647) {
          throw new ApiError(400, "주문 금액이 허용 범위를 초과합니다.");
        }
        inventoryRequired.set(
          item.menuId,
          (inventoryRequired.get(item.menuId) ?? 0) + item.quantity,
        );
        if (inventoryRequired.get(item.menuId) > 2147483647) {
          throw new ApiError(400, "주문 수량이 허용 범위를 초과합니다.");
        }
        return { menu, selectedOptions, quantity: item.quantity, unitPrice };
      });
      for (const [menuId, quantity] of inventoryRequired) {
        const menu = menus.get(menuId);
        if (quantity > menu.stock_quantity) {
          throw new ApiError(409, "재고가 부족합니다.", {
            menuId,
            available: menu.stock_quantity,
            requested: quantity,
          });
        }
      }
      const totalAmount = orderItems.reduce(
        (total, item) =>
          total +
          (item.unitPrice +
            item.selectedOptions.reduce((sum, option) => sum + option.price, 0)) *
            item.quantity,
        0,
      );
      if (!Number.isSafeInteger(totalAmount) || totalAmount > 2147483647) {
        throw new ApiError(400, "주문 금액이 허용 범위를 초과합니다.");
      }

      const orderResult = await client.query(
        `INSERT INTO orders (total_amount)
         VALUES ($1)
         RETURNING id, ordered_at, status, total_amount`,
        [totalAmount],
      );
      const savedOrder = orderResult.rows[0];
      const savedItems = [];
      for (const item of orderItems) {
        const itemResult = await client.query(
          `INSERT INTO order_items (order_id, menu_id, menu_name, unit_price, quantity)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [savedOrder.id, item.menu.id, item.menu.name, item.unitPrice, item.quantity],
        );
        const savedItem = {
          menuId: item.menu.id,
          name: item.menu.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
          options: item.selectedOptions.map((option) => ({
            id: option.id,
            name: option.name,
            price: option.price,
          })),
        };
        for (const option of item.selectedOptions) {
          await client.query(
            `INSERT INTO order_item_options
               (order_item_id, option_id, option_name, option_price)
             VALUES ($1, $2, $3, $4)`,
            [itemResult.rows[0].id, option.id, option.name, option.price],
          );
          savedItem.totalPrice += option.price * item.quantity;
        }
        savedItems.push(savedItem);
      }
      for (const [menuId, quantity] of inventoryRequired) {
        await client.query(
          `UPDATE menus SET stock_quantity = stock_quantity - $2
           WHERE id = $1 AND stock_quantity >= $2`,
          [menuId, quantity],
        );
      }
      await client.query("COMMIT");
      response.status(201).json({
        order: {
          id: savedOrder.id,
          orderedAt: savedOrder.ordered_at,
          status: savedOrder.status,
          totalAmount: savedOrder.total_amount,
          items: savedItems,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/api/orders/:orderId", async (request, response) => {
    const orderId = request.params.orderId;
    if (!validOrderId(orderId)) throw new ApiError(400, "주문 ID 형식이 올바르지 않습니다.");
    const orders = await loadOrders(database, orderId);
    if (orders.length === 0) throw new ApiError(404, "주문을 찾을 수 없습니다.");
    response.json({ order: orders[0] });
  });

  app.get("/api/admin/orders", async (_request, response) => {
    response.json({ orders: await loadOrders(database) });
  });

  app.patch("/api/admin/orders/:orderId/status", async (request, response) => {
    const orderId = request.params.orderId;
    const { status } = request.body ?? {};
    if (!validOrderId(orderId) || !orderStatuses.includes(status)) {
      throw new ApiError(400, "주문 ID 또는 상태 형식이 올바르지 않습니다.");
    }
    const updated = await database.query(
      `UPDATE orders
       SET status = $2
       WHERE id = $1 AND status = $3
       RETURNING id`,
      [orderId, status, status === "제조 중" ? "주문 접수" : "제조 중"],
    );
    if (updated.rowCount === 0) {
      const exists = await database.query("SELECT id FROM orders WHERE id = $1", [orderId]);
      if (exists.rowCount === 0) throw new ApiError(404, "주문을 찾을 수 없습니다.");
      throw new ApiError(409, "주문 상태는 다음 단계로만 변경할 수 있습니다.");
    }
    response.json({ order: (await loadOrders(database, orderId))[0] });
  });

  app.get("/api/health", async (_request, response) => {
    try {
      await database.query("SELECT 1");
      response.json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("Database health check failed:", error.code ?? error.name);
      response.status(503).json({ status: "error", database: "unavailable" });
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "요청한 리소스를 찾을 수 없습니다." });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: error.message, ...error.details });
      return;
    }
    if (error?.type === "entity.parse.failed") {
      response.status(400).json({ error: "JSON 요청 형식이 올바르지 않습니다." });
      return;
    }
    console.error("API request failed:", error.code ?? error.name);
    response.status(500).json({ error: "서버 오류가 발생했습니다." });
  });

  return app;
}

const app = createApp();

export default app;
