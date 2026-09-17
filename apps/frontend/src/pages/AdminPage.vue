<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const users = ref([])
const loading = ref(false)
const currentUser = ref(null) // { username, isAdmin }
const selectedUser = ref(null) // For editing
const editForm = ref({ username: '', is_admin: false, password: '' })
const saveLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

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
    } else {
      localStorage.removeItem(TOKEN_KEY)
      router.push('/login')
    }
  } catch (err) {
    console.error('Failed to fetch current user:', err)
  }
}

async function fetchUsers() {
  const token = getToken()
  if (!token) return
  loading.value = true
  try {
    const res = await fetch(`${API}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      router.push('/login')
      return
    }
    if (res.status === 403) {
      router.push('/')
      return
    }
    if (!res.ok) {
      const data = await res.json()
      errorMessage.value = data.error || 'Failed to load users'
      return
    }
    users.value = await res.json()
  } catch (err) {
    console.error('Failed to fetch users:', err)
    errorMessage.value = 'Network error'
  } finally {
    loading.value = false
  }
}

function openEdit(user) {
  selectedUser.value = user
  editForm.value = {
    username: user.username,
    is_admin: !!user.isAdmin,
    password: '',
  }
  errorMessage.value = ''
  successMessage.value = ''
}

function closeEdit() {
  selectedUser.value = null
  editForm.value = { username: '', is_admin: false, password: '' }
  errorMessage.value = ''
  successMessage.value = ''
}

async function saveUser() {
  const token = getToken()
  if (!selectedUser.value) return
  saveLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const body = {}
    if (editForm.value.username) body.username = editForm.value.username
    if (editForm.value.password) body.password = editForm.value.password
    body.is_admin = editForm.value.is_admin

    const res = await fetch(`${API}/admin/users/${selectedUser.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    })

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      router.push('/login')
      return
    }
    if (res.status === 403) {
      router.push('/')
      return
    }

    if (!res.ok) {
      const data = await res.json()
      errorMessage.value = data.error || 'Failed to update user'
      return
    }

    successMessage.value = 'User updated successfully!'
    await fetchUsers()
    setTimeout(() => {
      closeEdit()
    }, 1500)
  } catch (err) {
    console.error('Failed to update user:', err)
    errorMessage.value = 'Network error'
  } finally {
    saveLoading.value = false
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY)
  router.push('/login')
}

onMounted(() => {
  fetchCurrentUser()
  fetchUsers()
})
</script>

<template>
  <div class="min-h-screen gradient-bg flex items-center justify-center p-4">
    <div class="w-full max-w-3xl">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">👑 Admin Panel</h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">
              Управление пользователями
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

        <!-- Error -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {{ errorMessage }}
        </div>

        <!-- Success -->
        <div v-if="successMessage" class="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl text-sm">
          {{ successMessage }}
        </div>

        <!-- Users List -->
        <div v-if="!selectedUser">
          <div v-if="loading" class="text-center py-8 text-gray-400 dark:text-gray-500">
            <p class="text-2xl">⏳</p>
            <p>Загрузка...</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="user in users"
              :key="user.id"
              @click="openEdit(user)"
              class="user-card flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
            >
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                {{ user.username[0].toUpperCase() }}
              </div>
              <div class="flex-1">
                <p class="font-medium text-gray-800 dark:text-white">{{ user.username }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ user.isAdmin ? '👑 Администратор' : '👤 Пользователь' }}
                </p>
              </div>
              <span class="text-gray-400 dark:text-gray-500">→</span>
            </div>

            <div v-if="users.length === 0" class="text-center py-8 text-gray-400 dark:text-gray-500">
              <p class="text-4xl mb-2">👥</p>
              <p>Нет пользователей</p>
            </div>
          </div>
        </div>

        <!-- Edit User Form -->
        <div v-else>
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white">
              ✏️ Редактирование: {{ selectedUser.username }}
            </h2>
            <button
              @click="closeEdit"
              class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors"
            >
              ← Назад
            </button>
          </div>

          <div class="space-y-4">
            <!-- Username -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input
                v-model="editForm.username"
                type="text"
                placeholder="2-30 символов, a-z, A-Z, 0-9, _"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                pattern="[a-zA-Z0-9_]{2,30}"
              />
            </div>

            <!-- Password -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Новый пароль</label>
              <input
                v-model="editForm.password"
                type="password"
                placeholder="Минимум 6 символов (или оставьте пустым)"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                minlength="6"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Оставьте пустым, чтобы не менять пароль
              </p>
            </div>

            <!-- Admin toggle -->
            <div class="flex items-center gap-3">
              <input
                v-model="editForm.is_admin"
                type="checkbox"
                id="isAdmin"
                class="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-400"
              />
              <label for="isAdmin" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                👑 Администратор
              </label>
            </div>

            <!-- Save -->
            <button
              @click="saveUser"
              :disabled="saveLoading"
              class="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors"
            >
              {{ saveLoading ? 'Сохраняем...' : '💾 Сохранить' }}
            </button>
          </div>
        </div>

        <p class="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
          ✨ Вы: <strong>{{ currentUser?.username || '...' }}</strong>
          <span v-if="currentUser?.isAdmin"> (Admin)</span>
        </p>
      </div>
    </div>
  </div>
</template>
