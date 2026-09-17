<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''
  loading.value = true
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value.trim(), password: password.value }),
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.error || 'Registration failed'
      return
    }
    localStorage.setItem('token', data.token)
    router.push('/')
  } catch (err) {
    error.value = 'Network error'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen gradient-bg flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-white text-center mb-2">📝 Регистрация</h1>
        <p class="text-gray-500 dark:text-gray-400 text-center mb-6">Создайте новый аккаунт</p>

        <div v-if="error" class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm text-center">
          {{ error }}
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              v-model="username"
              type="text"
              placeholder="2-30 символов, a-z, A-Z, 0-9, _"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              required
              pattern="[a-zA-Z0-9_]{2,30}"
              title="2-30 символов, только буквы, цифры и подчёркивание"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Минимум 6 символов"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              required
              minlength="6"
            />
          </div>
          <button
            type="submit"
            class="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            :disabled="loading"
          >
            {{ loading ? 'Регистрируем...' : 'Зарегистрироваться' }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Уже есть аккаунт? <router-link to="/login" class="text-blue-500 hover:text-blue-600 font-medium">Войти</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
