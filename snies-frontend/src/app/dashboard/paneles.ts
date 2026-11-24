// Textos de cada panel y su agrupación por pestaña. Los usan la pantalla y los PDF (individual y general),
// así un cambio de redacción aparece igual en ambos.

export interface InfoPanel {
  titulo: string;
  ayuda: string;
  codigo: string;
  operacion: string;
}

export type ClavePanel = 'cs1' | 'cs2' | 'cs3' | 'cs4' | 'cs5' | 'cc2' | 'cc3' | 'cc4' | 'cc5' | 'cc6' | 'cc7';

export const PANELES: Record<ClavePanel, InfoPanel> = {
  cs1: {
    titulo: '¿Qué niveles de formación predominan?',
    ayuda: 'Cantidad de programas por nivel, de mayor a menor.',
    codigo: 'CS-1', operacion: 'Agregación por una dimensión',
  },
  cs5: {
    titulo: '¿Cómo cambian créditos y duración según la modalidad?',
    ayuda: 'Promedios por modalidad de oferta.',
    codigo: 'CS-5', operacion: 'Agregación por modalidad',
  },
  cs4: {
    titulo: '¿Dónde es más costosa la matrícula?',
    ayuda: 'Costo promedio para estudiantes nuevos por departamento. Solo programas que reportan costo.',
    codigo: 'CS-4', operacion: 'Agregación por ubicación',
  },
  cc3: {
    titulo: '¿Cómo se reparte la oferta entre sector oficial y privado?',
    ayuda: 'Programas por nivel y sector, con totales de cada fila y columna.',
    codigo: 'CC-3', operacion: 'Cubo completo (CUBE modalidad × nivel × sector)',
  },
  cs2: {
    titulo: '¿En qué modalidades ofrece programas?',
    ayuda: 'Programas de la Universidad de Nariño por modalidad. Ignora los filtros de departamento y sector.',
    codigo: 'CS-2', operacion: 'Slice sobre la dimensión Institución',
  },
  cc5: {
    titulo: '¿Qué lugar ocupa frente a otras instituciones?',
    ayuda: 'Las 10 instituciones con más programas y la Universidad de Nariño. La última columna compara su matrícula con el promedio de todas.',
    codigo: 'CC-5', operacion: 'Benchmarking con RANK()',
  },
  cc6: {
    titulo: '¿En qué áreas Nariño concentra más oferta que el país?',
    ayuda: 'Diferencia en puntos porcentuales entre la participación de cada campo en Nariño y en Colombia. Ignora el filtro de departamento.',
    codigo: 'CC-6', operacion: 'Dice + comparación local/nacional con funciones de ventana',
  },
  cc2: {
    titulo: '¿Cuántos programas hay en cada departamento y municipio?',
    ayuda: 'Abra un departamento para ver sus municipios.',
    codigo: 'CC-2', operacion: 'Roll-up / drill-down (ROLLUP)',
  },
  cc4: {
    titulo: '¿Qué tan presencial es la oferta de cada departamento?',
    ayuda: 'Programas por modalidad en columnas y porcentaje presencial.',
    codigo: 'CC-4', operacion: 'Pivot (modalidades en columnas)',
  },
  cs3: {
    titulo: '¿Cuántos programas se registraron cada año?',
    ayuda: 'Programas por año de registro y periodicidad. Ignora el filtro de año para mostrar la serie completa.',
    codigo: 'CS-3', operacion: 'Agregación sobre la dimensión Tiempo',
  },
  cc7: {
    titulo: '¿Crece o se reduce la oferta en Nariño y sus vecinos?',
    ayuda: 'Programas por año y variación frente al año anterior. Sin departamentos filtrados compara Nariño, Cauca y Putumayo.',
    codigo: 'CC-7', operacion: 'Drill-down por año con LAG()',
  },
};

/** Pestañas en el orden de la pantalla; el reporte general sigue el mismo orden. */
export const SECCIONES: { id: string; texto: string; icono: string; intro: string; paneles: ClavePanel[] }[] = [
  {
    id: 'panorama', texto: 'Panorama', icono: 'dashboard',
    intro: '¿Qué se ofrece y en qué condiciones? Composición de la oferta por nivel, modalidad, costo y sector.',
    paneles: ['cs1', 'cs5', 'cs4', 'cc3'],
  },
  {
    id: 'udenar', texto: 'Universidad de Nariño', icono: 'account_balance',
    intro: '¿Qué ofrece la Universidad de Nariño y cómo se compara con las instituciones de mayor oferta?',
    paneles: ['cs2', 'cc5'],
  },
  {
    id: 'territorio', texto: 'Territorio', icono: 'map',
    intro: '¿Cómo se distribuye la oferta en el país y en qué se diferencia Nariño?',
    paneles: ['cc6', 'cc2', 'cc4'],
  },
  {
    id: 'tendencias', texto: 'Tendencias', icono: 'trending_up',
    intro: '¿Cómo ha cambiado la oferta con el tiempo? Los años corresponden a la fecha de registro del programa en el SNIES.',
    paneles: ['cs3', 'cc7'],
  },
];
