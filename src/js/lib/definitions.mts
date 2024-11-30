import GenerateContext, { GenerateBlackList } from "./GenerateContext.mjs";
import { checkExclude, csForEach, csMap, csWhere } from "./util.mjs";

class TSType {
    public static isNotSupportedTypeForInterop(generateContext: GenerateContext, astType: CS.CppAst.CppType) {
        // if ((globalThis as any).zombietest) console.log('zombietest', astType.FullName, astType.TypeKind, this.getUnderlyingType(astType).TypeKind);
        while (astType.TypeKind == CS.CppAst.CppTypeKind.Qualified ||
            astType.TypeKind == CS.CppAst.CppTypeKind.Typedef) {
            astType = this.getUnderlyingType(astType);
        }

        if (astType.TypeKind == CS.CppAst.CppTypeKind.StructOrClass) {
            return !generateContext.specialTSNames[astType.FullName];
        }
        if (astType.TypeKind == CS.CppAst.CppTypeKind.Reference) {
            let underlyingType = this.getUnderlyingType(astType)
            let isQualified = underlyingType.TypeKind == CS.CppAst.CppTypeKind.Qualified;
            while (underlyingType.TypeKind == CS.CppAst.CppTypeKind.Qualified ||
                underlyingType.TypeKind == CS.CppAst.CppTypeKind.Typedef) {
                underlyingType = this.getUnderlyingType(underlyingType);
            }
            return !isQualified || this.isNotSupportedType(generateContext, underlyingType);
        }

        if (astType.TypeKind == CS.CppAst.CppTypeKind.Array && !astType.FullName.startsWith("char"))
            return true;
        if (astType.TypeKind == CS.CppAst.CppTypeKind.Pointer) {
            let underlyingType = this.getUnderlyingType(astType);
            while (underlyingType.TypeKind == CS.CppAst.CppTypeKind.Qualified ||
                underlyingType.TypeKind == CS.CppAst.CppTypeKind.Typedef) {
                underlyingType = this.getUnderlyingType(underlyingType);
            }
            if (underlyingType.TypeKind != CS.CppAst.CppTypeKind.StructOrClass && underlyingType.FullName != 'char')
                return true;
        }
        return this.isNotSupportedType(generateContext, astType);
    }
    public static isNotSupportedType(generateContext: GenerateContext, astType: CS.CppAst.CppType) {
        let lastKind = null;
        while ([
            CS.CppAst.CppTypeKind.Array,
            CS.CppAst.CppTypeKind.Pointer,
            CS.CppAst.CppTypeKind.Qualified,
            CS.CppAst.CppTypeKind.Reference,
            CS.CppAst.CppTypeKind.Typedef,
        ].indexOf(astType.TypeKind) != -1) {
            // double pointer is not supported
            if (
                (lastKind == CS.CppAst.CppTypeKind.Array || lastKind == CS.CppAst.CppTypeKind.Pointer) &&
                (astType.TypeKind == CS.CppAst.CppTypeKind.Array || astType.TypeKind == CS.CppAst.CppTypeKind.Pointer)
            ) return true;
            lastKind = astType.TypeKind;
            astType = this.getUnderlyingType(astType);
        }
        if (astType.TypeKind == CS.CppAst.CppTypeKind.Unexposed) return true;
        if (astType.FullName.startsWith('std'))
            return astType.FullName.indexOf('function') == -1 && astType.FullName.indexOf('string') == -1;
        if (astType.TypeKind == CS.CppAst.CppTypeKind.Function) return true;
        if (astType.TypeKind == CS.CppAst.CppTypeKind.StructOrClass) return TSClass.isNotSupportedClass(generateContext, astType as CS.CppAst.CppClass);
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
                return `(...args: any[]) => ${new TSType(this.generateContext, func.ReturnType).name}`

            case CS.CppAst.CppTypeKind.TemplateArgumentType:
                if ((this.astType as CS.CppAst.CppTemplateArgument).ArgAsType)
                    return (new TSType(this.generateContext, (this.astType as CS.CppAst.CppTemplateArgument).ArgAsType)).name
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
                } else {
                    if (cppName == 'std::string')
                        return 'string'
                    return cppName;
                }

