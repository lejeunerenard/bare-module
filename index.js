const path = require('@pearjs/path')
const Bundle = require('@pearjs/bundle')
const b4a = require('b4a')
const Protocol = require('./lib/protocol')
const binding = require('./binding')

const Module = module.exports = class Module {
  constructor (filename, dirname = path.dirname(filename)) {
    this.filename = filename
    this.dirname = dirname

    this.type = null
    this.info = null
    this.exports = null
    this.definition = null
    this.protocol = null
  }

  static _context = binding.init(
    this._onstaticimport.bind(this),
    this._ondynamicimport.bind(this),
    this._onevaluate.bind(this)
  )

  static _extensions = Object.create(null)
  static _protocols = Object.create(null)
  static _builtins = Object.create(null)
  static _cache = Object.create(null)

  static _onstaticimport (specifier, assertions, referrerFilename) {
    const referrer = this._cache[referrerFilename]

    let protocol

    if (referrer) {
      protocol = referrer.protocol

      specifier = this.resolve(specifier, referrer.dirname, { protocol })
    }

    return this.load(specifier, { protocol, referrer }).definition
  }

  static _ondynamicimport (specifier, assertions, referrerFilename) {
    const definition = this._onstaticimport(specifier, assertions, referrerFilename)

    binding.instantiateModule(definition, this._context)

    return definition
  }

  static _onevaluate (specifier) {
    const module = this._cache[specifier]

    binding.setExport(module.definition, 'default', module.exports)

    for (const [key, value] of Object.entries(module.exports)) {
      binding.setExport(module.definition, key, value)
    }
  }

  static Protocol = Protocol
  static Bundle = Bundle

  static load (specifier, source = null, opts = {}) {
    if (!ArrayBuffer.isView(source) && typeof source !== 'string' && source !== null) {
      opts = source
      source = null
    }

    let {
      referrer = null,
      protocol = null
    } = opts

    if (this._cache[specifier]) return this._synthesize(this._cache[specifier], referrer)

    let proto = specifier.slice(0, specifier.indexOf(':') + 1)

    if (protocol === null && !proto) proto = 'file:'

    if (proto in this._protocols) protocol = this._protocols[proto]

    const module = this._cache[specifier] = new this(specifier)

    let dirname = module.dirname

    while (true) {
      const pkg = path.join(dirname, 'package.json')

      if (protocol.exists(pkg)) {
        try { module.info = Module.load(pkg).exports } catch {}
        break
      }

      if (dirname === '/' || dirname === '.') break

      dirname = path.dirname(dirname)
    }

    if (specifier in this._builtins) {
      module.exports = this._builtins[specifier]
    } else {
      let extension = path.extname(specifier)

      if (extension in this._extensions === false) extension = '.js'

      this._extensions[extension].call(this, module, specifier, source, referrer, protocol)
    }

    return this._synthesize(module, referrer)
  }

  static resolve (specifier, dirname = process.cwd(), opts = {}) {
    if (typeof dirname !== 'string') {
      opts = dirname
      dirname = process.cwd()
    }

    let {
      protocol = null
    } = opts

    let proto = specifier.slice(0, specifier.indexOf(':') + 1)
    if (protocol === null && !proto) proto = 'file:'
    if (proto in this._protocols) protocol = this._protocols[proto]

    const [resolved = null] = this._resolve(protocol.map(specifier, dirname), dirname, protocol)

    if (resolved === null) {
      throw new Error('Could not resolve ' + specifier + ' from ' + dirname)
    }

    return resolved
  }

  static * _resolve (specifier, dirname, protocol) {
    if (this.isBuiltin(specifier)) {
      yield specifier
      return
    }

    if (/^(\/|\.{1,2}\/?)/.test(specifier)) {
      if (specifier[0] === '.') specifier = path.join(dirname, specifier)

      yield * this._resolveFile(specifier, protocol)
      yield * this._resolveDirectory(specifier, protocol)
      return
    }

    yield * this._resolveNodeModules(specifier, dirname, protocol)
  }

  static * _resolveFile (filename, protocol) {
    const f = filename

    if (protocol.exists(f)) yield f
    if (protocol.exists(f + '.js')) yield f + '.js'
    if (protocol.exists(f + '.cjs')) yield f + '.cjs'
    if (protocol.exists(f + '.mjs')) yield f + '.mjs'
    if (protocol.exists(f + '.json')) yield f + '.json'
    if (protocol.exists(f + '.node')) yield f + '.node'
    if (protocol.exists(f + '.pear')) yield f + '.pear'
  }

  static * _resolveIndex (dirname, protocol) {
    yield * this._resolveFile(path.join(dirname, 'index'), protocol)
  }

  static * _resolveDirectory (dirname, protocol) {
    const pkg = path.join(dirname, 'package.json')

    if (protocol.exists(pkg)) {
      const info = this.load(pkg, { protocol }).exports

      if (info.main) {
        const main = path.join(dirname, info.main)

        yield * this._resolveFile(main, protocol)
        yield * this._resolveIndex(main, protocol)
        return
      }
    }

    yield * this._resolveIndex(dirname, protocol)
  }

  static * _resolveNodeModules (specifier, dirname, protocol) {
    for (const nodeModules of this._resolvePaths(dirname)) {
      const filename = path.join(nodeModules, specifier)

      yield * this._resolveFile(filename, protocol)
      yield * this._resolveDirectory(filename, protocol)
    }
  }

  static * _resolvePaths (start) {
    if (start === path.sep) return yield path.join(start, 'node_modules')

    const parts = start.split('/')

    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] !== 'node_modules') {
        yield path.join(parts.slice(0, i + 1).join(path.sep), 'node_modules')
      }
    }
  }

  static _synthesize (module, referrer = null) {
    if (referrer === null) return module

    if (referrer.type === 'esm' && module.type !== 'esm' && module.definition === null) {
      const names = new Set(['default', ...Object.keys(module.exports)])

      module.definition = binding.createSyntheticModule(module.filename, Array.from(names), this._context)
    }

    if (referrer.type === 'cjs' && module.type === 'esm' && module.exports === null) {
      module.exports = binding.getModuleNamespace(module.definition)
    }

    return module
  }

  static isBuiltin (name) {
    return name in this._builtins
  }
}

