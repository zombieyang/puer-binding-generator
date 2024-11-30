import { TSType } from "./definitions.mjs";
import GenerateContext from "./GenerateContext.mjs";
import { PRINT } from "./globalConfig.mjs";
import { checkExclude, csWhere } from "./util.mjs";

export function getUnderlyingType(astType: CS.CppAst.CppType) {
    return (astType as CS.CppAst.CppTypeWithElementType).ElementType;
}


export function isNotSupportedTypeForBinding(type: TSType | CS.CppAst.CppType) {
    if (type instanceof TSType) type = type.astType;
    if (type.TypeKind == CS.CppAst.CppTypeKind.Enum) {
        PRINT('isNotSupportedTypeForBinding', type.FullName, 'reason: Enum type');
        return true;
    }
    return false;
}

export function isNotSupportedType(generateContext: GenerateContext, astType: CS.CppAst.CppType) {
    let lastKind = null;
    while ([
        CS.CppAst.CppTypeKind.Array,
        CS.CppAst.CppTypeKind.Pointer,
        CS.CppAst.CppTypeKind.Qualified,
        CS.CppAst.CppTypeKind.Reference,
        CS.CppAst.CppTypeKind.Typedef,
    ].indexOf(astType.TypeKind) != -1) {
        if (
            (lastKind == CS.CppAst.CppTypeKind.Array || lastKind == CS.CppAst.CppTypeKind.Pointer) &&
            (astType.TypeKind == CS.CppAst.CppTypeKind.Array || astType.TypeKind == CS.CppAst.CppTypeKind.Pointer)
        ) {
            PRINT('isNotSupportedType', astType.FullName, 'reason: Double pointer/array not supported');
            return true;
        }
        lastKind = astType.TypeKind;
        astType = getUnderlyingType(astType);
    }

    if (astType.TypeKind == CS.CppAst.CppTypeKind.Unexposed) {
        PRINT('isNotSupportedType', astType.FullName, 'reason: Unexposed type');
        return true;
    }
    if (astType.FullName.startsWith('std') && 
        astType.FullName.indexOf('function') == -1 && 
        astType.FullName.indexOf('string') == -1) {
        PRINT('isNotSupportedType', astType.FullName, 'reason: Unsupported STL type');
        return true;
    }
    if (astType.TypeKind == CS.CppAst.CppTypeKind.Function) {
        PRINT('isNotSupportedType', astType.FullName, 'reason: Function type');
        return true;
    }
    if (astType.TypeKind == CS.CppAst.CppTypeKind.StructOrClass) {
        return isNotSupportedClass(generateContext, astType as CS.CppAst.CppClass);
    }
    return false;
}

export function isNotSupportedClass(generateContext: GenerateContext, astClass: CS.CppAst.CppClass) {
    if (astClass.Functions.Count == 0 && astClass.Fields.Count == 0 && astClass.Constructors.Count == 0) {
        PRINT('isNotSupportedClass', astClass.FullName, 'reason: Empty class');
        return true;
    }
    if (astClass.Visibility > CS.CppAst.CppVisibility.Public) {
        PRINT('isNotSupportedClass', astClass.FullName, 'reason: Non-public visibility');
        return true;
    }
    if (astClass.IsAnonymous) {
        PRINT('isNotSupportedClass', astClass.FullName, 'reason: Anonymous class');
        return true;
    }
    if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.PartialTemplateClass) {
        PRINT('isNotSupportedClass', astClass.FullName, 'reason: Partial template class');
        return true;
    }
    if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateClass) {
        PRINT('isNotSupportedClass', astClass.FullName, 'reason: Template class');
        return true;
    }
    if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateSpecializedClass) {
        if (!astClass.FullName.startsWith('std::function')) {
            PRINT('isNotSupportedClass', astClass.FullName, 'reason: TemplateSpecialized template class (non-std::function)');
            return true;
        }
    }
    if (checkExclude(astClass, generateContext.refExclude)) {
        PRINT('isNotSupportedClass', astClass.FullName, 'reason: Excluded by configuration');
        return true;
    }
    return false;
}

export function isNotSupportedVariable(generateContext: GenerateContext, astField: CS.CppAst.CppField) {
    let astType = astField.Type;
    if (astField.Visibility != CS.CppAst.CppVisibility.Public) {
        PRINT('isNotSupportedVariable', astField.Name, 'reason: Non-public visibility');
        return true;
    }
    if (astField.IsBitField || astField.IsAnonymous) {
        PRINT('isNotSupportedVariable', astField.Name, 'reason: BitField or Anonymous');
        return true;
    }
    if (isNotSupportedTypeForInterop(generateContext, astType)) {
        PRINT('isNotSupportedVariable', astField.Name, 'reason: Unsupported type for interop');
        return true;
    }
    if (checkExclude(astField, generateContext.refExclude)) {
        PRINT('isNotSupportedVariable', astField.Name, 'reason: Excluded by configuration');
        return true;
    }
    return false;
}

