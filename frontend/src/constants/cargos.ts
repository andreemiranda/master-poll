import type { CargoEletivo, TabConfig } from '../types';

export const CARGOS_ELETIVOS: CargoEletivo[] = [
  { id:'presidente',  icone:'🇧🇷', cargo:'Presidente da República', pergunta:'Quem deve ser o Presidente do Brasil?',  abrangencia:'País',       ambito:'Federal',   cor:'#1d4ed8', hint:'Ex: Brasil' },
  { id:'governador',  icone:'🏛️',  cargo:'Governador de Estado',    pergunta:'Quem deve ser o Governador do Estado?', abrangencia:'Estado',     ambito:'Estadual',  cor:'#0891b2', hint:'Ex: São Paulo, Minas Gerais' },
  { id:'dep_federal', icone:'🏩',  cargo:'Deputado Federal',         pergunta:'Quem deve ser o Deputado Federal?',    abrangencia:'Estado',     ambito:'Federal',   cor:'#7c3aed', hint:'Ex: SP-1, Rio de Janeiro' },
  { id:'dep_estadual',icone:'🏢',  cargo:'Deputado Estadual',        pergunta:'Quem deve ser o Deputado Estadual?',   abrangencia:'Estado',     ambito:'Estadual',  cor:'#0d9488', hint:'Ex: ALESP, ALERJ' },
  { id:'prefeito',    icone:'🏙️', cargo:'Prefeito Municipal',        pergunta:'Quem deve ser o Prefeito?',            abrangencia:'Município',  ambito:'Municipal', cor:'#059669', hint:'Ex: São Paulo, Curitiba' },
  { id:'vereador',    icone:'🏘️', cargo:'Vereador',                  pergunta:'Quem deve ser o Vereador?',            abrangencia:'Município',  ambito:'Municipal', cor:'#b45309', hint:'Ex: Câmara Municipal SP' },
];

export const CORES_PRESET = [
  '#e53e3e','#e67e22','#d69e2e','#38a169',
  '#3182ce','#805ad5','#d53f8c','#00b5d8',
  '#2d9965','#b7791f',
];

export const ABAS: TabConfig[] = [
  { id:'votar',      label:'🗳️ Votar',      protegida:false },
  { id:'resultado',  label:'📊 Resultado',  protegida:true, roleMinima:'admin' },
  { id:'candidatos', label:'👥 Candidatos', protegida:true, roleMinima:'admin' },
  { id:'avatares',   label:'🖼️ Avatares',   protegida:true, roleMinima:'admin' },
  { id:'config',     label:'⚙️ Config',     protegida:true, roleMinima:'admin' },
];

export const ENQUETE_CONFIG_DEFAULT = {
  cargoId: 'governador',
  perguntaCustom: '',
  localNome: '',
  subtitulo: '',
};
