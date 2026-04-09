import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Play, Wind, Timer, Plane, Settings, Mail, BadgeInfo } from "lucide-react";

const STORAGE_KEY = "windtraining-browser-scores-v2";
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 118;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(a) {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
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
    windFrom = normalizeAngle(heading + steps * 5);
  } else {
    windFrom = Math.floor(Math.random() * 72) * 5;
  }

  return {
    display:
      mode === "atterrissage"
        ? headingToRunwayNumber(heading)
        : `${String(heading).padStart(3, "0")}°`,
    windFrom,
    relativeFrom: normalizeAngle(windFrom - heading),
  };
}

function isLeftRightConfusion(selected, correct) {
  const s = normalizeAngle(selected);
  const c = normalizeAngle(correct);

  const sLeft = s > 180;
  const sRight = s > 0 && s < 180;
  const cLeft = c > 180;
  const cRight = c > 0 && c < 180;

  return (sLeft && cRight) || (sRight && cLeft);
}

function computeScore(error, time, mode, selected, correct) {
  if (mode === "atterrissage" && isLeftRightConfusion(selected, correct)) {
    return 0;
  }

  const maxError = mode === "atterrissage" ? 10 : 30;

  let accuracy;
  if (error <= 3) accuracy = 100;
  else if (error >= maxError) accuracy = 0;
  else {
    const t = (error - 3) / (maxError - 3);
    accuracy = 100 * (1 - t * t);
  }

  const speed = clamp(1 - time / 30000, 0.2, 1);

  return Math.round(accuracy * 10 * speed);
}

function polar(angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(rad) * RADIUS,
    y: CENTER + Math.sin(rad) * RADIUS,
  };
}

export default function App() {
  const [mode, setMode] = useState("atterrissage");
  const [started, setStarted] = useState(false);
  const [q, setQ] = useState(null);
  const [angle, setAngle] = useState(null);
  const [startTime, setStartTime] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);

  function start() {
    setQ(generateQuestion(mode));
    setAngle(null);
    setFeedback(null);
    setScore(0);
    setStarted(true);
    setStartTime(Date.now());
  }

  function submit(a) {
    const time = Date.now() - startTime;
    const error = shortestAngularDistance(a, q.relativeFrom);
    const pts = computeScore(error, time, mode, a, q.relativeFrom);

    setFeedback({ error, time, pts });
    setScore(pts);
  }

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - CENTER;
    const y = e.clientY - rect.top - CENTER;
    const a = normalizeAngle((Math.atan2(y, x) * 180) / Math.PI + 90);

    setAngle(a);
    submit(a);
  }

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h1>windtraining</h1>

      {!started && (
        <>
          <button onClick={() => setMode("atterrissage")}>atterrissage</button>
          <button onClick={() => setMode("navigation")}>navigation</button>
          <br /><br />
          <button onClick={start}>Lancer</button>
        </>
      )}

      {started && q && (
        <>
          <h2>{q.display}</h2>
          <h3>Vent {q.windFrom}°</h3>

          <div
            onClick={handleClick}
            style={{
              width: SIZE,
              height: SIZE,
              margin: "20px auto",
              borderRadius: "50%",
              border: "2px solid black",
              position: "relative",
              cursor: "pointer",
            }}
          >
            {angle !== null && (
              <div
                style={{
                  position: "absolute",
                  left: polar(angle).x,
                  top: polar(angle).y,
                  width: 10,
                  height: 10,
                  background: "orange",
                  borderRadius: "50%",
                }}
              />
            )}
          </div>

          {feedback && (
            <>
              <p>Erreur: {Math.round(feedback.error)}°</p>
              <p>Temps: {(feedback.time / 1000).toFixed(1)}s</p>
              <p>Score: {feedback.pts}</p>
              <button onClick={start}>Rejouer</button>
            </>
          )}
        </>
      )}
    </div>
  );
}