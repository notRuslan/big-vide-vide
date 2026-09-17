<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const username = ref('')
const isAdmin = ref(false)
const totalTodos = ref(0)
const loading = ref(false)
const currentUser = ref(null)

const API = '/api'
const TOKEN_KEY = 'token'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

async function fetchCurrentUser() {
  const token = getToken()
  if (!token) return
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) {
      currentUser.value = await res.json()
      username.value = currentUser.value.username
      isAdmin.value = !!currentUser.value.isAdmin
    } else {
      localStorage.removeItem(TOKEN_KEY)
      router.push('/login')
    }
  } catch (err) {
    console.error('Failed to fetch current user:', err)
  }
}

async function fetchTodoCount() {
  const token = getToken()
  if (!token) return
  loading.value = true
  try {
    const res = await fetch(`${API}/todos`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) {
      const todos = await res.json()
      totalTodos.value = todos.length
    } else if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      router.push('/login')
    }
  } catch (err) {
    console.error('Failed to fetch todos:', err)
  } finally {
    loading.value = false
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY)
  router.push('/login')
}

onMounted(() => {
  fetchCurrentUser()
  fetchTodoCount()
})
</script>

<template>
  <div class="min-h-screen gradient-bg flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">👤 Личный кабинет</h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">
              Информация о вашем аккаунте
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="router.push('/')"
              class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              📝 Dashboard
            </button>
            <button
              @click="logout"
              class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>

        <!-- User Info -->
        <div class="space-y-4">
          <div class="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
              {{ username[0]?.toUpperCase() || '?' }}
            </div>
            <div>
              <p class="font-medium text-gray-800 dark:text-white text-lg">{{ username }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ isAdmin ? '👑 Администратор' : '👤 Пользователь' }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Всего задач</p>
              <p class="text-2xl font-bold text-blue-500">
                {{ loading ? '...' : totalTodos }}
              </p>
            </div>
            <span class="text-3xl">📋</span>
          </div>

          <!-- Change password button -->
          <button
            @click="router.push('/change-password')"
            class="w-full px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors text-center"
          >
            🔑 Сменить пароль
          </button>
        </div>

        <p class="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
          ✨ Данные сохраняются в БД
        </p>
      </div>
    </div>
  </div>
</template>
