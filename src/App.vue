<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { categories, formatNumber, normalizeRank, pointsFor } from './scoring'

const modes = [
  { id: 'carry', name: '单周 + 上周积分', resultLabel: '两周总积分' },
  { id: 'twoWeeks', name: '两周周成绩', resultLabel: '两周总成绩' },
  { id: 'single', name: '周成绩换积分', resultLabel: '周积分' },
]

const storageKey = 'nishuihan-chief-score-tool'
const activeMode = ref('carry')
const lookupRank = ref(1)

function makeWeekRanks(defaultRank = 1) {
  return Object.fromEntries(categories.map((category) => [category.id, defaultRank]))
}

function normalizeWeekRanks(ranks, fallbackRank = 1) {
  return Object.fromEntries(
    categories.map((category) => [category.id, normalizeRank(ranks?.[category.id] ?? fallbackRank)]),
  )
}

function makePlayer(index = 1) {
  return {
    id: crypto.randomUUID(),
    name: `玩家${index}`,
    lastPoints: 0,
    weekRanks: makeWeekRanks(),
    week1Ranks: makeWeekRanks(),
    week2Ranks: makeWeekRanks(),
  }
}

function loadPlayers() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey))
    if (Array.isArray(stored) && stored.length) {
      return stored.map((player, index) => {
        const fallbackRank = player.weekRank ?? 1
        return {
          ...makePlayer(index + 1),
          ...player,
          weekRanks: normalizeWeekRanks(player.weekRanks, fallbackRank),
          week1Ranks: normalizeWeekRanks(player.week1Ranks, player.week1Rank ?? fallbackRank),
          week2Ranks: normalizeWeekRanks(player.week2Ranks, player.week2Rank ?? fallbackRank),
        }
      })
    }
  } catch {
    localStorage.removeItem(storageKey)
  }

  return [makePlayer(1), makePlayer(2), makePlayer(3)]
}

const players = reactive(loadPlayers())

const activeModeMeta = computed(() => modes.find((mode) => mode.id === activeMode.value))

function weekTotal(ranks) {
  return categories.reduce((total, category) => total + pointsFor(category.id, ranks?.[category.id]), 0)
}

function projectScores(ranks) {
  return categories.map((category) => ({
    ...category,
    rank: normalizeRank(ranks?.[category.id]),
    points: pointsFor(category.id, ranks?.[category.id]),
  }))
}

function resultProjectScores(player) {
  if (activeMode.value === 'twoWeeks') {
    return categories.map((category) => ({
      ...category,
      points: pointsFor(category.id, player.week1Ranks?.[category.id]) + pointsFor(category.id, player.week2Ranks?.[category.id]),
    }))
  }

  return projectScores(player.weekRanks)
}

function playerResult(player) {
  if (activeMode.value === 'carry') {
    return Number(player.lastPoints || 0) + weekTotal(player.weekRanks)
  }

  if (activeMode.value === 'twoWeeks') {
    return weekTotal(player.week1Ranks) + weekTotal(player.week2Ranks)
  }

  return weekTotal(player.weekRanks)
}

function playerBreakdown(player) {
  if (activeMode.value === 'carry') {
    return `${formatNumber(player.lastPoints)} + ${formatNumber(weekTotal(player.weekRanks))}`
  }

  if (activeMode.value === 'twoWeeks') {
    return `${formatNumber(weekTotal(player.week1Ranks))} + ${formatNumber(weekTotal(player.week2Ranks))}`
  }

  return `${categories.length} 项合计`
}

const rankedPlayers = computed(() =>
  players
    .map((player) => ({
      ...player,
      result: playerResult(player),
      breakdown: playerBreakdown(player),
      resultScores: resultProjectScores(player),
    }))
    .sort((a, b) => b.result - a.result || a.name.localeCompare(b.name, 'zh-CN')),
)

const bestPlayer = computed(() => rankedPlayers.value[0])
const averageScore = computed(() => {
  if (!players.length) {
    return 0
  }

  return rankedPlayers.value.reduce((total, player) => total + player.result, 0) / players.length
})

const lookupScores = computed(() => {
  const rank = normalizeRank(lookupRank.value)
  return categories.map((category) => ({
    ...category,
    rank,
    points: pointsFor(category.id, rank),
  }))
})
const lookupTotal = computed(() => lookupScores.value.reduce((total, score) => total + score.points, 0))

function addPlayer() {
  players.push(makePlayer(players.length + 1))
}

function removePlayer(id) {
  if (players.length === 1) {
    Object.assign(players[0], makePlayer(1))
    return
  }

  const index = players.findIndex((player) => player.id === id)
  if (index > -1) {
    players.splice(index, 1)
  }
}

function resetPlayers() {
  players.splice(0, players.length, makePlayer(1), makePlayer(2), makePlayer(3))
}

watch(
  players,
  (value) => {
    localStorage.setItem(storageKey, JSON.stringify(value))
  },
  { deep: true },
)
</script>

