import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD-5zrSaRv2zzgiMx3Lhf7ywzAs0HS5bMw",
  authDomain: "project-365006779830143485.firebaseapp.com",
  projectId: "project-365006779830143485",
  storageBucket: "project-365006779830143485.firebasestorage.app",
  messagingSenderId: "810628243957",
  appId: "1:810628243957:web:bb67cebaeb572d3b3780bc"
};

const CLASSES = ["가람반", "나리반", "다솜반", "라온반", "마루반", "바름반", "사랑반"];
const SET_COUNT = 5;
const STORAGE_KEY = "grade6-badminton-league-admin-backup-v2";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const leagueDocRef = doc(db, "leagues", "grade6-badminton");

function buildInitialTeams() {
  return CLASSES.map((name) => ({ name, games: 0, wins: 0, losses: 0, setWon: 0, setLost: 0 }));
}

function winRate(team) {
  return team.games ? team.wins / team.games : 0;
}

function winRateText(team) {
  return team.games ? winRate(team).toFixed(3).replace(/^0/, "") : "-";
}

function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    const rateDiff = winRate(b) - winRate(a);
    if (rateDiff !== 0) return rateDiff;

    const setDiff = (b.setWon - b.setLost) - (a.setWon - a.setLost);
    if (setDiff !== 0) return setDiff;

    if (b.setWon !== a.setWon) return b.setWon - a.setWon;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name, "ko");
  });
}

