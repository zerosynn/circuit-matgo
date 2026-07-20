export type Player = 0 | 1;
export type CardKind = "bright" | "animal" | "ribbon" | "junk";
export type Phase = "playing" | "decision" | "ended";
export type CardSkin = "circuit" | "glass";

export interface HwatuCard {
  id: string;
  month: number;
  order: number;
  kind: CardKind;
  name: string;
  pi: number;
}

export interface ScoreDetail {
  total: number;
  bright: number;
  animal: number;
  ribbon: number;
  junk: number;
  combos: string[];
  counts: Record<CardKind, number>;
  piCount: number;
}

export interface PendingChoice {
  actor: Player;
  stage: "hand" | "draw";
  source: HwatuCard;
  matchIds: string[];
}

export interface GameState {
  deck: HwatuCard[];
  hands: [HwatuCard[], HwatuCard[]];
  floor: HwatuCard[];
  captures: [HwatuCard[], HwatuCard[]];
  turn: Player;
  phase: Phase;
  pending: PendingChoice | null;
  goCount: [number, number];
  lastGoScore: [number, number];
  shakeCount: [number, number];
  message: string;
  log: string[];
  winner: Player | null;
  settlement: { points: number; reasons: string[] } | null;
  turnNumber: number;
}

const MONTH_NAMES = ["", "송학", "매조", "벚꽃", "흑싸리", "난초", "모란", "홍싸리", "공산", "국화", "단풍", "비", "오동"];
const BRIGHTS = new Set(["1-1", "3-1", "8-1", "11-1", "12-1"]);
const ANIMALS = new Set(["2-1", "4-1", "5-1", "6-1", "7-1", "8-2", "9-1", "10-1", "11-2"]);
const RIBBONS = new Set(["1-2", "2-2", "3-2", "4-2", "5-2", "6-2", "7-2", "9-2", "10-2", "11-3"]);

export const ALL_CARDS: HwatuCard[] = Array.from({ length: 12 }, (_, monthIndex) =>
  Array.from({ length: 4 }, (_, orderIndex) => {
    const month = monthIndex + 1;
    const order = orderIndex + 1;
    const key = month + "-" + order;
    const kind: CardKind = BRIGHTS.has(key) ? "bright" : ANIMALS.has(key) ? "animal" : RIBBONS.has(key) ? "ribbon" : "junk";
    const pi = kind === "junk" && ((month === 11 && order === 4) || (month === 12 && order === 4)) ? 2 : kind === "junk" ? 1 : 0;
    return {
      id: "m" + String(month).padStart(2, "0") + "-c" + order,
      month,
      order,
      kind,
      name: month + "월 " + MONTH_NAMES[month],
      pi,
    };
  }),
).flat();

