const { join } = require('path')

const cwd = process.cwd()

const projectRootPath = "D:/_CODE_/puer-binding-generator/sample"

const defines = []
const includePaths = []

export default {
    "output": {
        // manually maintaining file for including all binding.
        "puerHeaderName": "AllBinding.h",
        // the generate position.
        "dts": join(projectRootPath, "dist/dts/index.d.ts"),
        "patchjs": join(projectRootPath, "dist/patch/type-patch.js"),
        "binding": join(projectRootPath, "dist/binding/Binding.h"),
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