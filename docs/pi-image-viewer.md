# Субагент `image-viewer` и авто-переключение моделей llama.cpp

Проектная настройка Pi, при которой визуальные задачи выполняет отдельный субагент на vision-модели `gemma4`, а после его завершения роутер llama.cpp сам возвращает модель родительской сессии (например `ornith-1.0`).

## Из чего состоит

| Файл | Назначение |
|---|---|
| `.pi/agents/image-viewer.md` | Описание субагента для `pi-subagents`. Закреплена модель `llama.cpp/gemma4`, инструменты наследуются от основного агента. |
| `.pi/extensions/llama-model-restore.ts` | Расширение Pi. После завершения любого субагента проверяет роутер и, если модель родительской сессии выгружена, загружает её обратно. |
| `.pi/settings.json` | `agentScope: "both"` и roots для MCP `chrome-devtools`. |

Все три файла лежат в репозитории, поэтому на другом ПК достаточно склонировать проект и настроить окружение по разделу «Установка».

## Как это работает

1. Основной агент вызывает инструмент `subagent` с `agent: "image-viewer"`.
2. `pi-subagents` запускает фоновый дочерний процесс Pi с моделью `llama.cpp/gemma4`.
3. Первый же запрос ребёнка приходит в роутер llama.cpp с `"model":"gemma4"`. Роутер запущен с `--models-max 1` и автозагрузкой, поэтому сам выгружает текущую модель и загружает `gemma4`. Никаких ручных load/unload не нужно.
4. Когда ребёнок завершается, `pi-subagents` публикует событие `subagent:async-complete` (или `subagent:foreground-complete`). Расширение `llama-model-restore` ловит его, смотрит `GET /models` на роутере и, если модель родителя не загружена, шлёт `POST /models/load {"model":"<id родителя>"}`. Роутер выгружает `gemma4` и возвращает исходную модель.
5. Если расширение по какой-то причине не сработало, ничего не ломается: следующий запрос родителя сам заставит роутер переключиться, просто с задержкой на загрузку.

Расширение реагирует только когда модель родительской сессии принадлежит провайдеру `llama.cpp`. Если родитель работает, например, на Anthropic, оно ничего не делает.

## Установка на новом ПК

### 1. llama.cpp router

Нужна сборка `llama-server` с поддержкой router mode (`--models-dir`). Модели раскладываются по подпапкам, имя подпапки становится id модели:

```text
<models-dir>/
├── gemma4/
│   ├── <модель>.gguf
│   └── mmproj-<...>.gguf      # обязателен для vision
└── ornith-1.0/
    └── <модель>.gguf
```

Запуск (важны `--models-max 1` и включённая автозагрузка, она включена по умолчанию, флаг `--no-models-autoload` ставить нельзя):

```bash
./llama-server.exe \
  --models-dir "/g/Resorces/Apps/modells" \
  --models-max 1 \
  --jinja \
  --host 127.0.0.1 \
  --port 8085 \
  -ngl 999 \
  -c 262144 \
  -fa on \
  -ctk q4_0 \
  -ctv q4_0 \
  --batch-size 4096 \
  --ubatch-size 1024
```

Проверка:

```bash
curl http://127.0.0.1:8085/health      # {"status":"ok"}
curl http://127.0.0.1:8085/models      # обе модели со status.value = unloaded/loaded
curl http://127.0.0.1:8085/props       # "role":"router","max_instances":1,"models_autoload":true
```

Если id моделей отличаются от `gemma4` и `ornith-1.0`, поправьте `model:` в `.pi/agents/image-viewer.md` и список моделей в `models.json` ниже.

### 2. Pi и пакеты

```bash
npm i -g @earendil-works/pi-coding-agent
pi install npm:pi-subagents      # инструмент subagent
pi install npm:pi-mcp-adapter    # MCP-инструменты (chrome-devtools) для проверки сайтов
```

