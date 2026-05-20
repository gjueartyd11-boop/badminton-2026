# 6학년 배드민턴 리그전 - Firestore Long Polling 수정본

## 수정 내용
- Firestore 연결 방식을 long polling으로 변경했습니다.
- 학교망/기관망/일부 모바일 브라우저에서 저장 중 멈추는 문제를 줄입니다.
- 저장이 8초 넘게 응답하지 않으면 화면에 오류를 표시합니다.
- 저장 테스트 버튼은 없습니다.

## 링크
학생용:
https://배포주소.vercel.app

관리자용:
https://배포주소.vercel.app?admin=1

## 필수 확인
Firestore Database → Rules를 아래처럼 설정하고 반드시 게시하세요.

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
