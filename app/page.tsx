"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  cardImage,
  CardSkin,
  chooseFloorCard,
  chooseGo,
  chooseStop,
  cpuTurn,
  GameState,
  HwatuCard,
  newGame,
  playCard,
  scoreCards,
} from "./game";

type Stats = { wins: number; losses: number; streak: number };

const KIND_LABEL = {
  bright: "광",
  animal: "열끗",
  ribbon: "띠",
  junk: "피",
};

function CardFace({
  card,
  skin,
  active = false,
  linked = false,
  selectable = false,
  onClick,
  onHighlight,
}: {
  card: HwatuCard;
  skin: CardSkin;
  active?: boolean;
  linked?: boolean;
  selectable?: boolean;
  onClick?: () => void;
  onHighlight?: (active: boolean) => void;
}) {
  return (
    <button
      className={"hwatu-card " + (active ? "choice " : "") + (linked ? "linked " : "") + (selectable ? "playable" : "")}
      onClick={onClick}
      onMouseEnter={() => onHighlight?.(true)}
      onMouseLeave={() => onHighlight?.(false)}
      onFocus={() => onHighlight?.(true)}
      onBlur={() => onHighlight?.(false)}
      disabled={!onClick}
      aria-label={card.name + " " + KIND_LABEL[card.kind]}
    >
      <Image src={cardImage(card, skin)} alt="" width={576} height={1024} draggable={false} unoptimized />
      <span className="month-tag">{card.month}</span>
    </button>
  );
}

function CardBack({ index }: { index: number }) {
  return (
    <div className="card-back" style={{ "--i": index } as React.CSSProperties} aria-hidden="true">
      <span />
    </div>
  );
}

function CaptureGroup({ cards, kind, skin }: { cards: HwatuCard[]; kind: HwatuCard["kind"]; skin: CardSkin }) {
  const filtered = cards.filter((card) => card.kind === kind);
  const count = kind === "junk" ? filtered.reduce((sum, card) => sum + card.pi, 0) : filtered.length;
  return (
    <div className="capture-group">
      <div className="capture-head">
        <span>{KIND_LABEL[kind]}</span>
        <strong>{count}</strong>
      </div>
      <div className="capture-stack">
        {filtered.slice(-6).map((card, index) => (
          <div className="capture-mini" key={card.id} style={{ "--n": index } as React.CSSProperties}>
            <Image src={cardImage(card, skin)} alt="" width={576} height={1024} unoptimized />
          </div>
        ))}
        {filtered.length === 0 && <i className="empty-slot" />}
      </div>
    </div>
  );
}

function CaptureRack({ cards, label, skin }: { cards: HwatuCard[]; label: string; skin: CardSkin }) {
  const score = scoreCards(cards);
  return (
    <section className="capture-rack" aria-label={label + " 획득 패"}>
      <div className="rack-title">
        <span>{label} CAPTURE</span>
        <b>{score.total.toString().padStart(2, "0")} PT</b>
      </div>
      <div className="capture-grid">
        {(["bright", "animal", "ribbon", "junk"] as const).map((kind) => (
          <CaptureGroup key={kind} cards={cards} kind={kind} skin={skin} />
        ))}
      </div>
      <div className="combo-line">{score.combos.length ? score.combos.join(" · ") : "COMBO WAITING"}</div>
    </section>
  );
}

