import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const port = Number(process.env.DB_PORT ?? 5432);

const requiredConfig = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];

export function validateDatabaseConfig() {
  const missingConfig = requiredConfig.filter((key) => !process.env[key]);

  if (missingConfig.length > 0) {
    throw new Error(`필수 PostgreSQL 설정이 없습니다: ${missingConfig.join(", ")}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT는 1부터 65535 사이의 정수여야 합니다.");
  }
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
});

export async function initializeDatabase(database = pool) {
  const schema = await readFile(
    fileURLToPath(new URL("./schema.sql", import.meta.url)),
    "utf8",
  );
  await database.query(schema);
  await database.query(
    `INSERT INTO menus (name, description, price, image_url, stock_quantity)
     VALUES
       ('아메리카노 (ICE)', '산뜻한 산미와 깔끔한 여운의 시그니처 블렌드', 4000, '', 10),
       ('아메리카노 (HOT)', '고소한 향을 따뜻하게 즐기는 클래식 커피', 4000, '', 10),
       ('카페라떼', '부드러운 우유와 에스프레소의 균형', 5000, '', 10),
       ('바닐라 라떼', '은은한 바닐라 향을 더한 달콤한 라떼', 5500, '', 10)
     ON CONFLICT (name) DO NOTHING`,
  );
  await database.query(
    `INSERT INTO options (menu_id, name, price)
     SELECT menus.id, option_data.name, option_data.price
     FROM menus
     CROSS JOIN (VALUES ('샷 추가', 500), ('시럽 추가', 0)) AS option_data(name, price)
     ON CONFLICT (menu_id, name) DO NOTHING`,
  );
}

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.code ?? error.name);
});

export default pool;
