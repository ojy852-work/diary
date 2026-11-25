# 만년 다이어리

같은 날의 지난 해들을 한 화면에서 함께 보는 개인용 다이어리. 설치형 웹앱(PWA)이라 윈도우, 안드로이드, iOS에서 모두 동작합니다.

## 보안 구조
- 서버 없음. 정적 파일만 호스팅하고, 기록은 기기 안 IndexedDB에만 저장됩니다.
- 무작위 256비트 데이터 키로 각 기록을 AES-256-GCM 암호화합니다.
- 데이터 키는 비밀번호(PBKDF2-SHA256 60만 회)와 복구 코드로 각각 감싸서 저장합니다. 비밀번호 변경 시 데이터를 다시 암호화할 필요가 없습니다.
- 날짜(YYYY-MM-DD)만 평문 인덱스로 남고, 본문·기분·태그는 모두 암호문입니다.
- 엄격한 CSP(외부 연결 금지), 비활성 시 자동 잠금.
- 백업 파일(.mdiary)도 암호문 그대로라 비밀번호 없이는 열 수 없습니다.

## 개발
```
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 에 정적 파일 생성
npm run check    # 타입 검사
```

## 로드맵
- [x] MVP: 잠금·암호화, 하루 기록, 같은 날 다른 해 보기, 연도 띠, 검색·태그, 음력 표시, 백업/복원, 텍스트 가져오기, Markdown 내보내기
- [x] 테스트 빌드: 윈도우 단일 HTML 파일, 안드로이드 APK (Capacitor)
- [x] v2 화면: 월별 달력으로 시작, 날짜를 눌러 작성, 달력의 "보기 설정"에서 지난 몇 년 기록을 볼지 선택, 차분한 디자인
- [x] 손글씨(펜) 입력 기반: Pointer Events, 필압, 손바닥 무시, 지우개, 되돌리기. 획 데이터는 기록과 함께 암호화 저장 (`src/lib/ink/`)
- [ ] 태블릿 손글씨 정식 지원: 페이지 여러 장, 확대/축소, 손글씨 검색(필기 인식)
- [ ] Google Drive(appDataFolder) 암호화 자동 동기화
- [ ] 로그인 (제안: `docs/login-proposal.md`)
- [ ] 사진 첨부, 매일 알림, 연도별 통계

## 테스트 빌드
```
npm run build:single          # dist-single/index.html: 더블클릭으로 여는 윈도우용 단일 파일
npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)   # 안드로이드 APK
```
GitHub에 push하면 Actions가 두 파일을 자동으로 빌드해서 Artifacts로 올립니다.
