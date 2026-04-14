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

const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90);

if (Number.isNaN(angle)) return null;

onSelect(angle);
return angle;

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
  let point;

  if ("touches" in e && e.touches.length > 0) {
    point = e.touches[0];
  } else if ("changedTouches" in e && e.changedTouches.length > 0) {
    point = e.changedTouches[0];
  } else {
    point = e;
  }

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

function polarPoint(angleDeg, radius = RADIUS, center = CENTER) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: center + Math.cos(rad) * radius,
    y: center + Math.sin(rad) * radius,
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

function SurfaceCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-[28px] border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function Leaderboard({ scores }) {
  const modes = ["atterrissage", "navigation"];
  const counts = [1, 5, 10, 20, 30];

  return (
    <SurfaceCard>
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Trophy className="h-5 w-5" /> Meilleurs scores
        </div>
      </div>

      <div className="space-y-5 p-6 pt-5">
        {modes.map((mode) => (
          <div key={mode} className="space-y-3">
            <div className="text-sm font-semibold capitalize text-slate-700">
              {mode}
            </div>

            <div className="space-y-3">
              {counts.map((count) => {
                const filtered = scores
                  .filter(
                    (s) => (s.mode || "atterrissage") === mode && s.questions === count
                  )
                  .sort(
                    (a, b) =>
                      b.score - a.score ||
                      a.average_error - b.average_error ||
                      a.average_time_ms - b.average_time_ms
                  )
                  .slice(0, 5);

                return (
                  <div
                    key={`${mode}-${count}`}
                    className="rounded-2xl bg-slate-50 p-3"
                  >
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {count} question{count > 1 ? "s" : ""}
                    </div>

                    {filtered.length === 0 ? (
                      <div className="text-sm text-slate-400">Aucun score</div>
                    ) : (
                      <div className="space-y-2">
                        {filtered.map((s, i) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm max-sm:flex-col max-sm:items-start max-sm:gap-2"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="w-6 text-slate-500">#{i + 1}</div>
                              <div className="truncate font-medium">{s.pseudo}</div>
                            </div>

                            <div className="flex items-center gap-3 text-slate-600">
                              <span>{s.score} pts</span>
                              <span>{s.average_error}°</span>
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
    </SurfaceCard>
  );
}

function CompassBoard({ selectedAngle, correctAngle, showCorrection, onSelect, onRelease, compact = false }) {
  const boardRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const size = compact ? 280 : SIZE;
  const center = size / 2;
  const radius = compact ? 102 : RADIUS;

const handlePointer = (e) => {
  if (!boardRef.current) return null;
  const rect = boardRef.current.getBoundingClientRect();
  const { x, y } = getPointFromEvent(e, rect);
  const dx = x - center;
  const dy = y - center;
  const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90);

  if (Number.isNaN(angle)) return null;

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
      className="relative mx-auto select-none touch-none"
      style={{ width: size, height: size }}
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
      <div className="absolute inset-0 rounded-full border-4 border-slate-300 bg-white shadow-inner" />

      {largeTicks.map((a) => {
        const inner = polarPoint(a, radius - 14, center);
        const outer = polarPoint(a, radius, center);
        return (
          <svg key={a} className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#cbd5e1" strokeWidth="2" />
          </svg>
        );
      })}

      {smallTicks.map((a) => {
        const inner = polarPoint(a, radius - 8, center);
        const outer = polarPoint(a, radius, center);
        return (
          <svg key={`small-${a}`} className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#e2e8f0" strokeWidth="1" />
          </svg>
        );
      })}

      <div className="absolute left-1/2 top-3 -translate-x-1/2 text-xs font-bold text-slate-500">AVANT</div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-slate-400">ARRIÈRE</div>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">GAUCHE</div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">DROITE</div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-50 shadow max-sm:h-[72px] max-sm:w-[72px]">
          <Plane className="h-10 w-10 -rotate-45 text-sky-700 max-sm:h-8 max-sm:w-8" />
        </div>
      </motion.div>

      {selectedAngle != null && (() => {
        const p = polarPoint(selectedAngle, radius, center);
        return (
          <>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`}>
              <line x1={center} y1={center} x2={p.x} y2={p.y} stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <div className="absolute h-4 w-4 rounded-full bg-amber-500 shadow" style={{ left: p.x - 8, top: p.y - 8 }} />
          </>
        );
      })()}

      {showCorrection && correctAngle != null && (() => {
        const p = polarPoint(correctAngle, radius - 6, center);
        return (
          <>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`}>
              <line
                x1={center}
                y1={center}
                x2={p.x}
                y2={p.y}
                stroke="#059669"
                strokeWidth="4"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute h-4 w-4 rounded-full bg-emerald-600 shadow" style={{ left: p.x - 8, top: p.y - 8 }} />
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
  const [history, setHistory] = useState([]);
  const [finished, setFinished] = useState(false);
  const [compact, setCompact] = useState(false);

useEffect(() => {
  async function fetchScores() {
    const scores = await loadScores();
    setLeaderboard(scores);
  }

  fetchScores();
}, []);

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

  function startGame() {
    const qs = Array.from({ length: questionCount }, () => generateQuestion(mode));
    setQuestions(qs);
    setIndex(0);
    setSelectedAngle(null);
    setFeedback(null);
    setHistory([]);
    setFinished(false);
    setStarted(true);
    setQuestionStart(Date.now());
  }

  function submitAnswer(finalAngle = selectedAngle) {
    if (!current || finalAngle == null || Number.isNaN(finalAngle) || feedback) return;
    
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
    setFeedback(entry);
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

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      finishGame(history);
      return;
    }

    setIndex((prev) => prev + 1);
    setSelectedAngle(null);
    setFeedback(null);
    setQuestionStart(Date.now());
  }

  const displayedScore = history.reduce((sum, h) => sum + h.points, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white p-4 font-sans md:p-8">
      <div className="mx-auto mb-4 max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          <BadgeInfo className="h-4 w-4" /> BETA
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <SurfaceCard className="rounded-[2rem]">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800">
                      <Wind className="h-4 w-4" /> Entraînement vent / piste
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">windtraining</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">Deviens un pro du vent relatif !</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[220px]">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-slate-500">Score</div>
                      <div className="text-xl font-bold">{displayedScore}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-slate-500">Erreur moy.</div>
                      <div className="text-xl font-bold">{history.length ? `${averageError}°` : "-"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </motion.div>

          {!started && !finished && (
            <SurfaceCard>
              <div className="p-6 pb-0">
                <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <Settings className="h-5 w-5" /> Menu
                </div>
              </div>
              <div className="space-y-6 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Pseudo</label>
                    <input
                      value={pseudo}
                      onChange={(e) => setPseudo(e.target.value)}
                      placeholder="Ton pseudo"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Mode</label>
                    <div className="flex gap-2">
                      {["atterrissage", "navigation"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`rounded-2xl px-4 py-3 font-medium transition ${
                            mode === m ? "bg-sky-600 text-white shadow" : "border border-slate-300 bg-white text-slate-900"
                          }`}
                          onClick={() => setMode(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Nombre de questions</label>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="mb-3 text-2xl font-bold">{questionCount}</div>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 5, 10, 20, 30].map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={`rounded-2xl px-4 py-3 font-medium transition ${
                              questionCount === count ? "bg-sky-600 text-white shadow" : "border border-slate-300 bg-white text-slate-900"
                            }`}
                            onClick={() => setQuestionCount(count)}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="w-full rounded-2xl bg-sky-600 py-5 text-base font-semibold text-white shadow-lg transition hover:bg-sky-700"
                >
                  <span className="inline-flex items-center gap-2">
                    <Play className="h-5 w-5" /> Lancer la partie
                  </span>
                </button>
              </div>
            </SurfaceCard>
          )}

          {started && current && (
            <SurfaceCard>
              <div className="p-5 md:p-6">
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Question</div>
                    <div className="mt-1 text-2xl font-bold">
                      {index + 1} / {questions.length}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {mode === "atterrissage" ? "Piste affichée" : "Cap"}
                    </div>
                    <div className="mt-1 text-2xl font-bold">{current.display}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Vent</div>
                    <div className="mt-1 text-2xl font-bold">{String(current.windFrom).padStart(3, "0")}°</div>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">D'où vient le vent ?</div>

                <div className="relative">
                  <CompassBoard
                    selectedAngle={selectedAngle}
                    correctAngle={current.relativeFrom}
                    showCorrection={!!feedback}
                    onSelect={setSelectedAngle}
                    onRelease={submitAnswer}
                    compact={compact}
                  />

                  <AnimatePresence>
                    {feedback && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <motion.div
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.85, opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="pointer-events-auto"
                        >
                          <button
                            className="h-20 w-20 rounded-full bg-sky-600 p-0 text-lg font-bold text-white shadow-lg"
                            onClick={nextQuestion}
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
                    className="mt-5 grid gap-3 md:grid-cols-3"
                  >
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <div className="text-sm text-emerald-800">Erreur</div>
                      <div className="text-2xl font-bold text-emerald-900">{feedback.errorDeg}°</div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-sm text-amber-800">
                        <Timer className="h-4 w-4" /> Temps
                      </div>
                      <div className="text-2xl font-bold text-amber-900">{formatDuration(feedback.timeMs)}</div>
                    </div>
                    <div className="rounded-2xl bg-sky-50 p-4">
                      <div className="text-sm text-sky-800">Score</div>
                      <div className="text-2xl font-bold text-sky-900">+{feedback.points}</div>
                    </div>
                  </motion.div>
                )}

                {feedback?.leftRightConfusion && (
                  <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
                    Confusion droite / gauche détectée : 0 point pour cette question.
                  </div>
                )}
              </div>
            </SurfaceCard>
          )}

          {finished && (
            <SurfaceCard>
              <div className="p-6 pb-0">
                <div className="text-xl font-bold text-slate-900">Résultat de la partie</div>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Pilote</div>
                    <div className="text-2xl font-bold">{pseudo || "Pilote"}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Score final</div>
                    <div className="text-2xl font-bold">{displayedScore} pts</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Erreur moyenne</div>
                    <div className="text-2xl font-bold">{averageError}°</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-slate-500">Temps moyen</div>
                    <div className="text-2xl font-bold">{formatDuration(averageTimeMs)}</div>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                  {history.map((h) => (
                    <div key={h.question} className="flex items-center justify-between gap-4 text-sm max-sm:flex-col max-sm:items-start">
                      <span>
                        Q{h.question} - {mode === "atterrissage" ? "piste" : "cap"} {h.runway} - vent {String(h.windFrom).padStart(3, "0")}°
                      </span>
                      <span className="text-right text-slate-600">{h.errorDeg}° - {formatDuration(h.timeMs)} - {h.points} pts</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
          
                  <button
                    className="w-full rounded-2xl border border-slate-300 bg-white py-4 font-medium text-slate-900"
                    onClick={() => {
                      setFinished(false);
                      setStarted(false);
                    }}
                  >
                    Retour au menu
                  </button>
                  <button className="w-full rounded-2xl bg-sky-600 py-4 font-semibold text-white shadow" onClick={startGame}>
                    <span className="inline-flex items-center gap-2">
                      <Play className="h-4 w-4" /> Rejouer
                    </span>
                  </button>
                </div>
              </div>
            </SurfaceCard>
          )}
        </div>

        <div className="space-y-6">
          <Leaderboard scores={leaderboard} />

          <SurfaceCard>
            <div className="p-6 pb-0">
              <div className="text-xl font-bold text-slate-900">Règle du jeu</div>
            </div>
            <div className="space-y-3 p-6 text-sm text-slate-600">
              <p>Le but est d'identifier d'où vient le vent par rapport à l'avion.</p>
              <p>En mode atterrissage, la piste te donne le cap. En mode navigation, le cap est affiché directement en degrés.</p>
              <p>Le score récompense à la fois la précision angulaire et la rapidité de réponse.</p>
              <p>En mode navigation, le score tombe à 0 à partir de 30° d'erreur.</p>
              <p>En mode atterrissage, le score tombe à 0 à partir de 10° d'erreur.</p>
              <p>En mode atterrissage, une confusion droite / gauche donne automatiquement 0 point.</p>
              <p>Le facteur temps descend au minimum à 0,2, donc une bonne réponse lente rapporte encore un peu.</p>
            </div>
          </SurfaceCard>
        </div>
      </div>

    
    </div>
  );
}
