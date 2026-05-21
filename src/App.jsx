import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  doc,
  initializeFirestore,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD-5zrSaRv2zzgiMx3Lhf7ywzAs0HS5bMw",
  authDomain: "gen-lang-client-0225718076.firebaseapp.com",
  projectId: "gen-lang-client-0225718076",
  storageBucket: "gen-lang-client-0225718076.firebasestorage.app",
  messagingSenderId: "810628243957",
  appId: "1:810628243957:web:bb67cebaeb572d3b3780bc"
};

const CLASSES = ["가람반", "나리반", "다솜반", "라온반", "마루반", "바름반", "사랑반"];
const SET_COUNT = 5;
const ADMIN_PASSWORD = "0926"; // 원하는 관리자 비밀번호로 바꾸세요.
const WRITE_TIMEOUT_MS = 8000;

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});
const leagueDocRef = doc(db, "leagues", "grade6-badminton");

function buildInitialTeams() {
  return CLASSES.map((name) => ({
    name,
    setWins: 0,
    setDraws: 0,
    setLosses: 0,
    matchWins: 0,
    matchDraws: 0,
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
      setDraws: Number(old.setDraws ?? 0),
      setLosses: Number(old.setLosses ?? old.losses ?? old.setLost ?? 0),
      matchWins: Number(old.matchWins ?? 0),
      matchDraws: Number(old.matchDraws ?? old.draws ?? 0),
      matchLosses: Number(old.matchLosses ?? 0),
    };
  });
}

function totalSets(team) {
  return team.setWins + team.setDraws + team.setLosses;
}

function winRate(team) {
  const total = totalSets(team);
  return total ? (team.setWins + team.setDraws * 0.5) / total : 0;
}

function winRateText(team) {
  const total = totalSets(team);
  return total ? winRate(team).toFixed(3).replace(/^0/, "") : "-";
}

function setDiff(team) {
  return team.setWins - team.setLosses;
}

function gameCount(team) {
  return team.matchWins + team.matchDraws + team.matchLosses;
}

function gameBack(team, leader) {
  if (!leader || team.name === leader.name) return "-";
  const gb = ((leader.matchWins - team.matchWins) + (team.matchLosses - leader.matchLosses)) / 2;
  return gb === 0 ? "-" : Number.isInteger(gb) ? String(gb) : gb.toFixed(1);
}

