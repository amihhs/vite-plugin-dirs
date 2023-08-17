import { posix } from 'node:path'
import type { DirMap, DirsOptions } from './types'

export const importDirsRE = /\bimport\.meta\.(dirs)(?:<\w+>)?\s*\(/g

export const knownOptions = {
  exhaustive: 'boolean',
} as const

export function toPosixPath(p: string) {
  return p.split('\\').join('/')
}

// github.com/antfu/vite-plugin-glob/src/plugin.ts
export async function toAbsolutePath(
  path: string,
  root: string,
  dirname: string,
  resolveId: (id: string) => string | Promise<string>,
): Promise<string> {
  let pre = ''
  if (path.startsWith('!')) {
    pre = '!'
    path = path.slice(1)
  }

  if (path.startsWith('/'))
    return pre + posix.join(root, path.slice(1))
  if (path.startsWith('./'))
    return pre + posix.join(dirname, path.slice(2))
  if (path.startsWith('../'))
    return pre + posix.join(dirname, path)
  if (path.startsWith('**'))
    return pre + path

  const resolved = await resolveId(path)
  if (resolved.startsWith('/'))
    return pre + resolved

  throw new Error(`Invalid first argument: ${path}. It must starts with '/' or './'`)
}

export function isVirtualModule(id: string) {
  // https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
  return id.startsWith('virtual:') || id.startsWith('\0') || !id.includes('/')
}

export function invalidGlobImportSyntaxError(msg: string, start: number) {
  const e = new Error(`Invalid syntax: ${msg}`)
  ;(e as any).pos = start
  return e
}

export function filterExhaustive(dirs: DirMap[], exhaustive: DirsOptions['exhaustive']) {
  if (typeof exhaustive === 'boolean' && exhaustive)
    exhaustive = /^\.|node_modules/

  if (!exhaustive)
    return dirs
  const newDirs: DirMap[] = []
  dirs.forEach((dir) => {
    if ((exhaustive as RegExp).test(dir.name))
      return
    if (dir.type === 'dir')
      dir.children = filterExhaustive(dir.children!, exhaustive)
    newDirs.push(dir)
  })

  return newDirs
}

export function getDirMapFiles(dir: DirMap, root: string) {
  const files: string[] = []
  if (dir.type === 'file') {
    files.push(posix.join(root, dir.name))
  }
  else {
    dir.children!.forEach((child) => {
      files.push(...getDirMapFiles(child, posix.join(root, dir.name)))
    })
  }
  return files
}
