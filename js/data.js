// Regras do Livro Básico 0.1 usadas pelo site.

export const PERICIAS = [
  ['Chute Forte', 'POT'], ['Disputa', 'POT'], ['Cabeceio', 'POT'], ['Desarme', 'POT'],
  ['Domínio', 'TÉC'], ['Passe', 'TÉC'], ['Drible', 'TÉC'], ['Finalização', 'TÉC'], ['Bola Parada', 'TÉC'],
  ['Arranque', 'FÍS'], ['Resistência', 'FÍS'],
  ['Tática', 'LEI'], ['Posicionamento', 'LEI'], ['Marcação', 'LEI'], ['Estudos', 'LEI'],
  ['Percepção de Campo', 'VIS'], ['Antecipação', 'VIS'], ['Reflexos', 'VIS'], ['Intuição', 'VIS'],
  ['Comandar', 'PRE'], ['Liderança', 'PRE'], ['Provocação', 'PRE'], ['Convívio', 'PRE'], ['Vontade', 'PRE'],
];

// CDs das zonas, vistas de quem ataca (linha 0 = ataque).
export const ZONAS = [
  { faixa: 'ATAQUE', cds: [18, 20, 18], nomes: ['Ponta esquerda', 'Área', 'Ponta direita'] },
  { faixa: 'MEIO', cds: [14, 15, 14], nomes: ['Meio esquerdo', 'Meio central', 'Meio direito'] },
  { faixa: 'DEFESA', cds: [12, 13, 12], nomes: ['Defesa esquerda', 'Defesa central', 'Defesa direita'] },
];

// Posições das formações (x, y) com o time atacando para cima; o goleiro é a posição 0.
const GK = [0.5, 0.93];
export const FORMACOES = {
  '4-4-2': { nota: '+1 no Duelo Tático', pos: [GK, [.15, .78], [.38, .78], [.62, .78], [.85, .78], [.15, .52], [.38, .52], [.62, .52], [.85, .52], [.38, .24], [.62, .24]] },
  '4-3-3': { nota: 'forte nas pontas', pos: [GK, [.15, .78], [.38, .78], [.62, .78], [.85, .78], [.3, .54], [.5, .54], [.7, .54], [.18, .24], [.5, .22], [.82, .24]] },
  '4-2-3-1': { nota: 'domínio do meio', pos: [GK, [.15, .78], [.38, .78], [.62, .78], [.85, .78], [.38, .62], [.62, .62], [.2, .42], [.5, .42], [.8, .42], [.5, .2]] },
  '3-5-2': { nota: 'meio congestionado', pos: [GK, [.3, .78], [.5, .78], [.7, .78], [.1, .52], [.3, .52], [.5, .52], [.7, .52], [.9, .52], [.38, .24], [.62, .24]] },
  '5-3-2': { nota: 'retranca', pos: [GK, [.1, .76], [.3, .78], [.5, .78], [.7, .78], [.9, .76], [.3, .54], [.5, .54], [.7, .54], [.38, .24], [.62, .24]] },
  '3-4-3': { nota: 'pressão total', pos: [GK, [.3, .78], [.5, .78], [.7, .78], [.15, .52], [.38, .52], [.62, .52], [.85, .52], [.18, .24], [.5, .22], [.82, .24]] },
};

export const ESTILOS = ['—', 'Posse de Bola', 'Contra-ataque', 'Pressão Alta', 'Jogo Direto', 'Ousadia'];

export const CONDICOES = ['—', 'Abalado', 'Inseguro', 'Revoltado', 'Distraído', 'Travado', 'Isolado'];

// Converte a posição da formação para o campo inteiro.
// modo 'saida': cada time no próprio campo. modo 'jogo': espalhado pelo campo todo.
export function posicaoFormacao(formacao, slot, team, modo) {
  const f = FORMACOES[formacao] || FORMACOES['4-4-2'];
  const [fx, fy] = f.pos[Math.min(slot, f.pos.length - 1)];
  let x = fx, y = modo === 'saida' ? 0.5 + fy * 0.47 : 0.06 + fy * 0.9;
  if (team === 'away') { x = 1 - x; y = 1 - y; }
  return { x, y };
}

export function estadoInicial() {
  return {
    score: { home: 0, away: 0 },
    bloco: 1,
    momento: 0,
    home: { name: 'Ushio Minato', formation: '4-4-2', style: '—' },
    away: { name: 'Adversário', formation: '4-4-2', style: '—' },
    ball: { x: 0.5, y: 0.5, holder: null },
  };
}

export function recursosIniciais() {
  return { folego: 0, folegoMax: 0, garra: 0, garraMax: 0, confianca: 5, pressao: 0, condicao: '—', amarelo: 0, vermelho: false };
}