Module._extensions['.js'] = function (module, filename, source, referrer, protocol) {
  const loader = this._extensions[
    module.info && module.info.type === 'module'
      ? '.mjs'
      : '.cjs'
  ]

  return loader.call(this, module, filename, source, referrer, protocol)
}

Module._extensions['.cjs'] = function (module, filename, source, context, protocol) {
  if (source === null) source = protocol.read(filename)

  if (typeof source !== 'string') source = b4a.toString(source)

  const resolve = (specifier) => {
    return this.resolve(specifier, module.dirname, { protocol })
  }

  const require = (specifier) => {
    return this.load(resolve(specifier), { protocol, referrer: module }).exports
  }

  module.type = 'cjs'
  module.protocol = protocol
  module.exports = {}

  require.cache = this._cache
  require.resolve = resolve

  binding.createFunction(filename, ['require', 'module', 'exports', '__filename', '__dirname'], source, 0)(
    require,
    module,
    module.exports,
    module.filename,
    module.dirname
  )
}

Module._extensions['.mjs'] = function (module, filename, source, referrer, protocol) {
  if (source === null) source = protocol.read(filename)

  if (typeof source !== 'string') source = b4a.toString(source)

  module.type = 'esm'
  module.protocol = protocol
  module.exports = null

  module.definition = binding.createModule(filename, source, 0)

  if (referrer === null || referrer.type !== 'esm') {
    binding.instantiateModule(module.definition, this._context)

    binding.runModule(module.definition)
  }
}

Module._extensions['.json'] = function (module, filename, source, referrer, protocol) {
  if (source === null) source = protocol.read(filename)

  if (typeof source !== 'string') source = b4a.toString(source)

  module.type = 'json'
  module.protocol = protocol

  module.exports = JSON.parse(source)
}

Module._extensions['.pear'] = function (module, filename, source, referrer, protocol) {
  module.type = 'addon'

  module.exports = process.addon(filename)
}

Module._extensions['.node'] = function (module, filename, source, referrer, protocol) {
  module.type = 'addon'

  module.exports = process.addon(filename)
}

Module._extensions['.bundle'] = function (module, filename, source, referrer, protocol) {
  if (source === null) source = protocol.read(filename)

  if (typeof source === 'string') source = b4a.from(source)

  const bundle = Bundle.from(source).mount(filename)

  module.protocol = protocol = new Protocol({
    map (specifier) {
      if (specifier in bundle.imports) specifier = bundle.imports[specifier]
      return specifier
    },

    exists (filename) {
      return bundle.exists(filename)
    },

    read (filename) {
      return bundle.read(filename)
    }
  })

  const entry = Module.load(bundle.main, bundle.read(bundle.main), { protocol })

  module.type = entry.type
  module.exports = entry.exports
}

process.once('exit', () => binding.destroy(Module._context))
