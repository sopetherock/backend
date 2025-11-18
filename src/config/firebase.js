//백엔드용 sdk초기화
// 1. ESM 방식의 import 구문
import admin from 'firebase-admin';
import { createRequire } from 'module';

// 2. [ESM을 위한 JSON 로드]
// ESM에서는 'require'를 직접 쓸 수 없으므로,
// 'createRequire'를 이용해 CJS 방식의 require 함수를 생성합니다.
const require = createRequire(import.meta.url);

// 3. 생성된 require 함수로 'serviceAccountKey.json' 파일을 불러옵니다.
// (경로: 'src/config/'에서 두 단계 위로 올라가 'main/' 폴더의 키 파일)
const serviceAccount = require('../../serviceAccountKey.json');

// 4. Firebase Admin SDK 초기화 (중복 방지)
// (이 부분은 공식 스니펫과 동일합니다)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 5. ESM 방식의 export 구문
// (이제 authMiddleware.js에서 'import admin'으로 이 객체를 쓸 수 있습니다)
export default admin;
