import { obfuscate, ObfuscatorOptions } from "javascript-obfuscator"
import {
  convertMetroRawSourceMapToStandardSourceMap,
  composeSourceMaps,
  MetroRawSourceMap,
} from "./composeSourceMaps"
import { RawSourceMap } from "source-map/source-map"

export function obfuscateCode(code: string, options: ObfuscatorOptions) {
  const result = obfuscate(code, options)
  return {
    code: result.getObfuscatedCode(),
  }
}

export function obfuscateCodePreservingSourceMap(
  code: string,
  map: string | RawSourceMap | MetroRawSourceMap,
  originalFilename: string,
  originalSource: string,
  options: ObfuscatorOptions,
) {
  const obfuscationResult = obfuscate(code, options)
  const obfuscationResultMap = obfuscationResult.getSourceMap()

  if (!obfuscationResultMap) {
    throw new Error(
      "javascript-obfuscator did not return a source map for file " +
        originalFilename,
    )
  }

  if (Array.isArray(map)) {
    map = convertMetroRawSourceMapToStandardSourceMap(
      map,
      originalFilename,
      originalSource,
    )
  }

  return {
    code: obfuscationResult.getObfuscatedCode(),
    map: composeSourceMaps(
      map,
      obfuscationResultMap,
      originalFilename,
      originalSource,
    ),
  }
}
