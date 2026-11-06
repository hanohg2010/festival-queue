/* 설정 파일 – 세 앱(visitor / booth / board)이 함께 읽어요 */
window.QUEUE_CONFIG = {
  // Firebase 콘솔에서 복사한 설정을 아래처럼 붙여 넣으세요. null이면 "데모 모드"(이 브라우저 안에서만 동작)로 열려요.
  firebase: null,
  /* 예시:
  firebase: {
    apiKey: "AIza....",
    authDomain: "내프로젝트.firebaseapp.com",
    databaseURL: "https://내프로젝트-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "내프로젝트",
    appId: "1:1234:web:abcd"
  },
  */
  masterPin: "0000",          // 총괄(부스 추가·삭제, PIN 설정) 비밀번호 – 꼭 바꿔 주세요
  maxActivePerVisitor: 3,     // 한 사람이 동시에 줄 설 수 있는 부스 수
  siteTitle: "축제 부스 줄서기"
};