function getStreak(teamName, history) {
  let streakType = "";
  let count = 0;

  for (const game of history) {
    if (game.teamA !== teamName && game.teamB !== teamName) continue;
    const result = game.winner === "무승부" ? "무" : game.winner === teamName ? "승" : "패";

    if (!streakType) {
      streakType = result;
      count = 1;
    } else if (result === streakType) {
      count += 1;
    } else {
      break;
    }
  }

  return count ? `${count}${streakType}` : "-";
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

function firebaseErrorText(error) {
  if (!error) return "";
  return `${error.code || "Firebase 오류"}: ${error.message || String(error)}`;
}

function withTimeout(promise, ms) {
  let timerId;
  const timer = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      reject(new Error("Firebase 저장 응답이 8초 안에 오지 않았습니다. Firestore Database 생성 여부, Rules 게시 여부, 네트워크 차단 여부를 확인하세요."));
    }, ms);
  });

  return Promise.race([promise, timer]).finally(() => window.clearTimeout(timerId));
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isAdmin = params.get("admin") === "1";

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [sets, setSets] = useState(Array(SET_COUNT).fill(""));
  const [teams, setTeams] = useState(buildInitialTeams());
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Firebase 불러오는 중");
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const selectedBoth = teamA && teamB && teamA !== teamB;
  const completeSets = sets.every(Boolean);
  const aSetWins = sets.filter((winner) => winner === teamA).length;
  const bSetWins = sets.filter((winner) => winner === teamB).length;
  const setDraws = sets.filter((winner) => winner === "무승부").length;
  const aSetScore = aSetWins + setDraws * 0.5;
  const bSetScore = bSetWins + setDraws * 0.5;
  const matchWinner = selectedBoth && completeSets
    ? aSetScore > bSetScore
      ? teamA
      : aSetScore < bSetScore
        ? teamB
        : "무승부"
    : "";
  const ranking = useMemo(() => sortTeams(teams), [teams]);
  const leader = ranking[0];
  const canEdit = isAdmin && adminUnlocked;
  const canSubmit = canEdit && selectedBoth && completeSets && aSetWins !== bSetWins && !saving;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      leagueDocRef,
      (snapshot) => {
        setError("");

        if (snapshot.exists()) {
          const data = snapshot.data();
          setTeams(normalizeTeams(data.teams));
          setHistory(Array.isArray(data.history) ? data.history : []);
          setLastSaved(data.updatedAtText || "");
          setStatus(isAdmin ? "관리자 화면 · Firebase 연동 중" : "경기 결과 실시간 반영 중");
        } else {
          setTeams(buildInitialTeams());
          setHistory([]);
          setLastSaved("");
          setStatus(isAdmin ? "관리자 화면 · 첫 경기 입력 전" : "학생 화면 · 아직 경기 결과 없음");
        }
      },
      (err) => {
        setStatus("Firebase 연결 실패");
        setError(firebaseErrorText(err));
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const resetSets = () => setSets(Array(SET_COUNT).fill(""));

  async function saveLeague(nextTeams, nextHistory, successMessage) {
    setSaving(true);
    setError("");

    const nowText = new Date().toLocaleString("ko-KR");

    try {
      await withTimeout(
        setDoc(
          leagueDocRef,
          {
            teams: nextTeams,
            history: nextHistory,
            updatedAtText: nowText,
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        ),
        WRITE_TIMEOUT_MS
      );

      setStatus(successMessage);
      setLastSaved(nowText);
    } catch (err) {
      setStatus("Firebase 저장 실패");
      setError(firebaseErrorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitMatch() {
    if (!canSubmit) return;

    const nextTeams = teams.map((team) => {
      if (team.name === teamA) {
        return {
          ...team,
          setWins: team.setWins + aSetWins,
          setDraws: team.setDraws + setDraws,
          setLosses: team.setLosses + bSetWins,
          matchWins: team.matchWins + (matchWinner === teamA ? 1 : 0),
          matchDraws: team.matchDraws + (matchWinner === "무승부" ? 1 : 0),
          matchLosses: team.matchLosses + (matchWinner === teamB ? 1 : 0),
        };
      }

      if (team.name === teamB) {
        return {
          ...team,
          setWins: team.setWins + bSetWins,
          setDraws: team.setDraws + setDraws,
          setLosses: team.setLosses + aSetWins,
          matchWins: team.matchWins + (matchWinner === teamB ? 1 : 0),
          matchDraws: team.matchDraws + (matchWinner === "무승부" ? 1 : 0),
          matchLosses: team.matchLosses + (matchWinner === teamA ? 1 : 0),
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
        setDraws,
        aSetScore,
        bSetScore,
        winner: matchWinner,
        createdAt: new Date().toLocaleString("ko-KR"),
      },
      ...history,
    ];

    setTeams(nextTeams);
    setHistory(nextHistory);
    resetSets();

    await saveLeague(nextTeams, nextHistory, "클라우드 저장 완료 · 학생 화면에 반영됨");
  }

  async function resetAll() {
    if (!canEdit) return;
    if (!window.confirm("모든 경기 기록과 순위를 초기화할까요?")) return;

    const emptyTeams = buildInitialTeams();
    const emptyHistory = [];

    setTeamA("");
    setTeamB("");
    resetSets();
    setTeams(emptyTeams);
    setHistory(emptyHistory);

    await saveLeague(emptyTeams, emptyHistory, "초기화 완료 · 학생 화면에 반영됨");
  }

  function unlockAdmin() {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  }

  const statusClass = status.includes("실패") ? "status error" : "status";

  return (
    <main className="page">
      <section className="app-shell">
        <header className="header">
          <div className="logo">🏸</div>
          <div>
            <h1>6학년 배드민턴 리그전</h1>
            <p>{isAdmin ? "관리자 화면" : "실시간 순위표"}</p>
            <p className={statusClass}>{status}</p>
            {lastSaved && <p className="last-saved">마지막 저장: {lastSaved}</p>}
          </div>
        </header>

        {error && (
          <section className="error-box">
            <strong>Firebase 오류</strong>
            <p>{error}</p>
          </section>
        )}

        {isAdmin && !canEdit && (
          <section className="card">
            <h2>관리자 비밀번호</h2>
            <p className="password-guide">경기 결과 입력은 관리자만 할 수 있습니다.</p>
            <input
              className="password-input"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="비밀번호 입력"
              onKeyDown={(e) => {
                if (e.key === "Enter") unlockAdmin();
              }}
            />
            <button className="submit-button" type="button" onClick={unlockAdmin}>
              관리자 입장
            </button>
          </section>
        )}

        {canEdit && (
          <section className="card">
            <div className="select-grid">
              <label>
                <span>반 1</span>
                <select value={teamA} onChange={(e) => { setTeamA(e.target.value); resetSets(); }}>
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
                <select value={teamB} onChange={(e) => { setTeamB(e.target.value); resetSets(); }}>
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
                  <strong>{teamA} {aSetScore} : {bSetScore} {teamB}</strong>
                  {completeSets && <em>{matchWinner === "무승부" ? "경기 무승부" : `승리: ${matchWinner}`}</em>}
                </div>

                <div className="set-list">
                  {sets.map((winner, index) => (
                    <div className="set-card" key={index}>
                      <div className="set-title">{index + 1}세트 승리반</div>
                      <div className="winner-buttons three">
                        {[teamA, "무승부", teamB].map((name) => (
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
                            {name === "무승부" ? "무승부" : `${name} 승`}
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
            {canEdit && <button className="reset-button" type="button" onClick={resetAll}>초기화</button>}
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
                  <th>경기</th>
                  <th>승</th>
                  <th>무</th>
                  <th>패</th>
                  <th>승률</th>
                  <th>게임차</th>
                  <th>연속</th>
                  <th>세트득실</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((team, index) => (
                  <tr key={team.name}>
                    <td className="rank">{index + 1}</td>
                    <td className="team-name">{team.name}</td>
                    <td>{gameCount(team)}</td>
                    <td>{team.matchWins}</td>
                    <td>{team.matchDraws}</td>
                    <td>{team.matchLosses}</td>
                    <td className="set-diff">{winRateText(team)}</td>
                    <td>{gameBack(team, leader)}</td>
                    <td>{getStreak(team.name, history)}</td>
                    <td>{setDiff(team)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rule-note">승률 = (세트승 + 세트무×0.5) ÷ 전체세트</p>
        </section>

        {history.length > 0 && (
          <section className="card">
            <h2>{isAdmin ? "입력된 경기" : "최근 경기 결과"}</h2>
            <div className="history-list">
              {history.slice(0, isAdmin ? history.length : 5).map((game) => (
                <div className="history-card" key={game.id}>
                  <strong>{game.teamA} {game.aSetScore ?? game.aSetWins} : {game.bSetScore ?? game.bSetWins} {game.teamB}</strong>
                  <span>{game.winner === "무승부" ? "경기 무승부" : `승리: ${game.winner}`}</span>
                  <small>{game.createdAt}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isAdmin && <p className="viewer-note">학생용 화면입니다. 경기 결과 입력은 관리자만 가능합니다.</p>}
      </section>
    </main>
  );
}
