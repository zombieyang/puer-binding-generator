// 放到不同项目时，首先要修改此处的路径
const UNREAL_MAIN_MODULE_NAME = 'puerts_unreal_demo'

const { isAbsolute, join, resolve } = require('path')
const { readFileSync } = require('fs');
const projectRootPath = resolve(process.cwd(), '../..').replace(/\\/g, '/')
const unrealEngineSourcePath = (() => {
    const slnContent = readFileSync(join(projectRootPath, UNREAL_MAIN_MODULE_NAME + '.sln'), 'utf-8')
    const lineWithEnginePath = slnContent.split('\n').find(line => {
        return line.includes('VisualStudioDebugging')
    });
    if (!lineWithEnginePath) {
        throw new Error('Failed to find Unreal Engine path in solution file')
    }
    const path = lineWithEnginePath.trim().split('\\Extras')[0].replace(/\\/g, '/') + '/Source'
    return isAbsolute(path) ? path : join(projectRootPath, path);
})()
const responseFileContent = (()=> {
    const contentA = readFileSync(
        join(projectRootPath, `Plugins/Puerts/Intermediate/Build/Win64/x64/UnrealEditor/Development/Puerts/Module.Puerts.cpp.obj.rsp`),
        'utf-8'
    )
    const contentB = readFileSync(
        join(projectRootPath, `Plugins/Puerts/Intermediate/Build/Win64/x64/UnrealEditor/Development/Puerts/Puerts.Shared.rsp`),
        'utf-8'
    )
    return contentA + '\n' + contentB;
})()

const defines = ['UNREAL_CODE_ANALYZER', '_CRT_USE_BUILTIN_OFFSETOF', '_MSC_VER=1934']
const includePaths = []
const forceIncludes = []
responseFileContent.split('\n').forEach(line => {
    if (line.startsWith('/I') || line.startsWith('/external:I')) {

        let path = line.slice(line.indexOf('I') + 1).trim().replace(/\\/g, '/').replace(/^\"/g, '').replace(/\"$/g, '')
        if (!isAbsolute(path)) {
            includePaths.push(join(unrealEngineSourcePath, path))
        } else { 
            includePaths.push(path)
        }

    } else if (line.startsWith('/FI')) {
        forceIncludes.push(line.slice(3).trim().replace(/\\/g, '/').replace(/^\"/g, '').replace(/\"$/g, ''))

    } else if (line.startsWith('/D')) {
        defines.push(line.slice(2).trim())
    }
})

export default {
    "output": {
        "puerHeaderName": `AllBinding.h`,
        // 生成位置
        "binding": `${projectRootPath}/Plugins/Puerts/Source/JsEnv/Private/TestBinding/BindingWrap.h`,
        // UE暂不需要这两个
        "dts": ".trash/index.d.ts",
        "patchjs": ".trash/sc.js"
    },
    "base": projectRootPath,
    defines,
    includePaths,
    "headers": [
        ...forceIncludes,
        // 搜索入口文件
        join(projectRootPath, "Plugins/Puerts/Source/JsEnv/Private/TestBinding/TestClass.cpp"),
        join(projectRootPath, "Plugins/Puerts/Source/JsEnv/Private/TestBinding/AdvanceTestClass.cpp"),
    ],
    "includes": [
        // 要生成的类
        "BaseClass::*",
        "NoDeleteClass::*",
        "TestClass::*",
        "AdvanceTestClass::*",
    ],
    // 涉及下列的任何成员都不生成
    "refExcludes": {
        "namespaces": [
        ],
        "types": [
        ],
        "members": [
        ]
    },
    // 用到这些类的成员可以生成，但其本身的binding不生成，需要手写。
    "genExcludes": {
        "types": [
        ],
    },
    // 指定某些类在dts中使用特殊TS名字
    "specialTSNames": {
    }
}