function loadAdminBackup() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const isAdmin = new URLSearchParams(window.location.search).get("admin") === "1";
  const adminBackup = isAdmin ? loadAdminBackup() : null;

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [sets, setSets] = useState(Array(SET_COUNT).fill(""));
  const [teams, setTeams] = useState(adminBackup?.teams || buildInitialTeams());
  const [history, setHistory] = useState(adminBackup?.history || []);
  const [cloudStatus, setCloudStatus] = useState("Firebase 연결 확인 중");
  const [lastSaved, setLastSaved] = useState("");
  const [cloudLoaded, setCloudLoaded] = useState(false);

  const ignoreNextWrite = useRef(false);

  const selectedBoth = teamA && teamB && teamA !== teamB;
  const completeSets = sets.every(Boolean);
  const aSetWins = sets.filter((winner) => winner === teamA).length;
  const bSetWins = sets.filter((winner) => winner === teamB).length;
  const matchWinner = selectedBoth && completeSets ? (aSetWins > bSetWins ? teamA : teamB) : "";
  const canSubmit = isAdmin && selectedBoth && completeSets && aSetWins !== bSetWins;
  const ranking = useMemo(() => sortTeams(teams), [teams]);

  useEffect(() => {
    setCloudStatus("Firebase 실시간 연결 중");

    const unsubscribe = onSnapshot(
      leagueDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          ignoreNextWrite.current = true;
          setTeams(data.teams || buildInitialTeams());
          setHistory(data.history || []);
          setLastSaved(data.updatedAt ? new Date(data.updatedAt).toLocaleString("ko-KR") : "");
          setCloudStatus(isAdmin ? "관리자 모드 · Firebase 연결됨" : "학생용 실시간 순위 · Firebase 연결됨");
        } else {
          setCloudStatus(isAdmin ? "관리자 모드 · 첫 데이터 생성 전" : "아직 입력된 Firebase 데이터가 없습니다");
        }
        setCloudLoaded(true);
      },
      (error) => {
        setCloudStatus("Firebase 연결 실패: Firestore Rules 또는 설정값 확인 필요");
        console.error(error);
        setCloudLoaded(true);
      }
    );

    return unsubscribe;
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams, history, updatedAt: new Date().toISOString() }));
    }

    if (!isAdmin || !cloudLoaded) return;

    if (ignoreNextWrite.current) {
      ignoreNextWrite.current = false;
      return;
    }

    const data = { teams, history, updatedAt: new Date().toISOString() };
    setDoc(leagueDocRef, data, { merge: true })
      .then(() => {
        setLastSaved(new Date(data.updatedAt).toLocaleString("ko-KR"));
        setCloudStatus("클라우드 저장 완료");
      })
      .catch((error) => {
        console.error(error);
        setCloudStatus("클라우드 저장 실패: Firestore Rules 확인 필요");
      });
  }, [teams, history, isAdmin, cloudLoaded]);

  const resetSets = () => setSets(Array(SET_COUNT).fill(""));

  const submitMatch = () => {
    if (!canSubmit) return;

    const loser = matchWinner === teamA ? teamB : teamA;
    const winnerSetWins = matchWinner === teamA ? aSetWins : bSetWins;
    const loserSetWins = matchWinner === teamA ? bSetWins : aSetWins;

    setTeams((prev) =>
      prev.map((team) => {
        if (team.name === matchWinner) {
          return { ...team, games: team.games + 1, wins: team.wins + 1, setWon: team.setWon + winnerSetWins, setLost: team.setLost + loserSetWins };
        }
        if (team.name === loser) {
          return { ...team, games: team.games + 1, losses: team.losses + 1, setWon: team.setWon + loserSetWins, setLost: team.setLost + winnerSetWins };
        }
        return team;
      })
    );

    setHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        teamA,
        teamB,
        aSetWins,
        bSetWins,
        winner: matchWinner,
        createdAt: new Date().toLocaleString("ko-KR"),
      },
      ...prev,
    ]);

    resetSets();
  };

  const resetAll = () => {
    if (!isAdmin) return;
    if (!window.confirm("모든 경기 기록과 순위를 초기화할까요?")) return;

    setTeamA("");
    setTeamB("");
    resetSets();
    setTeams(buildInitialTeams());
    setHistory([]);
  };

  return (
    <main className="page">
      <section className="app-shell">
        <header className="header">
          <div className="logo">🏸</div>
          <div>
            <h1>6학년 배드민턴 리그전</h1>
            <p>{isAdmin ? "관리자 입력 화면" : "실시간 순위표"}</p>
            <p className={cloudStatus.includes("실패") ? "status error" : "status"}>{cloudStatus}</p>
            {lastSaved && <p className="last-saved">마지막 저장: {lastSaved}</p>}
          </div>
        </header>

        {isAdmin && (
          <section className="card">
            <div className="select-grid">
              <label>
                <span>반 1</span>
                <select value={teamA} onChange={(e) => { setTeamA(e.target.value); resetSets(); }}>
                  <option value="">선택</option>
                  {CLASSES.map((name) => <option key={name} value={name} disabled={name === teamB}>{name}</option>)}
                </select>
              </label>

              <label>
                <span>반 2</span>
                <select value={teamB} onChange={(e) => { setTeamB(e.target.value); resetSets(); }}>
                  <option value="">선택</option>
                  {CLASSES.map((name) => <option key={name} value={name} disabled={name === teamA}>{name}</option>)}
                </select>
              </label>
            </div>

            {selectedBoth ? (
              <div className="match-panel">
                <div className="score-box">
                  <span>현재 세트 스코어</span>
                  <strong>{teamA} {aSetWins} : {bSetWins} {teamB}</strong>
                  {completeSets && <em>승리: {matchWinner}</em>}
                </div>

                <div className="set-list">
                  {sets.map((winner, index) => (
                    <div className="set-card" key={index}>
                      <div className="set-title">{index + 1}세트 승리반</div>
                      <div className="winner-buttons">
                        {[teamA, teamB].map((name) => (
                          <button
                            key={name}
                            type="button"
                            className={winner === name ? "selected" : ""}
                            onClick={() => {
                              const next = [...sets];
                              next[index] = name;
                              setSets(next);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button className="submit-button" type="button" disabled={!canSubmit} onClick={submitMatch}>
                  경기 결과 입력하기
                </button>
              </div>
            ) : (
              <div className="empty-guide">상단에서 경기할 두 반을 선택하세요.</div>
            )}
          </section>
        )}

        <section className="card">
          <div className="section-head">
            <h2>🏆 순위</h2>
            {isAdmin && <button className="reset-button" type="button" onClick={resetAll}>초기화</button>}
          </div>

          <div className="podium">
            {ranking.slice(0, 3).map((team, index) => (
              <div className={`podium-item top-${index + 1}`} key={team.name}>
                <span>{index + 1}위</span>
                <strong>{team.name}</strong>
                <em>{winRateText(team)}</em>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>반</th>
                  <th>승률</th>
                  <th>승</th>
                  <th>패</th>
                  <th>세트득실</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((team, index) => (
                  <tr key={team.name}>
                    <td className="rank">{index + 1}</td>
                    <td className="team-name">{team.name}</td>
                    <td>{winRateText(team)}</td>
                    <td>{team.wins}</td>
                    <td>{team.losses}</td>
                    <td className="set-diff">{team.setWon - team.setLost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {history.length > 0 && (
          <section className="card">
            <h2>{isAdmin ? "입력된 경기" : "최근 경기 결과"}</h2>
            <div className="history-list">
              {history.slice(0, isAdmin ? history.length : 5).map((game) => (
                <div className="history-card" key={game.id}>
                  <strong>{game.teamA} {game.aSetWins} : {game.bSetWins} {game.teamB}</strong>
                  <span>승리: {game.winner}</span>
                  <small>{game.createdAt}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isAdmin && <p className="viewer-note">학생용 화면입니다. 경기 결과 입력은 관리자 링크에서만 가능합니다.</p>}
      </section>
    </main>
  );
}
