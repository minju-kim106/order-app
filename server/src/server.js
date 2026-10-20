import "dotenv/config";
import app from "./app.js";
import pool, { validateDatabaseConfig } from "./db.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT는 1부터 65535 사이의 정수여야 합니다.");
}

validateDatabaseConfig();
await pool.query("SELECT 1");

app.listen(port, () => {
  console.log(`PostgreSQL 연결 완료. API 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
