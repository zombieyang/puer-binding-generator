const { join } = require('path')

const cwd = process.cwd()

const projectRootPath = cwd

const defines = []
const includePaths = []

export default {
    "output": {
        // manually maintaining file for including all binding.
        "puerHeaderName": "AllBinding.h",
        // the generate position.
        "dts": join(cwd, "dist/dts/index.d.ts"),
        "patchjs": join(cwd, "dist/patch/type-patch.js"),
        "binding": join(cwd, "dist/binding/Binding.h"),
    },
    "base": projectRootPath,
    defines,
    includePaths,
    "headers": [
        join(projectRootPath, "./src/main.cpp"),
    ],
    // "includes": [],
    "includes": "*",
    // all the api with the usage of these namespace/type/member would not generated
    "refExcludes": {
        "namespaces": [
        ],
        "types": [
        ],
        "members": [
        ]
    },
    // these namespace/type/member itself would not generated
    // but it won't let the api with the usage of these namespace/type/member be not generatged
    // useful for something you want to write binding manually.
    "genExcludes": {
        "namespaces": [
        ],
        "types": [
        ],
        "members": [
        ]
    },
    // specify the dts name for some special class
    "specialTSNames": {
    }
}