# Organiza

App de **tarefas, calendário e lista de compras** num só lugar. Feito para o celular (funciona bem em tablet e PC), minimalista, com modo claro/escuro, e instalável como app (PWA), inclusive offline.

## O que ele faz

- **Tarefas**: adicionar rápido com linguagem natural (`pagar conta amanhã 18h #casa p1`), prioridades, projetos, etiquetas, subtarefas, repetição, lembretes, visões Entrada / Hoje / Próximos / Concluídas, busca, filtros, deslizar para concluir ou excluir, desfazer e resumo de produtividade.
- **Calendário**: visões Dia, Semana e Mês; tarefas com data aparecem sozinhas; eventos próprios (aulas, reuniões); "Os dois" = tarefa que também ocupa um horário; marcar como concluída pelo calendário; exportar `.ics` para o Google Agenda.
- **Compras**: várias listas, itens por corredor com categoria automática, quantidade e unidade, preço e total estimado, sugestões e autocompletar pelo histórico, compartilhar no WhatsApp, duplicar e reaproveitar listas, transformar em tarefa/lembrete.
- **Dados**: ficam no próprio aparelho (IndexedDB). Backup e restauração em JSON nos Ajustes.

## Como rodar no PC

Não precisa instalar nada além do Python (já vem em muitos PCs):

```bash
python tools/serve.py
```

Depois abra <http://localhost:5173>. Para parar: `Ctrl+C`.

> Abrir o `index.html` direto (duplo clique) não funciona, porque o app usa módulos JavaScript, que exigem um servidor.

## Publicação

O site é publicado de graça pelo **GitHub Pages** a partir da branch `main` (pasta raiz). Toda vez que um commit é enviado (`git push`), o site atualiza em 1 ou 2 minutos.

## Instalar no celular

- **Android (Chrome)**: abra o link → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari)**: abra o link → botão Compartilhar → **Adicionar à Tela de Início**.

## Tecnologia

HTML, CSS e JavaScript puros (módulos ES), sem etapa de build. Veja `CLAUDE.md` para a arquitetura e as convenções.