// ---------------- Slice of life ----------------
// Atividades de período livre (Capítulo 10).
export const ATIVIDADES = [
  { id: 'treino', nome: 'Treino focado', teste: 'Perícia escolhida, CD 15', efeito: 'Sucesso: 1 progresso. Com 3, a perícia fica treinada (ou ganha Maestria).' },
  { id: 'pefraco', nome: 'Treino do pé fraco', teste: 'Técnica, CD 15', efeito: 'Com 3 progressos, a penalidade do pé fraco cai um degrau.' },
  { id: 'noturno', nome: 'Treino noturno sozinho', teste: 'Perícia escolhida, CD 15', efeito: 'Sucesso: 2 progressos, mas começa a próxima partida com −1d6 de Fôlego.' },
  { id: 'fundamento', nome: 'Aprender Fundamento', teste: 'Perícia do Fundamento', efeito: 'Precisa de alguém que ensine (Capítulo 6).' },
  { id: 'estudos', nome: 'Estudos', teste: 'Estudos, CD 12 a 18', efeito: 'Cada falha dá +1 de Pressão. Duas falhas seguidas: barrado da partida.' },
  { id: 'convivio', nome: 'Convívio', teste: 'Convívio, CD 12', efeito: '+1 num Vínculo e uma cena com aquela pessoa.' },
  { id: 'casa', nome: 'Ligar para casa', teste: 'Sem teste', efeito: '+2 de Confiança, uma vez por semana.' },
  { id: 'folga', nome: 'Folga', teste: 'Sem teste', efeito: '−1 de Pressão, uma vez por semana.' },
  { id: 'fisio', nome: 'Fisioterapia', teste: 'Resistência, CD 15', efeito: 'Encurta uma lesão em 1 semana.' },
  { id: 'adversario', nome: 'Estudar o adversário', teste: 'Tática, CD 15', efeito: '+2 no Duelo Tático contra aquele time e a formação dele é revelada.' },
  { id: 'tecnico', nome: 'Conversa com o técnico', teste: 'Liderança ou Convívio, CD 18', efeito: 'Sucesso: Status sobe e +1 de Confiança. Falha por 5+: Status cai.' },
  { id: 'cena', nome: 'Cena livre', teste: 'Sem teste', efeito: 'Uma cena sem rolagem. O mestre pode dar um marco por uma descoberta pessoal.' },
];

// Lugares de Ushio Minato. x/y no mapa de 1000 × 558.
export const LOCAIS = [
  { id: 'plato', nome: 'Campo do platô', x: 501, y: 109, desc: 'O campo de treino, lá em cima, acima do santuário. Dá para ver o lago inteiro. À noite, só um poste ilumina a grande área.', atividades: ['treino', 'pefraco', 'noturno', 'fundamento'] },
  { id: 'santuario', nome: 'Santuário das Raposas', x: 500, y: 247, desc: 'Escadaria de pedra cercada de raposas esculpidas. Quem sobe para treinar passa por ele todo dia. Bom lugar para pensar sozinho.', atividades: ['folga', 'cena'] },
  { id: 'sede', nome: 'Sede do clube', x: 709, y: 156, desc: 'Prédio velho do Ushio Minato FC. Tem a sala do técnico, uma TV para vídeos e troféus empoeirados de outra época.', atividades: ['adversario', 'tecnico', 'fundamento'] },
  { id: 'colegio', nome: 'Colégio de Ushio Minato', x: 218, y: 182, desc: 'O colégio onde os jogadores estão matriculados. Aulas de manhã, provas, clubes depois da aula.', atividades: ['estudos', 'convivio'] },
  { id: 'dormitorio', nome: 'Dormitório da balsa', x: 374, y: 342, desc: 'O antigo dormitório dos barqueiros, à beira do lago. Quartos divididos, refeitório barulhento e uma varanda sobre a água.', atividades: ['folga', 'convivio', 'casa', 'estudos'] },
  { id: 'lago', nome: 'Píer do lago', x: 454, y: 468, desc: 'Um píer de madeira onde a balsa atracava. Corrida de manhã cedo, conversas no fim do dia.', atividades: ['treino', 'folga', 'cena'] },
  { id: 'quadra', nome: 'Quadrinha do lago', x: 178, y: 403, desc: 'Quadra de cimento com linhas apagadas e alambrado torto. A molecada da cidade joga lá todas as noites.', atividades: ['treino', 'convivio', 'cena'] },
  { id: 'estacao', nome: 'Estação', x: 894, y: 269, desc: 'Pequena demais para os trens que passam. Uma máquina de bebidas, um banco e o cheiro do lago. Chegadas e despedidas.', atividades: ['casa', 'cena'] },
  { id: 'rua', nome: 'Rua comercial', x: 625, y: 327, desc: 'A rua das lojinhas, com toldos coloridos. No verão, vira o corredor do festival.', atividades: ['convivio', 'cena'] },
  { id: 'konbini', nome: 'Loja de conveniência', x: 718, y: 378, desc: 'Aberta 24 horas. Lanche depois do treino, ponto de encontro de todo mundo.', atividades: ['convivio', 'cena'] },
  { id: 'onsen', nome: 'Onsen do bairro', x: 919, y: 436, desc: 'Banho termal antigo, frequentado pelos velhos da cidade. O melhor lugar para o corpo cansado.', atividades: ['fisio', 'folga'] },
];
