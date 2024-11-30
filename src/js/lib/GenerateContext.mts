import { csForEach } from "./util.mjs";
import { TSClass, TSEnum } from "./definitions.mjs";
import { isNotSupportedClass } from "./SupportChecks.mjs";

export interface GenerateBlackList {
    namespaces: string[]
    types: string[]
    members: string[]
}

export default class GenerateContext {
    private readonly usedCls: Map<CS.CppAst.CppClass, TSClass> = new Map();
    private readonly usedEnum: Map<CS.CppAst.CppEnum, TSEnum> = new Map();
    public readonly refExclude: GenerateBlackList;
    public readonly genExclude: GenerateBlackList;
    public readonly specialTSNames: { [key: string]: string } = {};
    constructor(
        private readonly compilation: CS.CppAst.CppCompilation,
        refExclude?: GenerateBlackList,
        genExclude?: GenerateBlackList,
        specialTSName?: { [key: string]: string }
    ) {
        this.refExclude = refExclude || { types: [], members: [], namespaces: [] };
        this.refExclude.types = this.refExclude.types || [];
        this.refExclude.members = this.refExclude.members || [];
        this.refExclude.namespaces = this.refExclude.namespaces || [];
        this.genExclude = genExclude || { types: [], members: [], namespaces: [] };
        this.genExclude.types = this.genExclude.types || [];
        this.genExclude.members = this.genExclude.members || [];
        this.genExclude.namespaces = this.genExclude.namespaces || [];
        this.specialTSNames = specialTSName || {};
    }
    private findAstNamespace(namespaces: string[]) {
        let findingName = namespaces.shift();
        let currentNamespace: CS.CppAst.CppCompilation | CS.CppAst.CppNamespace | CS.CppAst.CppClass = this.compilation;
        while (namespaces.length != 0) {
            let matchedNamespace: CS.CppAst.CppCompilation | CS.CppAst.CppNamespace | CS.CppAst.CppClass | null = null;
            if (currentNamespace.Namespaces) csForEach(currentNamespace.Namespaces, (item) => {
                if (item.Name == findingName) matchedNamespace = item;
            });
            if (!matchedNamespace && currentNamespace.Classes) csForEach(currentNamespace.Classes, (cls) => {
                if (cls.Name == findingName) matchedNamespace = cls;
            });

            if (!matchedNamespace) {
                console.warn(`find ${findingName} failed`)
                return null;
            }
            currentNamespace = matchedNamespace;
            findingName = namespaces.shift();
        }

        return {
            ns: currentNamespace,
            lastItemName: findingName
        }
    }
    public findAstEnum(enumFullName: string): CS.CppAst.CppEnum | null {
        let result: CS.CppAst.CppEnum | null = null;

        const nsResult = this.findAstNamespace(enumFullName.split("::"));
        if (!nsResult) return null;
        const {
            ns,
            lastItemName
        } = nsResult

        csForEach(ns.Enums, (cls: CS.CppAst.CppEnum) => {
            if (cls.Name == lastItemName) result = cls;
        });
        return result;
    }
    public findAstClass(clsFullName: string): CS.CppAst.CppClass | null {
        let result: CS.CppAst.CppClass | null = null;

        const nsResult = this.findAstNamespace(clsFullName.split("::"));
        if (!nsResult) return null;
        const {
            ns,
            lastItemName
        } = nsResult

        csForEach(ns.Classes, (cls: CS.CppAst.CppClass) => {
            if (cls.Name == lastItemName) result = cls;
        });
        return result;
    }
    public getAllUsedCls() {
        return this.usedCls.values();
    }
    public getAllUsedEnum() {
        return this.usedEnum.values();
    }
    public getAllHeaders() {
        const headers = [];
        for (const astCls of this.usedCls.keys()) {
            let header = astCls.SourceFile;
            // sometime the class will define as incomplete type. so we need to find the first member to get the real header path
            if (astCls.Fields.Count) { header = astCls.Fields.get_Item(0).SourceFile; }
            else if (astCls.Functions.Count) { header = astCls.Functions.get_Item(0).SourceFile; }
            else if (astCls.Constructors.Count) { header = astCls.Constructors.get_Item(0).SourceFile; }
            if (header) headers.push(header);
        }
        return headers;
    }

