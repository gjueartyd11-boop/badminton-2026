# 6학년 배드민턴 리그전 - 관리자/학생 분리 버전

## 링크 사용법

배포 주소가 아래라고 가정하면:

학생용 순위 보기 링크:
https://내주소.vercel.app

선생님용 입력 링크:
https://내주소.vercel.app?admin=1

학생용 화면에는 경기 결과 입력창이 나오지 않고, 순위와 최근 경기 결과만 표시됩니다.
선생님이 관리자 링크에서 입력하면 Firebase를 통해 학생용 화면에 자동 반영됩니다.

## Firebase

이 파일에는 사용자가 제공한 firebaseConfig가 이미 들어 있습니다.
Firestore Database와 Rules 설정이 필요합니다.

테스트용 Rules:

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

주의: 테스트용 규칙입니다. 공개 운영 시 보안을 강화하는 것이 좋습니다.
