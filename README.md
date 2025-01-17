# bare-module

Module support for JavaScript.

```
npm i bare-module
```

## Usage

```js
const Module = require('bare-module')
````

## Packages

A package is directory with a `package.json` file.

### Fields

#### `"name"`

```json
{
  "name": "my-package"
}
```

The name of the package. This is used for [addon resolution](https://github.com/holepunchto/bare-addon-resolve#algorithm), [self-referencing](#self-referencing), and importing packages by name.

#### `"version"`

```json
{
  "version": "1.2.3"
}
```

The current version of the package. This is used for [addon resolution](https://github.com/holepunchto/bare-addon-resolve#algorithm).

#### `"type"`

```json
{
  "type": "module"
}
```

The module format used for `.js` files. If not defined, `.js` files are interpreted as CommonJS. If set to `"module"`, `.js` files are instead interpreted as ES modules.

#### `"exports"`

```json
{
  "exports": {
    ".": "./index.js"
  }
}
```

The entry points of the package. If defined, only the modules explicitly exported by the package may be imported when importing the package by name.

##### Subpath exports

A package may define more than one entry point by declaring several subpaths with the main export being `"."`:

```json
{
  "exports": {
    ".": "./index.js",
    "./submodule": "./lib/submodule.js"
  }
}
```

When importing the package by name, `require('my-package')` will resolve to `<modules>/my-package/index.js` whereas `require('my-package/submodule')` will resolve to `<modules>/my-package/lib/submodule.js`.

##### Conditional exports

Conditional exports allow packages to provide different exports for different conditions, such as the module format of the importing module:

```json
{
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.cjs"
    }
  }
}
```

When importing the package by name, `require('my-package')` will resolve to `<modules>/my-package/index.cjs` whereas `import 'my-package'` will resolve to `<modules>/my-package/index.mjs`.

Similarly, conditional exports can be used to provide different entry points for different runtimes:

```json
{
  "exports": {
    ".": {
      "bare": "./bare.js",
      "node": "./node.js"
    }
  }
}
```

To provide a fallback for when no other conditions match, the `"default"` condition can be declared:

```json
{
  "exports": {
    ".": {
      "bare": "./bare.js",
      "node": "./node.js",
      "default": "./fallback.js"
    }
  }
}
```

The following conditions are supported, listed in order from most specific to least specific as conditions should be defined:

Condition | Description
:-- | :--
`"bare"` |
`"node"` |
`"import"` |
`"require"` |
`"<platform>"` |
`"<arch>"` |
`"simulator"` |
`"default"` |

##### Self-referencing

Within a package, exports defined in the `"exports"` field can be referenced by importing the package by name. For example, given the following `package.json`...

```json
{
  "name": "my-package",
  "exports": {
    ".": "./index.js",
    "./submodule": "./lib/submodule.js"
  }
}
```

...any module within `my-package` may reference these entry points using either `require('my-package')` or `require('my-package/submodule')`.

##### Exports sugar

If a package defines only a single export, `"."`, it may leave out the subpath entirely:

```json
{
  "exports": "./index.js"
}
```

#### `"imports"`

##### Subpath imports

##### Conditional imports

##### Private imports

#### `"engines"`

```json
{
  "engines": {
    "bare": ">=1.0.5"
  }
}
```

The engine requirements of the package. During module resolution, the versions declared by `Bare.versions` will be tested against the requirements declared by the package and resolution fail if they're not satisfied.

## API

#### `Module.constants`

#### `Module.constants.states`

Constant | Description
:-- | :--
`EVALUATED` |
`SYNTHESIZED` |
`DESTROYED` |

#### `Module.constants.types`

Constant | Description
:-- | :--
`SCRIPT` |
`MODULE` |
`JSON` |
`BUNDLE` |
`ADDON` |

#### `Module.protocol`

#### `Module.cache`

#### `const url = Module.resolve(specifier, parentURL[, options])`

Options include:

```js
{
  isImport = false,
  referrer = null,
  type,
  extensions,
  protocol,
  imports,
  resolutions,
  builtins,
  conditions,
  attributes
}
```

#### `const module = Module.load(url[, source][, options])`

Options include:

```js
{
  referrer = null,
  type,
  defaultType = constants.types.SCRIPT,
  cache,
  main,
  protocol,
  imports,
  resolutions,
  builtins,
  conditions,
  attributes
}
```

#### `const url = Module.asset(specifier, parentURL[, options])`

Options include:

```js
{
  referrer = null,
  protocol,
  imports,
  resolutions,
  conditions
}
```

#### `module.url`

#### `module.filename`

#### `module.dirname`

#### `module.type`

#### `module.defaultType`

#### `module.cache`

#### `module.main`

#### `module.exports`

#### `module.imports`

#### `module.resolutions`

#### `module.builtins`

#### `module.conditions`

#### `module.protocol`

#### `module.destroy()`

### Custom `require()`

#### `const require = Module.createRequire(parentURL[, options])`

Options include:

```js
{
  referrer = null,
  type = constants.types.SCRIPT,
  defaultType = constants.types.SCRIPT,
  cache,
  main,
  protocol,
  imports,
  resolutions,
  builtins,
  conditions
}
```

### Protocols

#### `const protocol = new Module.Protocol(methods)`

Methods include:

```js
{
  preresolve,
  postresolve,
  resolve,
  exists,
  read,
  load,
  asset
}
```

### Bundles

#### `const bundle = new Module.Bundle()`

See <https://github.com/holepunchto/bare-bundle>.

## License

Apache-2.0
