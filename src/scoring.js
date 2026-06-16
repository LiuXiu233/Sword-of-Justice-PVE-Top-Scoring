export const scoringLogicOptions = [
  { id: 'max6000', name: '满分 6000', shortName: '6000' },
  { id: 'max5000', name: '满分 5000', shortName: '5000' },
  { id: 'max2500', name: '满分 2500', shortName: '2500' },
]

export const defaultProjects = [
  { id: 'realmSix', name: '燃心画境·六人', shortName: '画境六人', logic: 'max2500' },
  { id: 'six', name: '六人本', shortName: '六人本', logic: 'max5000' },
  { id: 'raid123', name: '团本·外', shortName: '团本外', logic: 'max6000' },
  { id: 'raid456', name: '团本·内', shortName: '团本内', logic: 'max6000' },
  { id: 'realmRaid', name: '燃心画境·团本', shortName: '画境团本', logic: 'max2500' },
]

const RANK_MIN = 1
const RANK_MAX = 300

function createRankTable(base, rounding = 'round') {
  const table = {}
  const headStep = base * 0.05
  const tailStart = base * 0.8
  const tailStep = (base * 0.6) / 45

  for (let rank = RANK_MIN; rank <= RANK_MAX; rank += 1) {
    if (rank <= 30) {
      const block = Math.floor((rank - 1) / 6)
      table[rank] = Math.round(base - block * headStep)
      continue
    }

    const block = Math.floor((rank - 31) / 6) + 1
    const raw = tailStart - block * tailStep
    table[rank] = rounding === 'floor' ? Math.floor(raw) : Math.round(raw)
  }

  return table
}

export const scoreTables = {
  max6000: createRankTable(6000, 'floor'),
  max5000: createRankTable(5000, 'floor'),
  max2500: createRankTable(2500, 'round'),
}

export function normalizeRank(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return RANK_MIN
  }

  return Math.min(RANK_MAX, Math.max(RANK_MIN, Math.round(number)))
}

export function normalizeScoringLogic(value) {
  return scoringLogicOptions.some((option) => option.id === value) ? value : scoringLogicOptions[0].id
}

export function pointsForLogic(logicId, rank) {
  const table = scoreTables[normalizeScoringLogic(logicId)]
  return table[normalizeRank(rank)]
}

export function pointsForProject(project, rank) {
  return pointsForLogic(project?.logic, rank)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Math.round(Number(value) || 0))
}
