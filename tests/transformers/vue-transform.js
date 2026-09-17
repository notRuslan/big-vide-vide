/**
 * Трансформер для .vue файлов в Jest (ESM).
 * Минимальный: извлекает script в экспорт.
 */

export default {
  process(source) {
    // Извлекаем <script setup> content
    const setupMatch = source.match(
      /<script\s+setup[^>]*>([\s\S]*?)<\/script>/
    );

    if (setupMatch) {
      const scriptContent = setupMatch[1].trim();
      return {
        code: `
          // Vue SFC with <script setup> — Jest transformer
          const __component = { __name: 'SFC' };
          export default __component;
        `,
      };
    }

    // Plain <script>
    const plainMatch = source.match(
      /<script(?!\s+setup)[^>]*>([\s\S]*?)<\/script>/
    );
    if (plainMatch) {
      const scriptContent = plainMatch[1].trim();
      return {
        code: `
          const __component = { __name: 'SFC' };
          ${scriptContent}
          export default __component;
        `,
      };
    }

    return { code: 'export default { __name: "SFC" };' };
  },
};