function ScoreReadout({ label, cards, go, active }: { label: string; cards: HwatuCard[]; go: number; active: boolean }) {
  const score = scoreCards(cards);
  return (
    <div className={"score-readout " + (active ? "active" : "")}>
      <div className="score-person">
        <span className="status-dot" />
        <span>{label}</span>
        {go > 0 && <i>{go} GO</i>}
      </div>
      <strong>{score.total.toString().padStart(2, "0")}</strong>
      <div className="score-cells">
        <span>광 {score.counts.bright}</span>
        <span>열 {score.counts.animal}</span>
        <span>띠 {score.counts.ribbon}</span>
        <span>피 {score.piCount}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);
  const [skin, setSkin] = useState<CardSkin>("circuit");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({ wins: 0, losses: 0, streak: 0 });
  const recordedResult = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGame(newGame());
      const savedSkin = window.localStorage.getItem("circuit-matgo-skin");
      if (savedSkin === "glass") setSkin("glass");
      const saved = window.localStorage.getItem("circuit-matgo-stats");
      if (saved) setStats(JSON.parse(saved));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!game || game.turn !== 1 || game.phase !== "playing" || game.pending) return;
    const timer = window.setTimeout(() => setGame((current) => (current ? cpuTurn(current) : current)), 720);
    return () => window.clearTimeout(timer);
  }, [game]);

  useEffect(() => {
    if (!game || game.phase !== "ended") return;
    const resultKey = game.turnNumber + ":" + game.winner + ":" + game.settlement?.points;
    if (recordedResult.current === resultKey) return;
    recordedResult.current = resultKey;
    setStats((current) => {
      const next =
        game.winner === 0
          ? { wins: current.wins + 1, losses: current.losses, streak: current.streak + 1 }
          : game.winner === 1
            ? { wins: current.wins, losses: current.losses + 1, streak: 0 }
            : current;
      window.localStorage.setItem("circuit-matgo-stats", JSON.stringify(next));
      return next;
    });
  }, [game]);

  const matchingMonths = useMemo(() => {
    if (!game || game.turn !== 0 || game.phase !== "playing" || game.pending) return new Set<number>();
    return new Set(game.floor.map((card) => card.month));
  }, [game]);

  const reset = () => {
    recordedResult.current = null;
    setHoveredMonth(null);
    setGame(newGame());
  };

  const toggleSkin = () => {
    setHoveredMonth(null);
    setSkin((current) => {
      const next = current === "circuit" ? "glass" : "circuit";
      window.localStorage.setItem("circuit-matgo-skin", next);
      return next;
    });
  };

  const winnerScore = game && game.winner !== null ? scoreCards(game.captures[game.winner]) : null;
  const winningHands = winnerScore
    ? [
        ...winnerScore.combos,
        ...(winnerScore.animal > 0 ? [`열끗 ${winnerScore.counts.animal}장`] : []),
        ...(winnerScore.ribbon > 0 ? [`띠 ${winnerScore.counts.ribbon}장`] : []),
        ...(winnerScore.junk > 0 ? [`피 ${winnerScore.piCount}장`] : []),
      ]
    : [];
  const scoreBreakdown: Array<[string, number]> = winnerScore
    ? [
        ["광", winnerScore.bright],
        ["열끗", winnerScore.animal],
        ["띠", winnerScore.ribbon],
        ["피", winnerScore.junk],
      ].filter(([, points]) => points > 0)
    : [];

  if (!game) {
    return (
      <main className="boot-screen">
        <div className="boot-mark"><span /></div>
        <p>DEALING CIRCUIT...</p>
      </main>
    );
  }

  return (
    <main className={"game-shell theme-" + skin}>
      <header className="topbar">
        <div className="brand-area">
          <button
            className="skin-switch"
            type="button"
            onClick={toggleSkin}
            aria-label={"스킨 변경, 현재 " + (skin === "glass" ? "스테인드글라스" : "전자회로")}
            aria-pressed={skin === "glass"}
            title="스킨 변경"
          >
            <span className="skin-glyph" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="skin-copy"><small>SKIN</small><b>{skin === "glass" ? "GLASS" : "CIRCUIT"}</b></span>
          </button>
          <div className="brand">
            <span className="brand-chip"><i /><i /><i /></span>
            <div><b>{skin === "glass" ? "STAINED" : "CIRCUIT"}</b><strong>MATGO</strong></div>
          </div>
        </div>
        <div className="round-status" aria-live="polite">
          <span>ROUND {Math.ceil(game.turnNumber / 2).toString().padStart(2, "0")}</span>
          <b>{game.message}</b>
        </div>
        <div className="top-actions">
          <button onClick={() => setRulesOpen(true)}>룰</button>
          <button className="primary-action" onClick={reset}>새 판</button>
        </div>
      </header>

      <div className="game-grid">
        <section className="play-surface">
          <div className="circuit-trace trace-a" />
          <div className="circuit-trace trace-b" />

          <div className="opponent-zone">
            <div className="player-id">
              <span className={"avatar cpu " + (game.turn === 1 ? "thinking" : "")}>AI</span>
              <div><b>CPU_NODE</b><small>{game.turn === 1 ? "PROCESSING" : "STANDBY"}</small></div>
            </div>
            <div className="opponent-hand" aria-label={"CPU 패 " + game.hands[1].length + "장"}>
              {game.hands[1].map((card, index) => <CardBack key={card.id} index={index} />)}
            </div>
          </div>

          <div className="table-zone">
            <div className="deck-stack" aria-label={"더미 " + game.deck.length + "장"}>
              <div className="card-back deck-back"><span /></div>
              <div className="deck-count"><b>{game.deck.length}</b><small>STACK</small></div>
            </div>
            <div className="floor-grid">
              {game.floor.map((card) => {
                const isChoice = Boolean(game.pending?.matchIds.includes(card.id));
                return (
                  <CardFace
                    key={card.id}
                    card={card}
                    skin={skin}
                    active={isChoice}
                    linked={game.turn === 0 && game.phase === "playing" && !game.pending && hoveredMonth === card.month}
                    selectable={isChoice}
                    onClick={isChoice ? () => setGame((current) => (current ? chooseFloorCard(current, card.id) : current)) : undefined}
                  />
                );
              })}
              {game.floor.length === 0 && <div className="floor-empty">FIELD CLEARED</div>}
            </div>
          </div>

          <div className="player-zone">
            <div className="player-id self">
              <span className={"avatar " + (game.turn === 0 ? "thinking" : "")}>ME</span>
              <div><b>PLAYER_01</b><small>{game.turn === 0 ? "YOUR TURN" : "WAIT"}</small></div>
            </div>
            <div className="player-hand">
              {game.hands[0].map((card) => {
                const playable = game.turn === 0 && game.phase === "playing" && !game.pending;
                return (
                  <CardFace
                    key={card.id}
                    card={card}
                    skin={skin}
                    selectable={playable}
                    active={playable && matchingMonths.has(card.month)}
                    linked={hoveredMonth === card.month}
                    onHighlight={playable && matchingMonths.has(card.month) ? (active) => setHoveredMonth(active ? card.month : null) : undefined}
                    onClick={playable ? () => {
                      setHoveredMonth(null);
                      setGame((current) => (current ? playCard(current, 0, card.id) : current));
                    } : undefined}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <aside className="data-rail">
          <div className="rail-head"><span>LIVE SCORE</span><i>SYNC</i></div>
          <ScoreReadout label="CPU" cards={game.captures[1]} go={game.goCount[1]} active={game.turn === 1} />
          <ScoreReadout label="PLAYER" cards={game.captures[0]} go={game.goCount[0]} active={game.turn === 0} />
          <CaptureRack cards={game.captures[1]} label="CPU" skin={skin} />
          <CaptureRack cards={game.captures[0]} label="MY" skin={skin} />

          <section className="event-log">
            <div className="rail-head"><span>EVENT LOG</span><i>0{game.log.length}</i></div>
            <ol>
              {game.log.map((item, index) => <li key={item + index}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}
            </ol>
          </section>
          <div className="record-line">
            <span>W {stats.wins}</span><span>L {stats.losses}</span><span>STREAK {stats.streak}</span>
          </div>
        </aside>
      </div>

      {game.phase === "decision" && (
        <div className="modal-layer">
          <section className="decision-panel">
            <span className="modal-code">DECISION_REQUIRED</span>
            <h2>{scoreCards(game.captures[0]).total} POINT</h2>
            <p>지금 점수를 확정하거나 위험을 감수하고 다음 고를 진행합니다.</p>
            <div className="decision-actions">
              <button className="go-button" onClick={() => setGame((current) => (current ? chooseGo(current) : current))}>GO</button>
              <button className="stop-button" onClick={() => setGame((current) => (current ? chooseStop(current) : current))}>STOP</button>
            </div>
          </section>
        </div>
      )}

      {game.phase === "ended" && (
        <div className="modal-layer">
          <section className={"result-panel " + (game.winner === 0 ? "result-win" : game.winner === 1 ? "result-lose" : "result-draw")}>
            <span className="modal-code">ROUND_COMPLETE</span>
            <h2>{game.winner === 0 ? "PLAYER WIN" : game.winner === 1 ? "CPU WIN" : "DRAW"}</h2>
            <div className="result-score"><b>{game.settlement?.points ?? 0}</b><span>FINAL POINT</span></div>
            {winnerScore ? (
              <div className="result-details">
                <section className="result-detail-block">
                  <strong>승리 족보</strong>
                  <div className="winning-hands">
                    {winningHands.length ? winningHands.map((hand) => <span key={hand}>{hand}</span>) : <span>기본 점수 조합</span>}
                  </div>
                </section>
                <section className="result-detail-block">
                  <strong>기본 점수 구성</strong>
                  <div className="score-breakdown">
                    {scoreBreakdown.map(([label, points]) => <span key={label}><i>{label}</i><b>{points}점</b></span>)}
                  </div>
                </section>
                <section className="result-detail-block settlement-block">
                  <strong>추가 정산</strong>
                  <div className="result-reasons">
                    {game.settlement?.reasons.length ? game.settlement.reasons.map((reason) => <span key={reason}>{reason}</span>) : <span>추가 배수 없음</span>}
                  </div>
                </section>
              </div>
            ) : (
              <div className="draw-summary">
                <span>PLAYER <b>{scoreCards(game.captures[0]).total}점</b></span>
                <span>CPU <b>{scoreCards(game.captures[1]).total}점</b></span>
              </div>
            )}
            <button className="primary-action wide" onClick={reset}>다시 시작</button>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="modal-layer" onMouseDown={() => setRulesOpen(false)}>
          <section className="rules-panel" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setRulesOpen(false)} aria-label="닫기">×</button>
            <span className="modal-code">RULE_REFERENCE</span>
            <h2>맞고 규칙</h2>
            <div className="rule-list">
              <article><b>진행</b><p>손패 한 장을 내고 더미 한 장을 뒤집습니다. 같은 월의 바닥패와 짝을 맞추면 가져옵니다.</p></article>
              <article><b>기본 점수</b><p>광 3장, 열끗 5장, 띠 5장, 피 10장부터 점수가 시작됩니다. 비광이 낀 삼광은 2점입니다.</p></article>
              <article><b>족보</b><p>오광 15점, 사광 4점, 고도리 5점, 홍단·초단·청단은 각각 3점입니다.</p></article>
              <article><b>고 / 스톱</b><p>7점부터 선택합니다. 1고와 2고는 가산점, 3고부터 배수가 적용됩니다.</p></article>
              <article><b>배수</b><p>광박, 피박, 멍따, 흔들기 조건에 따라 최종 점수가 두 배씩 증가합니다.</p></article>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
