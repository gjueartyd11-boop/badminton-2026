# 6학년 배드민턴 리그전 웹앱

## 사용 방법

1. GitHub에서 새 저장소를 만듭니다.
2. 이 폴더 안의 파일 전체를 업로드합니다.
3. Vercel에서 `Add New → Project`를 누르고 GitHub 저장소를 선택합니다.
4. `Deploy`를 누르면 링크가 생성됩니다.

## Firebase 연결 방법

`src/App.jsx` 파일 상단의 `firebaseConfig` 빈칸에 Firebase Console에서 복사한 설정값을 붙여넣으세요.

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Firestore Database를 만든 뒤 테스트용 Rules는 아래처럼 설정할 수 있습니다.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

주의: 위 규칙은 테스트용입니다. 공개적으로 오래 사용할 경우 보안 규칙을 제한하는 것이 좋습니다.

## 저장 방식

- Firebase 설정값이 있으면 클라우드 + 브라우저에 저장됩니다.
- Firebase 설정값이 비어 있으면 같은 기기/같은 브라우저에만 저장됩니다.
