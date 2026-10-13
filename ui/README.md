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
