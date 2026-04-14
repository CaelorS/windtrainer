import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Play, Wind, Timer, Plane, Settings, Mail, BadgeInfo } from "lucide-react";
import { supabase } from "./supabase";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 118;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function shortestAngularDistance(a, b) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, 360 - diff);
}

function headingToRunwayNumber(heading) {
  const rounded = Math.round(heading / 10);
  const num = rounded === 0 ? 36 : rounded;
  return String(num).padStart(2, "0");
}

function generateQuestion(mode) {
  const heading = Math.floor(Math.random() * 36) * 10;
  let windFrom;

  if (mode === "atterrissage") {
    const steps = Math.floor(Math.random() * 13) - 6;
    const offset = steps * 5;
    windFrom = normalizeAngle(heading + offset);
  } else {
    windFrom = Math.floor(Math.random() * 72) * 5;
  }

  const relativeFrom = normalizeAngle(windFrom - heading);

  return {
    heading,
    display:
      mode === "atterrissage"
        ? headingToRunwayNumber(heading)
        : `${String(heading).padStart(3, "0")}°`,
    windFrom,
    relativeFrom,
  };
}

function getPointFromEvent(e, rect) {
  const point = "touches" in e && e.touches.length > 0 ? e.touches[0] : e;
  const x = point.clientX - rect.left;
  const y = point.clientY - rect.top;
  return { x, y };
}

async function loadScores() {
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .order("score", { ascending: false })
    .order("average_error", { ascending: true })
    .order("average_time_ms", { ascending: true });

  if (error) {
    console.error("Erreur chargement scores:", error);
    return [];
  }

  return data ?? [];
}

async function saveScore(record) {
  const { error } = await supabase.from("scores").insert(record);

  if (error) {
    console.error("Erreur sauvegarde score:", error);
  }
}

function formatDuration(ms) {
  return (ms / 1000).toFixed(1) + " s";
}

function polarPoint(angleDeg, radius = RADIUS) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(rad) * radius,
    y: CENTER + Math.sin(rad) * radius,
  };
}

function isLeftSide(angle) {
  const a = normalizeAngle(angle);
  return a > 180;
}

function isRightSide(angle) {
  const a = normalizeAngle(angle);
  return a > 0 && a < 180;
}

function isLeftRightConfusion(selectedAngle, correctAngle) {
  const selected = normalizeAngle(selectedAngle);
  const correct = normalizeAngle(correctAngle);

  const selectedLeft = isLeftSide(selected);
  const selectedRight = isRightSide(selected);
  const correctLeft = isLeftSide(correct);
  const correctRight = isRightSide(correct);

  return (selectedLeft && correctRight) || (selectedRight && correctLeft);
}

function computeQuestionScore(errorDeg, timeMs, mode, selectedAngle, correctAngle) {
  if (mode === "atterrissage" && isLeftRightConfusion(selectedAngle, correctAngle)) {
    return 0;
  }

  let accuracy;
  const maxError = mode === "atterrissage" ? 10 : 30;

  if (errorDeg <= 3) {
    accuracy = 100;
  } else if (errorDeg >= maxError) {
    accuracy = 0;
  } else {
    const t = (errorDeg - 3) / (maxError - 3);
    accuracy = 100 * (1 - t * t);
  }

  const speedFactor = clamp(1 - timeMs / 30000, 0.2, 1);
  return Math.round(accuracy * 10 * speedFactor);
}

function appButtonStyle({ primary = false } = {}) {
  return {
    width: "100%",
    borderRadius: 18,
    padding: "14px 18px",
    border: primary ? "none" : "1px solid #cbd5e1",
    background: primary ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "white",
    color: primary ? "white" : "#0f172a",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: primary ? "0 10px 20px rgba(37,99,235,0.22)" : "0 1px 2px rgba(15,23,42,0.04)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
  };
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 28,
        boxShadow: "0 14px 40px rgba(15,23,42,0.08)",
        border: "1px solid rgba(226,232,240,0.9)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ children }) {
  return <div style={{ padding: "24px 24px 0 24px" }}>{children}</div>;
}

function CardTitle({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
      {children}
    </div>
  );
}

