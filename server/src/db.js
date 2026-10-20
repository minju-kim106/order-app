import "dotenv/config";
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

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.code ?? error.name);
});

export default pool;
