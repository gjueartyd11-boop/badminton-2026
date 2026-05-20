# 6학년 배드민턴 리그전 - 관리자/학생 연동 우선 수정본

## 링크

학생용:
https://배포주소.vercel.app

관리자용:
https://배포주소.vercel.app?admin=1

## 이번 수정

- Firebase 저장 테스트 버튼 제거
- 브라우저 저장 제거
- 관리자/학생 모두 같은 Firebase 문서만 구독
- 관리자 입력 시 `leagues/grade6-badminton` 문서에 즉시 저장
- 학생 화면은 같은 문서를 실시간으로 읽음
- 저장/읽기 실패 시 화면에 Firebase 오류 표시

## Firestore Rules

Firestore Database → Rules에 아래 규칙을 넣고 반드시 `게시`하세요.

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
