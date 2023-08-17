import { posix } from 'node:path'
import { lstatSync, readdirSync } from 'node:fs'
import type { ArrayExpression, CallExpression, Literal, Node, SequenceExpression } from 'estree'
import { parseExpressionAt } from 'acorn'
import type { DirMap, GeneralDirsOptions, ParsedImportDirs } from './types'
import { importDirsRE, invalidGlobImportSyntaxError, knownOptions, toAbsolutePath } from './shared'

const { basename, join } = posix

export async function parsedImportDirs(
  code: string,
  dir: string | null,
  root: string,
  resolveId: (id: string) => string | Promise<string>,
): Promise<ParsedImportDirs[]> {
  // check if the file contains import.meta.dirs
  const matches = Array.from(code.matchAll(importDirsRE))
  const tasks = matches.map(async (match) => {
    const start = match.index!
    const err = (msg: string) => invalidGlobImportSyntaxError(msg, start)
    let ast: CallExpression | SequenceExpression
    let lastTokenPos: number | undefined
    try {
      ast = parseExpressionAt(code, start, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ranges: true,
        onToken: (token) => {
          lastTokenPos = token.end
        },
      }) as any
    }
    catch (e) {
      const _e = e as any
      if (_e.message && _e.message.startsWith('Unterminated string constant'))
        return undefined!
      if (lastTokenPos == null || lastTokenPos <= start)
        throw _e

      // tailing comma in object or array will make the parser think it's a comma operation
      // we try to parse again removing the comma
      try {
        const statement = code.slice(start, lastTokenPos).replace(/[,\s]*$/, '')
        ast = parseExpressionAt(
          ' '.repeat(start) + statement, // to keep the ast position
          start,
          {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ranges: true,
          }) as any
      }
      catch {
        throw _e
      }
    }

    if (ast.type === 'SequenceExpression')
      ast = ast.expressions[0] as CallExpression

    if (ast.type !== 'CallExpression')
      throw err(`Expect CallExpression, got ${ast.type}`)

    if (ast.arguments.length < 1 || ast.arguments.length > 2)
      throw err(`Expected 1-2 arguments, but got ${ast.arguments.length}`)

    const arg1 = ast.arguments[0] as ArrayExpression | Literal
    const arg2 = ast.arguments[1] as Node | undefined

    const { type, dirs } = analyzeFirstArgument(arg1, err)
    const options = analyzeSecondArgument(arg2, err)

    const end = ast.range![1]
    const resolvedDirs = await Promise.all(dirs.map(d => toAbsolutePath(d, root, dir ?? root, resolveId)))
    const maps = await generateDirsMaps(resolvedDirs)
    // console.log('map', JSON.stringify(map))
    return {
      firstArgType: type,
      start,
      end,
      dirs,
      options,
      resolvedDirs,
      maps,
    }
  })

  return (await Promise.all(tasks)).filter(Boolean)
}

function analyzeFirstArgument(arg1: ArrayExpression | Literal, err: (msg: string) => Error) {
  const type = arg1.type === 'ArrayExpression' ? 'array' : 'string'
  const dirs = []
  if (arg1.type === 'ArrayExpression') {
    for (const element of arg1.elements) {
      if (!element)
        continue
      if (element.type !== 'Literal')
        throw err('Could only use literals')
      if (typeof element.value !== 'string')
        throw err(`Expected argument to be a string, but got "${typeof element.value}"`)

      dirs.push(element.value)
    }
  }
  else if (arg1.type === 'Literal') {
    if (typeof arg1.value !== 'string')
      throw err(`Expected argument to be a string, but got "${typeof arg1.value}"`)
    dirs.push(arg1.value)
  }
  else {
    throw err('Could only use literals')
  }

  return { type, dirs }
}

function analyzeSecondArgument(arg2: Node | undefined, err: (msg: string) => Error): GeneralDirsOptions {
  const options: GeneralDirsOptions = {}
  if (arg2) {
    if (arg2.type !== 'ObjectExpression')
      throw err(`Expected the second argument o to be a object literal, but got "${arg2.type}"`)

    for (const property of arg2.properties) {
      if (property.type === 'SpreadElement' || property.key.type !== 'Identifier')
        throw err('Could only use literals')

      const name = property.key.name as keyof GeneralDirsOptions

      if (!(name in knownOptions))
        throw err(`Unknown options ${name}`)

      if (property.value.type !== 'Literal')
        throw err('Could only use literals')

      const valueType = typeof property.value.value
      if (valueType === 'undefined')
        continue

      if (valueType !== knownOptions[name])
        throw err(`Expected the type of option "${name}" to be "${knownOptions[name]}", but got "${valueType}"`)
      options[name] = property.value.value as any
    }
  }
  return options
}

async function generateDirsMaps(dirs: string[]): Promise<DirMap[]> {
  const dirsDetail: DirMap[] = []

  for (const dir of dirs) {
    const files = readdirSync(dir)
    const fileDetails: DirMap[] = []
    for (const i of files) {
      const stat = lstatSync(join(dir, i))
      if (stat.isDirectory()) {
        const children = await generateDirsMaps([join(dir, i)])
        fileDetails.push({ name: basename(i), type: 'dir', children })
      }
      else {
        fileDetails.push({ name: basename(i), type: 'file' })
      }
    }
    dirsDetail.push({
      name: basename(dir),
      type: 'dir',
      children: fileDetails,
    })
  }
  return dirsDetail
}