function CardContent({ children, style }) {
  return <div style={{ padding: 24, ...style }}>{children}</div>;
}

function AppButton({ children, onClick, primary = false, disabled = false, style, type = "button" }) {
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        ...appButtonStyle({ primary }),
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function AppInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        borderRadius: 18,
        padding: "14px 16px",
        border: "1px solid #cbd5e1",
        fontSize: 15,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function Leaderboard({ scores, isMobile }) {
  const modes = ["atterrissage", "navigation"];
  const counts = [1, 5, 10, 20, 30];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trophy size={20} /> Meilleurs scores
        </CardTitle>
      </CardHeader>
      <CardContent style={{ paddingTop: 18 }}>
        <div style={{ display: "grid", gap: 20 }}>
          {modes.map((mode) => (
            <div key={mode} style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "capitalize" }}>{mode}</div>
              <div style={{ display: "grid", gap: 12 }}>
                {counts.map((count) => {
                  const filtered = scores
                    .filter((s) => (s.mode || "atterrissage") === mode && s.questions === count)
                    .sort((a, b) => b.score - a.score || a.averageError - b.averageError || a.averageTimeMs - b.averageTimeMs)
                    .slice(0, 5);

                  return (
                    <div key={`${mode}-${count}`} style={{ borderRadius: 20, background: "#f8fafc", padding: 14 }}>
                      <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: "#64748b", textTransform: "uppercase" }}>
                        {count} question{count > 1 ? "s" : ""}
                      </div>
                      {filtered.length === 0 ? (
                        <div style={{ fontSize: 14, color: "#94a3b8" }}>Aucun score</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {filtered.map((s, i) => (
                            <div
                              key={s.id}
                              style={{
                                display: "flex",
                                alignItems: isMobile ? "flex-start" : "center",
                                justifyContent: "space-between",
                                gap: 12,
                                flexDirection: isMobile ? "column" : "row",
                                borderRadius: 16,
                                background: "white",
                                padding: "10px 12px",
                              }}
                            >
                              <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 10 }}>
                                <div style={{ width: 28, color: "#64748b", fontSize: 14 }}>#{i + 1}</div>
                                <div style={{ fontWeight: 600, color: "#0f172a", wordBreak: "break-word" }}>{s.pseudo}</div>
                              </div>
                              <div style={{ display: "flex", gap: 12, color: "#475569", fontSize: 14, flexWrap: "wrap" }}>
                                <span>{s.score} pts</span>
                                <span>{s.averageError}°</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CompassBoard({ selectedAngle, correctAngle, showCorrection, onSelect, onRelease, isMobile }) {
  const boardRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const boardSize = isMobile ? 280 : SIZE;
  const boardCenter = boardSize / 2;
  const boardRadius = isMobile ? 102 : RADIUS;

  const localPolarPoint = (angleDeg, radius = boardRadius) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: boardCenter + Math.cos(rad) * radius,
      y: boardCenter + Math.sin(rad) * radius,
    };
  };

  const handlePointer = (e) => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const { x, y } = getPointFromEvent(e, rect);
    const dx = x - boardCenter;
    const dy = y - boardCenter;
    const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    onSelect(angle);
    return angle;
  };

  const handleRelease = (e) => {
    if (!dragging) return;
    const angle = handlePointer(e);
    setDragging(false);
    if (angle != null) onRelease(angle);
  };

  const largeTicks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const smallTicks = Array.from({ length: 36 }, (_, i) => i * 10).filter((a) => a % 30 !== 0);

  return (
    <div
      ref={boardRef}
      style={{
        position: "relative",
        width: boardSize,
        height: boardSize,
        margin: "0 auto",
        userSelect: "none",
        touchAction: "none",
      }}
      onMouseDown={(e) => {
        setDragging(true);
        handlePointer(e);
      }}
      onMouseMove={(e) => {
        if (dragging) handlePointer(e);
      }}
      onMouseUp={handleRelease}
      onMouseLeave={() => setDragging(false)}
      onTouchStart={(e) => {
        setDragging(true);
        handlePointer(e);
      }}
      onTouchMove={(e) => {
        if (dragging) handlePointer(e);
      }}
      onTouchEnd={handleRelease}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "4px solid #cbd5e1",
          background: "white",
          boxShadow: "inset 0 4px 20px rgba(15,23,42,0.06)",
        }}
      />

      {largeTicks.map((a) => {
        const inner = localPolarPoint(a, boardRadius - 14);
        const outer = localPolarPoint(a, boardRadius);
        return (
          <svg key={a} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox={`0 0 ${boardSize} ${boardSize}`}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#cbd5e1" strokeWidth="2" />
          </svg>
        );
      })}

      {smallTicks.map((a) => {
        const inner = localPolarPoint(a, boardRadius - 8);
        const outer = localPolarPoint(a, boardRadius);
        return (
          <svg key={`small-${a}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox={`0 0 ${boardSize} ${boardSize}`}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#e2e8f0" strokeWidth="1" />
          </svg>
        );
      })}

      <div style={{ position: "absolute", left: "50%", top: 12, transform: "translateX(-50%)", fontSize: 12, fontWeight: 700, color: "#64748b" }}>AVANT</div>
      <div style={{ position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)", fontSize: 12, color: "#94a3b8" }}>ARRIÈRE</div>
      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94a3b8" }}>GAUCHE</div>
      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94a3b8" }}>DROITE</div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        <div
          style={{
            width: isMobile ? 72 : 80,
            height: isMobile ? 72 : 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "#e0f2fe",
            boxShadow: "0 8px 20px rgba(14,165,233,0.12)",
          }}
        >
          <Plane size={isMobile ? 34 : 40} color="#0369a1" style={{ transform: "rotate(-45deg)" }} />
        </div>
      </motion.div>

      {selectedAngle != null && (() => {
        const p = localPolarPoint(selectedAngle);
        return (
          <>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox={`0 0 ${boardSize} ${boardSize}`}>
              <line x1={boardCenter} y1={boardCenter} x2={p.x} y2={p.y} stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <div
              style={{
                position: "absolute",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#f59e0b",
                boxShadow: "0 4px 12px rgba(245,158,11,0.28)",
                left: p.x - 8,
                top: p.y - 8,
              }}
            />
          </>
        );
      })()}

      {showCorrection && correctAngle != null && (() => {
        const p = localPolarPoint(correctAngle, boardRadius - 6);
        return (
          <>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox={`0 0 ${boardSize} ${boardSize}`}>
              <line x1={boardCenter} y1={boardCenter} x2={p.x} y2={p.y} stroke="#059669" strokeWidth="4" strokeDasharray="6 6" strokeLinecap="round" />
            </svg>
            <div
              style={{
                position: "absolute",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#059669",
                boxShadow: "0 4px 12px rgba(5,150,105,0.24)",
                left: p.x - 8,
                top: p.y - 8,
              }}
            />
          </>
        );
      })()}
    </div>
  );
}

export default function WindtrainingApp() {
  const [pseudo, setPseudo] = useState("Pilote");
  const [questionCount, setQuestionCount] = useState(5);
  const [mode, setMode] = useState("atterrissage");
  const [leaderboard, setLeaderboard] = useState([]);
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedAngle, setSelectedAngle] = useState(null);
  const [questionStart, setQuestionStart] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [finished, setFinished] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [improvementIdea, setImprovementIdea] = useState("");
  const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  async function fetchScores() {
    const scores = await loadScores();
    setLeaderboard(scores);
  }

  fetchScores();
}, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.fontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    document.body.style.background = "linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)";
    document.body.style.color = "#0f172a";
    return () => {
      document.body.style.margin = "";
      document.body.style.fontFamily = "";
      document.body.style.background = "";
      document.body.style.color = "";
    };
  }, []);

  const current = questions[index] || null;

  const averageError = useMemo(() => {
    if (history.length === 0) return 0;
    return Math.round(history.reduce((sum, h) => sum + h.errorDeg, 0) / history.length);
  }, [history]);

  const averageTimeMs = useMemo(() => {
    if (history.length === 0) return 0;
    return Math.round(history.reduce((sum, h) => sum + h.timeMs, 0) / history.length);
  }, [history]);

  function openImprovementEmail() {
    const subject = encodeURIComponent("Windtraining - idée d'amélioration");
    const body = encodeURIComponent(improvementIdea.trim());
    window.location.href = `mailto:windtraining.slouchy218@simplelogin.com?subject=${subject}&body=${body}`;
    setFeedbackModalOpen(false);
    setImprovementIdea("");
  }

  function startGame() {
    const qs = Array.from({ length: questionCount }, () => generateQuestion(mode));
    setQuestions(qs);
    setIndex(0);
    setSelectedAngle(null);
    setFeedback(null);
    setTotalScore(0);
    setHistory([]);
    setFinished(false);
    setStarted(true);
    setQuestionStart(Date.now());
  }

  function submitAnswer(finalAngle = selectedAngle) {
    if (!current || finalAngle == null || feedback) return;

    const timeMs = Date.now() - questionStart;
    const errorDeg = shortestAngularDistance(finalAngle, current.relativeFrom);
    const leftRightConfusion = mode === "atterrissage" && isLeftRightConfusion(finalAngle, current.relativeFrom);
    const points = computeQuestionScore(errorDeg, timeMs, mode, finalAngle, current.relativeFrom);

    const entry = {
      question: index + 1,
      errorDeg: Math.round(errorDeg),
      timeMs,
      points,
      windFrom: current.windFrom,
      runway: current.display,
      selectedAngle: Math.round(normalizeAngle(finalAngle)),
      correctAngle: Math.round(current.relativeFrom),
      leftRightConfusion,
    };

    setSelectedAngle(finalAngle);
    setHistory((prev) => [...prev, entry]);
    setTotalScore((prev) => prev + points);
    setFeedback(entry);
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      finishGame();
      return;
    }

    setIndex((prev) => prev + 1);
    setSelectedAngle(null);
    setFeedback(null);
    setQuestionStart(Date.now());
  }

  async function finishGame(finalHistory = history) {
  const finalScore = finalHistory.reduce((sum, h) => sum + h.points, 0);
  const finalAverageError =
    finalHistory.length === 0
      ? 0
      : Math.round(finalHistory.reduce((sum, h) => sum + h.errorDeg, 0) / finalHistory.length);
  const finalAverageTimeMs =
    finalHistory.length === 0
      ? 0
      : Math.round(finalHistory.reduce((sum, h) => sum + h.timeMs, 0) / finalHistory.length);

  const record = {
    pseudo: pseudo.trim() || "Pilote",
    score: finalScore,
    questions: questionCount,
    mode,
    average_error: finalAverageError,
    average_time_ms: finalAverageTimeMs,
  };

  await saveScore(record);

  const refreshedScores = await loadScores();
  setLeaderboard(refreshedScores);
  setFinished(true);
  setStarted(false);
}
  const displayedScore = history.reduce((sum, h) => sum + h.points, 0);

  return (
    <div style={{ minHeight: "100vh", padding: isMobile ? 16 : 32, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto 16px auto" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: "#fef3c7",
            color: "#92400e",
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <BadgeInfo size={16} /> BETA
        </div>
      </div>

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 24,
          gridTemplateColumns: isMobile ? "1fr" : "1.3fr 0.7fr",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 24 }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card style={{ borderRadius: 36 }}>
              <CardContent style={{ padding: isMobile ? 20 : 32 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 16,
                    alignItems: isMobile ? "stretch" : "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        marginBottom: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 999,
                        background: "#e0f2fe",
                        color: "#075985",
                        padding: "8px 12px",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      <Wind size={16} /> Entraînement vent / piste
                    </div>
                    <h1 style={{ margin: 0, fontSize: isMobile ? 34 : 44, lineHeight: 1, fontWeight: 800, letterSpacing: -1.2 }}>
                      windtraining
                    </h1>
                    <p style={{ marginTop: 12, marginBottom: 0, maxWidth: 620, fontSize: isMobile ? 14 : 16, color: "#475569" }}>
                      Deviens un pro du vent relatif !
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, minWidth: isMobile ? 0 : 230 }}>
                    <div style={{ borderRadius: 20, background: "#f8fafc", padding: 14 }}>
                      <div style={{ color: "#64748b", fontSize: 14 }}>Score</div>
                      <div style={{ fontSize: 26, fontWeight: 800 }}>{displayedScore}</div>
                    </div>
                    <div style={{ borderRadius: 20, background: "#f8fafc", padding: 14 }}>
                      <div style={{ color: "#64748b", fontSize: 14 }}>Erreur moy.</div>
                      <div style={{ fontSize: 26, fontWeight: 800 }}>{history.length ? `${averageError}°` : "-"}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {!started && !finished && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Settings size={20} /> Menu
                </CardTitle>
              </CardHeader>
              <CardContent style={{ display: "grid", gap: 24 }}>
                <div style={{ display: "grid", gap: 16, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>Pseudo</label>
                    <AppInput value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ton pseudo" />
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>Mode</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["atterrissage", "navigation"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          style={{
                            borderRadius: 16,
                            padding: "12px 16px",
                            border: mode === m ? "none" : "1px solid #cbd5e1",
                            background: mode === m ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "white",
                            color: mode === m ? "white" : "#0f172a",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8, gridColumn: isMobile ? "auto" : "1 / span 2" }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>Nombre de questions</label>
                    <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                      <div style={{ marginBottom: 12, fontSize: 34, fontWeight: 800 }}>{questionCount}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
                        {[1, 5, 10, 20, 30].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setQuestionCount(count)}
                            style={{
                              borderRadius: 16,
                              padding: "12px 10px",
                              border: questionCount === count ? "none" : "1px solid #cbd5e1",
                              background: questionCount === count ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "white",
                              color: questionCount === count ? "white" : "#0f172a",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <AppButton primary onClick={startGame} style={{ padding: "18px 20px", fontSize: 16 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Play size={18} /> Lancer la partie
                  </span>
                </AppButton>
              </CardContent>
            </Card>
          )}

          {started && current && (
            <Card>
              <CardContent style={{ padding: isMobile ? 18 : 24 }}>
                <div style={{ marginBottom: 20, display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                  <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>Question</div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>
                      {index + 1} / {questions.length}
                    </div>
                  </div>
                  <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>
                      {mode === "atterrissage" ? "Piste affichée" : "Cap"}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{current.display}</div>
                  </div>
                  <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>Vent</div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>
                      {String(current.windFrom).padStart(3, "0")}°
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 16, borderRadius: 20, background: "#e0f2fe", color: "#0c4a6e", padding: 16, fontSize: 14, fontWeight: 500 }}>
                  D'où vient le vent ?
                </div>

                <div style={{ position: "relative" }}>
                  <CompassBoard
                    selectedAngle={selectedAngle}
                    correctAngle={current.relativeFrom}
                    showCorrection={!!feedback}
                    onSelect={setSelectedAngle}
                    onRelease={submitAnswer}
                    isMobile={isMobile}
                  />

                  <AnimatePresence>
                    {feedback && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        <motion.div
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.85, opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          style={{ pointerEvents: "auto" }}
                        >
                          <button
                            onClick={nextQuestion}
                            style={{
                              width: 80,
                              height: 80,
                              borderRadius: "50%",
                              border: "none",
                              background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                              color: "white",
                              fontSize: 18,
                              fontWeight: 800,
                              cursor: "pointer",
                              boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
                            }}
                          >
                            go
                          </button>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 20, display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}
                  >
                    <div style={{ borderRadius: 20, background: "#ecfdf5", padding: 16 }}>
                      <div style={{ fontSize: 14, color: "#047857" }}>Erreur</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "#065f46" }}>{feedback.errorDeg}°</div>
                    </div>
                    <div style={{ borderRadius: 20, background: "#fffbeb", padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#b45309" }}>
                        <Timer size={16} /> Temps
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "#92400e" }}>{formatDuration(feedback.timeMs)}</div>
                    </div>
                    <div style={{ borderRadius: 20, background: "#e0f2fe", padding: 16 }}>
                      <div style={{ fontSize: 14, color: "#0369a1" }}>Score</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "#0c4a6e" }}>+{feedback.points}</div>
                    </div>
                  </motion.div>
                )}

                {feedback?.leftRightConfusion && (
                  <div style={{ marginTop: 16, borderRadius: 20, background: "#fff1f2", color: "#9f1239", padding: 16, fontSize: 14 }}>
                    Confusion droite / gauche détectée : 0 point pour cette question.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {finished && (
            <Card>
              <CardHeader>
                <CardTitle>Résultat de la partie</CardTitle>
              </CardHeader>
              <CardContent style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))" }}>
                  <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                    <div style={{ color: "#64748b", fontSize: 14 }}>Pilote</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{pseudo || "Pilote"}</div>
                  </div>
                  <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                    <div style={{ color: "#64748b", fontSize: 14 }}>Score final</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{displayedScore} pts</div>
                  </div>
                  <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                    <div style={{ color: "#64748b", fontSize: 14 }}>Erreur moyenne</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{averageError}°</div>
                  </div>
                  <div style={{ borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                    <div style={{ color: "#64748b", fontSize: 14 }}>Temps moyen</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{formatDuration(averageTimeMs)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, borderRadius: 20, background: "#f8fafc", padding: 16 }}>
                  {history.map((h) => (
                    <div key={h.question} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 14, flexDirection: isMobile ? "column" : "row" }}>
                      <span>
                        Q{h.question} - {mode === "atterrissage" ? "piste" : "cap"} {h.runway} - vent {String(h.windFrom).padStart(3, "0")}°
                      </span>
                      <span style={{ textAlign: isMobile ? "left" : "right", color: "#475569" }}>
                        {h.errorDeg}° - {formatDuration(h.timeMs)} - {h.points} pts
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                  <AppButton onClick={() => setFeedbackModalOpen(true)}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Mail size={16} /> une idée d'amélioration ?
                    </span>
                  </AppButton>
                  <AppButton
                    onClick={() => {
                      setFinished(false);
                      setStarted(false);
                    }}
                  >
                    Retour au menu
                  </AppButton>
                  <AppButton primary onClick={startGame}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Play size={16} /> Rejouer
                    </span>
                  </AppButton>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <Leaderboard scores={leaderboard} isMobile={isMobile} />

          <Card>
            <CardHeader>
              <CardTitle>Règle du jeu</CardTitle>
            </CardHeader>
            <CardContent style={{ display: "grid", gap: 12, fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>Le but est d'identifier d'où vient le vent par rapport à l'avion.</p>
              <p style={{ margin: 0 }}>En mode atterrissage, la piste te donne le cap. En mode navigation, le cap est affiché directement en degrés.</p>
              <p style={{ margin: 0 }}>Le score récompense à la fois la précision angulaire et la rapidité de réponse.</p>
              <p style={{ margin: 0 }}>En mode navigation, le score tombe à 0 à partir de 30° d'erreur.</p>
              <p style={{ margin: 0 }}>En mode atterrissage, le score tombe à 0 à partir de 10° d'erreur.</p>
              <p style={{ margin: 0 }}>En mode atterrissage, une confusion droite / gauche donne automatiquement 0 point.</p>
              <p style={{ margin: 0 }}>Le facteur temps descend au minimum à 0,2, donc une bonne réponse lente rapporte encore un peu.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {feedbackModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15,23,42,0.4)",
              padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              style={{ width: "100%", maxWidth: 680, borderRadius: 28, background: "white", padding: 24, boxShadow: "0 24px 60px rgba(15,23,42,0.18)" }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 24, fontWeight: 800 }}>Une idée d'amélioration ?</h3>
              <p style={{ marginTop: 0, color: "#475569", fontSize: 14 }}>
                Écris ton idée ci-dessous. La validation ouvrira ton application mail avec le message prêt à être envoyé.
              </p>
              <textarea
                value={improvementIdea}
                onChange={(e) => setImprovementIdea(e.target.value)}
                placeholder="Exemple : ajouter un mode vent de travers, afficher la composante de vent, améliorer les animations..."
                style={{
                  marginTop: 12,
                  minHeight: 180,
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 20,
                  border: "1px solid #cbd5e1",
                  padding: 16,
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
                <AppButton onClick={() => setFeedbackModalOpen(false)}>Annuler</AppButton>
                <AppButton primary onClick={openImprovementEmail} disabled={!improvementIdea.trim()}>
                  Envoyer par mail
                </AppButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
