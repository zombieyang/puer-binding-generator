import { TSClass, TSType, TSVariable } from "../definitions.mjs";
import UsageCollector from "../UsageCollector.mjs";

function renderBinding(
    usageExpander: UsageCollector,
    BindingConfig: any,
    bindingFunctionName: string
) {
    const allClsEnum = usageExpander.getAllUsedCls();
    const allCls = [];
    for (const cls of allClsEnum) {
        allCls.push(cls);
    }

    const allHeaders = usageExpander.getAllHeaders();

    return `
#pragma once
#include "Puerh.h"
${(function () {
            const includePaths = BindingConfig.includePaths

            return allHeaders.map((header) => {
                let converted = false;
                header = header.replace(/\\/g, '/');
                includePaths.forEach((includePath: string) => {
                    if (header.startsWith(includePath) && !converted) {
                        header = header.replace(includePath, '')
                        if (header.startsWith('/')) header = header.slice(1)
                        converted = true;
                    }
                })
                return `#include "${header}"`
            }).join('\n')
        })()}
${allCls.map((cls) => {
    return renderClassDeclare(cls) + renderClassOverloadWithDefaultValue(cls)
}).join('')}
static void ${bindingFunctionName}() {
    ${allCls.map((cls) => {
            return renderClassBinding(cls)
        }).join('')}
}
    `
}

function renderDefaultValue(param: TSVariable, prefix: string = '') {
    if (param.defaultValue) {
        if (
            !param.type.isPrimitive && 
            param.type.astType.TypeKind == CS.CppAst.CppTypeKind.Reference && 
            param.defaultValueKind == CS.CppAst.CppExpressionKind.Unexposed
        ) {
            // for "" to const String&
            return prefix + `${param.type.rawType.cppName}(${param.defaultValue})`
        }
        return prefix + param.defaultValue
    }
    return '';
}

function renderClassDeclare(cls: TSClass) {
    return `\nUsingCppType(${cls.fullname})`
}
function renderClassOverloadWithDefaultValue(cls: TSClass) {
    let ret = '';

    // ctor with default value is not supported by puerts
    // if (cls.ctor.overloads.length > 1) {
    //     cls.ctor.overloads.forEach((overload) => {
    //         const self = overload.isStatic ? "(*)" : `(${cls.fullname}::*)`
    //         const methodSign = `${overload.returnType.cppName}${self}(${overload.params.map(param => param.type.cppName).join(', ')})${overload.isConst ? ' const' : ''}`;
    //         ret += `DeclOverload(${cls.fullname}, ${methodSign}, &${cls.fullname}::${overload.name}${overload.params.map(param => {
    //             if (param.defaultValue) {
    //                 return `,  ${param.defaultValue}`
    //             }
    //             return '';
    //         }).filter(str => str).join('')})\n`
    //     })
    // }
    cls.functions.forEach((overload) => {
        if (overload.overloads.length > 1) {
            ret += `\nDeclOverloads(${cls.fullname}_${overload.name})`
            overload.overloads.forEach((overload) => {
                const self = overload.isStatic ? "(*)" : `(${cls.fullname}::*)`
                const methodSign = `${overload.returnType.cppName}${self}(${overload.params.map(param => param.type.cppName).join(', ')})${overload.isConst ? ' const' : ''}`;
                ret += `\nDeclOverload(${cls.fullname}_${overload.name}, ${methodSign}, &${cls.fullname}::${overload.name}${overload.params
                    .map(param => renderDefaultValue(param, ', ')).filter(str => str).join('')})`
            })
        }
    });

    return ret;
}
function renderClassBinding(cls: TSClass) {
    if (cls.astClass.IsAbstract && cls.astClass.Destructors.Count == 0) return '';

    let res = `
PUERTS_NAMESPACE::DefineClass<${cls.fullname}>()\n`
    if (cls.baseTypeFullName) {
        res += `    .Extends<${cls.baseTypeFullName}>()\n`
    }
    if (cls.ctor.overloads.length == 0) {

    } else if (cls.ctor.overloads.length == 1) {
        const ctor = cls.ctor.overloads[0];
        if (ctor.params.length == 0)
            res += `    .Constructor()\n`
        else
            res += `    .Constructor<${ctor.params.map(param => param.type.cppName).join(', ')}>()\n`
    } else {
        res += `    .Constructor(
        CombineConstructors(\n${cls.ctor.overloads.map((ctor) => {
            return `            MakeConstructor(${cls.fullname}${ctor.params.map(param => ', ' + param.type.cppName).join('')})`
        }).join(",\n")}
        )
    )\n`
    }

    cls.functions.forEach((overload) => {
        const self = overload.isStatic ? "(*)" : `(${cls.fullname}::*)`
        res += overload.isStatic ? `    .Function("${overload.name}", ` : `    .Method("${overload.name}", `

        if (overload.overloads.length == 1) {
            const method = overload.overloads[0];
            const methodSign = `${method.returnType.cppName}${self}(${method.params.map(param => param.type.cppName).join(', ')})${method.isConst ? ' const' : ''}`;
            res += `SelectFunction(${methodSign}, &${cls.fullname}::${method.name}${method.params
                .map(param => renderDefaultValue(param, ', ')).filter(str => str).join('')}))\n`

        } else {
            res += `CombineOverloads(${overload.overloads.map((method) => {
                const methodSign = `${method.returnType.cppName}${self}(${method.params.map(param => {
                    return param.type.cppName

                }).join(', ')})${method.isConst ? ' const' : ''}`;
                // return `\n        MakeOverload(${methodSign}, &${cls.fullname}::${method.name})`
                return `\n        SelectOverload(${cls.fullname}_${method.name}, ${methodSign})`
            }).join(",")
                }\n    ))\n`
        }
    })
    cls.fields.forEach((field) => {
        if (field.isStatic) {
            if (field.isReadOnly) {
                res += `    .Variable("${field.name}", MakeReadonlyVariable(&${cls.fullname}::${field.name}))\n`

            } else {
                res += `    .Variable("${field.name}", MakeVariable(&${cls.fullname}::${field.name}))\n`
            }

        } else {
            if (field.isReadOnly) {
                res += `    .Property("${field.name}", MakeReadonlyProperty(&${cls.fullname}::${field.name}))\n`

            } else {
                res += `    .Property("${field.name}", MakeProperty(&${cls.fullname}::${field.name}))\n`

            }
        }

    })
    res += "    .Register();";
    return res;
}

export default renderBinding;