export function isNotSupportedParameter(generateContext: GenerateContext, astParam: CS.CppAst.CppParameter) {
    if (isNotSupportedTypeForInterop(generateContext, astParam.Type)) {
        PRINT('isNotSupportedParameter', astParam.Name, 'reason: Unsupported type for interop');
        return true;
    }
    return false;
}

export function isNotSupportedFunction(generateContext: GenerateContext, astFunction: CS.CppAst.CppFunction) {
    if (astFunction.Visibility != CS.CppAst.CppVisibility.Public) {
        PRINT('isNotSupportedFunction', astFunction.Name, 'reason: Non-public visibility');
        return true;
    }
    if (isNotSupportedTypeForInterop(generateContext, astFunction.ReturnType)) {
        PRINT('isNotSupportedFunction', astFunction.Name, 'reason: Unsupported return type');
        return true;
    }
    if (astFunction.Flags & CS.CppAst.CppFunctionFlags.Variadic) {
        PRINT('isNotSupportedFunction', astFunction.Name, 'reason: Variadic function');
        return true;
    }
    if (astFunction.Flags & CS.CppAst.CppFunctionFlags.Deleted) {
        PRINT('isNotSupportedFunction', astFunction.Name, 'reason: Deleted function');
        return true;
    }
    if (astFunction.TemplateParameters.Count > 0) {
        PRINT('isNotSupportedFunction', astFunction.Name, 'reason: Template parameters');
        return true;
    }
    if (csWhere(astFunction.Parameters, (param: CS.CppAst.CppParameter) => {
        return isNotSupportedTypeForInterop(generateContext, param.Type)
    })) {
        PRINT('isNotSupportedFunction', astFunction.Name, 'reason: Unsupported parameter type');
        return true;
    }
    if (checkExclude(astFunction, generateContext.refExclude)) {
        PRINT('isNotSupportedFunction', astFunction.Name, 'reason: Excluded by configuration');
        return true;
    }
    return false;
}

export function isNotSupportedTypeForInterop(generateContext: GenerateContext, astType: CS.CppAst.CppType) {
    // if ((globalThis as any).zombietest) console.log('zombietest', astType.FullName, astType.TypeKind, this.getUnderlyingType(astType).TypeKind);
    while (astType.TypeKind == CS.CppAst.CppTypeKind.Qualified ||
        astType.TypeKind == CS.CppAst.CppTypeKind.Typedef) {
        astType = getUnderlyingType(astType);
    }

    if (astType.TypeKind == CS.CppAst.CppTypeKind.StructOrClass) {
        // return !generateContext.specialTSNames[astType.FullName]
        if (!generateContext.specialTSNames[astType.FullName]) {
            PRINT('isNotSupportedTypeForInterop', astType.FullName, 'reason: StructOrClass without ref or pointer');
            return true;
            
        } else {
            PRINT('SupportedTypeForInterop', astType.FullName, 'reason: StructOrClass but in specialTSNames');
            return false;
        }
    }
    if (astType.TypeKind == CS.CppAst.CppTypeKind.Reference) {
        let underlyingType = getUnderlyingType(astType)
        let isQualified = underlyingType.TypeKind == CS.CppAst.CppTypeKind.Qualified;
        while (underlyingType.TypeKind == CS.CppAst.CppTypeKind.Qualified ||
            underlyingType.TypeKind == CS.CppAst.CppTypeKind.Typedef) {
            underlyingType = getUnderlyingType(underlyingType);
        }
        if (!isQualified) {
            PRINT('isNotSupportedTypeForInterop', astType.FullName, 'reason: Reference without const');
            return true;
        }
        if (isNotSupportedType(generateContext, underlyingType)) {
            PRINT('isNotSupportedTypeForInterop', astType.FullName, 'reason: Reference with unsupported underlying type');
            return true;
        }
        return false;
    }

    if (astType.TypeKind == CS.CppAst.CppTypeKind.Array && !astType.FullName.startsWith("char")) {
        PRINT('isNotSupportedTypeForInterop', astType.FullName, 'reason: Non-char array');
        return true;
    }

    if (astType.TypeKind == CS.CppAst.CppTypeKind.Pointer) {
        let underlyingType = getUnderlyingType(astType);
        while (underlyingType.TypeKind == CS.CppAst.CppTypeKind.Qualified ||
            underlyingType.TypeKind == CS.CppAst.CppTypeKind.Typedef) {
            underlyingType = getUnderlyingType(underlyingType);
        }
        if (underlyingType.TypeKind != CS.CppAst.CppTypeKind.StructOrClass && underlyingType.FullName != 'char') {
            PRINT('isNotSupportedTypeForInterop', astType.FullName, 'reason: Pointer to non-class/non-char type');
            return true;
        }
    }
    return isNotSupportedType(generateContext, astType);
}