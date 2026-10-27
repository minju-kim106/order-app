# COZY 프런트엔드

Vite와 React를 사용하는 COZY 커피 주문 앱의 프런트엔드입니다. JavaScript와 JSX로 화면을 개발합니다.

## 요구 사항

- Node.js 20.19+ 또는 22.12+
- npm

## 시작하기

이 디렉터리(`ui`)에서 의존성을 설치하고 개발 서버를 실행합니다.

```sh
npm install
npm run dev
```

개발 서버 주소는 터미널에 표시됩니다. 저장한 변경 사항은 Vite의 HMR을 통해 브라우저에 반영됩니다.

API를 사용하는 화면을 실행하려면 별도 터미널에서 [백엔드 서버](../server/README.md)를 먼저 실행하세요. Vite 개발 서버는 `/api` 요청을 `http://localhost:3000`으로 프록시합니다.

## Render 배포

백엔드와 프런트엔드는 Render에 각각 별도 서비스로 배포합니다.

1. 백엔드 Web Service를 먼저 배포하고 서비스 URL을 확인합니다. 예: `https://cozy-api.onrender.com`
2. Render에서 **New → Static Site**를 선택하고 같은 저장소를 연결합니다.
3. 다음과 같이 설정합니다.
   - **Root Directory:** `ui`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
4. Static Site의 **Environment**에 `VITE_API_URL`을 추가합니다. 값은 백엔드 주소 뒤에 `/api`를 붙인 주소입니다. 예: `https://cozy-api.onrender.com/api`
5. **Settings → Redirects/Rewrites**에 SPA 경로를 위한 rewrite를 추가합니다.
   - **Source:** `/*`
   - **Destination:** `/index.html`
   - **Action:** `Rewrite`
6. 프런트엔드 Static Site URL을 백엔드 Web Service의 `CORS_ORIGIN` 환경변수에 등록합니다. 프로토콜과 도메인만 입력하고 끝의 `/`는 제외합니다. 예: `https://cozy-ui.onrender.com`
7. 백엔드 환경변수 변경 후 백엔드를 재배포하고, `VITE_API_URL` 변경 후 프런트엔드를 재배포합니다. Vite는 이 값을 빌드 시점에 포함하므로 재빌드가 필요합니다.

`VITE_API_URL`을 설정하지 않으면 기본값 `/api`를 사용하므로, 로컬 개발 시 기존 Vite 프록시 동작은 유지됩니다. `VITE_` 접두사 환경변수는 브라우저에 공개되므로 비밀 값은 넣지 마세요.

## 사용 가능한 명령

```sh
npm run dev      # 개발 서버 실행
npm run build    # 배포용 파일 생성
npm run preview  # 배포용 빌드 미리보기
npm run lint     # Oxlint 검사
```

## 주요 파일

- `src/main.jsx`: React 앱 진입점
- `src/App.jsx`: 앱 화면
- `src/App.css`: 앱 화면 스타일
- `src/index.css`: 전역 스타일
- `index.html`: HTML 진입 문서
- `vite.config.js`: Vite 및 React 플러그인 설정
