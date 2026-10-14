# CLAUDE.md: contexto do projeto Organiza

Leia isto antes de mexer no projeto. Mantenha este arquivo atualizado a cada etapa.

## Objetivo

App pessoal (PWA) de **tarefas + calendário + lista de compras**, em português do Brasil, para usar principalmente no **celular** (também tablet e PC). Meta: reunir o melhor de Todoist, TickTick, Things, Any.do, Microsoft To Do, Bring! e AnyList, **sem poluir a tela**. Publicado no GitHub Pages; dados salvos localmente.

## Como trabalhamos (importante)

- Construímos **juntos, em tempo real, passo a passo**. O usuário acompanha e pede mudanças na hora (design, layout, cores, textos, comportamentos, funcionalidades).
- Ao receber um pedido de mudança: **aplique sem refazer do zero**, mostre o resultado (rodar o app e conferir) e espere a opinião antes de seguir.
- Pode **sugerir ideias**, mas **quem decide é o usuário**.
- Se algo for ambíguo: no máximo **3 perguntas rápidas**; senão, comece direto.
- A cada etapa: diga **o que foi feito** e **o que sugere de próximo**.
- **Commits pequenos e frequentes**, mensagens claras em **português**, e `git push` ao final de cada etapa. No PowerShell 5.1, mensagens com aspas quebram: escreva a mensagem num arquivo e use `git commit -F arquivo`.
- **Nunca** salvar senhas, tokens ou chaves no projeto.
- Comunicação com o usuário sempre em português do Brasil.

## Decisões de design

- **Minimalista**: muito espaço em branco, tons neutros e **uma** cor de destaque. Tipografia do sistema (Segoe UI / SF / Roboto). Animações sutis. Respeita `prefers-reduced-motion`.
- **Paleta padrão: Grafite** (escolha do usuário). Há paletas de teste em Ajustes (Índigo, Sálvia, Coral, Oceano, Ameixa, Âmbar) para o usuário escolher depois. Paletas ficam em `js/features/settings/palettes.js`.
- **Modo claro/escuro/sistema** via `data-theme` no `<html>`; cores neutras em `css/tokens.css`.
- **Mobile-first**: alvos de toque ≥ 44px, navegação inferior com 3 abas (Tarefas, Calendário, Compras), campo de adicionar no rodapé (uso com uma mão), painéis "bottom sheet". Campos com fonte ≥ 16px (evita zoom no iPhone).
- **PC (≥ 900px)**: barra lateral com as abas + barra lateral de visões em Tarefas; conteúdo centralizado (máx. 760px). Painéis viram janelas centrais (≥ 700px).
- Prioridades: P1 vermelho, P2 laranja, P3 azul, P4 sem prioridade (cinza).
- **Tarefa × Evento** (pedido do usuário, substituiu o antigo "Os dois"):
  - O editor tem só **Tarefa | Evento**. Evento existe só no calendário (sempre com data).
  - Tarefa nova começa **sem data**. O botão **"Data/Horário"** mostra data, hora, repetição e lembrete.
  - O botão **"Adicionar ao calendário"** (campo `block: true`) faz a tarefa aparecer no calendário, com duração e cor. **Tarefas sem esse botão não aparecem no calendário**, mesmo com data.
  - Se a tarefa tem data mas não está no calendário, ao salvar aparece o aviso "Adicionar ao calendário?" (Só na lista / Adicionar). Na adição rápida, o toast oferece o botão "Adicionar ao calendário".
  - Duração tem a opção **"Sem duração"** (`duration: 0`), para prazos/entregas: aparece no calendário como marcação fina no horário. Use `?? 60` (nunca `|| 60`) ao ler duração, senão 0 vira 1h.
  - Nada recebe data automaticamente (nem na visão Hoje); só quando o usuário escolhe ou escreve ("amanhã 18h"). Criar pelo calendário já vem com "Adicionar ao calendário" ligado.

## Tecnologia e arquitetura

