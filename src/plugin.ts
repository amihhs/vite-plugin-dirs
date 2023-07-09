import { posix } from 'node:path'
import type { ModuleNode, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import MagicString from 'magic-string'
import mm from 'micromatch'
import type { DirsOptions, ParsedImportDirs } from '../types'
import { parsedImportDirs } from './analyze'
import { filterExhaustive, isVirtualModule, toPosixPath } from './shared'

const { dirname } = posix

/**
 * @example
 * dirs
 * src/
 *  pages/
 *   index.vue
 *   docs/
 *    index.md
 *    about.md
 *    tags/
 *      index.md
 *      vue.md
 *
 * in index.vue file
 * import.meta.dirs('./docs') -> {
 *  index: { type:'file', name: 'index.md' },
 *  about: { type:'file', name: 'about.md' },
 *  tags: { type:'dir', name: 'tags', children: [
 *    { type:'file', name: 'index.md' }
 *    { type:'file', name: 'vue.md' }
 *   ]}
 * }
 *
 */
// import.meta.dirs('path', config) -> DirMap[] | DirMap
export function importDirsPlugin(options: DirsOptions = {}): Plugin {
  let server: ViteDevServer | undefined
  let config: ResolvedConfig
  const map = new Map<string, string[]>()

  function updateMap(id: string, info: ParsedImportDirs[]) {
    const allDirs: string[] = []
    for (const i of info) {
      const dirs = i.resolvedDirs
      allDirs.push(...dirs)
    }
    map.set(id, allDirs)
  }

  function getAffectedModules(file: string): ModuleNode[] {
    const modules: ModuleNode[] = []
    file = toPosixPath(file)
    for (const [id, allFiles] of map) {
      allFiles.forEach((i) => {
        const reg = mm.makeRe(i, { contains: true })
        if (file.match(reg))
          modules.push(server?.moduleGraph?.getModuleById(id) as ModuleNode)
      })
    }
    return modules
  }
  return {
    name: 'vite-plugin-dirs',
    configResolved(_config) {
      config = _config
    },
    buildStart() {
      map.clear()
    },
    handleHotUpdate(ctx) {
      if (!ctx.file)
        return
      const affected = getAffectedModules(ctx.file)
      if (affected.length)
        return [...ctx.modules, ...affected]
    },
    configureServer(_server) {
      server = _server
      const handleFileAddUnlink = (file: string) => {
        const modules = getAffectedModules(file)
        modules.forEach((i) => {
          if (i?.file)
            _server.moduleGraph.onFileChange(i.file)
        })
      }
      server.watcher.on('unlink', handleFileAddUnlink)
    },
    async transform(code, id) {
      const result = await transform(
        code,
        id,
        config.root,
        im => this.resolve(im, id).then(i => i?.id || im),
        options,
      )
      if (result) {
        updateMap(id, result.matches)
        return {
          code: result.s.toString(),
          map: result.s.generateMap() as any,
        }
      }
    },
  }
}

async function transform(
  code: string,
  id: string,
  root: string,
  resolveId: (id: string) => Promise<string> | string,
  option: DirsOptions,
) {
  id = toPosixPath(id)
  root = toPosixPath(root)
  const dir = isVirtualModule(id) ? null : dirname(id)

  const matches = await parsedImportDirs(code, dir, root, resolveId)

  const s = new MagicString(code)
  matches.map(async (match) => {
    const { start, end, firstArgType, options } = match
    let { maps } = match
    const opt = Object.assign({}, options, option)
    if (opt.exhaustive)
      maps = filterExhaustive(maps, opt.exhaustive)

    if (firstArgType === 'string' && maps.length === 1)
      s.overwrite(start, end, JSON.stringify(maps[0]))
    else
      s.overwrite(start, end, JSON.stringify(maps))
  })
  return {
    s,
    matches,
  }
}
