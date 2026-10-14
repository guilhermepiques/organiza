// Categorias (corredores) na ordem típica de um mercado, com palavras-chave para sugestão automática.
// Para ensinar uma palavra nova, basta incluí-la na lista da categoria (sem acento, minúscula).
// O app também aprende: se você muda a categoria de um item, ele lembra da próxima vez.

import { normalize } from '../../core/util.js';

export const CATEGORIES = [
  { id: 'hortifruti', name: 'Hortifrúti', emoji: '🥬', words: [
    'alface', 'tomate', 'cebola', 'alho', 'batata', 'batata doce', 'cenoura', 'beterraba', 'abobrinha', 'abobora', 'berinjela', 'pepino',
    'pimentao', 'brocolis', 'couve', 'couve-flor', 'repolho', 'espinafre', 'rucula', 'agriao', 'cheiro verde', 'salsinha', 'salsa',
    'cebolinha', 'coentro', 'manjericao', 'hortela', 'gengibre', 'mandioca', 'aipim', 'macaxeira', 'inhame', 'chuchu', 'quiabo', 'vagem',
    'milho verde', 'banana', 'maca', 'laranja', 'limao', 'mamao', 'melancia', 'melao', 'abacaxi', 'manga', 'uva', 'morango', 'pera',
    'kiwi', 'abacate', 'goiaba', 'maracuja', 'tangerina', 'mexerica', 'bergamota', 'ameixa', 'pessego', 'coco', 'fruta', 'frutas',
    'legume', 'legumes', 'verdura', 'verduras', 'cogumelo', 'shimeji', 'shitake', 'jilo', 'nabo', 'rabanete', 'alho poro', 'acelga',
    'mirtilo', 'framboesa', 'caqui', 'figo', 'acerola', 'pitaya', 'romã', 'roma', 'salada'] },
  { id: 'padaria', name: 'Padaria', emoji: '🥖', words: [
    'pao', 'paes', 'pao frances', 'pao de forma', 'pao integral', 'bisnaguinha', 'baguete', 'croissant', 'bolo', 'torrada', 'rosca',
    'sonho', 'broa', 'pao de queijo', 'salgado', 'salgados', 'pao doce', 'ciabatta', 'focaccia', 'pao sirio', 'wrap', 'tortilha', 'panetone', 'colomba'] },
  { id: 'acougue', name: 'Açougue e peixaria', emoji: '🥩', words: [
    'carne', 'patinho', 'alcatra', 'picanha', 'contrafile', 'fraldinha', 'maminha', 'acem', 'musculo', 'costela', 'cupim', 'file mignon',
    'carne moida', 'frango', 'peito de frango', 'coxa', 'sobrecoxa', 'asa', 'asinha', 'coxinha da asa', 'linguica', 'porco', 'lombo', 'pernil',
    'bisteca', 'costelinha', 'peixe', 'tilapia', 'salmao', 'merluza', 'pescada', 'camarao', 'bacalhau', 'file', 'bife', 'coracao', 'figado',
    'carne seca', 'charque', 'cordeiro', 'peru', 'chester'] },
  { id: 'frios', name: 'Frios e laticínios', emoji: '🧀', words: [
    'leite', 'queijo', 'mussarela', 'mucarela', 'muçarela', 'presunto', 'peito de peru', 'salame', 'mortadela', 'requeijao', 'iogurte',
    'manteiga', 'margarina', 'nata', 'ricota', 'cream cheese', 'coalhada', 'ovo', 'ovos', 'calabresa', 'bacon', 'salsicha', 'leite fermentado',
    'yakult', 'danone', 'petit suisse', 'queijo ralado', 'parmesao', 'provolone', 'catupiry', 'gorgonzola', 'queijo minas', 'cottage',
    'kefir', 'leite sem lactose', 'blanquet', 'apresuntado'] },
  { id: 'mercearia', name: 'Mercearia', emoji: '🥫', words: [
    'arroz', 'feijao', 'macarrao', 'espaguete', 'penne', 'lasanha massa', 'massa', 'oleo', 'azeite', 'sal', 'acucar', 'cafe', 'farinha',
    'farinha de trigo', 'fuba', 'aveia', 'granola', 'cereal', 'sucrilhos', 'molho de tomate', 'extrato de tomate', 'ketchup', 'maionese',
    'mostarda', 'vinagre', 'tempero', 'oregano', 'pimenta', 'canela', 'colorau', 'paprica', 'cominho', 'louro', 'achocolatado', 'nescau',
    'toddy', 'leite condensado', 'creme de leite', 'leite de coco', 'leite em po', 'milho', 'ervilha', 'seleta', 'atum', 'sardinha',
    'biscoito', 'bolacha', 'chocolate', 'bala', 'chiclete', 'pipoca', 'amendoim', 'castanha', 'nozes', 'gelatina', 'fermento', 'amido',
    'maisena', 'farofa', 'lentilha', 'grao de bico', 'azeitona', 'palmito', 'mel', 'geleia', 'doce de leite', 'cha', 'adocante', 'miojo',
    'batata palha', 'salgadinho', 'doritos', 'cuscuz', 'tapioca', 'polvilho', 'granulado', 'caldo', 'caldo knorr', 'shoyu', 'molho',
    'pao ralado', 'farinha de rosca', 'chia', 'linhaca', 'quinoa', 'barra de cereal', 'whey', 'paçoca', 'pacoca', 'creme de avela', 'nutella'] },
  { id: 'bebidas', name: 'Bebidas', emoji: '🥤', words: [
    'agua', 'agua com gas', 'agua mineral', 'refrigerante', 'refri', 'coca', 'coca-cola', 'guarana', 'fanta', 'sprite', 'suco', 'cerveja',
    'vinho', 'vodka', 'whisky', 'cachaca', 'gin', 'rum', 'energetico', 'red bull', 'cha gelado', 'isotonico', 'gatorade', 'kombucha',
    'agua de coco', 'espumante', 'tonica', 'h2oh'] },
  { id: 'congelados', name: 'Congelados', emoji: '🧊', words: [
    'sorvete', 'pizza', 'pizza congelada', 'lasanha', 'hamburguer', 'nuggets', 'batata frita', 'pao de queijo congelado', 'polpa', 'polpa de fruta',
    'gelo', 'empanado', 'legumes congelados', 'acai', 'picole', 'lasanha congelada', 'esfiha', 'kibe', 'coxinha', 'brocolis congelado', 'ervilha congelada'] },
  { id: 'limpeza', name: 'Limpeza', emoji: '🧽', words: [
    'detergente', 'sabao', 'sabao em po', 'sabao liquido', 'lava roupa', 'amaciante', 'agua sanitaria', 'alvejante', 'desinfetante',
    'multiuso', 'limpa vidro', 'esponja', 'palha de aco', 'bombril', 'saco de lixo', 'vassoura', 'rodo', 'pano', 'pano de chao', 'flanela',
    'lustra moveis', 'veja', 'cloro', 'tira manchas', 'inseticida', 'luva', 'limpador', 'pedra sanitaria', 'sabao em barra', 'lava loucas',
    'odorizador', 'bom ar', 'alcool', 'pa de lixo', 'balde'] },
  { id: 'higiene', name: 'Higiene e beleza', emoji: '🧴', words: [
    'sabonete', 'shampoo', 'xampu', 'condicionador', 'creme dental', 'pasta de dente', 'escova de dente', 'fio dental', 'desodorante',
    'papel higienico', 'absorvente', 'cotonete', 'algodao', 'aparelho de barbear', 'gilete', 'barbeador', 'espuma de barbear', 'hidratante',
    'protetor solar', 'enxaguante', 'antisseptico bucal', 'perfume', 'lenco umedecido', 'fralda', 'fraldas', 'maquiagem', 'creme de cabelo',
    'creme para pentear', 'esmalte', 'acetona', 'lenco de papel', 'sabonete liquido', 'repelente'] },
  { id: 'farmacia', name: 'Farmácia', emoji: '💊', words: [
    'remedio', 'dipirona', 'paracetamol', 'ibuprofeno', 'vitamina', 'curativo', 'band-aid', 'soro', 'soro fisiologico', 'termometro',
    'alcool gel', 'dorflex', 'neosaldina', 'omeprazol', 'colirio', 'antialergico', 'loratadina', 'xarope', 'pomada', 'gaze', 'esparadrapo',
    'mascara', 'teste de gravidez', 'preservativo', 'camisinha', 'anticoncepcional', 'probiotico', 'buscopan', 'estomazil', 'sal de fruta'] },
  { id: 'pet', name: 'Pet', emoji: '🐾', words: [
    'racao', 'areia de gato', 'areia', 'petisco', 'sache', 'coleira', 'tapete higienico', 'bifinho', 'osso', 'antipulgas', 'vermifugo'] },
  { id: 'casa', name: 'Casa e utilidades', emoji: '🏠', words: [
    'pilha', 'pilhas', 'lampada', 'papel aluminio', 'filme plastico', 'papel toalha', 'guardanapo', 'copo descartavel', 'prato descartavel',
    'talher descartavel', 'vela', 'fosforo', 'isqueiro', 'carvao', 'sacola', 'pote', 'filtro de cafe', 'papel manteiga', 'forma', 'extensao',
    'fita', 'cola', 'caneta', 'caderno', 'canudo', 'saco zip', 'toalha', 'tupperware', 'carregador'] },
  { id: 'outros', name: 'Outros', emoji: '📦', words: [] },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
export const categoryOrder = (id) => CATEGORIES.findIndex((c) => c.id === id);

// índice de palavras-chave (mais longas primeiro, para "leite condensado" vencer "leite")
const INDEX = CATEGORIES.flatMap((c) => c.words.map((w) => ({ w: normalize(w), id: c.id })))
  .sort((a, b) => b.w.length - a.w.length);

export function guessCategory(name) {
  const n = ' ' + normalize(name).replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ') + ' ';
  // Vence a palavra-chave que aparece primeiro no nome (o substantivo principal costuma vir antes:
  // "pão de batata" -> padaria); empate = a mais longa ("leite condensado" vence "leite").
  let best = null;
  for (const { w, id } of INDEX) {
    for (const f of [w, w + 's', w + 'es', w.replace(/ao$/, 'oes'), w.replace(/ao$/, 'aes')]) {
      const i = n.indexOf(' ' + f + ' ');
      if (i >= 0 && (!best || i < best.i || (i === best.i && f.length > best.len))) best = { i, len: f.length, id };
    }
  }
  if (best) return best.id;
  // começo do nome (ex.: "pão de batata" -> padaria); só para palavras mais longas, evitando falsos positivos
  for (const { w, id } of INDEX) {
    if (w.length >= 4 && n.startsWith(' ' + w)) return id;
  }
  return 'outros';
}

/** Sugestões para a primeira vez, antes de existir histórico. */
export const STARTER_ITEMS = ['Arroz', 'Feijão', 'Leite', 'Pão francês', 'Ovos', 'Café', 'Banana', 'Tomate', 'Cebola', 'Papel higiênico', 'Detergente', 'Frango'];
