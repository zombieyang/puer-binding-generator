import { csForEach, csMap, csWhere } from "./csUtil.mjs";

class TSType {
    public static isNotSupportedType(astType: CS.CppAst.CppType) {
        while ([
            CS.CppAst.CppTypeKind.Array,
            CS.CppAst.CppTypeKind.Pointer,
            CS.CppAst.CppTypeKind.Qualified,
            CS.CppAst.CppTypeKind.Reference,
        ].indexOf(astType.TypeKind) != -1) astType = this.getUnderlyingType(astType);
        if (astType.TypeKind == CS.CppAst.CppTypeKind.Unexposed) return true;
        if (astType.TypeKind == CS.CppAst.CppTypeKind.StructOrClass) return TSClass.isNotSupportedClass(astType as CS.CppAst.CppClass);
        return false;
    }
    public static isNotSupportedTypeForBinding(type: TSType | CS.CppAst.CppType) {
        if (type instanceof TSType) type = type.astType;
        if (type.TypeKind == CS.CppAst.CppTypeKind.Enum) return true;
        return false;
    }
    public static getUnderlyingType(astType: CS.CppAst.CppType) {
        return (astType as CS.CppAst.CppTypeWithElementType).ElementType;
    }
    public get name(): string {
        let cppName = this.cppName;
        switch (this.astType.TypeKind) {
            case CS.CppAst.CppTypeKind.Function:
                const func = this.astType as CS.CppAst.CppFunctionType;
                // return `(${csMap(func.Parameters, (item) => {
                //     return (new TSType(item.Type)).name
                // }).join(', ')}) => ${new TSType(func.ReturnType).name}`
                return `(...args: any[]) => ${new TSType(func.ReturnType).name}`

            case CS.CppAst.CppTypeKind.TemplateArgumentType: 
                if ((this.astType as CS.CppAst.CppTemplateArgument).ArgAsType)
                    return (new TSType((this.astType as CS.CppAst.CppTemplateArgument).ArgAsType)).name
                return cppName;

            case CS.CppAst.CppTypeKind.Enum: return 'number';
            case CS.CppAst.CppTypeKind.Array: return (this.elemType as TSType).name + '[]';
            case CS.CppAst.CppTypeKind.Pointer: 
                const elemType = this.elemType as TSType;
                if (elemType.cppName == 'void') return 'any';
                return (elemType as TSType).name;
            case CS.CppAst.CppTypeKind.Qualified: return (this.elemType as TSType).name;
            case CS.CppAst.CppTypeKind.Reference: return (this.elemType as TSType).name;
            case CS.CppAst.CppTypeKind.Typedef:
                if (this.elemType?.astType.TypeKind == CS.CppAst.CppTypeKind.Primitive) {
                    cppName = this.elemType.cppName;
                } else return cppName;
                
            case CS.CppAst.CppTypeKind.Primitive:
                switch (cppName) {
                    case 'bool': return 'boolean';
                    case 'int': return 'number';
                    case 'uint': return 'number';
                    case 'int8_t': return 'number';
                    case 'uint8_t': return 'number';
                    case 'int16_t': return 'number';
                    case 'uint16_t': return 'number';
                    case 'int16': return 'number';
                    case 'uint16': return 'number';
                    case 'int32_t': return 'number';
                    case 'uint32_t': return 'number';
                    case 'int32': return 'number';
                    case 'uint32': return 'number';
                    case 'int64_t': return 'bigint';
                    case 'uint64_t': return 'bigint';
                    case 'int64': return 'bigint';
                    case 'uint64': return 'bigint';
                    case 'float': return 'number';
                    case 'short': return 'number';
                    case 'double': return 'number';
                    case 'void': return 'void';
                    case 'char': return 'string';
                    case 'wchar_t': return 'string';
                    case 'char16_t': return 'string';
                    case 'char32_t': return 'string';
                    case 'size_t': return 'number';
                    case 'long long': return 'bigint';
                    case 'unsigned long long': return 'bigint';
                    default: throw new Error(`unknown primitive type ${this.cppName}`);
                }
            case CS.CppAst.CppTypeKind.StructOrClass:
                // String will be handled as a js string
                if (cppName == 'String') return 'string';
                const cls = this.astType as CS.CppAst.CppClass;
                if (cls.TemplateKind == CS.CppAst.CppTemplateKind.NormalClass) {
                    return cppName
                }
                // std::function will be handled as a jsfunction
                if (cls.FullParentName == 'std' && cls.Name == 'function') {
                    return new TSType(cls.TemplateSpecializedArguments.get_Item(0)).name
                }
                return `any`

            default: 
                return cppName
        }
    }
    public readonly cppName: string;
    public readonly isPrimitive: boolean;
    public readonly elemType: TSType | undefined;
    
    constructor(public readonly astType: CS.CppAst.CppType) {
        this.cppName = astType.FullName;
        this.astType = astType;
        this.isPrimitive = astType.TypeKind == CS.CppAst.CppTypeKind.Primitive;
        if ([
            CS.CppAst.CppTypeKind.Array,
            CS.CppAst.CppTypeKind.Pointer,
            CS.CppAst.CppTypeKind.Qualified,
            CS.CppAst.CppTypeKind.Reference,
            CS.CppAst.CppTypeKind.Typedef,
        ].indexOf(astType.TypeKind) != -1) {
            this.elemType = new TSType(TSType.getUnderlyingType(astType));
        }
    }

