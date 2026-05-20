# 6학년 배드민턴 리그전 - 연동 안정화 버전

## 링크

학생용:
https://배포주소.vercel.app

관리자용:
https://배포주소.vercel.app?admin=1

## 이번 버전의 변경점

- 학생용 화면은 브라우저 저장값을 사용하지 않고 Firebase 실시간 데이터만 표시합니다.
- 관리자 화면에서만 Firebase에 쓰기 저장합니다.
- 화면 상단에 Firebase 연결/저장 상태가 표시됩니다.
- 연결 실패 시 Firestore Rules 또는 설정값 문제를 바로 확인할 수 있습니다.

## Firebase Rules 확인

Firestore Database → Rules를 아래처럼 설정하고 게시하세요.

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
