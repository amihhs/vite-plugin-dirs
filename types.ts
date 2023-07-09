export interface DirsOptions {
  /**
   * Search files also inside `node_modules/` and hidden directories (e.g. `.git/`). This might have impact on performance.
   *
   * @default false
   */
  exhaustive?: boolean | RegExp
}
export type GeneralDirsOptions = DirsOptions
export interface ParsedImportDirs {
  firstArgType: string
  start: number
  end: number
  dirs: string[]
  options: DirsOptions
  resolvedDirs: string[]
  maps: DirMap[]
}
export interface DirMap {
  name: string
  type: 'dir' | 'file'
  children?: DirMap[]
}
export interface MetaDirsFunction {
  <M extends string | string[]>(
    dirs: M,
    options?: DirsOptions
  ): M extends string ? DirMap : DirMap[]
}
