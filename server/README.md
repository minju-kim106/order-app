# 백엔드 서버

Node.js와 Express 기반의 COZY 주문 앱 API 서버입니다.

## 실행

```powershell
cd server
npm install
npm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다. `PORT`로 포트를, `CORS_ORIGIN`으로 허용할 프런트엔드 출처를 설정할 수 있습니다. 여러 출처는 쉼표로 구분합니다.

PostgreSQL 서비스가 실행 중이어야 합니다. `.env`에 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`를 설정하세요. 데이터베이스 자체는 미리 생성해야 합니다. 서버는 시작할 때 테이블과 인덱스를 만들고 기본 커피 메뉴 및 옵션을 추가한 뒤 PostgreSQL 연결을 확인합니다. 연결에 실패하면 시작하지 않습니다.

## 확인

- `GET /api/health` — 서버와 PostgreSQL 연결 상태 확인
- `GET /api/menus` — 주문 가능한 메뉴와 옵션 조회 (재고 미포함)
- `GET /api/admin/menus` — 관리자 메뉴 및 재고 조회
- `PATCH /api/admin/menus/:menuId/stock` — `{ "change": 1 }` 또는 `{ "change": -1 }`로 재고 변경
- `POST /api/orders` — `{ "items": [{ "menuId": 1, "quantity": 2, "optionIds": [1] }] }`로 주문 생성
- `GET /api/orders/:orderId` — 주문 상세 조회
- `GET /api/admin/orders` — 관리자 주문 현황 조회
- `PATCH /api/admin/orders/:orderId/status` — `{ "status": "제조 중" }` 또는 `{ "status": "제조 완료" }`로 다음 상태 변경
- `npm test` — 서버 기본 동작 테스트

주문 생성 시 서버가 가격과 옵션을 검증하고 주문 저장 및 재고 차감을 하나의 트랜잭션으로 처리합니다. 개발 프런트엔드의 `/api` 요청은 Vite가 `http://localhost:3000`으로 전달합니다.
