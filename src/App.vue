<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  defaultProjects,
  formatNumber,
  normalizeRank,
  normalizeScoringLogic,
  pointsForProject,
  scoringLogicOptions,
} from './scoring'

const modes = [
  { id: 'carry', name: '单周 + 上周积分', resultLabel: '两周总积分' },
  { id: 'twoWeeks', name: '两周周成绩', resultLabel: '两周总成绩' },
  { id: 'single', name: '周成绩换积分', resultLabel: '周积分' },
]

const schools = ['碎梦', '神相', '鸿音', '九灵', '龙吟', '沧澜', '铁衣', '素问', '玄机', '血河', '潮光']
const storageKey = 'nishuihan-chief-score-tool'
const archiveStorageKey = 'nishuihan-chief-score-tool-archives'
const activeProjectsStorageKey = 'nishuihan-chief-score-tool-active-projects'
const projectsStorageKey = 'nishuihan-chief-score-tool-projects'
const activeMode = ref('carry')
const lookupRank = ref(1)
const archiveName = ref('')
const selectedArchiveId = ref('')

function cloneProjects(value = defaultProjects) {
  return JSON.parse(JSON.stringify(value))
}

function makeProject(overrides = {}) {
  const id = overrides.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const name = String(overrides.name || '自定义项目').trim() || '自定义项目'
  return {
    id,
    name,
    shortName: String(overrides.shortName || name.slice(0, 4)).trim() || name.slice(0, 4),
    logic: normalizeScoringLogic(overrides.logic || 'max2500'),
  }
}

function normalizeProjects(value) {
  const source = Array.isArray(value) && value.length ? value : defaultProjects
  const seen = new Set()
  const normalized = source
    .map((project) => makeProject(project))
    .filter((project) => {
      if (seen.has(project.id)) {
        return false
      }

      seen.add(project.id)
      return true
    })

  return normalized.length ? normalized : cloneProjects()
}

function loadProjects() {
  try {
    return normalizeProjects(JSON.parse(localStorage.getItem(projectsStorageKey)))
  } catch {
    localStorage.removeItem(projectsStorageKey)
    return cloneProjects()
  }
}

const categories = ref(loadProjects())

function makeWeekRanks(defaultRank = 1, projectList = categories.value) {
  return Object.fromEntries(projectList.map((category) => [category.id, defaultRank]))
}

function normalizeWeekRanks(ranks, fallbackRank = 1, projectList = categories.value) {
  return Object.fromEntries(
    projectList.map((category) => [category.id, normalizeRank(ranks?.[category.id] ?? fallbackRank)]),
  )
}

function makePlayer(index = 1) {
  return {
    id: crypto.randomUUID(),
    name: `玩家${index}`,
    school: schools[0],
    lastPoints: 0,
    weekRanks: makeWeekRanks(),
    week1Ranks: makeWeekRanks(),
    week2Ranks: makeWeekRanks(),
  }
}

function normalizePlayer(player, index = 0, projectList = categories.value) {
  const fallbackRank = player?.weekRank ?? 1
  return {
    ...makePlayer(index + 1),
    ...player,
    id: player?.id || crypto.randomUUID(),
    school: schools.includes(player?.school) ? player.school : schools[0],
    weekRanks: normalizeWeekRanks(player?.weekRanks, fallbackRank, projectList),
    week1Ranks: normalizeWeekRanks(player?.week1Ranks, player?.week1Rank ?? fallbackRank, projectList),
    week2Ranks: normalizeWeekRanks(player?.week2Ranks, player?.week2Rank ?? fallbackRank, projectList),
  }
}

function loadPlayers() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey))
    if (Array.isArray(stored) && stored.length) {
      return stored.map(normalizePlayer)
    }
  } catch {
    localStorage.removeItem(storageKey)
  }

  return [makePlayer(1), makePlayer(2), makePlayer(3)]
}

function clonePlayers(value = players) {
  return JSON.parse(JSON.stringify(value))
}

function formatArchiveTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value || Date.now()))
}

function normalizeArchive(archive, index = 0) {
  const modeIds = modes.map((mode) => mode.id)
  const archiveProjects = normalizeProjects(archive?.projects)
  return {
    id: archive?.id || crypto.randomUUID(),
    name: String(archive?.name || `存档 ${index + 1}`),
    savedAt: Number(archive?.savedAt) || Date.now(),
    activeMode: modeIds.includes(archive?.activeMode) ? archive.activeMode : 'carry',
    lookupRank: normalizeRank(archive?.lookupRank ?? 1),
    projects: archiveProjects,
    activeProjectIds: normalizeActiveProjectIds(archive?.activeProjectIds, archiveProjects),
    players:
      Array.isArray(archive?.players) && archive.players.length
        ? archive.players.map((player, playerIndex) => normalizePlayer(player, playerIndex, archiveProjects))
        : [makePlayer(1)],
  }
}

