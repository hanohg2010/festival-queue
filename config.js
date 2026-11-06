/* 설정 파일 – 세 앱(visitor / booth / board)이 함께 읽어요 */
window.QUEUE_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCceRXi7-heZYP7A4Z6D2gvW4FLl0i6kdg",
    authDomain: "festival-queue-17574.firebaseapp.com",
    databaseURL: "https://festival-queue-17574-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "festival-queue-17574",
    appId: "1:866737555459:web:500ad5549f34f894b6a636"
  },
  masterPin: "20100919",          // 총괄 비밀번호 – 아래 4번 참고
  maxActivePerVisitor: 3,     // 한 사람이 동시에 줄 설 수 있는 부스 수
  siteTitle: "축제 부스 줄서기"
};