            case CS.CppAst.CppTypeKind.Primitive:
                if (cppName.startsWith('unsigned ')) cppName = cppName.replace('unsigned ', '');
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
                    case 'wchar': return 'string';
                    case 'wchar_t': return 'string';
                    case 'char16_t': return 'string';
                    case 'char32_t': return 'string';
                    case 'size_t': return 'number';
                    case 'long long': return 'bigint';
                    default: throw new Error(`unknown primitive type ${this.cppName}`);
                }
            case CS.CppAst.CppTypeKind.StructOrClass:
                if (this.generateContext.specialTSNames[cppName]) return this.generateContext.specialTSNames[cppName];
                const cls = this.astType as CS.CppAst.CppClass;
                if (cls.TemplateKind == CS.CppAst.CppTemplateKind.NormalClass) {
                    return cppName
                }
                // std::function will be handled as a jsfunction
                if (cls.FullParentName == 'std' && cls.Name == 'function') {
                    return new TSType(this.generateContext, cls.TemplateSpecializedArguments.get_Item(0)).name
                }
                return `any`

            default:
                return cppName
        }
    }
    public readonly cppName: string;
    public readonly isPrimitive: boolean;
    public readonly elemType: TSType | undefined;

    constructor(
        private readonly generateContext: GenerateContext,
        public readonly astType: CS.CppAst.CppType
    ) {
        this.cppName = astType.FullName;
        // It may be a bug of cppast.net
        if (this.cppName.indexOf('std::function') != -1 && this.cppName.indexOf('(*)') != -1) {
            this.cppName = this.cppName.replace('(*)', '');
        }

        this.astType = astType;
        this.isPrimitive = astType.TypeKind == CS.CppAst.CppTypeKind.Primitive;
        if ([
            CS.CppAst.CppTypeKind.Array,
            CS.CppAst.CppTypeKind.Pointer,
            CS.CppAst.CppTypeKind.Qualified,
            CS.CppAst.CppTypeKind.Reference,
            CS.CppAst.CppTypeKind.Typedef,
        ].indexOf(astType.TypeKind) != -1) {
            this.elemType = new TSType(this.generateContext, TSType.getUnderlyingType(astType));
        }
    }

    public get rawType(): TSType {
        return this.elemType ? this.elemType.rawType : this;
    }
}

