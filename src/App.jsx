import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";

// Firebase Console에서 복사한 firebaseConfig를 아래 빈칸에 붙여넣으세요.
// 값이 비어 있으면 같은 기기/같은 브라우저에만 저장됩니다.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const CLASSES = ["가람반", "나리반", "다솜반", "라온반", "마루반", "바름반", "사랑반"];
const SET_COUNT = 5;
const STORAGE_KEY = "grade6-badminton-league-v1";
const FIREBASE_ENABLED = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const leagueDocRef = FIREBASE_ENABLED
  ? doc(getFirestore(initializeApp(firebaseConfig)), "leagues", "grade6-badminton")
  : null;

function buildInitialTeams() {
  return CLASSES.map((name) => ({
    name,
    games: 0,
    wins: 0,
    losses: 0,
    setWon: 0,
    setLost: 0,
  }));
}

function safeLoadLocal() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
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

    const aSetDiff = a.setWon - a.setLost;
    const bSetDiff = b.setWon - b.setLost;
    if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;

    if (b.setWon !== a.setWon) return b.setWon - a.setWon;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name, "ko");
  });
}

export default function App() {
  const localData = safeLoadLocal();

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [sets, setSets] = useState(Array(SET_COUNT).fill(""));
  const [teams, setTeams] = useState(localData?.teams || buildInitialTeams());
  const [history, setHistory] = useState(localData?.history || []);
  const [savedNotice, setSavedNotice] = useState(false);
  const [cloudReady, setCloudReady] = useState(!FIREBASE_ENABLED);
  const loadedFromCloud = useRef(false);

  const selectedBoth = teamA && teamB && teamA !== teamB;
  const completeSets = sets.every(Boolean);
  const aSetWins = sets.filter((winner) => winner === teamA).length;
  const bSetWins = sets.filter((winner) => winner === teamB).length;
  const matchWinner = selectedBoth && completeSets ? (aSetWins > bSetWins ? teamA : teamB) : "";
  const canSubmit = selectedBoth && completeSets && aSetWins !== bSetWins;
  const ranking = useMemo(() => sortTeams(teams), [teams]);

  useEffect(() => {
    if (!FIREBASE_ENABLED || !leagueDocRef) return;

    const unsubscribe = onSnapshot(leagueDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTeams(data.teams || buildInitialTeams());
        setHistory(data.history || []);
      }
      loadedFromCloud.current = true;
      setCloudReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const data = { teams, history, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    if (FIREBASE_ENABLED && leagueDocRef && loadedFromCloud.current) {
      setDoc(leagueDocRef, data, { merge: true }).catch(() => {});
    }

    setSavedNotice(true);
    const timer = window.setTimeout(() => setSavedNotice(false), 900);
    return () => window.clearTimeout(timer);
  }, [teams, history]);

  const resetSets = () => setSets(Array(SET_COUNT).fill(""));

  const selectTeamA = (value) => {
    setTeamA(value);
    resetSets();
  };

  const selectTeamB = (value) => {
    setTeamB(value);
    resetSets();
  };

  const updateSetWinner = (index, winner) => {
    const next = [...sets];
    next[index] = winner;
    setSets(next);
  };

  const submitMatch = () => {
    if (!canSubmit) return;

    const loser = matchWinner === teamA ? teamB : teamA;
    const winnerSetWins = matchWinner === teamA ? aSetWins : bSetWins;
    const loserSetWins = matchWinner === teamA ? bSetWins : aSetWins;

    setTeams((prev) =>
      prev.map((team) => {
        if (team.name === matchWinner) {
          return {
            ...team,
            games: team.games + 1,
            wins: team.wins + 1,
            setWon: team.setWon + winnerSetWins,
            setLost: team.setLost + loserSetWins,
          };
        }
        if (team.name === loser) {
          return {
            ...team,
            games: team.games + 1,
            losses: team.losses + 1,
            setWon: team.setWon + loserSetWins,
            setLost: team.setLost + winnerSetWins,
          };
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
    if (!window.confirm("모든 경기 기록과 순위를 초기화할까요?")) return;

    const emptyTeams = buildInitialTeams();
    setTeamA("");
    setTeamB("");
    resetSets();
    setTeams(emptyTeams);
    setHistory([]);
    window.localStorage.removeItem(STORAGE_KEY);

    if (FIREBASE_ENABLED && leagueDocRef) {
      setDoc(
        leagueDocRef,
        { teams: emptyTeams, history: [], updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => {});
    }
  };

  const storageMessage = savedNotice
    ? FIREBASE_ENABLED
      ? "클라우드와 브라우저에 자동 저장됨"
      : "브라우저에 자동 저장됨"
    : FIREBASE_ENABLED
      ? cloudReady
        ? "여러 기기에서 같은 기록을 볼 수 있습니다"
        : "클라우드 기록 불러오는 중"
      : "기록은 이 브라우저에 저장됩니다";

  return (
    <main className="page">
      <section className="app-shell">
        <header className="header">
          <div className="logo">🏸</div>
          <div>
            <h1>6학년 배드민턴 리그전</h1>
            <p>5세트 결과 입력 · 승률순 자동 순위</p>
            <p className="save-state">{storageMessage}</p>
          </div>
        </header>

        <section className="card">
          <div className="select-grid">
            <label>
              <span>반 1</span>
              <select value={teamA} onChange={(e) => selectTeamA(e.target.value)}>
                <option value="">선택</option>
                {CLASSES.map((name) => (
                  <option key={name} value={name} disabled={name === teamB}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>반 2</span>
              <select value={teamB} onChange={(e) => selectTeamB(e.target.value)}>
                <option value="">선택</option>
                {CLASSES.map((name) => (
                  <option key={name} value={name} disabled={name === teamA}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedBoth ? (
            <div className="match-panel">
              <div className="score-box">
                <span>현재 세트 스코어</span>
                <strong>
                  {teamA} {aSetWins} : {bSetWins} {teamB}
                </strong>
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
                          onClick={() => updateSetWinner(index, name)}
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

        <section className="card">
          <div className="section-head">
            <h2>🏆 순위</h2>
            <button className="reset-button" type="button" onClick={resetAll}>
              초기화
            </button>
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
            <h2>입력된 경기</h2>
            <div className="history-list">
              {history.map((game) => (
                <div className="history-card" key={game.id}>
                  <strong>
                    {game.teamA} {game.aSetWins} : {game.bSetWins} {game.teamB}
                  </strong>
                  <span>승리: {game.winner}</span>
                  <small>{game.createdAt}</small>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
