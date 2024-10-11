import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import { ObfuscatorOptions } from "javascript-obfuscator"
import { mangle } from "gnirts"
import { path as appRootPath } from "app-root-path"

import { getCallerFile } from "./getCallerFile"
import {
  MetroTransformer,
  generateAndConvert,
  getMetroTransformer,
  MetroTransformerResult,
  maybeTransformMetroResult,
} from "./getMetroTransformer"
import {
  obfuscateCode,
  obfuscateCodePreservingSourceMap,
} from "./obfuscateCode"
import { extendFileExtension } from "./extendFileExtension"

function getOwnCacheKey(upstreamCacheKey: string, configFilename: string) {
  var key = crypto.createHash("md5")
  key.update(upstreamCacheKey)
  key.update(fs.readFileSync(__filename))
  key.update(fs.readFileSync(configFilename))
  return key.digest("hex")
}

function emitObfuscatedFile(code: string, filename: string, pre = false) {
  const emitDir = path.dirname(filename)
  const obfuscatedFilename = extendFileExtension(
    path.basename(filename),
    pre ? "pre-obfuscated" : "obfuscated",
  )
  fs.writeFileSync(path.join(emitDir, obfuscatedFilename), code)
}

export interface ObfuscatingTransformerOptions {
  filter?(filename: string, source: string): boolean
  upstreamTransformer?: MetroTransformer
  obfuscatorOptions?: ObfuscatorOptions
  trace?: boolean
  emitObfuscatedFiles?: boolean
  emitPreObfuscatedFiles?: boolean
  enableInDevelopment?: boolean
}

const sourceDir = path.join(appRootPath, "src")

export function obfuscatingTransformer({
  filter = (filename) => filename.startsWith(sourceDir),
  upstreamTransformer = getMetroTransformer(),
  obfuscatorOptions: _obfuscatorOptions,
  ...otherOptions
}: ObfuscatingTransformerOptions): MetroTransformer {
  const callerFilename = getCallerFile()

  const obfuscatorOptions: ObfuscatorOptions = {
    ..._obfuscatorOptions,
    sourceMap: true,
    sourceMapMode: "separate",
    // Unfortunately, string-array mangling produces incompatible react-native code
    stringArray: false,
  }

  return {
    transform(props) {
      const result = upstreamTransformer.transform(props)

      if (props.options.dev && !otherOptions.enableInDevelopment) {
        return result
      }

      const resultCanBeObfuscated = result.code || result.ast

      if (resultCanBeObfuscated && filter(props.filename, props.src)) {
        if (otherOptions.trace) {
          console.log("Obfuscating", props.filename)
        }

        let { code, map }: MetroTransformerResult = result.code
          ? result
          : result.ast
            ? generateAndConvert(result.ast, props.filename)
            : { code: "", map: "" }

        if (!code) {
          return result
        }

        code = mangle(code)

        if (otherOptions.emitPreObfuscatedFiles)
          emitObfuscatedFile(code, props.filename, true)

        if (!map) {
          const obfuscatedResult = obfuscateCode(code, obfuscatorOptions)
          if (otherOptions.emitObfuscatedFiles)
            emitObfuscatedFile(obfuscatedResult.code, props.filename)
          return { code: obfuscatedResult.code }
        }

        const obfuscatedCodeAndMapFile = obfuscateCodePreservingSourceMap(
          code,
          map,
          props.filename,
          props.src,
          obfuscatorOptions,
        )
        if (otherOptions.emitObfuscatedFiles)
          emitObfuscatedFile(obfuscatedCodeAndMapFile.code, props.filename)
        return maybeTransformMetroResult(result, obfuscatedCodeAndMapFile)
      }

      return result
    },

    getCacheKey() {
      return getOwnCacheKey(
        upstreamTransformer.getCacheKey
          ? upstreamTransformer.getCacheKey()
          : "",
        callerFilename,
      )
    },
  }
}
