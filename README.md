# 만년 다이어리

같은 날의 지난 해들을 한 화면에서 함께 보는 개인용 다이어리. 설치형 웹앱(PWA)이라 윈도우, 안드로이드, iOS에서 모두 동작합니다.

## 보안 구조
- 서버 없음. 정적 파일만 호스팅하고, 기록은 기기 안 IndexedDB에만 저장됩니다.
- 무작위 256비트 데이터 키로 각 기록을 AES-256-GCM 암호화합니다.
- 데이터 키는 비밀번호(PBKDF2-SHA256 60만 회)와 복구 코드로 각각 감싸서 저장합니다. 비밀번호 변경 시 데이터를 다시 암호화할 필요가 없습니다.
- 날짜(YYYY-MM-DD)만 평문 인덱스로 남고, 본문·기분·태그는 모두 암호문입니다.
- 엄격한 CSP, 비활성 시 자동 잠금. Google Drive 동기화(선택 기능)를 켜지 않는 한 외부로 나가는 연결이 없습니다.
- 백업 파일(.mdiary)도 암호문 그대로라 비밀번호 없이는 열 수 없습니다.

## 개발
```
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 에 정적 파일 생성
npm run check    # 타입 검사
```

## Google Drive 동기화 설정 (선택)
1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트를 만들고 "Google Drive API"를 사용 설정합니다.
2. "API 및 서비스 > OAuth 동의 화면"에서 앱 유형을 "외부"로, 게시 상태는 **테스트**로 두고 본인(및 함께 쓸 사람)의 구글 계정을 테스트 사용자로 추가합니다. (테스트 상태는 심사 없이 계속 쓸 수 있습니다. 로그인할 때 "확인되지 않은 앱" 경고가 한 번 뜨는데 정상입니다.)
3. "사용자 인증 정보"에서 "OAuth 클라이언트 ID" (유형: 웹 애플리케이션)를 만들고, 승인된 자바스크립트 원본에 실제 쓰는 주소를 모두 등록합니다 (예: `http://localhost:5173`, GitHub Pages 주소).
4. 발급된 클라이언트 ID를 `src/lib/drive-sync.svelte.ts`의 `GOOGLE_CLIENT_ID`에 붙여넣습니다. 이 값은 비밀값이 아니라(위 3번의 "승인된 원본" 목록으로 보호됨) 그대로 커밋해도 됩니다.
5. 설정 > "Google Drive 동기화"에서 연결하면 바로 동작합니다. `file://`로 여는 단일 HTML 파일에서는 구글 로그인이 불가능합니다(주소가 있는 페이지에서만 동작).

## 로드맵
- [x] MVP: 잠금·암호화, 하루 기록, 같은 날 다른 해 보기, 연도 띠, 검색·태그, 음력 표시, 백업/복원, 텍스트 가져오기, Markdown 내보내기
- [x] 테스트 빌드: 윈도우 단일 HTML 파일, 안드로이드 APK (Capacitor)
- [x] v2 화면: 월별 달력으로 시작, 날짜를 눌러 작성, 달력의 "보기 설정"에서 지난 몇 년 기록을 볼지 선택, 차분한 디자인
- [x] 손글씨(펜) 입력 기반: Pointer Events, 필압, 손바닥 무시, 지우개, 되돌리기. 획 데이터는 기록과 함께 암호화 저장 (`src/lib/ink/`)
- [ ] 태블릿 손글씨 정식 지원: 페이지 여러 장, 확대/축소, 손글씨 검색(필기 인식)
- [x] Google Drive(appDataFolder) 암호화 자동 동기화 — 로직·설정 화면 완성, Google Cloud Console에서 OAuth 클라이언트 ID 발급 후 `src/lib/drive-sync.svelte.ts`의 `GOOGLE_CLIENT_ID`만 채우면 바로 사용 가능 (자세한 설계는 `docs/login-proposal.md`)
- [ ] 로그인 (제안: `docs/login-proposal.md`)
- [ ] 사진 첨부, 매일 알림, 연도별 통계

## 테스트 빌드
```
npm run build:single          # dist-single/index.html: 더블클릭으로 여는 윈도우용 단일 파일
npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)   # 안드로이드 APK
```
GitHub에 push하면 Actions가 두 파일을 자동으로 빌드해서 Artifacts로 올립니다.
