// Backup (exportar/importar JSON) e dados de exemplo.

import * as store from '../../core/store.js';
import { downloadFile, uid } from '../../core/util.js';
import { todayISO, addDays, weekday } from '../../core/date.js';
import { createTask, findOrCreateProject } from '../tasks/task-service.js';
import { addItem, ensureDefaultList, lists } from '../shopping/shopping-service.js';

export function exportBackup() {
  const dump = store.exportData();
  downloadFile(`organiza-backup-${todayISO()}.json`, JSON.stringify(dump, null, 2), 'application/json');
  const n = Object.values(dump.data).reduce((s, arr) => s + arr.length, 0);
  return n;
}

export async function readBackupFile(file) {
  const text = await file.text();
  const dump = JSON.parse(text);
  if (dump?.app !== 'organiza' || typeof dump.data !== 'object') throw new Error('Este arquivo não é um backup do Organiza.');
  return dump;
}

export async function importBackup(dump) {
  await store.replaceAll(dump);
}

export function loadSampleData() {
  const today = todayISO();
  store.batch('Dados de exemplo', () => {
    const casa = findOrCreateProject('Casa');
    const trabalho = findOrCreateProject('Trabalho');
    createTask({ title: 'Pagar conta de luz', date: today, time: '18:00', priority: 1, projectId: casa.id, reminder: 30 });
    createTask({ title: 'Responder e-mails', date: today, priority: 3, projectId: trabalho.id, labels: ['rápido'] });
    createTask({ title: 'Regar as plantas', date: today, recurrence: { freq: 'daily', interval: 1, anchor: today } });
    createTask({
      title: 'Preparar apresentação', date: addDays(today, 1), time: '10:00', priority: 2, projectId: trabalho.id, block: true, duration: 90,
      subtasks: [{ id: uid(), title: 'Revisar slides', done: true }, { id: uid(), title: 'Ensaiar', done: false }],
    });
    createTask({ title: 'Ligar para o dentista', date: addDays(today, -1), priority: 2 });
    createTask({ title: 'Ler um capítulo do livro', labels: ['leitura'] });
    createTask({ title: 'Academia', date: addDays(today, 2), time: '07:00', recurrence: { freq: 'weekly', interval: 1, days: [weekday(addDays(today, 2))], anchor: addDays(today, 2) } });
    store.create('events', { title: 'Aula de inglês', date: today, time: '19:00', duration: 60, allDay: false, color: '#7c3aed', recurrence: { freq: 'weekly', interval: 1, days: [weekday(today)], anchor: today }, reminder: 15 });
    store.create('events', { title: 'Reunião de equipe', date: addDays(today, 1), time: '14:00', duration: 60, allDay: false, color: '#3b82f6', recurrence: null, reminder: null });
    store.create('events', { title: 'Aniversário da Ana', date: addDays(today, 3), time: null, duration: 60, allDay: true, color: '#db2777', recurrence: null, reminder: null });
    const list = lists()[0] || ensureDefaultList();
    for (const t of ['2 kg arroz', 'Feijão', '1 L leite', '6 banana', 'Tomate', 'Detergente', 'Pão francês', 'Café']) {
      const m = t.match(/^(\d+)\s*(kg|L)?\s*(.+)$/);
      addItem(list.id, m ? { name: m[3], qty: +m[1], unit: m[2] || 'un' } : { name: t });
    }
  });
}
