// Firebase 연결 (교사·학생 화면 공용)
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, initializeAuth, inMemoryPersistence, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, where
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9XOt5QzTXWZlWTHoKEPIAKGEo369AiMc",
  authDomain: "sagi-race.firebaseapp.com",
  projectId: "sagi-race",
  storageBucket: "sagi-race.firebasestorage.app",
  messagingSenderId: "376306220615",
  appId: "1:376306220615:web:a6a59538a3fd19db713b62"
};

const app = initializeApp(firebaseConfig);
// 주소에 ?test 가 붙으면 탭마다 다른 학생으로 접속 (한 컴퓨터에서 여러 명 시뮬레이션용, 새로고침하면 새 학생)
export const TEST = new URLSearchParams(location.search).has('test');
export const auth = TEST ? initializeAuth(app, { persistence: inMemoryPersistence }) : getAuth(app);
export const db = getFirestore(app);
export { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, where };

// 익명 로그인 후 uid 반환 (같은 기기·브라우저면 새로고침해도 같은 uid)
export function login() {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, u => {
      if (u) { off(); resolve(u.uid); }
    });
    signInAnonymously(auth).catch(e => { off(); reject(e); });
  });
}

export const COLORS = ['#ff8a80', '#ffd180', '#fff176', '#a5d6a7', '#80deea', '#90caf9', '#ce93d8', '#f8bbd0'];
export const N = 8, ROUNDS = 12, GOAL = 20, BLOCK = 17, MAXBET = 2;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 정산: 1등 = 건 칩 × (전체 판돈 ÷ 1등 말 판돈), 2등 = 그 절반 배당
export function payout(bets, res) {
  const { first, second, total, pool } = res;
  const a = pool[first] ? bets[first] * total / pool[first] : 0;
  const b = pool[second] ? bets[second] * total / pool[second] / 2 : 0;
  return { a, b };
}