MCP-сервер `chrome-devtools` описывается в `~/.pi/agent/mcp.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222", "--allowUnrestrictedPaths"],
      "directTools": true
    }
  }
}
```

Для проверки сайтов Chrome должен быть запущен с `--remote-debugging-port=9222`.

### 3. Провайдер llama.cpp в Pi

Файл `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "llama.cpp": {
      "api": "openai-completions",
      "baseUrl": "http://127.0.0.1:8085/v1",
      "apiKey": "not-needed",
      "models": [
        { "id": "ornith-1.0", "name": "Ornith 1.0", "input": ["text"], "contextWindow": 262144, "maxTokens": 262144 },
        { "id": "gemma4", "name": "Gemma 4", "input": ["text", "image"], "contextWindow": 262144, "maxTokens": 262144 }
      ]
    }
  }
}
```

Затем в интерактивном Pi выполните `/login llama.cpp`, укажите URL `http://127.0.0.1:8085` и **непустой** API key, например `local`. Сервер без `--api-key` принимает любой токен.

Это обязательный шаг. Если оставить ключ пустым, в `auth.json` появится запись без ключа, она перекрывает `apiKey` из `models.json`, и дочерние процессы `pi-subagents` падают с ошибкой `No API key found for llama.cpp`. Основная сессия при этом работает, поэтому ошибка выглядит загадочно. Проверка:

```bash
pi auth check --provider llama.cpp --json    # ожидается "status":"ready"
```

### 4. Проект

Склонируйте репозиторий и откройте его в Pi. Проектные расширения из `.pi/extensions/` загружаются только после того, как проект помечен доверенным (Pi спросит при первом запуске). Проверить, что агент виден:

```text
subagent({ action: "list", capabilities: true })
```

В списке должна быть строка `image-viewer (project) ... Model: llama.cpp/gemma4`.

## Использование

Основной агент делегирует задачу сам, когда нужна визуальная аналитика: анализ изображения или скриншота, проход по сайту и сверка с дизайном, извлечение фактов из картинки. Можно попросить явно:

```text
Через субагент image-viewer проанализируй screenshot.png и опиши, что на нём.
Через image-viewer открой http://localhost:3001 и проверь, соответствует ли страница макету: ...
```

Прямой вызов инструмента:

```json
{ "agent": "image-viewer", "task": "Открой http://localhost:3001, сделай скриншот и опиши элементы, цвета и раскладку." }
```

Агент запускается в фоне (`async: true`), результат приходит уведомлением в родительскую сессию. Фоновый режим обязателен: MCP-инструменты браузера доступны только фоновым дочерним процессам. Для быстрых текстовых проверок можно передать `"async": false`, но тогда браузерных инструментов у ребёнка не будет.

Что происходит с GPU: на время работы субагента загружена `gemma4`, основная модель выгружена. Переключение занимает несколько секунд для `gemma4` и до пары минут для крупной модели при возврате.

## Отладка

Подробный лог расширения:

```bash
LLAMA_RESTORE_DEBUG=1 pi
```

В stderr появятся строки вида `[llama-model-restore] requesting load of ornith-1.0 at http://127.0.0.1:8085` или причина пропуска.

Типичные проблемы:

| Симптом | Причина | Что делать |
|---|---|---|
| `No API key found for llama.cpp` у субагента | пустой ключ в `auth.json` | `/login llama.cpp` с непустым ключом |
| `Model "llama.cpp/gemma4" not found` | нет `models.json` или другой id модели | проверить `models.json` и `curl .../models` |
| Субагент отвечает, что не видит картинку | запуск ушёл на текстовую модель | убедиться, что вызван именно `image-viewer` или передан `model: "llama.cpp/gemma4"` |
| Модель не возвращается после субагента | расширение не загружено (проект не доверен) или роутер недоступен | проверить `LLAMA_RESTORE_DEBUG=1`, `/health` роутера |
| Долгое ожидание при переключении | роутер грузит модель, запросы к другой модели ждут окончания загрузки | это нормально, см. `curl .../models` для статуса `loading` |