- **HTML/CSS/JS puros com módulos ES, sem build.** Motivo: simples, roda direto no GitHub Pages, fácil de alterar. (Vite só se um dia precisarmos de dependências.)
- Servidor de desenvolvimento: `python tools/serve.py` (porta 5173, sem cache). Configurado em `.claude/launch.json` para o preview do Claude Code.
- Ícones PNG gerados por `python tools/make-icons.py` (Pillow) a partir do desenho de `icons/icon.svg`.

```
index.html, manifest.webmanifest, sw.js (offline, "rede primeiro")
css/  tokens.css (cores/tema) · base.css (layout, abas) · components.css (botões, painéis, chips, toast, deslizar)
      tasks.css (tarefas, editor, ajustes) · calendar.css · shopping.css
js/app.js            entrada: carrega dados, monta abas, roteamento
js/pwa.js            service worker + instalar app
js/core/             sem DOM (exceto theme/router)
  db.js              IndexedDB (fallback localStorage). Só o store.js usa.
  store.js           estado em memória + gravação + desfazer (batch/undo) + eventos de mudança (on)
  date.js            datas "AAAA-MM-DD", horas "HH:MM", rótulos em pt-BR
  recurrence.js      regras de repetição {freq, interval, days, anchor}, próxima ocorrência, RRULE
  router.js          hash: #/tarefas/hoje, #/tarefas/projeto/<id>, #/calendario, #/compras/<id>
  theme.js           aplica tema e paleta
  util.js            uid, normalize (sem acento), dinheiro, download
js/ui/               dom.js (helper h(), render(), segmented) · icons.js (SVG) · sheet.js (painéis, menu, prompt, confirmar)
                     toast.js (aviso + Desfazer) · swipe.js (deslizar linha)
js/features/
  tasks/             task-service (regras/visões/estatísticas) · nlp (linguagem natural) · tasks-view · task-row · task-nav · quick-add · stats
  calendar/          calendar-view · occurrences (junta eventos+tarefas, colunas de sobreposição) · ics (exportação)
  shopping/          shopping-service · shopping-view · categories (corredores + palavras-chave) · parse-item ("2 kg arroz")
  editor/editor.js   editor único de tarefa/evento/os dois
  settings/          settings-view · palettes · backup (JSON + dados de exemplo)
  reminders/         lembretes via Notification API
```

### Convenções de código

- Português nos textos da interface e nos comentários; nomes de código em inglês.
- Cada tela exporta `createXView()` → `{ el, activate(parts), refresh() }`. Só a aba visível é redesenhada quando o store muda.
- Telas **nunca** falam com o banco direto: usam `store.create/update/remove`, e agrupam ações com `store.batch('Rótulo', fn)` para permitir **Desfazer** (`undoToast`).
- Use `render(el, ...)` (ignora `null`) em vez de `replaceChildren` (que escreve "null" na tela).
- Painéis: `onClose` roda só depois que o histórico assentou; para encadear (fechar e abrir outro, ou navegar), use `await sheet.close()`. Perguntas: `confirmDialog`, `choiceDialog`, `promptText` em `ui/sheet.js`.
- Variáveis CSS em estilos inline: `h('div', { style: { '--c': cor } })` (o helper usa `setProperty`).
- Todo registro tem `id`, `createdAt`, `updatedAt`; exclusão é lógica (`deleted: true`) para facilitar sincronização futura.
- Ao adicionar arquivos novos, nada precisa ser listado no `sw.js`: a página envia ao service worker a lista de recursos carregados. Ao mudar muito a estrutura, aumente `VERSION` no `sw.js`.

### Modelo de dados (coleções)