<template>
  <main class="app-shell">
    <section class="toolbar">
      <div>
        <p class="eyebrow">逆水寒副本首席</p>
        <h1>记分与多人对比</h1>
      </div>

      <div class="toolbar-actions">
        <button class="secondary-button" type="button" @click="resetPlayers">重置</button>
        <button class="primary-button" type="button" @click="addPlayer">添加成员</button>
      </div>
    </section>

    <section class="mode-tabs" aria-label="计算模式">
      <button
        v-for="mode in modes"
        :key="mode.id"
        type="button"
        :class="{ active: activeMode === mode.id }"
        @click="activeMode = mode.id"
      >
        {{ mode.name }}
      </button>
    </section>

    <section class="summary-grid">
      <div class="metric">
        <span>当前模式</span>
        <strong>{{ activeModeMeta.name }}</strong>
      </div>
      <div class="metric">
        <span>每周项目</span>
        <strong>{{ categories.length }} 项合计</strong>
      </div>
      <div class="metric">
        <span>最高成员</span>
        <strong>{{ bestPlayer?.name || '-' }}</strong>
      </div>
      <div class="metric">
        <span>{{ activeModeMeta.resultLabel }}均值</span>
        <strong>{{ formatNumber(averageScore) }}</strong>
      </div>
    </section>

    <section class="workspace-grid">
      <div class="panel input-panel">
        <div class="section-heading">
          <h2>录入成绩</h2>
          <span>{{ players.length }} 人</span>
        </div>

        <div class="player-list">
          <article v-for="(player, index) in players" :key="player.id" class="player-row">
            <div class="row-head">
              <label>
                成员
                <input v-model.trim="player.name" type="text" :placeholder="`玩家${index + 1}`" />
              </label>
              <button class="icon-button" type="button" title="移除成员" @click="removePlayer(player.id)">×</button>
            </div>

            <div v-if="activeMode !== 'twoWeeks'" class="week-editor">
              <label v-if="activeMode === 'carry'" class="carry-input">
                上周积分
                <input v-model.number="player.lastPoints" type="number" min="0" />
              </label>

              <div class="week-block">
                <div class="week-title">
                  <strong>本周五项排名</strong>
                  <span>{{ formatNumber(weekTotal(player.weekRanks)) }}</span>
                </div>

                <div class="project-grid">
                  <label v-for="category in categories" :key="category.id" class="project-field">
                    <span>{{ category.name }}</span>
                    <input v-model.number="player.weekRanks[category.id]" type="number" min="1" max="300" />
                    <em>{{ formatNumber(pointsFor(category.id, player.weekRanks[category.id])) }}</em>
                  </label>
                </div>
              </div>
            </div>

            <div v-else class="week-editor two-week-editor">
              <div class="week-block">
                <div class="week-title">
                  <strong>第一周五项排名</strong>
                  <span>{{ formatNumber(weekTotal(player.week1Ranks)) }}</span>
                </div>

                <div class="project-grid">
                  <label v-for="category in categories" :key="category.id" class="project-field">
                    <span>{{ category.shortName }}</span>
                    <input v-model.number="player.week1Ranks[category.id]" type="number" min="1" max="300" />
                    <em>{{ formatNumber(pointsFor(category.id, player.week1Ranks[category.id])) }}</em>
                  </label>
                </div>
              </div>

              <div class="week-block">
                <div class="week-title">
                  <strong>第二周五项排名</strong>
                  <span>{{ formatNumber(weekTotal(player.week2Ranks)) }}</span>
                </div>

                <div class="project-grid">
                  <label v-for="category in categories" :key="category.id" class="project-field">
                    <span>{{ category.shortName }}</span>
                    <input v-model.number="player.week2Ranks[category.id]" type="number" min="1" max="300" />
                    <em>{{ formatNumber(pointsFor(category.id, player.week2Ranks[category.id])) }}</em>
                  </label>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div class="panel result-panel">
        <div class="section-heading">
          <h2>对比结果</h2>
          <span>{{ activeModeMeta.resultLabel }}</span>
        </div>

        <div class="result-table-wrap">
          <table class="result-table">
            <thead>
              <tr>
                <th>名次</th>
                <th>成员</th>
                <th>计算</th>
                <th>项目明细</th>
                <th>{{ activeModeMeta.resultLabel }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(player, index) in rankedPlayers" :key="player.id">
                <td>
                  <span class="rank-pill">{{ index + 1 }}</span>
                </td>
                <td>{{ player.name || `玩家${index + 1}` }}</td>
                <td>{{ player.breakdown }}</td>
                <td>
                  <div class="mini-score-grid">
                    <span v-for="score in player.resultScores" :key="score.id">
                      {{ score.shortName }} {{ formatNumber(score.points) }}
                    </span>
                  </div>
                </td>
                <td class="score-cell">{{ formatNumber(player.result) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="panel rule-panel">
      <div class="section-heading">
        <h2>积分速查</h2>
        <span>输入排名查看五项</span>
      </div>

      <div class="lookup-grid">
        <label>
          排名
          <input v-model.number="lookupRank" type="number" min="1" max="300" />
        </label>

        <div class="lookup-score">
          <span>五项合计</span>
          <strong>{{ formatNumber(lookupTotal) }}</strong>
        </div>
      </div>

      <div class="lookup-result-grid">
        <div v-for="score in lookupScores" :key="score.id" class="lookup-card">
          <span>{{ score.name }}</span>
          <strong>{{ formatNumber(score.points) }}</strong>
          <em>第 {{ score.rank }} 名</em>
        </div>
      </div>
    </section>
  </main>
</template>