    public expandCurrentUsage() {
        const addRefUsage = (name: string) => {
            const astClass = this.findAstClass(name);

            if (astClass) {
                if (!this.usedCls.has(astClass)) {
                    if (isNotSupportedClass(this, astClass)) return;
                    let tsCls = new TSClass(this, astClass)
                    this.usedCls.set(astClass, tsCls);
                    return tsCls

                    // template not supported yet
                    // if (astClass.TemplateKind == CS.CppAst.CppTemplateKind.TemplateSpecializedClass) {
                    //     csForEach(astClass.TemplateSpecializedArguments, item => {
                    //         if (item.TypeKind == CS.CppAst.CppTypeKind.Function) return;
                    //         this.addRefUsage(item.FullName);
                    //     })
                    // }
                }
                return
            }
            const astEnum = this.findAstEnum(name);
            if (astEnum) {
                if (!this.usedEnum.has(astEnum)) {
                    let tsEnum = new TSEnum(this, astEnum)
                    this.usedEnum.set(astEnum, tsEnum);
                    // return tsEnum
                }
                return
            }
            console.warn(`can't find class ${name} in compilation`);
        }
        for (const cls of this.usedCls.values()) {
            cls.baseTypeCppFullName && addRefUsage(cls.baseTypeCppFullName);
            cls.ctor.overloads.forEach((func) => {
                const type = func.returnType.rawType;
                if (!type.isPrimitive) addRefUsage(type.cppName)

                func.params.forEach((param) => {
                    const type = param.type.rawType;
                    if (!type.isPrimitive) addRefUsage(type.cppName)

                    if (param.astField.InitExpression && param.astField.InitExpression.Kind == CS.CppAst.CppExpressionKind.DeclRef) {
                        const dvCls = addRefUsage(param.astField.InitExpression.toString().split('::').slice(0, -1).join('::'));
                        if (dvCls) dvCls.addMember(param.astField.InitExpression.toString().split('::').slice(-1)[0]);
                    }
                })
            })
            cls.fields.forEach((field) => {
                const type = field.type.rawType;
                if (!type.isPrimitive) addRefUsage(type.cppName)
            })
            cls.functions.forEach((overload) => {
                overload.overloads.forEach((func) => {
                    const type = func.returnType.rawType;
                    if (!type.isPrimitive) addRefUsage(type.cppName)

                    func.params.forEach((param) => {
                        const type = param.type.rawType;
                        if (!type.isPrimitive) addRefUsage(type.cppName)

                        if (param.astField.InitExpression && param.astField.InitExpression.Kind == CS.CppAst.CppExpressionKind.DeclRef) {
                            const dvCls = addRefUsage(param.astField.InitExpression.toString().split('::').slice(0, -1).join('::'));
                            if (dvCls) dvCls.addMember(param.astField.InitExpression.toString().split('::').slice(-1)[0]);
                        }
                    })
                });
            });
        }

    }
    public addBaseUsage(signature: string) {
        const name = signature.split('::').slice(0, -1).join('::');
        const astClass = this.findAstClass(name);

        if (astClass) {
            if (!this.usedCls.has(astClass)) {
                if (isNotSupportedClass(this, astClass)) return;
                this.usedCls.set(astClass, new TSClass(this, astClass));
            }
            const cls = this.usedCls.get(astClass) as TSClass;
            if (signature.endsWith("::*")) {
                cls.addAllMember();
            } else {
                cls.addMember(signature);
            }
            return;
        }
        const astEnum = this.findAstEnum(name);
        if (astEnum) {
            if (!this.usedEnum.has(astEnum)) {
                this.usedEnum.set(astEnum, new TSEnum(this, astEnum))
            }
            return
        }
        console.warn(`can't find class ${name} in compilation`);
    }

    public findAllClass() {
        this.iterateNamespace(this.compilation)
    }
    private iterateNamespace(namespace: CS.CppAst.CppCompilation | CS.CppAst.CppNamespace | CS.CppAst.CppClass) {
        if (namespace.Classes) csForEach(namespace.Classes, (astClass: CS.CppAst.CppClass) => {
            if (!this.usedCls.has(astClass)) {
                if (isNotSupportedClass(this, astClass)) return;
                const tsCls = new TSClass(this, astClass)
                this.usedCls.set(astClass, tsCls);
                tsCls.addAllMember();
            }

            this.iterateNamespace(astClass);
        });
        if (namespace.Enums) csForEach(namespace.Enums, (cls: CS.CppAst.CppEnum) => {
            this.usedEnum.set(cls, new TSEnum(this, cls));
        });
        if (!(namespace instanceof CS.CppAst.CppClass) && namespace.Namespaces) csForEach(namespace.Namespaces, (item) => {
            this.iterateNamespace(item)
        });
    }
}