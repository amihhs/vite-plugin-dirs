# vite-plugin-dirs [![npm](https://img.shields.io/npm/v/vite-plugin-dirs.svg)](https://npmjs.com/package/vite-plugin-dirs)

> A vite plugin to get the names of all files in a specified directory

```ts
const settled = import.meta.dirs('/src', { exhaustive: true })

// to
const settled = {
  name: 'src',
  type: 'dir',
  children: [
    {
      name: 'main.ts',
      type: 'file'
    },
    {
      name: 'style.css',
      type: 'file'
    },
    {
      name: 'test',
      type: 'dir',
      children: [
        {
          name: '1.ts',
          type: 'file'
        }
      ]
    }
  ]
}
```

## Install

```bash
npm i vite-plugin-dirs -D
```

## Usage

```ts
import dirs from 'vite-plugin-dirs'

export default defineConfig({
  // ...
  plugins: [
    dirs(),
  ],
  // ...
})
```

## Client Types

add vite-plugin-dirs/client to compilerOptions.types of your tsconfig:

```json
{
  "compilerOptions": {
    "types": [
      "vite-plugin-dirs/client"
      ]
  }
}

```
  
## Options

```ts
export interface DirsOptions {
  /**
   * exclude some files or directories, default: /^\.|node_modules/
   * @default false
   */
  exhaustive?: boolean | RegExp
}
```