class TSVariable {
    public static isNotSupportedVariable(generateContext: GenerateContext, astField: CS.CppAst.CppField) {
        let astType = astField.Type;
        if (astField.Visibility != CS.CppAst.CppVisibility.Public) return true;
        if (astField.IsBitField || astField.IsAnonymous) return true;
        if (TSType.isNotSupportedTypeForInterop(generateContext, astType)) return true;
        if (checkExclude(astField, generateContext.refExclude)) return true;
        return false;
    }
    public static isNotSupportedParameter(generateContext: GenerateContext, astParam: CS.CppAst.CppParameter) {
        if (TSType.isNotSupportedTypeForInterop(generateContext, astParam.Type)) return true;
        return false;
    }
    public readonly name: string;
    public readonly isStatic: boolean;
    public readonly isReadOnly: boolean;
    public readonly type: TSType;
    public readonly defaultExpressionCpp: string = '';
    public readonly defaultExpressionTS: string = '';
    constructor(
        private readonly generateContext: GenerateContext,
        public readonly astField: CS.CppAst.CppField | CS.CppAst.CppParameter,
        paramIndex: number = 0
    ) {
        if (astField instanceof CS.CppAst.CppParameter) {
            const astParam = astField;
            this.name = astParam.Name || ('arg' + paramIndex);
            this.isStatic = false
            this.isReadOnly = astParam.Type.TypeKind == CS.CppAst.CppTypeKind.Qualified;
            this.type = new TSType(this.generateContext, astParam.Type);
            if (astParam.InitExpression) {
                // const initValueInStr = astParam.InitValue == null ? astParam.InitExpression.toString() : astParam.InitValue.toString();
                const initValueInStr = astParam.InitValue == null ? astParam.InitExpression.toString() : astParam.InitValue.toString();

                // if (this.name == 'authLen') {
                // if (this.name == 'config') {
                //     console.log(this.name, 'astParam.InitExpression.Kind', astParam.InitExpression.Kind, astParam.InitExpression.toString())
                // }
                // console.log(astParam.Name, astParam.InitExpression.Kind, astParam.InitExpression.toString(), astParam.InitValue?.toString())
                // default value in ts
                switch (astParam.InitExpression.Kind) {
                    case CS.CppAst.CppExpressionKind.DeclRef:
                    case CS.CppAst.CppExpressionKind.Call:
                        if (astParam.InitValue != null) {
                            this.defaultExpressionTS = initValueInStr;

                        } else {
                            // todo need namespace finding
                            // const raw = astParam.InitExpression as CS.CppAst.CppRawExpression;
                            // this.defaultExpressionTS = 'SC.' + initValueInStr.split('::').join('.');
                            this.defaultExpressionTS = '';
                        }
                        break;
                    case CS.CppAst.CppExpressionKind.Unexposed:
                        this.defaultExpressionTS = initValueInStr == "NA" ? '""' : initValueInStr
                        break;
                    default:
                        this.defaultExpressionTS = initValueInStr;
                        break;
                }
                if (this.defaultExpressionTS == 'nullptr') this.defaultExpressionTS = 'null';
                if (this.defaultExpressionTS.length == 1 && this.defaultExpressionTS.charCodeAt(0) == 1) this.defaultExpressionTS = '';
                
                // default value in cpp
                if (!this.defaultExpressionTS) {
                    this.defaultExpressionCpp = '';

                } else if (this.type.astType.TypeKind == CS.CppAst.CppTypeKind.Enum && astParam.InitValue) {
                    this.defaultExpressionCpp = `(${this.type.astType.FullName})${astParam.InitValue}`;

                } else if (this.type.rawType.name == "boolean" && astParam.InitValue) {
                    this.defaultExpressionCpp = initValueInStr == '0' ? 'false' : 'true';

                } else if (
                    astParam.InitExpression.toString().match(/\.\d*f$/)
                ) {
                    this.defaultExpressionCpp = astParam.InitExpression.toString();

                } else if (
                    !this.type.isPrimitive &&
                    this.type.astType.TypeKind == CS.CppAst.CppTypeKind.Reference &&
                    astParam.InitExpression.Kind == CS.CppAst.CppExpressionKind.Unexposed
                ) {
                    // for creating const String& by ""
                    this.defaultExpressionCpp = `${this.type.rawType.cppName}(${initValueInStr})`;

                } else {
                    this.defaultExpressionCpp = this.defaultExpressionTS;
                }
            }

        } else if (astField instanceof CS.CppAst.CppField) {
            this.name = astField.Name;
            this.isStatic = astField.StorageQualifier == CS.CppAst.CppStorageQualifier.Static;
            this.isReadOnly = astField.Type.TypeKind == CS.CppAst.CppTypeKind.Qualified;
            this.type = new TSType(this.generateContext, astField.Type);

        } else {
            throw new Error("not supported");
        }
    }
}
class TSOverload {
    public static isNotSupportedFunction(generateContext: GenerateContext, astFunction: CS.CppAst.CppFunction) {
        if (astFunction.Visibility != CS.CppAst.CppVisibility.Public) return true;
        if (TSType.isNotSupportedTypeForInterop(generateContext, astFunction.ReturnType)) {
            return true;
        }
        if (astFunction.Flags & CS.CppAst.CppFunctionFlags.Variadic) return true;
        if (astFunction.Flags & CS.CppAst.CppFunctionFlags.Deleted) return true;
        if (astFunction.TemplateParameters.Count > 0) return true;
        if (csWhere(astFunction.Parameters, (param: CS.CppAst.CppParameter) => {
            return TSType.isNotSupportedTypeForInterop(generateContext, param.Type)
        })) return true;
        if (checkExclude(astFunction, generateContext.refExclude)) return true;
        return false;
    }
    public readonly returnType: TSType;
    public readonly params: TSVariable[] = [];
    public readonly name: string;
    public readonly isStatic: boolean;
    public readonly isConst: boolean;
    constructor(
        private readonly generateContext: GenerateContext,
        public readonly astFunction: CS.CppAst.CppFunction
    ) {
        this.returnType = new TSType(this.generateContext, astFunction.ReturnType);
        this.name = astFunction.Name;
        this.isStatic = astFunction.IsStatic;
        this.isConst = astFunction.IsConst;

        csForEach(
            astFunction.Parameters,
            (astParam: CS.CppAst.CppParameter, index: number) => {
                this.params.push(new TSVariable(this.generateContext, astParam, index));
            }
        )
    }
}
class TSFunction {
    public readonly overloads: TSOverload[] = [];

    constructor(
        private readonly generateContext: GenerateContext,
        public readonly name: string, public readonly isStatic: boolean, public readonly index: number
    ) { }

