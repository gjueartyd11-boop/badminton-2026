import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const leagueDocRef = doc(db, "leagues", "grade6-badminton");

function buildInitialTeams() {
  return CLASSES.map((name) => ({
    name,
    setWins: 0,
    setLosses: 0,
    matchWins: 0,
    matchLosses: 0,
  }));
}

function normalizeTeams(teams) {
  const byName = new Map((teams || []).map((team) => [team.name, team]));
  return CLASSES.map((name) => {
    const old = byName.get(name) || {};
    return {
      name,
      setWins: Number(old.setWins ?? old.wins ?? old.setWon ?? 0),
      setLosses: Number(old.setLosses ?? old.losses ?? old.setLost ?? 0),
      matchWins: Number(old.matchWins ?? 0),
      matchLosses: Number(old.matchLosses ?? 0),
    };
  });
}

function totalSets(team) {
  return team.setWins + team.setLosses;
}

function winRate(team) {
  const total = totalSets(team);
  return total ? team.setWins / total : 0;
}

function winRateText(team) {
  const total = totalSets(team);
  return total ? winRate(team).toFixed(3).replace(/^0/, "") : "-";
}

function setDiff(team) {
  return team.setWins - team.setLosses;
}

function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    const rateDiff = winRate(b) - winRate(a);
    if (rateDiff !== 0) return rateDiff;

    const diff = setDiff(b) - setDiff(a);
    if (diff !== 0) return diff;

    if (b.setWins !== a.setWins) return b.setWins - a.setWins;
    if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;

    return a.name.localeCompare(b.name, "ko");
  });
}

function errorToText(error) {
  if (!error) return "";
  return `${error.code || "unknown"} · ${error.message || String(error)}`;
}

export default function App() {
  const isAdmin = new URLSearchParams(window.location.search).get("admin") === "1";

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [sets, setSets] = useState(Array(SET_COUNT).fill(""));
  const [teams, setTeams] = useState(buildInitialTeams());
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Firebase 연결 중");
  const [errorText, setErrorText] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedBoth = teamA && teamB && teamA !== teamB;
  const completeSets = sets.every(Boolean);
  const aSetWins = sets.filter((winner) => winner === teamA).length;
  const bSetWins = sets.filter((winner) => winner === teamB).length;
  const matchWinner = selectedBoth && completeSets ? (aSetWins > bSetWins ? teamA : teamB) : "";
  const canSubmit = isAdmin && selectedBoth && completeSets && aSetWins !== bSetWins && !saving;
  const ranking = useMemo(() => sortTeams(teams), [teams]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      leagueDocRef,
      (snapshot) => {
        setErrorText("");

        if (snapshot.exists()) {
          const data = snapshot.data();
          setTeams(normalizeTeams(data.teams));
          setHistory(Array.isArray(data.history) ? data.history : []);
          setLastSaved(data.updatedAtText || "");
          setStatus(isAdmin ? "관리자 모드 · Firebase 실시간 연결됨" : "학생용 실시간 순위 · Firebase 연결됨");
        } else {
          setTeams(buildInitialTeams());
          setHistory([]);
          setLastSaved("");
          setStatus(isAdmin ? "관리자 모드 · 아직 Firebase 문서 없음" : "아직 입력된 경기 결과가 없습니다");
        }
      },
      (error) => {
        setStatus("Firebase 읽기 실패");
        setErrorText(errorToText(error));
      }
    );

    return unsubscribe;
  }, [isAdmin]);

  const resetSets = () => setSets(Array(SET_COUNT).fill(""));

  const writeLeague = async (nextTeams, nextHistory, successMessage) => {
    setSaving(true);
    setErrorText("");
    const nowText = new Date().toLocaleString("ko-KR");

    try {
      await setDoc(
        leagueDocRef,
        {
          teams: nextTeams,
          history: nextHistory,
          updatedAtText: nowText,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );

      setStatus(successMessage);
      setLastSaved(nowText);
    } catch (error) {
      setStatus("Firebase 저장 실패");
      setErrorText(errorToText(error));
    } finally {
      setSaving(false);
    }
  };

  const testFirebaseWrite = async () => {
    await writeLeague(teams, history, "Firebase 저장 테스트 성공");
  };

  const submitMatch = async () => {
    if (!canSubmit) return;

    const loser = matchWinner === teamA ? teamB : teamA;
    const winnerSetWins = matchWinner === teamA ? aSetWins : bSetWins;
    const loserSetWins = matchWinner === teamA ? bSetWins : aSetWins;

    const nextTeams = teams.map((team) => {
      if (team.name === matchWinner) {
        return {
          ...team,
          setWins: team.setWins + winnerSetWins,
          setLosses: team.setLosses + loserSetWins,
          matchWins: team.matchWins + 1,
        };
      }

      if (team.name === loser) {
        return {
          ...team,
          setWins: team.setWins + loserSetWins,
          setLosses: team.setLosses + winnerSetWins,
          matchLosses: team.matchLosses + 1,
        };
      }

      return team;
    });

    const nextHistory = [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        teamA,
        teamB,
        aSetWins,
        bSetWins,
        winner: matchWinner,
        createdAt: new Date().toLocaleString("ko-KR"),
      },
      ...history,
    ];

    setTeams(nextTeams);
    setHistory(nextHistory);
    resetSets();

    await writeLeague(nextTeams, nextHistory, "클라우드 저장 완료");
  };

  const resetAll = async () => {
    if (!isAdmin) return;
    if (!window.confirm("모든 경기 기록과 순위를 초기화할까요?")) return;

    const emptyTeams = buildInitialTeams();
    const emptyHistory = [];

    setTeamA("");
    setTeamB("");
    resetSets();
    setTeams(emptyTeams);
    setHistory(emptyHistory);

    await writeLeague(emptyTeams, emptyHistory, "초기화 완료 · 클라우드 저장 완료");
  };

  const statusClass = status.includes("실패") ? "status error" : "status";

  return (
    <main className="page">
      <section className="app-shell">
        <header className="header">
          <div className="logo">🏸</div>
          <div>
            <h1>6학년 배드민턴 리그전</h1>
            <p>{isAdmin ? "관리자 입력 화면" : "실시간 순위표"}</p>
            <p className={statusClass}>{status}</p>
            {lastSaved && <p className="last-saved">마지막 저장: {lastSaved}</p>}
          </div>
        </header>

        {errorText && (
          <section className="error-box">
            <strong>Firebase 오류</strong>
            <p>{errorText}</p>
          </section>
        )}

        {isAdmin && (
          <section className="card">
            <button className="test-button" type="button" onClick={testFirebaseWrite} disabled={saving}>
              {saving ? "확인 중..." : "Firebase 저장 테스트"}
            </button>

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
                  {saving ? "저장 중..." : "경기 결과 입력하기"}
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
                  <th>세트승</th>
                  <th>세트패</th>
                  <th>세트득실</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((team, index) => (
                  <tr key={team.name}>
                    <td className="rank">{index + 1}</td>
                    <td className="team-name">{team.name}</td>
                    <td>{winRateText(team)}</td>
                    <td>{team.setWins}</td>
                    <td>{team.setLosses}</td>
                    <td className="set-diff">{setDiff(team)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rule-note">승률 = 세트승 ÷ (세트승 + 세트패)</p>
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
