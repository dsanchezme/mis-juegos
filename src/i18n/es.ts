import type { ScoringPart } from "../games/ambicioso/rules/score";

/** Spanish texts. `en.ts` must provide the same keys (enforced by the `Texts` type). */
export const es = {
  locale: "es-CO",
  appName: "Mis juegos",

  common: {
    back: "‹ Atrás",
    backToGames: "‹ Mis juegos",
    cancel: "Cancelar",
    add: "Agregar",
    name: "Nombre",
    remove: "Quitar",
    soon: "Pronto",
    nextGame: "Próximo juego",
    pause: "Pausar",
  },

  nav: { games: "Juegos", history: "Historial", players: "Jugadores", settings: "Ajustes", sections: "Secciones" },

  home: {
    continue: "Continuar",
    resume: "Seguir ›",
    games: "Juegos",
    installTitle: "Instalar Mis juegos",
    installBody: "Queda como app en tu teléfono y funciona sin internet.",
    install: "Instalar",
  },

  players: {
    title: "Jugadores",
    intro:
      "Las personas con las que has jugado, para no escribir el nombre cada vez. Al crear una partida eliges quién juega hoy.",
    games: (n: number) => (n === 1 ? "1 partida" : `${n} partidas`),
    empty: "Todavía no hay jugadores. Agrega el primero aquí o al crear una partida.",
    changeColor: (name: string) => `Cambiar color de ${name}`,
    removeLabel: (name: string) => `Quitar a ${name}`,
    unnamed: "Sin nombre",
  },

  history: {
    title: "Historial",
    empty: "Aquí aparecerán las partidas terminadas.",
    wins: (n: number) => (n === 1 ? "1 victoria" : `${n} victorias`),
    noWinner: "Terminada sin ganador",
    won: (name: string) => `${name} ganó`,
    tie: (names: string) => `Empate: ${names}`,
    today: "Hoy",
    yesterday: "Ayer",
  },

  settings: {
    title: "Ajustes",
    language: "Idioma",
    sound: "Sonido",
    vibration: "Vibración",
    noVibration: "Este equipo no permite vibrar",
    shake: "Agitar para lanzar",
    shakeHint: "Siempre puedes tocar el botón para lanzar",
    noShake: "Este equipo no tiene sensor de movimiento",
    defaultStarter: "Quién empieza, por defecto",
    clearHistory: "Borrar historial",
    clearConfirm: "¿Borrar todo el historial de partidas?",
    clearDetail: "No se puede deshacer. Los jugadores se conservan.",
    clear: "Borrar",
    localOnly: "Todo se guarda solo en este teléfono.",
  },

  starters: {
    fingers: "Dedos en la pantalla",
    spinner: "Ruleta",
    duel: "Duelo de dados",
    random: "Al azar",
    list: "Orden de la lista",
  },

  whoStarts: {
    title: "¿Quién empieza?",
    starts: "Empieza",
    startGame: "Empezar la partida",
    fingersPlace: "Todos pongan un dedo aquí",
    fingersOneMore: "Falta al menos otro dedo",
    fingersHold: "Quietos…",
    fingersPicked: "¡Ese dedo empieza!",
    whoseFinger: "¿De quién es el dedo?",
    again: "Repetir",
    fingersHint: "Cuando haya 2 o más dedos quietos, cuenta 3, 2, 1 y elige uno.",
    startsName: (name: string) => `Empieza ${name}`,
    spinAgain: "Girar otra vez",
    spinning: "Girando…",
    spin: "Girar",
    duelTitle: "Duelo de dados",
    duelIntro: "Cada uno lanza un dado. El más alto empieza.",
    tieBetween: (names: string) => `Empate entre ${names}`,
    tieRoll: "Desempatan solo ellos",
    rollYourDie: (name: string, shake: boolean) =>
      `${name}, ${shake ? "agita o toca para lanzar" : "toca para lanzar"}`,
    tieBreak: (names: string) => `Empate: desempatan ${names}`,
  },

  /** Joins names: "Ana, Diego y Caro". */
  join: (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`),

  ambicioso: {
    name: "Ambicioso",
    tagline: "Dados · 2+ jugadores",

    newGame: "Nueva partida",
    whoPlays: "¿Quién juega hoy?",
    addNew: "Agregar a alguien nuevo",
    oneMore: "Falta al menos un jugador más.",
    moveUp: (n: string) => `Subir a ${n}`,
    moveDown: (n: string) => `Bajar a ${n}`,
    target: "Meta",
    other: "Otra…",
    invalidTarget: "La meta debe ser un múltiplo de 50, por ejemplo 2.500.",
    reachOrPass: "Llegar o pasar",
    exact: "Exacta",
    exactHint: "Hay que llegar justo a la meta. Si te pasas, pierdes lo acumulado en el turno.",
    reachHint: "Basta con llegar a la meta o pasarla.",
    roundEndsHint: "Al alcanzarla, se termina la ronda.",
    whoStarts: "¿Quién empieza?",
    start: "Empezar",

    resumeTitle: "Tienes una partida a medias",
    startedAgo: (ago: string) => `Ambicioso · empezó ${ago}`,
    minutesAgo: (n: number) => `hace ${n} min`,
    hoursAgo: (n: number) => `hace ${n} h`,
    daysAgo: (n: number) => `hace ${n} días`,
    whoseTurn: (n: string) => `Le toca a ${n}`,
    turnSoFar: (pts: string) => `, lleva ${pts} en el turno`,
    justLost: ", acaba de perder su turno",
    resume: "Retomar",
    newInstead: "Empezar una nueva",
    discardConfirm: "¿Empezar otra? La partida a medias se descarta al empezar la nueva.",
    discardYes: "Sí, empezar otra",
    pendingSummary: (n: string) => `le toca a ${n}`,

    round: (n: number) => `Ronda ${n}`,
    targetLabel: (exact: boolean, pts: string) => `Meta ${exact ? "exacta " : ""}${pts}`,
    showScores: "Ver marcador",
    turnOf: (n: string) => `Turno de ${n}`,

    lastRound: "Última ronda",
    lastRoundBody: (who: string, pts: string, rest: string, many: boolean) =>
      `${who} llegó a ${pts}. ${rest} ${many ? "tienen" : "tiene"} un último turno.`,
    passTo: "Pásale el teléfono a",
    hasNeedsExact: (has: string, need: string) => `Tiene ${has} · necesita exactamente ${need}`,
    hasNeedsLead: (has: string, need: string) => `Tiene ${has} · necesita ${need} para quedar de primero`,
    hasMissing: (has: string, miss: string) => `Tiene ${has} · le faltan ${miss}`,
    lastTurn: "Último turno",
    ready: "Estoy listo",
    readyRoll: "Estoy listo · lanzar",

    dice: (n: number) => (n === 1 ? "1 dado" : `${n} dados`),
    shakeToRoll: "Agita para lanzar",
    shakeHint: "Los dados caen cuando dejas de agitar.",
    tapToRoll: "O toca aquí para lanzar",
    shaking: "Agitando…",
    rolling: "Lanzando…",
    turnTotal: "Acumulado del turno",
    rollN: (n: number) => `Lanzamiento ${n}`,
    hotDice: "¡mano llena!",
    hotDiceBody: "Todos sumaron: recuperas los 4 dados. ",
    ifYouBank: (from: string, to: string) => `Si te plantas: ${from} → ${to}`,
    exactHit: "¡Justo la meta! Plántate para ganar.",
    reachesTarget: "Si te plantas alcanzas la meta.",
    exactMissing: (pts: string) => `Te faltarían ${pts} para la meta exacta.`,
    keepRolling: (n: number, shake: boolean) =>
      `Seguir · ${shake ? "agita o toca para " : ""}lanzar ${n === 1 ? "1 dado" : `${n} dados`}`,
    bank: (pts: string) => `Plantarme y anotar ${pts}`,

    part: (p: ScoringPart, fmt: (n: number) => string) =>
      p.kind === "single"
        ? `${p.count === 1 ? "un" : p.count} ${p.face} = ${fmt(p.points)}`
        : `${p.kind === "four" ? "cuatro" : "tres"} ${p.face} = ${fmt(p.points)}`,

    bust: "¡Sancocho!",
    overshot: "¡Te pasaste!",
    bustBody: (name: string, pts: string) => `Ningún dado sirvió. ${name} se queda con ${pts}.`,
    overshotBody: (had: string, lost: string, would: string, name: string) =>
      `Tenías ${had} + ${lost} acumulados. Este lanzamiento te llevaba a ${would}. ${name} se queda con ${had}.`,
    seeWinner: "Ver quién ganó",
    passTurn: (n: string) => `Pasar el turno a ${n}`,

    endOfRound: (n: number) => `Fin de la ronda ${n}`,
    wins: (n: string) => `¡${n} gana!`,
    tieWin: (names: string) => `¡Empate! Ganan ${names}`,
    winnerStats: (turns: number, best: string) => `${turns} turnos · su mejor turno: ${best}`,
    rematch: "Revancha (mismos jugadores)",
    changeSetup: "Cambiar jugadores o meta",
    backHome: "Volver a Mis juegos",

    paused: "Partida en pausa",
    pausedTurn: (n: string) => `Turno de ${n}`,
    pausedProgress: (pts: string, dice: string) => `Acumulado ${pts} · quedan ${dice}`,
    notRolledYet: "Todavía no ha lanzado",
    keepPlaying: "Seguir jugando",
    rules: "Reglas",
    soundVibration: "Sonido y vibración",
    exitSaved: "Salir (queda guardada)",
    endNoWinner: "Terminar partida sin ganador",
    endConfirm: "¿Terminar la partida sin ganador?",
    endDetail: "Quedará en el historial como terminada sin ganador.",
    end: "Terminar",

    scoreboard: "Marcador",
    backToGame: "‹ Volver al juego",
    log: "Historial",
    noTurns: "Todavía no hay turnos.",
    logBanked: (n: string, pts: string, total: string) => `${n} se plantó con ${pts} → ${total}`,
    logOvershot: (n: string, pts: string) => `${n} se pasó y perdió ${pts}`,
    logSkipped: (n: string) => `${n} no jugó su turno`,
    logBust: (n: string, pts: string | null) => `${n} sacó sancocho${pts ? ` y perdió ${pts}` : ""}`,
    roundShort: (n: number) => `R${n}`,

    historyDetail: (exact: boolean, target: string, finished: boolean, rounds: number) =>
      `meta ${exact ? "exacta " : ""}${target} · ${finished ? `${rounds} rondas` : `ronda ${rounds}`}`,

    rulesTitle: "Reglas de Ambicioso",
    rulesList: [
      "Se lanzan 4 dados. Cada 1 vale 100 y cada 5 vale 50.",
      "Tres iguales valen el número × 100 (tres 4 = 400). Tres 1 valen 1.000.",
      "Cuatro iguales valen el número × 1.000. Cuatro 1 valen 10.000.",
      "Los tríos y pókeres cuentan solo si salen en el mismo lanzamiento. Todos los dados que suman se apartan.",
      "Después de cada lanzamiento decides: plantarte y anotar lo acumulado, o seguir con los dados que quedan.",
      "Si ningún dado sirve es sancocho: pierdes todo lo acumulado en el turno.",
      "Si todos los dados que lanzaste sumaron (mano llena), vuelves a tener los 4.",
      "Con meta exacta, si te pasas de la meta pierdes lo acumulado en el turno.",
      "Cuando alguien alcanza la meta, se termina la ronda. Gana quien tenga más puntos; si hay empate, ganan los empatados.",
    ],
  },
};

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : T extends (...a: infer A) => infer R
      ? (...a: A) => R
      : { [K in keyof T]: Widen<T[K]> };
export type Texts = Widen<typeof es>;