export function cardImage(card: HwatuCard, skin: CardSkin = "circuit") {
  return "/" + (skin === "glass" ? "cards-glass/" : "cards/") + card.id + ".webp";
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sorted(cards: HwatuCard[]) {
  return [...cards].sort((a, b) => a.month - b.month || a.order - b.order);
}

export function newGame(): GameState {
  const deck = shuffle(ALL_CARDS);
  const hands: [HwatuCard[], HwatuCard[]] = [sorted(deck.splice(0, 10)), sorted(deck.splice(0, 10))];
  const floor = sorted(deck.splice(0, 8));
  return {
    deck,
    hands,
    floor,
    captures: [[], []],
    turn: 0,
    phase: "playing",
    pending: null,
    goCount: [0, 0],
    lastGoScore: [6, 6],
    shakeCount: [0, 0],
    message: "내 패를 선택하세요",
    log: ["NEW ROUND · 패 10장 / 바닥 8장"],
    winner: null,
    settlement: null,
    turnNumber: 1,
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    deck: [...state.deck],
    hands: [[...state.hands[0]], [...state.hands[1]]],
    floor: [...state.floor],
    captures: [[...state.captures[0]], [...state.captures[1]]],
    goCount: [...state.goCount] as [number, number],
    lastGoScore: [...state.lastGoScore] as [number, number],
    shakeCount: [...state.shakeCount] as [number, number],
    log: [...state.log],
    pending: state.pending ? { ...state.pending, matchIds: [...state.pending.matchIds] } : null,
  };
}

function addLog(state: GameState, text: string) {
  state.log = [text, ...state.log].slice(0, 5);
}

function removeFloor(state: GameState, ids: string[]) {
  const idSet = new Set(ids);
  const removed = state.floor.filter((card) => idSet.has(card.id));
  state.floor = state.floor.filter((card) => !idSet.has(card.id));
  return removed;
}

function capture(state: GameState, actor: Player, cards: HwatuCard[]) {
  state.captures[actor].push(...cards);
}

function cardValue(card: HwatuCard) {
  return card.kind === "bright" ? 8 : card.kind === "animal" ? 5 : card.kind === "ribbon" ? 3 : card.pi;
}

function bestMatch(state: GameState, ids: string[]) {
  return ids
    .map((id) => state.floor.find((card) => card.id === id)!)
    .sort((a, b) => cardValue(b) - cardValue(a))[0].id;
}

function stealPi(state: GameState, actor: Player) {
  const victim: Player = actor === 0 ? 1 : 0;
  const junk = state.captures[victim].filter((card) => card.kind === "junk").sort((a, b) => a.pi - b.pi)[0];
  if (!junk) return false;
  state.captures[victim] = state.captures[victim].filter((card) => card.id !== junk.id);
  state.captures[actor].push(junk);
  return true;
}

function resolveCard(state: GameState, actor: Player, source: HwatuCard, stage: "hand" | "draw"): boolean {
  const matches = state.floor.filter((card) => card.month === source.month);
  if (matches.length === 0) {
    state.floor.push(source);
    return true;
  }
  if (matches.length === 2 && actor === 0) {
    state.pending = { actor, stage, source, matchIds: matches.map((card) => card.id) };
    state.message = "가져올 바닥패를 선택하세요";
    addLog(state, source.month + "월 패가 두 장입니다 · 하나를 선택");
    return false;
  }
  if (matches.length === 2) {
    const targetId = bestMatch(state, matches.map((card) => card.id));
    capture(state, actor, [source, ...removeFloor(state, [targetId])]);
    return true;
  }
  capture(state, actor, [source, ...removeFloor(state, matches.map((card) => card.id))]);
  return true;
}

function drawStep(state: GameState, actor: Player) {
  if (state.deck.length === 0) return finalizeTurn(state, actor);
  const drawn = state.deck.shift()!;
  addLog(state, (actor === 0 ? "나" : "CPU") + " · " + drawn.month + "월 패 오픈");
  const resolved = resolveCard(state, actor, drawn, "draw");
  if (!resolved) return state;
  return finalizeTurn(state, actor);
}

function finalPoints(state: GameState, winner: Player) {
  const loser: Player = winner === 0 ? 1 : 0;
  const winScore = scoreCards(state.captures[winner]);
  const loseScore = scoreCards(state.captures[loser]);
  const reasons: string[] = [];
  let points = winScore.total;
  if (state.goCount[winner] === 1) {
    points += 1;
    reasons.push("1고 +1");
  } else if (state.goCount[winner] === 2) {
    points += 2;
    reasons.push("2고 +2");
  } else if (state.goCount[winner] >= 3) {
    points = (points + 2) * 2 ** (state.goCount[winner] - 2);
    reasons.push(state.goCount[winner] + "고 배수");
  }
  const winnerBright = state.captures[winner].filter((card) => card.kind === "bright").length;
  const loserBright = state.captures[loser].filter((card) => card.kind === "bright").length;
  if (winnerBright >= 3 && loserBright === 0) {
    points *= 2;
    reasons.push("광박 ×2");
  }
  if (winScore.piCount >= 10 && loseScore.piCount <= 5) {
    points *= 2;
    reasons.push("피박 ×2");
  }
  if (state.captures[winner].filter((card) => card.kind === "animal").length >= 7) {
    points *= 2;
    reasons.push("멍따 ×2");
  }
  if (state.shakeCount[winner] > 0) {
    points *= 2 ** state.shakeCount[winner];
    reasons.push("흔들기 ×" + 2 ** state.shakeCount[winner]);
  }
  return { points: Math.max(points, 1), reasons };
}

function finishGame(state: GameState, winner: Player | null, reason: string) {
  state.phase = "ended";
  state.winner = winner;
  state.pending = null;
  if (winner === null) {
    state.message = "무승부입니다";
    state.settlement = { points: 0, reasons: [reason] };
  } else {
    state.settlement = finalPoints(state, winner);
    state.message = winner === 0 ? "내가 이겼습니다" : "CPU가 이겼습니다";
  }
  addLog(state, reason);
  return state;
}

function finalizeTurn(state: GameState, actor: Player) {
  if (state.floor.length === 0 && stealPi(state, actor)) addLog(state, "쓸 · 상대 피 1장 획득");
  const currentScore = scoreCards(state.captures[actor]).total;
  const noCards = state.hands[0].length === 0 || state.hands[1].length === 0 || state.deck.length === 0;
  if (noCards) {
    const myScore = scoreCards(state.captures[0]).total;
    const cpuScore = scoreCards(state.captures[1]).total;
    return finishGame(state, myScore === cpuScore ? null : myScore > cpuScore ? 0 : 1, "남은 패가 없어 점수를 정산했습니다");
  }
  if (currentScore >= 7 && currentScore > state.lastGoScore[actor]) {
    if (actor === 0) {
      state.phase = "decision";
      state.message = currentScore + "점 · 고 또는 스톱을 선택하세요";
      addLog(state, "GO / STOP 판단");
      return state;
    }
    const myScore = scoreCards(state.captures[0]).total;
    const cpuGoes = currentScore < 10 && state.deck.length > 6 && currentScore >= myScore;
    if (!cpuGoes) return finishGame(state, 1, "CPU 스톱 · " + currentScore + "점");
    state.goCount[1] += 1;
    state.lastGoScore[1] = currentScore;
    addLog(state, "CPU " + state.goCount[1] + "고");
  }
  state.turn = actor === 0 ? 1 : 0;
  state.turnNumber += 1;
  state.message = state.turn === 0 ? "내 패를 선택하세요" : "CPU가 계산 중입니다";
  return state;
}

export function playCard(state: GameState, actor: Player, cardId: string) {
  if (state.phase !== "playing" || state.turn !== actor || state.pending) return state;
  const draft = cloneState(state);
  const hand = draft.hands[actor];
  const source = hand.find((card) => card.id === cardId);
  if (!source) return state;
  const sameMonth = hand.filter((card) => card.month === source.month);
  const floorMatch = draft.floor.filter((card) => card.month === source.month);
  if (sameMonth.length >= 3 && floorMatch.length === 1) {
    const bombCards = sameMonth.slice(0, 3);
    const ids = new Set(bombCards.map((card) => card.id));
    draft.hands[actor] = hand.filter((card) => !ids.has(card.id));
    capture(draft, actor, [...bombCards, ...removeFloor(draft, [floorMatch[0].id])]);
    draft.shakeCount[actor] += 1;
    addLog(draft, (actor === 0 ? "나" : "CPU") + " · 폭탄");
    return drawStep(draft, actor);
  }
  draft.hands[actor] = hand.filter((card) => card.id !== cardId);
  if (sameMonth.length === 3) {
    draft.shakeCount[actor] += 1;
    addLog(draft, (actor === 0 ? "나" : "CPU") + " · 흔들기");
  }
  addLog(draft, (actor === 0 ? "나" : "CPU") + " · " + source.month + "월 패 사용");
  const resolved = resolveCard(draft, actor, source, "hand");
  return resolved ? drawStep(draft, actor) : draft;
}

export function chooseFloorCard(state: GameState, floorId: string) {
  if (!state.pending || !state.pending.matchIds.includes(floorId)) return state;
  const draft = cloneState(state);
  const pending = draft.pending!;
  capture(draft, pending.actor, [pending.source, ...removeFloor(draft, [floorId])]);
  draft.pending = null;
  return pending.stage === "hand" ? drawStep(draft, pending.actor) : finalizeTurn(draft, pending.actor);
}

export function cpuTurn(state: GameState) {
  if (state.turn !== 1 || state.phase !== "playing" || state.pending) return state;
  const ranked = [...state.hands[1]].sort((a, b) => {
    const matchA = state.floor.filter((card) => card.month === a.month);
    const matchB = state.floor.filter((card) => card.month === b.month);
    const valueA = matchA.reduce((sum, card) => sum + cardValue(card), 0) + (matchA.length ? cardValue(a) : -cardValue(a));
    const valueB = matchB.reduce((sum, card) => sum + cardValue(card), 0) + (matchB.length ? cardValue(b) : -cardValue(b));
    return valueB - valueA;
  });
  return playCard(state, 1, ranked[0]?.id ?? "");
}

export function chooseGo(state: GameState) {
  if (state.phase !== "decision" || state.turn !== 0) return state;
  const draft = cloneState(state);
  draft.goCount[0] += 1;
  draft.lastGoScore[0] = scoreCards(draft.captures[0]).total;
  draft.phase = "playing";
  draft.turn = 1;
  draft.message = "CPU가 계산 중입니다";
  addLog(draft, "나 · " + draft.goCount[0] + "고");
  return draft;
}

export function chooseStop(state: GameState) {
  if (state.phase !== "decision" || state.turn !== 0) return state;
  return finishGame(cloneState(state), 0, "내가 스톱 · " + scoreCards(state.captures[0]).total + "점");
}

function hasAll(cards: HwatuCard[], ids: string[]) {
  const held = new Set(cards.map((card) => card.id));
  return ids.every((id) => held.has(id));
}

export function scoreCards(cards: HwatuCard[]): ScoreDetail {
  const brightCards = cards.filter((card) => card.kind === "bright");
  const animalCards = cards.filter((card) => card.kind === "animal");
  const ribbonCards = cards.filter((card) => card.kind === "ribbon");
  const junkCards = cards.filter((card) => card.kind === "junk");
  const combos: string[] = [];
  let bright = 0;
  if (brightCards.length === 5) {
    bright = 15;
    combos.push("오광");
  } else if (brightCards.length === 4) {
    bright = 4;
    combos.push("사광");
  } else if (brightCards.length === 3) {
    const hasRain = brightCards.some((card) => card.month === 11);
    bright = hasRain ? 2 : 3;
    combos.push(hasRain ? "비삼광" : "삼광");
  }
  let animal = animalCards.length >= 5 ? animalCards.length - 4 : 0;
  if (hasAll(cards, ["m02-c1", "m04-c1", "m08-c2"])) {
    animal += 5;
    combos.push("고도리");
  }
  let ribbon = ribbonCards.length >= 5 ? ribbonCards.length - 4 : 0;
  const ribbonSets: Array<[string[], string]> = [
    [["m01-c2", "m02-c2", "m03-c2"], "홍단"],
    [["m04-c2", "m05-c2", "m07-c2"], "초단"],
    [["m06-c2", "m09-c2", "m10-c2"], "청단"],
  ];
  ribbonSets.forEach(([ids, label]) => {
    if (hasAll(cards, ids)) {
      ribbon += 3;
      combos.push(label);
    }
  });
  const piCount = junkCards.reduce((sum, card) => sum + card.pi, 0);
  const junk = piCount >= 10 ? piCount - 9 : 0;
  return {
    total: bright + animal + ribbon + junk,
    bright,
    animal,
    ribbon,
    junk,
    combos,
    counts: { bright: brightCards.length, animal: animalCards.length, ribbon: ribbonCards.length, junk: junkCards.length },
    piCount,
  };
}
