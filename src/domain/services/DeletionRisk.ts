// REGLA DE NEGOCIO: "¿qué pasa si borro esto?"
// Es una base de conocimiento de rutas conocidas de Windows. La primera regla que matchea gana,
// así que el ORDEN importa: van primero las más específicas (ej: Windows\Temp antes que Windows).

export type RiskLevel = 'blocked' | 'high' | 'medium' | 'low'

export interface RiskAssessment {
  level: RiskLevel
  category: string
  consequence: string
}

interface Rule extends RiskAssessment {
  pattern: RegExp // se evalúa contra la ruta normalizada (minúsculas, con "\")
}

const USER = String.raw`^[a-z]:\\users\\[^\\]+`
const END = String.raw`(\\|$)` // "termina acá o sigue una subcarpeta"

const rules: Rule[] = [
  // --- BLOQUEADO: nunca se borra desde la app ---
  {
    pattern: /^[a-z]:\\?$/,
    level: 'blocked',
    category: 'Raíz del disco',
    consequence: 'Borrarías TODO el contenido del disco.',
  },
  {
    pattern: /\\(pagefile|hiberfil|swapfile)\.sys$/,
    level: 'blocked',
    category: 'Memoria del sistema',
    consequence:
      'Windows lo usa todo el tiempo. Se achica desde Configuración avanzada (memoria virtual) o con "powercfg -h off" para hiberfil.sys.',
  },
  {
    pattern: new RegExp(String.raw`^[a-z]:\\(system volume information|\$recycle\.bin|recovery|boot|\$winreagent|config\.msi)${END}`),
    level: 'blocked',
    category: 'Carpeta interna del sistema',
    consequence: 'Contiene puntos de restauración, la Papelera o archivos de arranque. Puede impedir recuperar o iniciar Windows.',
  },

  // --- Excepciones seguras DENTRO de Windows (por eso van antes que la regla de Windows) ---
  {
    pattern: new RegExp(String.raw`^[a-z]:\\windows\\temp${END}`),
    level: 'low',
    category: 'Temporales de Windows',
    consequence: 'No hacen falta. Los que estén en uso simplemente no se van a borrar.',
  },
  {
    pattern: new RegExp(String.raw`^[a-z]:\\windows\\softwaredistribution\\download${END}`),
    level: 'medium',
    category: 'Descargas de Windows Update',
    consequence:
      'Se vuelven a bajar si hacen falta. Mejor limpiarlo con "Liberar espacio" de Windows para no cortar una actualización en curso.',
  },
  {
    pattern: new RegExp(String.raw`^[a-z]:\\windows${END}`),
    level: 'blocked',
    category: 'Sistema operativo',
    consequence: 'Windows deja de funcionar o no arranca.',
  },
  {
    pattern: new RegExp(String.raw`^[a-z]:\\(windows\.old|\$windows\.~bt|\$windows\.~ws)${END}`),
    level: 'medium',
    category: 'Instalación anterior de Windows',
    consequence:
      'Perdés la opción de volver a la versión anterior de Windows. Borralo desde "Liberar espacio" porque tiene permisos especiales.',
  },
  {
    pattern: new RegExp(String.raw`(\\windowsapps|\\xboxgames|^[a-z]:\\xbox)${END}`),
    level: 'blocked',
    category: 'Apps y juegos de Microsoft Store / Xbox',
    consequence:
      'Están protegidos por el sistema. Desinstalalos desde la app Xbox o Configuración > Aplicaciones; a mano quedan instalaciones rotas.',
  },
  {
    pattern: /^[a-z]:\\(program files|program files \(x86\)|programdata)$/,
    level: 'blocked',
    category: 'Carpeta de programas',
    consequence: 'Rompe TODOS los programas instalados.',
  },
  {
    pattern: new RegExp(String.raw`^[a-z]:\\users(\\[^\\]+)?$|${USER}\\appdata(\\(local|roaming|locallow))?$`),
    level: 'blocked',
    category: 'Perfil de usuario',
    consequence: 'Perderías la configuración y los datos de todas tus aplicaciones, o tu usuario entero.',
  },

  // --- BAJO: se regenera solo ---
  {
    pattern: new RegExp(String.raw`\\node_modules${END}`),
    level: 'low',
    category: 'Dependencias de Node',
    consequence: 'Se regeneran con "pnpm install" o "npm install" dentro del proyecto.',
  },
  {
    pattern: new RegExp(String.raw`\\appdata\\local\\temp${END}`),
    level: 'low',
    category: 'Temporales del usuario',
    consequence: 'No hacen falta. Los que estén en uso simplemente no se van a borrar.',
  },
  {
    pattern: new RegExp(
      String.raw`\\(npm-cache|\.npm|yarn\\cache|pnpm\\store|\.pnpm-store|nuget\\packages|pip\\cache|\.gradle\\caches|\.m2\\repository|go\\pkg\\mod|\.cargo\\registry)${END}`,
    ),
    level: 'low',
    category: 'Caché de paquetes',
    consequence: 'Se vuelve a descargar cuando instales dependencias. Solo cuesta tiempo y red.',
  },
  {
    pattern: new RegExp(String.raw`\\steamapps\\(shadercache|downloading|temp)${END}`),
    level: 'low',
    category: 'Caché de Steam',
    consequence: 'Steam la regenera. Algún juego puede tardar más la primera vez que lo abras.',
  },
  {
    pattern: new RegExp(
      String.raw`\\(cache|cache2|code cache|gpucache|shadercache|dawncache|grshadercache|crashdumps|crashpad|d3dscache)${END}`,
    ),
    level: 'low',
    category: 'Caché',
    consequence: 'La aplicación la regenera. Puede tardar un poco más la próxima vez que la abras.',
  },
  {
    pattern: new RegExp(String.raw`\\(__pycache__|\.next|\.turbo|\.vite|\.parcel-cache|\.nuxt)${END}`),
    level: 'low',
    category: 'Artefactos de compilación',
    consequence: 'Se regeneran al compilar o ejecutar el proyecto.',
  },

  // --- ALTO: puede perderse algo irrecuperable o romper programas ---
  {
    pattern: new RegExp(String.raw`\\\.git${END}`),
    level: 'high',
    category: 'Historial de Git',
    consequence: 'Perdés el historial del repositorio y todo lo que no hayas subido (push).',
  },
  {
    pattern: /^[a-z]:\\(program files|program files \(x86\))\\/,
    level: 'high',
    category: 'Programa instalado',
    consequence:
      'El programa deja de funcionar y Windows lo sigue mostrando como instalado. Desinstalalo desde Configuración > Aplicaciones.',
  },
  {
    pattern: /^[a-z]:\\programdata\\/,
    level: 'high',
    category: 'Datos compartidos de programas',
    consequence: 'Guarda licencias, configuraciones y bases de datos de apps instaladas. Puede romperlas o pedirte reactivar licencias.',
  },
  {
    pattern: new RegExp(String.raw`${USER}\\(documents|desktop|pictures|videos|music|onedrive[^\\]*|saved games)${END}`),
    level: 'high',
    category: 'Archivos personales',
    consequence: 'Si no tenés copia, se pierden para siempre. Ojo: muchos juegos guardan las partidas en Documentos.',
  },

  // --- MEDIO: se puede recuperar, pero con costo ---
  {
    pattern: new RegExp(String.raw`\\steamapps\\common\\[^\\]+`),
    level: 'medium',
    category: 'Juego de Steam',
    consequence:
      'Se puede reinstalar, pero Steam lo sigue mostrando como instalado. Mejor desinstalarlo desde Steam. Las partidas suelen estar en la nube o en Documentos/AppData.',
  },
  {
    pattern: new RegExp(String.raw`${USER}\\downloads${END}`),
    level: 'medium',
    category: 'Descargas',
    consequence: 'Los instaladores se pueden volver a bajar, pero si hay documentos únicos se pierden. Revisá antes.',
  },
  {
    pattern: new RegExp(String.raw`${USER}\\appdata\\(local|roaming|locallow)\\[^\\]+`),
    level: 'medium',
    category: 'Datos de una aplicación',
    consequence:
      'Perdés configuración, sesiones iniciadas y a veces datos locales (historial, partidas). Si la app sigue instalada, puede fallar o empezar de cero.',
  },
]

const UNKNOWN: RiskAssessment = {
  level: 'medium',
  category: 'Sin regla conocida',
  consequence: 'No reconozco esta ruta. Revisá qué contiene antes de borrarla.',
}

export function normalizeWinPath(path: string): string {
  const n = path.replace(/\//g, '\\').toLowerCase()
  return n.length > 3 ? n.replace(/\\+$/, '') : n // "c:\" se queda como está
}

export function assessDeletionRisk(path: string): RiskAssessment {
  const normalized = normalizeWinPath(path)
  const rule = rules.find((r) => r.pattern.test(normalized))
  if (!rule) return UNKNOWN
  const { level, category, consequence } = rule
  return { level, category, consequence }
}

const SEVERITY: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, blocked: 3 }

export function worstRisk(levels: RiskLevel[]): RiskLevel | null {
  if (levels.length === 0) return null
  return levels.reduce((worst, l) => (SEVERITY[l] > SEVERITY[worst] ? l : worst))
}
