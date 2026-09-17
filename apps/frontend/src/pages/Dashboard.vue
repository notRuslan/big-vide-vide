<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const todos = ref([])
const newTodo = ref('')
const filter = ref('all')
const darkMode = ref(false)
const loading = ref(false)
const username = ref('')
const isAdmin = ref(false)
const meLoading = ref(false)

const API = '/api'
const TOKEN_KEY = 'token'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

// ─── Auth helpers ──────────────────────────────────────────────

async function fetchCurrentUser() {
  const token = getToken()
  if (!token) return
  meLoading.value = true
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      username.value = data.username
      isAdmin.value = !!data.isAdmin
    } else {
      // Token invalid — logout
      localStorage.removeItem(TOKEN_KEY)
      router.push('/login')
    }
  } catch (err) {
    console.error('Failed to fetch current user:', err)
  } finally {
    meLoading.value = false
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY)
  router.push('/login')
}

// ─── API helpers ───────────────────────────────────────────────

async function fetchTodos() {
  const token = getToken()
  if (!token) return
  loading.value = true
  try {
    const res = await fetch(`${API}/todos`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      router.push('/login')
      return
    }
    todos.value = await res.json()
  } catch (err) {
    console.error('Failed to fetch todos:', err)
  } finally {
    loading.value = false
  }
}

async function addTodo() {
  const text = newTodo.value.trim()
  if (!text) return
  const token = getToken()

  try {
    const res = await fetch(`${API}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text }),
    })
    if (res.ok) {
      newTodo.value = ''
      await fetchTodos()
    }
  } catch (err) {
    console.error('Failed to add todo:', err)
  }
}

async function toggleTodo(todo) {
  const token = getToken()
  try {
    const res = await fetch(`${API}/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ completed: !todo.completed }),
    })
    if (res.ok) await fetchTodos()
  } catch (err) {
    console.error('Failed to toggle todo:', err)
  }
}

async function removeTodo(id) {
  const token = getToken()
  try {
    const res = await fetch(`${API}/todos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) await fetchTodos()
  } catch (err) {
    console.error('Failed to delete todo:', err)
  }
}

async function clearCompleted() {
  const token = getToken()
  try {
    const res = await fetch(`${API}/todos/completed`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) await fetchTodos()
  } catch (err) {
    console.error('Failed to clear completed:', err)
  }
}

// ─── Theme ─────────────────────────────────────────────────────

onMounted(() => {
  const savedDark = localStorage.getItem('darkMode')
  if (savedDark) darkMode.value = JSON.parse(savedDark)
  if (darkMode.value) {
    document.documentElement.classList.add('dark')
  }
  fetchCurrentUser()
  fetchTodos()
})

function toggleDark() {
  darkMode.value = !darkMode.value
  localStorage.setItem('darkMode', JSON.stringify(darkMode.value))
  if (darkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// ─── Computed ──────────────────────────────────────────────────

const filteredTodos = computed(() => {
  switch (filter.value) {
    case 'active': return todos.value.filter(t => !t.completed)
    case 'completed': return todos.value.filter(t => t.completed)
    default: return todos.value
  }
})

const completedCount = computed(() => todos.value.filter(t => t.completed).length)
const remainingCount = computed(() => todos.value.length - completedCount.value)

// ─── Keyboard ──────────────────────────────────────────────────

function handleKeydown(e) {
  if (e.key === 'Enter') addTodo()
}
</script>

<template>
  <div class="min-h-screen gradient-bg flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">📝 Todo List</h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">
              <span v-if="username">Привет, <strong>{{ username }}</strong>!</span>
              <span v-else>Организуй свой день</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="toggleDark"
              class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl hover:scale-110 transition-transform"
              title="Тёмная тема"
            >
              🌙
            </button>
            <button
              v-if="isAdmin"
              @click="router.push('/admin')"
              class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              👑 Админ-панель
            </button>
            <button
              @click="logout"
              class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>

        <!-- Input -->
        <div class="flex gap-2 mb-6">
          <input
            v-model="newTodo"
            @keydown="handleKeydown"
            type="text"
            placeholder="Добавить задачу..."
            class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <button
            @click="addTodo"
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            :disabled="loading"
          >
            Добавить
          </button>
        </div>

        <!-- Filters -->
        <div class="flex gap-2 mb-4">
          <button
            v-for="f in ['all', 'active', 'completed']"
            :key="f"
            @click="filter = f"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition',
              filter === f
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            ]"
          >
            {{ f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Выполненные' }}
          </button>
        </div>

        <!-- Todo List -->
        <div class="space-y-2 mb-4">
          <div
            v-if="filteredTodos.length === 0 && !loading"
            class="text-center py-8 text-gray-400 dark:text-gray-500"
          >
            <p class="text-4xl mb-2">🎯</p>
            <p>Нет задач</p>
            <p class="text-sm mt-1">Добавьте свою первую задачу!</p>
          </div>

          <div
            v-for="todo in filteredTodos"
            :key="todo.id"
            class="todo-item flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <button
              @click="toggleTodo(todo)"
              :class="[
                'w-6 h-6 rounded-full border-2 flex items-center justify-center transition',
                todo.completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 dark:border-gray-500 hover:border-green-400'
              ]"
            >
              <span v-if="todo.completed" class="text-sm">✓</span>
            </button>

            <span
              :class="[
                'flex-1 text-gray-800 dark:text-white transition',
                todo.completed ? 'line-through opacity-50' : ''
              ]"
            >
              {{ todo.text }}
            </span>

            <button
              @click="removeTodo(todo.id)"
              class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Осталось задач: <span class="font-medium text-blue-500">{{ remainingCount }}</span>
          </p>
          <button
            v-if="completedCount > 0"
            @click="clearCompleted"
            class="text-sm text-red-500 hover:text-red-600 font-medium transition"
          >
            Очистить выполненные
          </button>
        </div>

        <p class="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
          ✨ Данные сохраняются в БД
        </p>
      </div>
    </div>
  </div>
</template>
