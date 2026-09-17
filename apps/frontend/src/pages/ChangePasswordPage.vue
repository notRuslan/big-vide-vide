<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const API = '/api'
const TOKEN_KEY = 'token'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

async function handleChangePassword() {
  error.value = ''
  success.value = ''

  // Client-side validation
  if (!oldPassword.value) {
    error.value = 'Введите старый пароль'
    return
  }
  if (!newPassword.value || newPassword.value.length < 6) {
    error.value = 'Новый пароль должен содержать минимум 6 символов'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Новые пароли не совпадают'
    return
  }

  loading.value = true
  try {
    const token = getToken()
    const res = await fetch(`${API}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        oldPassword: oldPassword.value,
        newPassword: newPassword.value,
      }),
    })

    if (res.status === 401) {
      const data = await res.json()
      if (data.error === 'Authorization token required' || data.error === 'Invalid or expired token') {
        localStorage.removeItem(TOKEN_KEY)
        router.push('/login')
        return
      }
      error.value = data.error || 'Неверный старый пароль'
      return
    }

    if (!res.ok) {
      const data = await res.json()
      error.value = data.error || 'Ошибка при смене пароля'
      return
    }

    success.value = 'Пароль успешно изменён!'
    setTimeout(() => {
      router.push('/profile')
    }, 1500)
  } catch (err) {
    console.error('Failed to change password:', err)
    error.value = 'Ошибка сети'
  } finally {
    loading.value = false
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY)
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen gradient-bg flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">🔑 Смена пароля</h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">
              Введите старый и новый пароль
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="router.push('/profile')"
              class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors"
            >
              ← Назад
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
        <div v-if="error" class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {{ error }}
        </div>

        <!-- Success -->
        <div v-if="success" class="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl text-sm">
          {{ success }}
        </div>

        <!-- Form -->
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Старый пароль</label>
            <input
              v-model="oldPassword"
              type="password"
              placeholder="Введите текущий пароль"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Новый пароль</label>
            <input
              v-model="newPassword"
              type="password"
              placeholder="Минимум 6 символов"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              minlength="6"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Подтвердите новый пароль</label>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="Повторите новый пароль"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              minlength="6"
              required
            />
          </div>

          <button
            type="submit"
            class="w-full px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors"
            :disabled="loading"
          >
            {{ loading ? 'Сохраняем...' : '💾 Сохранить пароль' }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
          <router-link to="/profile" class="text-blue-500 hover:text-blue-600 font-medium">← Вернуться в личный кабинет</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