    public get rawType(): TSType {
        return this.elemType ? this.elemType.rawType : this;
    }
}
class TSVariable {
    public static isNotSupportedVariable(astField: CS.CppAst.CppField) {
        if (astField.Visibility != CS.CppAst.CppVisibility.Public) return true;
        if (astField.IsBitField && astField.IsAnonymous) return true;
        return false;
    }
    public readonly name: string;
    public readonly isStatic: boolean;
    public readonly isReadOnly: boolean;
    public readonly type: TSType;
    public readonly defaultValue: string = '';
    constructor(public readonly astField: CS.CppAst.CppField | CS.CppAst.CppParameter, paramIndex: number = 0) {
        if (astField instanceof CS.CppAst.CppParameter) {
            const astParam = astField;
            this.name = astParam.Name || ('arg' + paramIndex);
            this.isStatic = false
            this.isReadOnly = astParam.Type.TypeKind == CS.CppAst.CppTypeKind.Qualified;
            this.type = new TSType(astParam.Type);
            if (astParam.InitExpression) {
                switch(astParam.InitExpression.Kind) {
                    case CS.CppAst.CppExpressionKind.DeclRef:
                        this.defaultValue = 'SC.' + astParam.InitExpression.toString().split('::').join('.');
                        break;
                    case CS.CppAst.CppExpressionKind.FloatingLiteral:
                        this.defaultValue = astParam.InitExpression.toString().replace(/f$/, '');
                        break;
                    default:
                        this.defaultValue = astParam.InitExpression.toString();
                        break;
                }
            }

        } else if (astField instanceof CS.CppAst.CppField) {
            this.name = astField.Name;
            this.isStatic = astField.StorageQualifier == CS.CppAst.CppStorageQualifier.Static;
            this.isReadOnly = astField.Type.TypeKind == CS.CppAst.CppTypeKind.Qualified;
            this.type = new TSType(astField.Type);

        } else {
            throw new Error("not supported");
        }
    }
}
class TSOverload {
    public static isNotSupportedFunction(astFunction: CS.CppAst.CppFunction) {
        if (astFunction.Visibility != CS.CppAst.CppVisibility.Public) return true;
        if (TSType.isNotSupportedType(astFunction.ReturnType)) return true;
        if (astFunction.Flags & CS.CppAst.CppFunctionFlags.Variadic) return true;
        if (csWhere(astFunction.Parameters, (param: CS.CppAst.CppParameter) => {
            return TSType.isNotSupportedType(param.Type)// || param.Type.FullName == 'const char*'
        })) return true;
        return false;
    }
    public readonly returnType: TSType;
    public readonly params: TSVariable[] = [];
    public readonly name: string;
    public readonly isStatic: boolean;
    public readonly isConst: boolean;
    constructor(public readonly astFunction: CS.CppAst.CppFunction) {
        this.returnType = new TSType(astFunction.ReturnType);
        this.name = astFunction.Name;
        this.isStatic = astFunction.IsStatic;
        this.isConst = astFunction.IsConst;
        csForEach(
            astFunction.Parameters,
            (astParam: CS.CppAst.CppParameter, index: number) => {
                this.params.push(new TSVariable(astParam, index));
            }
        )
    }
}
class TSFunction {
    public readonly overloads: TSOverload[] = [];

    constructor(public readonly name: string, public readonly isStatic: boolean) { }

    public addFunction(func: TSOverload | CS.CppAst.CppFunction) {
        if (func instanceof CS.CppAst.CppFunction) {
            func = new TSOverload(func);
        }
        this.overloads.push(func);
    }
}

class TSClass {
    public static isNotSupportedClass(astClass: CS.CppAst.CppClass) {
        if (astClass.IsAnonymous) return true;
        if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.PartialTemplateClass) return true;
        if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateClass) return true;
        if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateSpecializedClass) {
            return !astClass.FullName.includes('std::function');
        }
        return false;
    }
    public readonly fullname: string;
    public readonly baseTypeFullName: string;
    public readonly functions: TSFunction[] = [];
    public readonly ctor: TSFunction;
    public readonly fields: TSVariable[] = [];
    private findOrAddOverload(name: string, isStatic: boolean): TSFunction {
        let overload = this.functions.find(
            (overload) => overload.name == name && overload.isStatic == isStatic
        );
        if (!overload) {
            overload = new TSFunction(name, isStatic);
            this.functions.push(overload);
        }
        return overload;
    }
    constructor(public readonly astClass: CS.CppAst.CppClass) {
        // if (astClass.FullName.endsWith("::")) console.log(astClass.IsAnonymous, astClass.FullName)
        this.fullname = astClass.FullName;
        this.baseTypeFullName = astClass.BaseTypes.Count > 0 ? astClass.BaseTypes.get_Item(0).Type.FullName : "";

        this.ctor = new TSFunction('constructor', false);
        if (!this.astClass.IsAbstract)
            csForEach(this.astClass.Constructors, (astFunction: CS.CppAst.CppFunction) => {
                if (TSOverload.isNotSupportedFunction(astFunction)) return;
                this.ctor.addFunction(astFunction);
            })
    }
    public addMember(signature: string) {
        const sign = signature.split(':').pop();

        if (sign == this.astClass.Name) {

        } else if (sign == '~' + this.astClass.Name) {

        } else {
            csForEach(this.astClass.Functions, (astFunction: CS.CppAst.CppFunction) => {
                if (astFunction.Name != sign) return;
                if (TSOverload.isNotSupportedFunction(astFunction)) return;
                const overload = this.findOrAddOverload(astFunction.Name, astFunction.IsStatic);
                overload.addFunction(astFunction);
            });
            csForEach(this.astClass.Fields, (astField: CS.CppAst.CppField) => {
                if (astField.Name != sign) return;
                if (TSVariable.isNotSupportedVariable(astField)) return;
                this.fields.push(new TSVariable(astField));
            });
        }
    }
}

export {
    TSClass,
    TSFunction,
    TSOverload,
    TSVariable,
    TSType
}