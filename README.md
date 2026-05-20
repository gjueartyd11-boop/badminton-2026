# 6학년 배드민턴 리그전 - 최종 수정본 v1.3

수정 내용:
1. 승률 = 세트승 / (세트승 + 세트패)
2. 학생용과 관리자용은 같은 Firebase 문서(leagues/grade6-badminton)를 실시간 구독
3. 경기 입력 버튼을 누르는 순간 Firebase에 직접 저장

학생용: https://배포주소.vercel.app
관리자용: https://배포주소.vercel.app?admin=1

Firestore Rules 테스트용:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