function loadArchives() {
  try {
    const stored = JSON.parse(localStorage.getItem(archiveStorageKey))
    if (Array.isArray(stored)) {
      return stored.map(normalizeArchive).sort((a, b) => b.savedAt - a.savedAt)
    }
  } catch {
    localStorage.removeItem(archiveStorageKey)
  }

  return []
}

function normalizeActiveProjectIds(value, projectList = categories.value) {
  const validIds = projectList.map((category) => category.id)
  const selectedIds = Array.isArray(value) ? value.filter((id) => validIds.includes(id)) : validIds
  return selectedIds.length ? selectedIds : validIds
}

function loadActiveProjectIds() {
  try {
    return normalizeActiveProjectIds(JSON.parse(localStorage.getItem(activeProjectsStorageKey)))
  } catch {
    localStorage.removeItem(activeProjectsStorageKey)
    return normalizeActiveProjectIds()
  }
}

const players = reactive(loadPlayers())
const archives = ref(loadArchives())
const activeProjectIds = ref(loadActiveProjectIds())

const activeModeMeta = computed(() => modes.find((mode) => mode.id === activeMode.value))
const selectedArchive = computed(() => archives.value.find((archive) => archive.id === selectedArchiveId.value))
const activeProjectCount = computed(() => activeProjectIds.value.length)

function isProjectActive(categoryId) {
  return activeProjectIds.value.includes(categoryId)
}

function toggleProject(categoryId) {
  if (isProjectActive(categoryId)) {
    if (activeProjectIds.value.length === 1) {
      return
    }

    activeProjectIds.value = activeProjectIds.value.filter((id) => id !== categoryId)
    return
  }

  activeProjectIds.value = [...activeProjectIds.value, categoryId]
}

function projectPoints(categoryId, rank) {
  const project = categories.value.find((category) => category.id === categoryId)
  return project && isProjectActive(categoryId) ? pointsForProject(project, rank) : 0
}

function weekTotal(ranks) {
  return categories.value.reduce((total, category) => total + projectPoints(category.id, ranks?.[category.id]), 0)
}

function projectScores(ranks) {
  return categories.value.map((category) => ({
    ...category,
    rank: normalizeRank(ranks?.[category.id]),
    active: isProjectActive(category.id),
    rawPoints: pointsForProject(category, ranks?.[category.id]),
    points: projectPoints(category.id, ranks?.[category.id]),
  }))
}

