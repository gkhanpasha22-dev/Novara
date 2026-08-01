// Полная очистка базы — чтобы показать демо «с чистого листа».
import { rmSync } from 'node:fs';
import { config } from './config.js';

for (const suffix of ['', '-wal', '-shm']) {
  try {
    rmSync(config.dbPath + suffix);
  } catch {
    /* файла может не быть — это нормально */
  }
}
console.log('База очищена. При следующем запуске загрузятся демо-диалоги.');
