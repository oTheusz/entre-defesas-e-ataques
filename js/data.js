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
