# 6학년 배드민턴 리그전 - Firebase 진단/고정 버전 v1.4

## 핵심 변경점

- localStorage 저장/불러오기를 완전히 제거했습니다.
- 학생용/관리자용 모두 같은 Firestore 문서만 실시간으로 봅니다.
- 관리자 입력 버튼을 누르는 순간 Firestore에 직접 저장합니다.
- 관리자 화면에 `Firebase 저장 테스트` 버튼을 추가했습니다.
- Firebase 저장/읽기 실패 시 실제 오류 메시지를 화면에 표시합니다.

## 링크

학생용:
https://배포주소.vercel.app

관리자용:
https://배포주소.vercel.app?admin=1

## 확인 순서

1. 관리자 링크로 접속
2. `Firebase 저장 테스트` 버튼 클릭
3. 상단에 `Firebase 저장 테스트 성공`이 뜨면 Firebase 저장 정상
4. Firestore Database에서 `leagues / grade6-badminton` 문서가 생겼는지 확인
5. 학생용 링크 새로고침

## Firestore Rules

테스트용으로 아래 규칙을 게시하세요.

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

위 규칙 입력 후 반드시 `게시`를 누르세요.
