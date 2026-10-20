# 백엔드 서버

Node.js와 Express 기반의 COZY 주문 앱 API 서버입니다.

## 실행

```powershell
cd server
npm install
npm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다. `PORT`로 포트를, `CORS_ORIGIN`으로 허용할 프런트엔드 출처를 설정할 수 있습니다. 여러 출처는 쉼표로 구분합니다.

PostgreSQL 서비스가 실행 중이어야 합니다. `.env`에 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`를 설정하세요. 서버는 시작할 때 PostgreSQL 연결을 확인하고, 연결에 실패하면 시작하지 않습니다. 데이터베이스는 미리 생성되어 있어야 합니다.

## 확인

- `GET /api/health` — 서버와 PostgreSQL 연결 상태 확인
- `npm test` — 서버 기본 동작 테스트

주문·메뉴 API와 데이터베이스 테이블 스키마는 후속 백엔드 구현 범위입니다.