function resultProjectScores(player) {
  if (activeMode.value === 'twoWeeks') {
    return categories.value.map((category) => ({
      ...category,
      active: isProjectActive(category.id),
      points: isProjectActive(category.id)
        ? pointsForProject(category, player.week1Ranks?.[category.id]) + pointsForProject(category, player.week2Ranks?.[category.id])
        : 0,
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

function playerWeekScores(player) {
  if (activeMode.value === 'carry') {
    return {
      week1: Number(player.lastPoints || 0),
      week2: weekTotal(player.weekRanks),
    }
  }

  if (activeMode.value === 'twoWeeks') {
    return {
      week1: weekTotal(player.week1Ranks),
      week2: weekTotal(player.week2Ranks),
    }
  }

  return {
    week1: weekTotal(player.weekRanks),
    week2: 0,
  }
}

const rankedPlayers = computed(() =>
  players
    .map((player) => {
      const weekScores = playerWeekScores(player)
      return {
        ...player,
        ...weekScores,
        result: playerResult(player),
        resultScores: resultProjectScores(player),
      }
    })
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
  return categories.value.map((category) => ({
    ...category,
    rank,
    points: pointsForProject(category, rank),
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

function syncPlayerRanksToProjects() {
  const validIds = categories.value.map((category) => category.id)

  players.forEach((player) => {
    ;['weekRanks', 'week1Ranks', 'week2Ranks'].forEach((key) => {
      validIds.forEach((id) => {
        if (player[key][id] == null) {
          player[key][id] = 1
        }
      })

      Object.keys(player[key]).forEach((id) => {
        if (!validIds.includes(id)) {
          delete player[key][id]
        }
      })
    })
  })
}

function addProject() {
  const project = makeProject({ name: `自定义项目${categories.value.length + 1}`, logic: 'max2500' })
  categories.value = [...categories.value, project]
  activeProjectIds.value = [...activeProjectIds.value, project.id]

  players.forEach((player) => {
    player.weekRanks[project.id] = 1
    player.week1Ranks[project.id] = 1
    player.week2Ranks[project.id] = 1
  })
}

function removeProject(projectId) {
  if (categories.value.length === 1) {
    return
  }

  categories.value = categories.value.filter((category) => category.id !== projectId)
  activeProjectIds.value = normalizeActiveProjectIds(activeProjectIds.value.filter((id) => id !== projectId))
  syncPlayerRanksToProjects()
}

function resetProjectsToTemplate() {
  categories.value = cloneProjects()
  activeProjectIds.value = categories.value.map((category) => category.id)
  players.splice(0, players.length, ...players.map((player, index) => normalizePlayer(player, index)))
}

function persistArchives() {
  localStorage.setItem(archiveStorageKey, JSON.stringify(archives.value))
}

function saveArchive() {
  const name = archiveName.value.trim() || `存档 ${archives.value.length + 1}`
  const archive = {
    id: crypto.randomUUID(),
    name,
    savedAt: Date.now(),
    activeMode: activeMode.value,
    lookupRank: lookupRank.value,
    projects: cloneProjects(categories.value),
    activeProjectIds: activeProjectIds.value,
    players: clonePlayers(),
  }

  archives.value.unshift(archive)
  selectedArchiveId.value = archive.id
  archiveName.value = ''
  persistArchives()
}

function loadArchive() {
  if (!selectedArchive.value) {
    return
  }

  activeMode.value = selectedArchive.value.activeMode
  lookupRank.value = selectedArchive.value.lookupRank
  categories.value = normalizeProjects(selectedArchive.value.projects)
  activeProjectIds.value = normalizeActiveProjectIds(selectedArchive.value.activeProjectIds)
  players.splice(0, players.length, ...selectedArchive.value.players.map(normalizePlayer))
}

function deleteArchive() {
  if (!selectedArchive.value) {
    return
  }

  const deletingId = selectedArchive.value.id
  archives.value = archives.value.filter((archive) => archive.id !== deletingId)
  selectedArchiveId.value = archives.value[0]?.id || ''
  persistArchives()
}

watch(
  players,
  (value) => {
    localStorage.setItem(storageKey, JSON.stringify(value))
  },
  { deep: true },
)

watch(
  activeProjectIds,
  (value) => {
    localStorage.setItem(activeProjectsStorageKey, JSON.stringify(normalizeActiveProjectIds(value)))
  },
  { deep: true },
)

watch(
  categories,
  (value) => {
    activeProjectIds.value = normalizeActiveProjectIds(activeProjectIds.value)
    syncPlayerRanksToProjects()
    localStorage.setItem(projectsStorageKey, JSON.stringify(value))
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

    <section class="panel project-toggle-panel">
      <div class="section-heading">
        <h2>项目设置</h2>
        <span>{{ activeProjectCount }}/{{ categories.length }} 项参与计算</span>
      </div>

      <div class="project-setting-actions">
        <button class="primary-button" type="button" @click="addProject">添加项目</button>
        <button class="secondary-button" type="button" @click="resetProjectsToTemplate">恢复模板</button>
      </div>

      <div class="project-setting-grid">
        <article v-for="category in categories" :key="category.id" class="project-setting-card">
          <button
            type="button"
            :class="['project-toggle', { active: isProjectActive(category.id) }]"
            @click="toggleProject(category.id)"
          >
            <span>{{ category.name }}</span>
            <strong>{{ isProjectActive(category.id) ? '计分' : '未计' }}</strong>
          </button>

          <label>
            项目名称
            <input v-model.trim="category.name" type="text" />
          </label>

          <label>
            简称
            <input v-model.trim="category.shortName" type="text" />
          </label>

          <label>
            积分逻辑
            <select v-model="category.logic">
              <option v-for="logic in scoringLogicOptions" :key="logic.id" :value="logic.id">
                {{ logic.name }}
              </option>
            </select>
          </label>

          <button
            class="secondary-button danger-button"
            type="button"
            :disabled="categories.length === 1"
            @click="removeProject(category.id)"
          >
            删除
          </button>
        </article>
      </div>
    </section>

    <section class="summary-grid">
      <div class="metric">
        <span>当前模式</span>
        <strong>{{ activeModeMeta.name }}</strong>
      </div>
      <div class="metric">
        <span>每周项目</span>
        <strong>{{ activeProjectCount }} 项计分</strong>
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

    <section class="panel archive-panel">
      <div class="section-heading">
        <h2>存档管理</h2>
        <span>{{ archives.length }} 个存档</span>
      </div>

      <div class="archive-grid">
        <label>
          存档名称
          <input v-model.trim="archiveName" type="text" placeholder="例如：周一首席名单" />
        </label>

        <button class="primary-button" type="button" @click="saveArchive">保存当前</button>

        <label>
          读取存档
          <select v-model="selectedArchiveId">
            <option value="" disabled>请选择存档</option>
            <option v-for="archive in archives" :key="archive.id" :value="archive.id">
              {{ archive.name }} · {{ formatArchiveTime(archive.savedAt) }}
            </option>
          </select>
        </label>

        <div class="archive-actions">
          <button class="secondary-button" type="button" :disabled="!selectedArchive" @click="loadArchive">读取</button>
          <button class="secondary-button danger-button" type="button" :disabled="!selectedArchive" @click="deleteArchive">
            删除
          </button>
        </div>
      </div>

      <p v-if="selectedArchive" class="archive-meta">
        当前选择：{{ selectedArchive.name }}，保存于 {{ formatArchiveTime(selectedArchive.savedAt) }}
      </p>
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
              <label class="school-field">
                流派
                <select v-model="player.school">
                  <option v-for="school in schools" :key="school" :value="school">{{ school }}</option>
                </select>
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
                  <label
                    v-for="category in categories"
                    :key="category.id"
                    :class="['project-field', { inactive: !isProjectActive(category.id) }]"
                  >
                    <span>{{ category.name }}</span>
                    <input v-model.number="player.weekRanks[category.id]" type="number" min="0" max="300" />
                    <em>{{ !isProjectActive(category.id) ? '未计' : normalizeRank(player.weekRanks[category.id]) === 0 ? '无排名' : formatNumber(pointsForProject(category, player.weekRanks[category.id])) }}</em>
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
                  <label
                    v-for="category in categories"
                    :key="category.id"
                    :class="['project-field', { inactive: !isProjectActive(category.id) }]"
                  >
                    <span>{{ category.shortName }}</span>
                    <input v-model.number="player.week1Ranks[category.id]" type="number" min="0" max="300" />
                    <em>{{ !isProjectActive(category.id) ? '未计' : normalizeRank(player.week1Ranks[category.id]) === 0 ? '无排名' : formatNumber(pointsForProject(category, player.week1Ranks[category.id])) }}</em>
                  </label>
                </div>
              </div>

              <div class="week-block">
                <div class="week-title">
                  <strong>第二周五项排名</strong>
                  <span>{{ formatNumber(weekTotal(player.week2Ranks)) }}</span>
                </div>

                <div class="project-grid">
                  <label
                    v-for="category in categories"
                    :key="category.id"
                    :class="['project-field', { inactive: !isProjectActive(category.id) }]"
                  >
                    <span>{{ category.shortName }}</span>
                    <input v-model.number="player.week2Ranks[category.id]" type="number" min="0" max="300" />
                    <em>{{ !isProjectActive(category.id) ? '未计' : normalizeRank(player.week2Ranks[category.id]) === 0 ? '无排名' : formatNumber(pointsForProject(category, player.week2Ranks[category.id])) }}</em>
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
                <th>流派</th>
                <th>第一周积分</th>
                <th>第二周积分</th>
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
                <td>
                  <span class="school-pill">{{ player.school }}</span>
                </td>
                <td class="week-score-cell">{{ formatNumber(player.week1) }}</td>
                <td class="week-score-cell">{{ formatNumber(player.week2) }}</td>
                <td>
                  <div class="mini-score-grid">
                    <span v-for="score in player.resultScores" :key="score.id" :class="{ inactive: !score.active }">
                      <span class="score-full-name">{{ score.name }}</span>
                      <span class="score-short-name">{{ score.shortName }}</span>
                      {{ score.active ? formatNumber(score.points) : '未计' }}
                    </span>
                  </div>
                </td>
                <td class="score-cell">
                  <span>{{ activeModeMeta.resultLabel }}</span>
                  <strong>{{ formatNumber(player.result) }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mobile-quick-results" aria-label="手机端快速结果">
          <div class="quick-result-head">
            <strong>快速结果</strong>
            <span>名次 / 成员 / 流派 / 总分</span>
          </div>

          <ol class="quick-result-list">
            <li v-for="(player, index) in rankedPlayers" :key="player.id">
              <span class="quick-rank">{{ index + 1 }}</span>
              <span class="quick-member">{{ player.name || `玩家${index + 1}` }}</span>
              <span class="quick-school">{{ player.school }}</span>
              <strong>{{ formatNumber(player.result) }}</strong>
            </li>
          </ol>
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
          <input v-model.number="lookupRank" type="number" min="0" max="300" />
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
          <em>{{ score.rank === 0 ? '无排名' : `第 ${score.rank} 名` }}</em>
        </div>
      </div>
    </section>
  </main>
</template>
