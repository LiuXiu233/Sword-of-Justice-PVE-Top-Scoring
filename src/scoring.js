export const scoringLogicOptions = [
  { id: 'max6000', name: '满分 6000', shortName: '6000' },
  { id: 'max5000', name: '满分 5000', shortName: '5000' },
  { id: 'max2500', name: '满分 2500', shortName: '2500' },
  { id: 'max2500Raid', name: '满分 2500（12 人分档·燃团）', shortName: '燃团2500' },
]

export const defaultProjects = [
  { id: 'realmSix', name: '燃心画境·六人', shortName: '画境六人', logic: 'max2500' },
  { id: 'six', name: '六人本', shortName: '六人本', logic: 'max5000' },
  { id: 'raid123', name: '团本·外', shortName: '团本外', logic: 'max6000' },
  { id: 'raid456', name: '团本·内', shortName: '团本内', logic: 'max6000' },
  { id: 'realmRaid', name: '燃心画境·团本', shortName: '画境团本', logic: 'max2500Raid' },
]

const RANK_MIN = 1
const RANK_MAX = 300

function createSixRankTable(base, rounding = 'round') {
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

function createRaidRankTable() {
  const table = {}
  const head = [6000, 5400, 4800]
  const middle = [4628, 4457, 4285, 4114, 3942, 3770, 3600]
  const tailBase = createRealmRaidReferenceTable()

  for (let rank = RANK_MIN; rank <= RANK_MAX; rank += 1) {
    if (rank <= 36) {
      table[rank] = head[Math.floor((rank - 1) / 12)]
      continue
    }

    if (rank <= 120) {
      table[rank] = middle[Math.floor((rank - 37) / 12)]
      continue
    }

    table[rank] = Math.floor(tailBase[rank] * 2.4)
  }

  return table
}

function createRealmRaidReferenceTable() {
  const table = {}
  const head = [2500, 2250, 2000]
  const middle = [1928, 1857, 1785, 1714, 1642, 1570, 1500]

  for (let rank = RANK_MIN; rank <= RANK_MAX; rank += 1) {
    if (rank <= 36) {
      table[rank] = head[Math.floor((rank - 1) / 12)]
      continue
    }

    if (rank <= 120) {
      table[rank] = middle[Math.floor((rank - 37) / 12)]
      continue
    }

    const block = Math.floor((rank - 121) / 12) + 1
    table[rank] = Math.round(1500 - block * (500 / 15))
  }

  return table
}

export const scoreTables = {
  max6000: createRaidRankTable(),
  max5000: createSixRankTable(5000, 'floor'),
  max2500: createSixRankTable(2500, 'round'),
  max2500Raid: createRealmRaidReferenceTable(),
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
