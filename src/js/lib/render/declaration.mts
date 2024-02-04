import { TSClass, TSType } from "../definitions.mjs";
import UsageCollector from "../UsageCollector.mjs";

export default function renderDeclaration(
    usageCollector: UsageCollector
) {
    let ret = 'declare namespace SC {\n\n'

    const allClsEnum = usageCollector.getAllUsedCls();
    const allCls = [];
    for (const cls of allClsEnum) {
        allCls.push(cls);
        ret += renderClass(cls, usageCollector) + '\n\n';
    }

    return ret + "\n\n}";
}

function renderTypeName(type: TSType) {
    const name = type.name;
    return name;
}

function renderClass(cls: TSClass, usageCollector: UsageCollector) {
    let ret = ''
    let baseClsStr = '';
    if (cls.baseTypeFullName) {
        const baseAstCls = usageCollector.findAstClass(cls.baseTypeFullName);
        if (baseAstCls) {
            if (baseAstCls.IsAbstract && baseAstCls.Destructors.Count == 0)
                baseClsStr = ' implements ' + cls.baseTypeFullName;
            else 
                baseClsStr = ' extends ' + cls.baseTypeFullName;
        }
    }
    ret += `class ${cls.fullname}${baseClsStr} { \n`;

    if (cls.ctor.overloads.length != 0) {
        ret += cls.ctor.overloads.map((overload) => {
            return `    constructor(${overload.params.map((param) => {
                return `${param.name}: ${renderTypeName(param.type)}${param.defaultValue ? ' = ' + param.defaultValue : ''}`
            }).join(', ')});`
        }).join('\n');
        ret += '\n\n';
    }

    if (cls.functions.length != 0) {
        ret += cls.functions.map((func) => {
            return func.overloads.map((overload) => {
                return `    public ${overload.isStatic ? 'static ': ''}${overload.name}(${overload.params.map((param) => {
                    return `${param.name}: ${renderTypeName(param.type)}${param.defaultValue ? ' = ' + param.defaultValue : ''}`
                }).join(', ')}) : ${renderTypeName(overload.returnType)};`
            }).join('\n');
        }).join('\n\n');
        ret += '\n\n';
    }

    if (cls.fields.length != 0) {
        ret += cls.fields.map((field) => {
            return `    public ${field.isStatic ? 'static ': ''}${field.name}: ${renderTypeName(field.type)};`
        }).join('\n\n');
        ret += '\n\n';
    }
    ret += '    [Symbol.dispose](): any; \n';
    ret += '\n}'
    return ret
}