    public addFunction(func: TSOverload | CS.CppAst.CppFunction) {
        if (func instanceof CS.CppAst.CppFunction) {
            func = new TSOverload(this.generateContext, func);
        }
        this.overloads.push(func);
    }
}

class TSClass {
    public static isNotSupportedClass(generateContext: GenerateContext, astClass: CS.CppAst.CppClass) {
        if (astClass.Functions.Count == 0 && astClass.Fields.Count == 0 && astClass.Constructors.Count == 0) return true;
        if (astClass.Visibility > CS.CppAst.CppVisibility.Public) return true;
        if (astClass.IsAnonymous) return true;
        if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.PartialTemplateClass) return true;
        if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateClass) return true;
        if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateSpecializedClass) {
            return !astClass.FullName.startsWith('std::function');
        }
        if (checkExclude(astClass, generateContext.refExclude)) return true;
        return false;
    }
    public readonly cppFullName: string;
    public readonly baseTypeCppFullName: string;
    public readonly functions: TSFunction[] = [];
    public readonly ctor: TSFunction;
    public readonly fields: TSVariable[] = [];
    private findOrAddOverload(name: string, isStatic: boolean): TSFunction {
        let overload = this.functions.find(
            (overload) => overload.name == name && overload.isStatic == isStatic
        );
        if (!overload) {
            overload = new TSFunction(this.generateContext, name, isStatic, this.functions.length);
            this.functions.push(overload);
        }
        return overload;
    }
    constructor(
        private readonly generateContext: GenerateContext,
        public readonly astClass: CS.CppAst.CppClass
    ) {
        // if (astClass.FullName.endsWith("::")) console.log(astClass.IsAnonymous, astClass.FullName)
        this.cppFullName = astClass.FullName;
        this.baseTypeCppFullName = astClass.BaseTypes.Count > 0 ? astClass.BaseTypes.get_Item(0).Type.FullName : "";

        this.ctor = new TSFunction(this.generateContext, 'constructor', false, 0);
        if (!this.astClass.IsAbstract)
            csForEach(this.astClass.Constructors, (astFunction: CS.CppAst.CppFunction) => {
                if (TSOverload.isNotSupportedFunction(this.generateContext, astFunction)) return;
                this.ctor.addFunction(astFunction);
            })
    }
    public addAllMember() {
        csForEach(this.astClass.Functions, (astFunction: CS.CppAst.CppFunction) => {
            if (TSOverload.isNotSupportedFunction(this.generateContext, astFunction)) return;
            const overload = this.findOrAddOverload(astFunction.Name, astFunction.IsStatic);
            overload.addFunction(astFunction);
        });
        csForEach(this.astClass.Fields, (astField: CS.CppAst.CppField) => {
            if (TSVariable.isNotSupportedVariable(this.generateContext, astField)) return;
            this.fields.push(new TSVariable(this.generateContext, astField));
        });
    }
    public addMember(signature: string) {
        const sign = signature.split(':').pop();

        if (sign == this.astClass.Name) {
            // ignore constructor

        } else if (sign == '~' + this.astClass.Name) {
            // ignore destructor

        } else {
            csForEach(this.astClass.Functions, (astFunction: CS.CppAst.CppFunction) => {
                if (astFunction.Name != sign) return;
                if (TSOverload.isNotSupportedFunction(this.generateContext, astFunction)) return;
                const overload = this.findOrAddOverload(astFunction.Name, astFunction.IsStatic);
                overload.addFunction(astFunction);
            });
            csForEach(this.astClass.Fields, (astField: CS.CppAst.CppField) => {
                if (astField.Name != sign) return;
                if (TSVariable.isNotSupportedVariable(this.generateContext, astField)) return;
                this.fields.push(new TSVariable(this.generateContext, astField));
            });
        }
    }
}
class TSEnum {
    public readonly enums: { [name: string]: number } = {};
    public readonly name: string;
    public readonly cppFullName: string;
    
    constructor(
        private readonly generateContext: GenerateContext,
        public readonly astEnum: CS.CppAst.CppEnum
    ) {
        csForEach(astEnum.Items, (astEnumItem: CS.CppAst.CppEnumItem) => {
            this.enums[astEnumItem.Name] = Number(astEnumItem.Value);
        })
        this.name = astEnum.Name;
        this.cppFullName = astEnum.FullName;
    }
}

export {
    TSEnum,
    TSClass,
    TSFunction,
    TSOverload,
    TSVariable,
    TSType
}