- `tasks`: title, notes, date, time, duration, priority (1–4), labels[], projectId, subtasks[{id,title,done}], recurrence, reminder (min antes), block (= está no calendário), color, done, doneAt, order
- `events`: title, notes, date, time, duration, allDay, color, recurrence, reminder
- `projects`: name, color, order
- `lists`: name, order · `items`: listId, name, qty, unit, note, price (por unidade), category, bought, boughtAt, order
- `catalog`: histórico de itens (id = nome normalizado) para autocompletar/sugestões/categoria aprendida
- `log`: conclusões de tarefas (estatísticas e sequência)
- `meta/settings`: theme, palette, weekStart, calendarView, defaultEventDuration, taskSort, showDoneInCalendar, lastListId

### Sincronização futura (preparado)

IDs UUID, `updatedAt` em todo registro, exclusão lógica e uma única camada de persistência (`db.js` + `store.js`). Para sincronizar: criar um adaptador remoto (ex.: Supabase/Firebase) que envie/receba registros por `updatedAt`, sem mexer nas telas.

## Funcionalidades

### Feitas (v0.1)
- **Entrada = todas as tarefas pendentes** (com ou sem projeto), pedido do usuário. Projetos continuam filtrando só as suas tarefas.
- **Entrada é a visão principal**: o app sempre abre nela (`start_url` sem hash → `tarefas/entrada`). Voltar para a aba Tarefas mantém a visão em que o usuário estava.
- Offline testado: com o servidor desligado o app abre e salva normalmente. O service worker usa a rede com limite de 3s (internet ruim → usa o cache) e copia o cache antigo ao atualizar de versão.
- Tarefas: adicionar rápido com linguagem natural (hoje/amanhã/dias da semana/dia 15/15/10/“às 9”/18h/de manhã, `#projeto`, `@etiqueta`, `p1`/`!1`, “toda segunda e quarta”, “todo mês”, “a cada 2 semanas”, “dias úteis”) com prévia; editor completo; subtarefas; recorrência (avança ao concluir); lembretes; visões Entrada/Hoje/Próximos/Concluídas/projeto/etiqueta; busca; ordenar; filtrar por prioridade; reagendar atrasadas; deslizar para concluir/excluir; desfazer; resumo de produtividade (hoje, semana, sequência, gráfico 7 dias); projetos (criar, renomear, cor, excluir).
- Calendário: Dia/Semana/Mês, navegação (botões e deslizar), linha do “agora”, criar evento tocando no horário, eventos com cor/duração/repetição/dia todo, tarefas marcadas com "Adicionar ao calendário" aparecem como blocos, concluir pelo calendário, exportar `.ics`.
- Compras: várias listas (criar, renomear, duplicar, copiar de outra, excluir), adicionar vários itens de uma vez, quantidade/unidade/preço/observação, categoria automática que aprende, agrupado por corredor, comprados vão para “No carrinho”, limpar comprados, desmarcar todos, autocompletar + sugestões frequentes, total estimado, compartilhar (WhatsApp/copiar), transformar item/lista em tarefa.
- Ajustes: tema, paletas de teste, início da semana, duração padrão, notificações, instalar app, backup JSON (exportar/importar), dados de exemplo, apagar tudo.
- PWA: manifest, ícones, service worker offline.

### Pendentes / ideias
- Arrastar para reordenar tarefas (ordem manual) e arrastar eventos no calendário.
- Editar só uma ocorrência de um evento repetido (hoje edita a série).
- Mostrar ocorrências futuras de tarefas recorrentes no calendário.
- Lembretes com app fechado (exigiria servidor de push).
- Sincronização entre dispositivos.
- Fonte personalizada, mais paletas, ícone do app conforme a paleta.

## Publicação

GitHub Pages, branch `main`, pasta raiz (`.nojekyll` presente). Site atualiza após cada `git push` (1–2 min).

- Site: https://guilhermepiques.github.io/organiza/
- Repositório: https://github.com/guilhermepiques/organiza
- Commits usam o e-mail privado do GitHub (`…@users.noreply.github.com`), configurado no git local do projeto.
- O usuário já usa o app no celular com dados reais: **nunca** mudar nomes de coleções/campos sem migração, nem o nome do banco (`organiza`) ou o caminho do site, senão os dados somem.
